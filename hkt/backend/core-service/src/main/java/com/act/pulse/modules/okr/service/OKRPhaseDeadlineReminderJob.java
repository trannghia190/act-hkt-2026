package com.act.pulse.modules.okr.service;

import com.act.pulse.modules.attendance.repository.NotificationRepository;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.okr.entity.OKRCycle;
import com.act.pulse.modules.okr.entity.OKRReview;
import com.act.pulse.modules.okr.repository.OKRMidYearReviewRepository;
import com.act.pulse.modules.okr.repository.OKRReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * F9 — Tự nhắc trước hạn chót của từng phase (check-in có job riêng: {@link OKRCheckInReminderJob}).
 * Khi phase đang mở và còn ≤ {@link #REMIND_DAYS_BEFORE} ngày tới hạn, nhắc đúng người còn việc chưa xong:
 * <ul>
 *   <li>setup   → nhân viên chưa gửi OKR cho Quản lý duyệt</li>
 *   <li>midyear → Quản lý chưa lưu biên bản review giữa năm cho nhân viên</li>
 *   <li>final   → nhân viên chưa tự đánh giá; Quản lý còn hồ sơ chờ chấm</li>
 *   <li>summary → HR chưa chốt & khoá chu kỳ</li>
 * </ul>
 * Mỗi người tối đa 1 nhắc/ngày cho mỗi phase.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OKRPhaseDeadlineReminderJob {

    public static final int REMIND_DAYS_BEFORE = 3;

    private final OKRPhaseService phaseService;
    private final OKRManagementService management;
    private final OKRReviewRepository reviewRepository;
    private final OKRMidYearReviewRepository midYearRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final com.act.pulse.modules.notification.service.NotificationDispatcher notificationDispatcher;

    @Scheduled(cron = "0 5 8 * * *")
    public void remindPhaseDeadlines() {
        OKRCycle cycle = phaseService.cycle(null).orElse(null);
        if (cycle == null || phaseService.isCycleLocked(cycle)) return;
        try {
            remind(cycle);
        } catch (Exception e) {
            log.warn("Không gửi được nhắc hạn chót OKR cho chu kỳ {}", cycle.getId(), e);
        }
    }

    /** Tách riêng để gọi/kiểm thử thủ công. Trả về số thông báo đã tạo. */
    public int remind(OKRCycle cycle) {
        LocalDate today = LocalDate.now();
        List<OKRReview> reviews = reviewRepository.findByCycleYear(cycle.getCycleYear());
        Map<UUID, OKRReview> byUser = new HashMap<>();
        reviews.forEach(r -> byUser.put(r.getUserId(), r));
        int sent = 0;

        for (String key : List.of(OKRPhaseService.SETUP, OKRPhaseService.MIDYEAR, OKRPhaseService.FINAL)) {
            if (!phaseService.isOpen(cycle, key)) continue;
            LocalDate due = phaseService.dueDate(cycle, key);
            if (due == null) continue;
            long daysLeft = ChronoUnit.DAYS.between(today, due);
            if (daysLeft < 0 || daysLeft > REMIND_DAYS_BEFORE) continue;
            String when = "Còn " + daysLeft + " ngày (hạn " + due + ")";
            String type = "OKR_DEADLINE_" + key.toUpperCase();

            switch (key) {
                case OKRPhaseService.SETUP -> {
                    for (User u : workingUsers()) {
                        OKRReview r = byUser.get(u.getId());
                        String st = r == null ? "draft" : String.valueOf(r.getStatus()).toLowerCase();
                        if (st.equals("draft") || st.equals("returned") || st.equals("reopened")) {
                            sent += send(u.getId(), type, daysLeft, "Sắp hết hạn gửi OKR đầu năm",
                                    when + " để thiết lập 2 nhóm Business & People và gửi Quản lý duyệt.", "/okr/my-okr");
                        }
                    }
                }
                case OKRPhaseService.MIDYEAR -> {
                    Map<UUID, Integer> pendingByManager = new HashMap<>();
                    for (OKRReview r : reviews) {
                        if (r.getManagerId() == null || !management.isApproved(r)) continue;
                        if (midYearRepository.findByReviewId(r.getId()).isEmpty()) {
                            pendingByManager.merge(r.getManagerId(), 1, Integer::sum);
                        }
                    }
                    for (var e : pendingByManager.entrySet()) {
                        sent += send(e.getKey(), type, daysLeft, "Sắp hết hạn review giữa năm",
                                when + " — còn " + e.getValue() + " nhân viên chưa có biên bản review giữa năm.", "/okr/mid-year-review");
                    }
                }
                case OKRPhaseService.FINAL -> {
                    Map<UUID, Integer> pendingByManager = new HashMap<>();
                    int pendingTotal = 0;
                    for (OKRReview r : reviews) {
                        // cùng điều kiện với API tự đánh giá / chấm điểm
                        if (!management.isCurrentlyApproved(r)) continue;
                        if (!management.selfAssessed(r) || (r.getCurrentStep() != null && r.getCurrentStep() < 3)) {
                            pendingTotal++;
                            sent += send(r.getUserId(), type, daysLeft, "Sắp hết hạn tự đánh giá cuối năm",
                                    when + " để nộp đánh giá cuối năm (thành tựu công việc, thành tựu con người, định hướng năm sau).", "/okr/my-okr?section=assessment");
                        } else if (!management.managerAssessed(r) && r.getManagerId() != null) {
                            pendingTotal++;
                            pendingByManager.merge(r.getManagerId(), 1, Integer::sum);
                        }
                    }
                    for (var e : pendingByManager.entrySet()) {
                        sent += send(e.getKey(), type, daysLeft, "Sắp hết hạn chấm điểm cuối năm",
                                when + " — còn " + e.getValue() + " nhân viên đã tự đánh giá đang chờ bạn chấm.", "/okr/team-review");
                    }
                    // HR cần biết khối lượng còn tồn để kịp nghiệm thu/chốt chu kỳ.
                    if (pendingTotal > 0) {
                        for (User hr : userRepository.findByRoleIn(List.of("ADMIN", "HR_ADMIN"))) {
                            if (!isWorking(hr)) continue;
                            sent += send(hr.getId(), "OKR_DEADLINE_SUMMARY", daysLeft, "Sắp hết hạn tổng hợp OKR cuối năm",
                                    when + " — còn " + pendingTotal + " hồ sơ chưa hoàn tất đánh giá cuối năm.", "/okr/cycles");
                        }
                    }
                }
                default -> { }
            }
        }
        if (sent > 0) log.info("Đã gửi {} nhắc hạn chót OKR", sent);
        return sent;
    }

    private List<User> workingUsers() {
        return userRepository.findAll().stream().filter(this::isWorking)
                .filter(u -> !"ADMIN".equalsIgnoreCase(u.getRole())).toList();
    }

    private boolean isWorking(User u) {
        return !"RESIGNED".equalsIgnoreCase(u.getStatus()) && !"SUSPENDED".equalsIgnoreCase(u.getStatus());
    }

    /** Gửi 1 nhắc nếu hôm nay chưa nhắc cùng loại cho người này. */
    private int send(UUID userId, String type, long daysLeft, String title, String content, String url) {
        if (userId == null) return 0;
        LocalDate today = LocalDate.now();
        boolean sentToday = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .anyMatch(n -> type.equals(n.getType()) && n.getCreatedAt() != null
                        && n.getCreatedAt().toLocalDate().equals(today));
        if (sentToday) return 0;
        notificationDispatcher.dispatch(
                type,
                userId,
                title,
                content,
                type,
                daysLeft <= 1 ? "HIGH" : "MEDIUM",
                url,
                type + ":" + today);
        return 1;
    }
}
