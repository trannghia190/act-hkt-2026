package com.act.pulse.modules.auth.service;

import com.act.pulse.modules.auth.dto.request.LoginRequest;
import com.act.pulse.modules.auth.dto.response.AuthResponse;

import java.util.Map;

public interface AuthService {
    AuthResponse login(LoginRequest request);
    void changePassword(String currentPassword, String newPassword);
    boolean changePasswordForUser(String employeeCode, String oldPassword, String newPassword);
    boolean enrollFace(String employeeCode, String faceDataUrl, Double confidenceScore);
    void sendPasswordResetOtp(String email);
    boolean testEmailConnection(String targetEmail, String testMessage);
    boolean configureSmtp(String host, int port, String username, String password);
    Map<String, Object> getSmtpStatus();
    void sendNotification(String toEmail, String fullName, String requestId, String requestType, String decision, String approverName, String approverComment);
}
