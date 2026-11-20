package com.act.pulse.common.service;

import java.util.List;
import java.util.Map;

public interface EmailService {
    void sendAccountActivationEmail(String toEmail, String fullName, String employeeCode, String temporaryPassword);
    void sendPasswordResetEmail(String toEmail, String fullName, String resetToken);
    void sendPasswordChangedSuccessEmail(String toEmail, String fullName, String changeType);
    void sendRequestDecisionNotification(String toEmail, String fullName, String requestId, String requestType, String decision, String approverName, String approverComment);
    void sendDailyDigestEmail(String toEmail, String fullName, List<Map<String, Object>> tasks, Map<String, Object> leaveSummary);
    void sendSlaEscalationEmail(String toEmail, String managerName, String requestId, String employeeName, String requestType, long elapsedHours);
    boolean sendTestEmail(String toEmail, String message);
    boolean configureSmtp(String host, int port, String username, String password);
    boolean isSmtpConfigured();
    String getSenderEmail();
}
