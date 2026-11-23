package com.act.pulse.modules.notification.service;

import com.act.pulse.common.service.EmailService;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Gửi email theo kênh đã bật trong cấu hình tuỳ chỉnh của người dùng.
 * <p>Trước đây email gửi đi đường riêng ({@code sendRequestDecisionNotification}
 * chạy thẳng, không đọc prefs) nên tắt "email" trên UI không có tác dụng gì.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationEmailService {

    private final NotificationPreferenceService preferenceService;
    private final UserRepository userRepository;
    private final EmailService emailService;

    /**
     * Gửi email kết quả duyệt/từ chối đơn — chỉ gửi khi người nhận BẬT kênh email
     * cho sự kiện tương ứng.
     */
    public void sendRequestDecision(User recipient, String eventKey, String requestType,
                                     String decision, String approverName, String approverComment) {
        if (recipient == null || recipient.getEmail() == null || recipient.getEmail().isBlank()) return;
        var prefs = preferenceService.resolve(recipient.getId(), recipient.getRole());
        if (!prefs.channelEnabled(eventKey, "email")) {
            log.info("Bỏ qua email sự kiện {} cho {} (người dùng tắt kênh email)",
                    eventKey, recipient.getEmployeeCode());
            return;
        }
        try {
            emailService.sendRequestDecisionNotification(recipient.getEmail(), recipient.getFullName(),
                    "-", requestType, decision, approverName, approverComment);
        } catch (Exception ex) {
            log.warn("Gửi email quyết định đơn thất bại cho {}: {}", recipient.getEmployeeCode(), ex.getMessage());
        }
    }

    /**
     * Gửi email digest 08:00 gồm các mục bị dồn (push bị chặn bởi giờ yên lặng
     * hoặc vượt hạn mức push/ngày) + việc thật của user.
     *
     * @return số user đã gửi email
     */
    public int sendDeferredDigest(User user, List<Map<String, Object>> deferredTasks,
                                 Map<String, Object> leaveSummary) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) return 0;
        if (!emailService.isMailDeliverable()) return 0;
        try {
            boolean sent = emailService.sendDailyDigestEmail(user.getEmail(), user.getFullName(),
                    deferredTasks == null ? List.of() : deferredTasks,
                    leaveSummary == null ? Map.of() : leaveSummary);
            return sent ? 1 : 0;
        } catch (Exception ex) {
            log.warn("Gửi digest cho {} thất bại: {}", user.getEmployeeCode(), ex.getMessage());
            return 0;
        }
    }
}
