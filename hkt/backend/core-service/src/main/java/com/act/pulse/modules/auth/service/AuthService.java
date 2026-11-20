package com.act.pulse.modules.auth.service;

import com.act.pulse.modules.auth.dto.request.LoginRequest;
import com.act.pulse.modules.auth.dto.response.AuthResponse;

import java.util.Map;
import java.util.UUID;

public interface AuthService {
    AuthResponse login(LoginRequest request);

    /** Làm mới access token từ refresh token còn hiệu lực. */
    AuthResponse refresh(String refreshToken);

    void changePassword(String currentPassword, String newPassword);

    boolean changePasswordForUser(String employeeCode, String oldPassword, String newPassword);

    boolean enrollFace(String employeeCode, String faceDataUrl, Double confidenceScore);

    boolean enrollFace(String employeeCode, String faceDataUrl, Double confidenceScore, float[] embedding);

    /** Reset / delete enrolled face profile for user. */
    boolean resetFace(String employeeCode);

    /** Thu hồi toàn bộ phiên của tài khoản (đổi mật khẩu / đăng xuất). */
    void revokeAllSessions(UUID userId, String reason);

    void sendPasswordResetOtp(String email);

    boolean testEmailConnection(String targetEmail, String testMessage);

    boolean configureSmtp(String host, int port, String username, String password);

    Map<String, Object> getSmtpStatus();

    void sendNotification(String toEmail, String fullName, String requestId, String requestType,
                          String decision, String approverName, String approverComment);
}
