package com.act.pulse.modules.notification.service;

import com.act.pulse.modules.attendance.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Dọn thông báo đã đọc quá hạn lưu trữ để hộp thư không phình vô hạn.
 * <p>Chỉ xoá bản ghi {@code is_read = true}; thông báo chưa đọc luôn được giữ lại
 * bất kể cũ đến đâu. Số ngày cấu hình qua {@code app.notification.retention-days}.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationCleanupJob {

    private final NotificationRepository notificationRepository;

    @Value("${app.notification.retention-days:90}")
    private int retentionDays;

    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public int cleanup() {
        int days = Math.max(1, retentionDays);
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        int removed = notificationRepository.deleteReadOlderThan(cutoff);
        if (removed > 0) {
            log.info("Đã dọn {} thông báo đã đọc cũ hơn {} ngày", removed, days);
        }
        return removed;
    }
}
