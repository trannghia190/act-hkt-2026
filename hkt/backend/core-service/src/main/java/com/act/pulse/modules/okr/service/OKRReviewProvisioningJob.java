package com.act.pulse.modules.okr.service;

import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.okr.entity.OKRCycle;
import com.act.pulse.modules.okr.entity.OKRReview;
import com.act.pulse.modules.okr.repository.OKRReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Đầu kỳ OKR: hệ thống tự tạo hồ sơ OKR (bản nháp 2 nhóm Business / People) cho mọi nhân viên đang làm việc,
 * kèm thông báo — nhân viên tự điền và gửi Quản lý duyệt, không cần Quản lý/HR khởi tạo.
 * <ul>
 *   <li>Chạy khi khởi động app, 00:10 hằng ngày (bắt kịp nhân viên mới), và ngay khi HR lưu / mở lại chu kỳ.</li>
 *   <li>Chỉ tạo khi chu kỳ đang mở và phase Thiết lập đã tới ngày bắt đầu.</li>
 *   <li>Idempotent: người đã có hồ sơ năm đó thì bỏ qua (unique index user_id + cycle_year).</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OKRReviewProvisioningJob {

    private final OKRPhaseService phaseService;
    private final OKRManagementService management;
    private final OKRReviewRepository reviewRepository;
    private final UserRepository userRepository;

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        runSafely();
    }

    @Scheduled(cron = "0 10 0 * * *")
    public void daily() {
        runSafely();
    }

    private void runSafely() {
        try {
            phaseService.cycle(null).ifPresent(this::provision);
        } catch (Exception e) {
            log.warn("Không tự tạo được hồ sơ OKR đầu kỳ", e);
        }
    }

    /** Đã tới đầu kỳ chưa: chu kỳ đang mở và phase Thiết lập đã bắt đầu. */
    public boolean started(OKRCycle cycle) {
        if (cycle == null || phaseService.isCycleLocked(cycle)) return false;
        return phaseService.phase(cycle, OKRPhaseService.SETUP)
                .map(p -> !OKRPhaseService.UPCOMING.equals(p.get("effective_status")))
                .orElse(false);
    }

    public static boolean isWorkingEmployee(User u) {
        return u != null && !"RESIGNED".equalsIgnoreCase(u.getStatus()) && !"SUSPENDED".equalsIgnoreCase(u.getStatus())
                && !"ADMIN".equalsIgnoreCase(u.getRole());
    }

    /** Tạo hồ sơ cho 1 nhân viên nếu chưa có. Trả về hồ sơ (mới hoặc sẵn có), null nếu chưa tới đầu kỳ. */
    public OKRReview ensureFor(User user, OKRCycle cycle) {
        if (!isWorkingEmployee(user) || !started(cycle)) return null;
        OKRReview existing = reviewRepository.findByUserIdAndCycleYear(user.getId(), cycle.getCycleYear()).orElse(null);
        if (existing != null) return existing;
        OKRReview review;
        try {
            review = reviewRepository.save(OKRReview.builder()
                    .userId(user.getId())
                    .managerId(user.getManagerId())
                    .cycleId(cycle.getId())
                    .cycleYear(cycle.getCycleYear())
                    .status("draft")
                    .currentStep(1)
                    .build());
        } catch (org.springframework.dao.DataIntegrityViolationException race) {
            return reviewRepository.findByUserIdAndCycleYear(user.getId(), cycle.getCycleYear()).orElse(null);
        }
        management.audit(review.getId(), cycle.getId(), null, "AUTO_CREATE", "status", null, "draft",
                "Hệ thống tạo hồ sơ OKR đầu kỳ " + cycle.getCycleYear());
        // Chỉ nhắc khi nhân viên sửa được ngay (phase Thiết lập đang mở hoặc người mới vào sau hạn)
        if (management.goalsLockReason(user, review, cycle) == null) {
            var due = phaseService.dueDate(cycle, OKRPhaseService.SETUP);
            management.notify(user.getId(), "OKR năm " + cycle.getCycleYear() + " đã mở",
                    "Hãy thiết lập 2 nhóm Business & People và gửi Quản lý duyệt"
                            + (due != null && !management.isLateJoiner(user, cycle) ? " trước " + due : "") + ".",
                    "OKR_SETUP_OPEN", "/okr/my-okr");
        }
        return review;
    }

    /** Tạo hồ sơ cho mọi nhân viên chưa có. Trả về số hồ sơ mới. */
    public int provision(OKRCycle cycle) {
        if (!started(cycle)) return 0;
        Set<UUID> withReview = new HashSet<>();
        reviewRepository.findByCycleYear(cycle.getCycleYear()).forEach(r -> withReview.add(r.getUserId()));
        int created = 0;
        for (User u : userRepository.findAll()) {
            if (withReview.contains(u.getId()) || !isWorkingEmployee(u)) continue;
            if (ensureFor(u, cycle) != null) created++;
        }
        if (created > 0) log.info("Đã tự tạo {} hồ sơ OKR đầu kỳ {}", created, cycle.getCycleYear());
        return created;
    }
}
