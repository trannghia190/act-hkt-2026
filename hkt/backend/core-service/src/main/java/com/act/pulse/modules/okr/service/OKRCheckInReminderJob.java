package com.act.pulse.modules.okr.service;

import com.act.pulse.modules.attendance.repository.NotificationRepository;
import com.act.pulse.modules.okr.entity.OKRCycle;
import com.act.pulse.modules.okr.entity.OKRReview;
import com.act.pulse.modules.okr.repository.OKRCheckInRepository;
import com.act.pulse.modules.okr.repository.OKRItemRepository;
import com.act.pulse.modules.okr.repository.OKRReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Nhắc check-in OKR theo TỪNG KỲ (tháng/quý theo cấu hình chu kỳ):
 * khi còn ≤ 3 ngày tới hạn kỳ hiện tại, nhắc những người có OKR đã duyệt mà chưa check-in kỳ này.
 * Mỗi người tối đa 1 nhắc/ngày.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OKRCheckInReminderJob {

    public static final int REMIND_DAYS_BEFORE = 3;

    private final OKRPhaseService phaseService;
    private final OKRManagementService management;
    private final OKRReviewRepository okrReviewRepository;
    private final OKRItemRepository okrItemRepository;
    private final OKRCheckInRepository checkInRepository;
    private final NotificationRepository notificationRepository;
    private final com.act.pulse.modules.notification.service.NotificationDispatcher notificationDispatcher;

    @Scheduled(cron = "0 0 8 * * *")
    public void remindUpcomingCheckIn() {
        OKRCycle cycle = phaseService.cycle(null).orElse(null);
        if (cycle == null) return;

        LocalDate today = LocalDate.now();
        String period = phaseService.currentPeriod(cycle);
        for (OKRReview review : okrReviewRepository.findByCycleYear(cycle.getCycleYear())) {
            if (phaseService.updateWindow(cycle, review) == null) continue; // cùng điều kiện với API check-in
            LocalDate deadline = phaseService.currentPeriodDeadline(cycle, review);
            long daysLeft = ChronoUnit.DAYS.between(today, deadline);
            if (daysLeft < 0 || daysLeft > REMIND_DAYS_BEFORE) continue;
            if (!management.isCurrentlyApproved(review)) continue; // cùng điều kiện với API check-in
            var items = okrItemRepository.findByReviewIdAndDeletedAtIsNullOrderById(review.getId());
            if (items.isEmpty()) continue;
            if (!checkInRepository.findByReviewIdAndPeriodOrderByCreatedAtDesc(review.getId(), period).isEmpty()) continue;

            // Chống trùng: 1 nhắc/ngày/kỳ (dispatcher cũng áp thêm cửa sổ dedupe của người dùng).
            boolean alreadySentToday = notificationRepository
                    .findByUserIdOrderByCreatedAtDesc(review.getUserId()).stream()
                    .anyMatch(n -> "OKR_CHECKIN_REMINDER".equals(n.getType())
                            && n.getCreatedAt() != null
                            && n.getCreatedAt().toLocalDate().equals(today));
            if (alreadySentToday) continue;

            notificationDispatcher.dispatch(
                    "OKR_CHECKIN_DUE",
                    review.getUserId(),
                    "Nhắc check-in OKR kỳ " + period,
                    "Còn " + daysLeft + " ngày đến hạn check-in kỳ " + period + " (" + deadline
                            + "). Cập nhật giá trị mới cho " + items.size() + " đầu việc.",
                    "OKR_CHECKIN_REMINDER",
                    daysLeft <= 1 ? "HIGH" : "MEDIUM",
                    "/okr/my-okr",
                    "okr-checkin:" + review.getId() + ":" + period);
        }
    }
}
