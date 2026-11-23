package com.act.pulse.common.service;

import java.util.List;
import java.util.Map;

public interface EmailService {
    boolean sendAccountActivationEmail(String toEmail, String fullName, String employeeCode, String temporaryPassword);
    boolean sendPasswordResetEmail(String toEmail, String fullName, String resetToken);
    boolean sendPasswordChangedSuccessEmail(String toEmail, String fullName, String changeType);
    void sendRequestDecisionNotification(String toEmail, String fullName, String requestId, String requestType, String decision, String approverName, String approverComment);
    /**
     * Gửi email thông báo tổng quát theo kênh (dùng cho mọi sự kiện có bật email).
     * @param actionUrl liên kết tới màn hình xử lý trong hệ thống
     */
    boolean sendEventEmail(String toEmail, String fullName, String title, String content, String actionUrl);
    /**
     * Gửi email digest 08:00.
     * @return true nếu email đã gửi được (hoặc đã ghi ra log ở chế độ dev)
     */
    boolean sendDailyDigestEmail(String toEmail, String fullName, List<Map<String, Object>> tasks, Map<String, Object> leaveSummary);
    void sendSlaEscalationEmail(String toEmail, String managerName, String requestId, String employeeName, String requestType, long elapsedHours);
    boolean sendTestEmail(String toEmail, String message);
    boolean configureSmtp(String host, int port, String username, String password);
    boolean isSmtpConfigured();
    /**
     * Có gửi được thư không: SMTP đã cấu hình, hoặc đang bật chế độ dev-log
     * (chưa có SMTP thì in nội dung email ra log và vẫn tính là đã gửi).
     */
    boolean isMailDeliverable();
    String getSenderEmail();
}
