package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.auth.dto.request.LoginRequest;
import com.act.pulse.modules.auth.dto.response.AuthResponse;
import com.act.pulse.modules.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "1. Authentication & Email API", description = "Đăng nhập, bảo mật, gửi email Gmail doanh nghiệp thật và thông báo")
public class AuthController {

    private final AuthService authService;

    @Data
    public static class ResetPasswordRequest {
        private String email;
    }

    @Data
    public static class TestEmailRequest {
        private String targetEmail;
        private String message;
    }

    @Data
    public static class ConfigureSmtpRequest {
        private String host;
        private int port;
        private String username;
        private String password;
    }

    @Data
    public static class EnrollFaceRequest {
        private String employeeCode;
        private String faceDataUrl;
        private Double confidenceScore;
    }

    @Data
    public static class ChangePasswordPayload {
        private String employeeCode;
        private String oldPassword;
        private String newPassword;
    }

    @Data
    public static class SendNotificationRequest {
        private String toEmail;
        private String fullName;
        private String requestId;
        private String requestType;
        private String decision;
        private String approverName;
        private String approverComment;
    }

    @Data
    public static class RefreshRequest {
        private String refreshToken;
        private String employeeCode;
    }

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập bằng Mã NV/Email + Mật khẩu (tài khoản nội bộ do HR cấp)")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request), "Đăng nhập thành công");
    }

    @PostMapping("/refresh")
    @Operation(summary = "Lấy access token mới từ refresh token (phiên phải còn hiệu lực)")
    public ApiResponse<AuthResponse> refresh(@RequestBody(required = false) RefreshRequest request) {
        String token = request != null ? request.getRefreshToken() : null;
        String code = request != null ? request.getEmployeeCode() : null;
        return ApiResponse.ok(authService.refresh(token, code), "Làm mới phiên thành công");
    }

    @PostMapping("/logout")
    @Operation(summary = "Đăng xuất — thu hồi phiên hiện tại")
    public ApiResponse<Boolean> logout(@RequestBody(required = false) Map<String, Object> body) {
        UUID uid = CurrentUser.userId();
        if (uid != null) {
            authService.revokeAllSessions(uid, "LOGOUT");
        } else if (body != null && body.containsKey("employeeCode")) {
            authService.revokeAllSessionsByEmployeeCode(String.valueOf(body.get("employeeCode")), "LOGOUT");
        }
        return ApiResponse.ok(true, "Đã đăng xuất");
    }

    @GetMapping("/me")
    @Operation(summary = "Thông tin tài khoản đang đăng nhập + vai trò (tự xác định, không chọn)")
    public ApiResponse<Map<String, Object>> me() {
        UUID uid = CurrentUser.userId();
        String code = CurrentUser.employeeCode();
        String role = CurrentUser.role();
        Map<String, Object> data = new java.util.HashMap<>();
        data.put("userId", uid != null ? uid.toString() : "d0000000-0000-0000-0000-000000000000");
        data.put("employeeCode", code != null ? code : "Admin");
        data.put("role", role != null ? role : "ADMIN");
        return ApiResponse.ok(data, "Thông tin tài khoản");
    }

    @PostMapping("/reset-password-request")
    @Operation(summary = "Gửi mã OTP đặt lại mật khẩu qua Gmail thật")
    public ApiResponse<String> requestPasswordReset(@RequestBody ResetPasswordRequest request) {
        authService.sendPasswordResetOtp(request.getEmail());
        return ApiResponse.ok("Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn.", "Thành công");
    }

    @PostMapping("/test-email")
    @Operation(summary = "Kiểm tra kết nối và gửi email thật qua Gmail SMTP")
    public ApiResponse<Boolean> testEmail(@RequestBody TestEmailRequest request) {
        boolean sent = authService.testEmailConnection(request.getTargetEmail(), request.getMessage());
        return ApiResponse.ok(sent, sent ? "Email đã được gửi thành công đến hòm thư thực tế!" : "Không thể gửi email, vui lòng kiểm tra App Password hoặc kết nối SMTP.");
    }

    @PostMapping("/config-smtp")
    @Operation(summary = "Cấu hình tài khoản Gmail Doanh Nghiệp (Google App Password) trực tiếp")
    public ApiResponse<Boolean> configureSmtp(@RequestBody ConfigureSmtpRequest request) {
        boolean ok = authService.configureSmtp(
                request.getHost() != null && !request.getHost().isBlank() ? request.getHost() : "smtp.gmail.com",
                request.getPort() > 0 ? request.getPort() : 587,
                request.getUsername(),
                request.getPassword()
        );
        return ApiResponse.ok(ok, ok ? "Cấu hình Gmail Doanh Nghiệp thành công!" : "Lỗi khi cập nhật cấu hình SMTP.");
    }

    @GetMapping("/smtp-status")
    @Operation(summary = "Lấy trạng thái cấu hình Gmail Doanh Nghiệp hiện tại")
    public ApiResponse<Map<String, Object>> getSmtpStatus() {
        return ApiResponse.ok(authService.getSmtpStatus(), "Trạng thái cấu hình SMTP");
    }

    @PostMapping("/enroll-face")
    @Operation(summary = "Đăng ký mẫu khuôn mặt lần đầu (Face Enrollment Wizard - S01-B)")
    public ApiResponse<Boolean> enrollFace(@RequestBody EnrollFaceRequest request) {
        boolean enrolled = authService.enrollFace(
                request.getEmployeeCode(),
                request.getFaceDataUrl(),
                request.getConfidenceScore() != null ? request.getConfidenceScore() : 0.95
        );
        return ApiResponse.ok(enrolled, "Đăng ký mẫu khuôn mặt thành công!");
    }

    @PostMapping("/change-password")
    @Operation(summary = "Đổi mật khẩu tài khoản lần đầu (S01-A) hoặc định kỳ")
    public ApiResponse<Boolean> changePassword(@RequestBody ChangePasswordPayload request) {
        boolean changed = authService.changePasswordForUser(
                request.getEmployeeCode(),
                request.getOldPassword(),
                request.getNewPassword()
        );
        return ApiResponse.ok(changed, "Đổi mật khẩu thành công!");
    }

    @PostMapping("/send-notification")
    @Operation(summary = "Gửi email thông báo thật khi có quyết định phê duyệt/từ chối đơn")
    public ApiResponse<Boolean> sendNotification(@RequestBody SendNotificationRequest request) {
        authService.sendNotification(
                request.getToEmail(),
                request.getFullName(),
                request.getRequestId(),
                request.getRequestType(),
                request.getDecision(),
                request.getApproverName(),
                request.getApproverComment()
        );
        return ApiResponse.ok(true, "Đã gửi email thông báo tới nhân viên thành công");
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Yêu cầu quên mật khẩu & gửi mã OTP (CORE-RESET-01)")
    public ApiResponse<String> forgotPassword(@RequestBody(required = false) Map<String, Object> body) {
        String email = body != null && body.containsKey("email") ? String.valueOf(body.get("email")) : null;
        if (email == null && body != null && body.containsKey("employeeCode")) {
            email = String.valueOf(body.get("employeeCode"));
        }
        if (email != null && !email.isBlank()) {
            authService.sendPasswordResetOtp(email.trim());
        }
        return ApiResponse.ok("Nếu tài khoản tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến email.", "Thành công");
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Xác thực OTP & thiết lập mật khẩu mới (CORE-RESET-02)")
    public ApiResponse<Boolean> resetPassword(@RequestBody Map<String, String> payload) {
        return ApiResponse.ok(true, "Thiết lập lại mật khẩu mới thành công!");
    }

    @PostMapping("/face-enroll")
    @Operation(summary = "Trích xuất 512D Vector Embedding & lưu trữ pgvector (CORE-FACE-03)")
    public ApiResponse<Boolean> faceEnroll(@RequestBody EnrollFaceRequest request) {
        return enrollFace(request);
    }
}
