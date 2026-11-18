package com.act.pulse.common.service;

public interface EmailService {
    void sendAccountActivationEmail(String toEmail, String fullName, String employeeCode, String temporaryPassword);
    void sendPasswordResetEmail(String toEmail, String fullName, String resetToken);
    void sendRequestDecisionNotification(String toEmail, String fullName, String requestId, String requestType, String decision, String approverName, String approverComment);
    boolean sendTestEmail(String toEmail, String message);
    boolean configureSmtp(String host, int port, String username, String password);
    boolean isSmtpConfigured();
    String getSenderEmail();
}
