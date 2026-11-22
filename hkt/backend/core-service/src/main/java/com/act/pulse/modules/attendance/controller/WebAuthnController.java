package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.PasskeyCredential;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
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

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * WebAuthn/Passkey dùng cho ĐĂNG NHẬP nhanh (passwordless).
 * <p>Không liên quan tới chấm công — chấm công dùng thiết bị đã đăng ký + khuôn mặt.
 * Client chỉ gửi public credential; private key không bao giờ rời thiết bị.</p>
 */
@RestController
@RequestMapping("/webauthn")
@RequiredArgsConstructor
@Tag(name = "9. WebAuthn / Passkey API", description = "Đăng ký và đăng nhập bằng passkey")
public class WebAuthnController {

    private final WebAuthnService webAuthnService;
    private final AuthService authService;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
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
    @Operation(summary = "Xác minh attestation và lưu public key passkey")
    public ApiResponse<Map<String, Object>> registerVerify(@RequestBody VerifyRequest body) {
        return ApiResponse.ok(webAuthnService.finishRegistration(currentUser(), body.getChallengeId(),
                credentialJson(body)), "Đăng ký WebAuthn");
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

    /** Trạng thái passkey của tài khoản — dùng cho trang "Passkey & bảo mật". */
    @GetMapping("/status")
    @Operation(summary = "Tài khoản đã có passkey chưa + danh sách passkey")
    public ApiResponse<Map<String, Object>> status() {
        User user = currentUser();
        List<PasskeyCredential> passkeys = webAuthnService.listPasskeys(user).stream()
                .filter(p -> p.getRevokedAt() == null)
                .toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hasPasskey", !passkeys.isEmpty());
        out.put("credentials", passkeys.stream().map(p -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", p.getId());
            item.put("label", p.getLabel());
            item.put("createdAt", p.getCreatedAt());
            item.put("lastUsedAt", p.getLastUsedAt());
            return item;
        }).toList());
        return ApiResponse.ok(out, "Trạng thái WebAuthn");
    }

    @DeleteMapping("/credentials/{id}")
    @Operation(summary = "Gỡ một passkey của chính mình")
    public ApiResponse<Map<String, Object>> removePasskey(@PathVariable UUID id) {
        User user = currentUser();
        String label = webAuthnService.listPasskeys(user).stream()
                .filter(p -> p.getId().equals(id))
                .map(PasskeyCredential::getLabel)
                .findFirst().orElse("Passkey");
        webAuthnService.removePasskey(user, id);
        audit("REMOVE_PASSKEY", id, "Gỡ passkey " + label);
        return ApiResponse.ok(Map.of("removed", true), "Đã gỡ passkey");
    }

    private void audit(String action, UUID passkeyId, String reason) {
        AuditLog log = AuditLog.builder()
                .action(action).entityName("PASSKEY").entityId(String.valueOf(passkeyId))
                .userId(CurrentUser.userId()).userCode(CurrentUser.employeeCode())
                .newValue("REVOKED").reason(reason)
                .build();
        log.setCreatedAt(LocalDateTime.now());
        auditLogRepository.save(log);
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
