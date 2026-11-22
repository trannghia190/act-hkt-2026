package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import com.act.pulse.modules.attendance.repository.DeviceRegistrationRepository;
import com.act.pulse.modules.attendance.service.WebAuthnService;
import com.act.pulse.modules.auth.dto.response.AuthResponse;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.auth.service.AuthService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * WebAuthn/Passkey cho lớp khóa thiết bị phần cứng (Lớp 4).
 * Client chỉ gửi public credential; private key không bao giờ rời thiết bị.
 */
@RestController
@RequestMapping("/webauthn")
@RequiredArgsConstructor
@Tag(name = "9. WebAuthn / Passkey API", description = "Đăng ký passkey thiết bị và ký challenge khi chấm công")
public class WebAuthnController {

    private final WebAuthnService webAuthnService;
    private final AuthService authService;
    private final DeviceRegistrationRepository deviceRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Data
    public static class VerifyRequest {
        private String challengeId;
        private JsonNode credential;
    }

    @PostMapping("/register/options")
    @Operation(summary = "Lấy PublicKeyCredentialCreationOptions để đăng ký passkey")
    public ApiResponse<Map<String, Object>> registerOptions(
            @RequestHeader(value = "Origin", required = false) String origin,
            @RequestHeader(value = "X-App-Origin", required = false) String appOrigin) {
        return ApiResponse.ok(webAuthnService.startRegistration(currentUser(), originOf(origin, appOrigin)),
                "Yêu cầu đăng ký WebAuthn");
    }

    @PostMapping("/register/verify")
    @Operation(summary = "Xác minh attestation và lưu public key thiết bị")
    public ApiResponse<Map<String, Object>> registerVerify(@RequestBody VerifyRequest body) {
        return ApiResponse.ok(webAuthnService.finishRegistration(currentUser(), body.getChallengeId(),
                credentialJson(body)), "Đăng ký WebAuthn");
    }

    @PostMapping("/assert/options")
    @Operation(summary = "Lấy challenge để ký khi chấm công")
    public ApiResponse<Map<String, Object>> assertOptions(
            @RequestHeader(value = "Origin", required = false) String origin,
            @RequestHeader(value = "X-App-Origin", required = false) String appOrigin) {
        return ApiResponse.ok(webAuthnService.startAssertion(currentUser(), originOf(origin, appOrigin)),
                "Yêu cầu xác thực WebAuthn");
    }

    @PostMapping("/assert/verify")
    @Operation(summary = "Xác minh chữ ký challenge — thiết bị phải đã được duyệt")
    public ApiResponse<Map<String, Object>> assertVerify(@RequestBody VerifyRequest body) {
        DeviceRegistration device = webAuthnService.finishAssertion(currentUser(), body.getChallengeId(),
                credentialJson(body));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deviceId", device.getId());
        out.put("verified", true);
        out.put("lastActiveAt", device.getLastActiveAt());
        return ApiResponse.ok(out, "Thiết bị đã xác thực");
    }

    /** Đăng nhập bằng passkey (usernameless): endpoint công khai, không cần JWT. */
    @PostMapping("/login/options")
    @Operation(summary = "Lấy challenge đăng nhập bằng passkey")
    public ApiResponse<Map<String, Object>> loginOptions(
            @RequestHeader(value = "Origin", required = false) String origin,
            @RequestHeader(value = "X-App-Origin", required = false) String appOrigin) {
        return ApiResponse.ok(webAuthnService.startLoginAssertion(originOf(origin, appOrigin)),
                "Yêu cầu đăng nhập bằng passkey");
    }

    @PostMapping("/login/verify")
    @Operation(summary = "Xác minh chữ ký passkey và cấp phiên đăng nhập")
    public ApiResponse<AuthResponse> loginVerify(@RequestBody VerifyRequest body) {
        User user = webAuthnService.finishLoginAssertion(body.getChallengeId(), credentialJson(body));
        if ("LOCKED".equalsIgnoreCase(user.getStatus())) {
            throw new RuntimeException("Tài khoản đã bị tạm khóa, vui lòng liên hệ HR hoặc Quản trị viên");
        }
        if ("INACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new RuntimeException("Tài khoản đã ngừng hoạt động — vui lòng liên hệ HR");
        }
        return ApiResponse.ok(authService.loginWithPasskey(user), "Đăng nhập bằng passkey thành công");
    }

    /** Trạng thái khóa thiết bị — UI hiển thị nhắc đăng ký passkey trước khi chấm công. */
    @GetMapping("/status")
    @Operation(summary = "Thiết bị hiện tại có passkey đã duyệt chưa")
    public ApiResponse<Map<String, Object>> status() {
        UUID userId = CurrentUser.userId();
        List<DeviceRegistration> approved = deviceRepository.findByUserIdAndIsApprovedTrue(userId);
        boolean hasApprovedPasskey = approved.stream()
                .anyMatch(d -> d.isHasPasskey() && d.getRevokedAt() == null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hasPasskey", hasApprovedPasskey);
        out.put("approvedDevices", approved.size());
        return ApiResponse.ok(out, "Trạng thái WebAuthn");
    }

    private User currentUser() {
        UUID id = CurrentUser.userId();
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng hiện tại."));
    }

    private static String originOf(String origin, String appOrigin) {
        return origin != null && !origin.isBlank() ? origin : appOrigin;
    }

    private String credentialJson(VerifyRequest body) {
        if (body.getCredential() == null) {
            throw new IllegalArgumentException("Thiếu credential WebAuthn.");
        }
        try {
            return objectMapper.writeValueAsString(body.getCredential());
        } catch (Exception e) {
            throw new IllegalArgumentException("Credential WebAuthn không hợp lệ.");
        }
    }
}
