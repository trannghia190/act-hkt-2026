package com.act.pulse.modules.attendance.service;

import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import com.act.pulse.modules.attendance.entity.WebAuthnChallenge;
import com.act.pulse.modules.attendance.repository.DeviceRegistrationRepository;
import com.act.pulse.modules.attendance.repository.WebAuthnChallengeRepository;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorAssertionResponse;
import com.yubico.webauthn.data.AuthenticatorAttestationResponse;
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.ClientAssertionExtensionOutputs;
import com.yubico.webauthn.data.ClientRegistrationExtensionOutputs;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.RelyingPartyIdentity;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * WebAuthn/Passkey — lớp khóa thiết bị phần cứng khi chấm công.
 *
 * <p>Server không bao giờ nhận private key. Mỗi lần chấm công client ký challenge bằng
 * passkey (Face ID/Touch ID/Windows Hello) và server verify bằng public key đã lưu.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebAuthnService {

    private static final String CEREMONY_REGISTER = "REGISTER";
    private static final String CEREMONY_ASSERT = "ASSERT";
    /** Đăng nhập usernameless — challenge chưa gắn user, biết user sau khi verify. */
    private static final String CEREMONY_LOGIN = "LOGIN";
    private static final int CHALLENGE_TTL_SECONDS = 120;

    private final UserRepository userRepository;
    private final DeviceRegistrationRepository deviceRepository;
    private final WebAuthnChallengeRepository challengeRepository;
    private final RuleService ruleService;
    private final ObjectMapper objectMapper;

    @Value("${app.webauthn.rp-id:localhost}")
    private String rpId;

    @Value("${app.webauthn.rp-name:ACT Pulse}")
    private String rpName;

    @Value("${app.webauthn.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}")
    private String allowedOriginsRaw;

    /**
     * Origin động dạng glob (vd {@code https://*.trycloudflare.com}) cho tunnel demo.
     * RP ID được suy ra từ host của Origin nên KHÔNG cần cấu hình lại mỗi lần tunnel đổi tên.
     */
    @Value("${app.webauthn.allowed-origin-patterns:}")
    private String allowedOriginPatternsRaw;

    private Set<String> allowedOrigins;
    private List<Pattern> allowedOriginPatterns;

    /** RP ID khác nhau (localhost / tunnel host) phải có RelyingParty riêng. */
    private final Map<String, RelyingParty> relyingParties = new java.util.concurrent.ConcurrentHashMap<>();

    @PostConstruct
    void init() {
        allowedOrigins = Arrays.stream(allowedOriginsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(WebAuthnService::normalizeOrigin)
                .collect(Collectors.toUnmodifiableSet());
        allowedOriginPatterns = Arrays.stream(allowedOriginPatternsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(glob -> Pattern.compile(globToRegex(normalizeOrigin(glob))))
                .collect(Collectors.toList());
        log.info("WebAuthn rpId={} origins={} originPatterns={}", rpId, allowedOrigins,
                allowedOriginPatterns.stream().map(Pattern::pattern).collect(Collectors.toList()));
    }

    /**
     * Mỗi cặp (RP ID, Origin) có RelyingParty riêng — thư viện chỉ chấp nhận origin nằm trong
     * tập khai báo, nên origin của tunnel (khớp pattern) phải được thêm vào để verify chữ ký.
     * Origin đã được lọc qua {@link #requireAllowedOrigin} trước đó.
     */
    private RelyingParty relyingPartyFor(String relyingPartyId, String origin) {
        String normalized = normalizeOrigin(origin);
        String key = relyingPartyId + "|" + normalized;
        return relyingParties.computeIfAbsent(key, k -> {
            Set<String> origins = new LinkedHashSet<>(allowedOrigins);
            origins.add(normalized);
            return RelyingParty.builder()
                    .identity(RelyingPartyIdentity.builder().id(relyingPartyId).name(rpName).build())
                    .credentialRepository(new DbCredentialRepository())
                    .origins(origins)
                    .build();
        });
    }

    /**
     * RP ID hợp lệ là chính host của Origin (hoặc domain cha đã cấu hình).
     * Nhờ vậy cùng một server phục vụ được localhost và tunnel cloudflared/ngrok.
     */
    private String rpIdFor(String origin) {
        String host;
        try {
            host = java.net.URI.create(origin).getHost();
        } catch (Exception e) {
            throw new WebAuthnException("Origin không hợp lệ cho WebAuthn: " + origin, e);
        }
        if (host == null || host.isBlank()) {
            throw new WebAuthnException("Origin không hợp lệ cho WebAuthn: " + origin);
        }
        String configured = rpId == null ? "" : rpId.trim().toLowerCase(Locale.ROOT);
        String lowerHost = host.toLowerCase(Locale.ROOT);
        if (!configured.isEmpty() && (lowerHost.equals(configured) || lowerHost.endsWith("." + configured))) {
            return rpId;
        }
        return host;
    }

    private static String globToRegex(String glob) {
        StringBuilder sb = new StringBuilder();
        for (char c : glob.toCharArray()) {
            if (c == '*') sb.append("[^/]*");
            else if ("\\^$.|?+()[]{}".indexOf(c) >= 0) sb.append('\\').append(c);
            else sb.append(c);
        }
        return sb.toString();
    }

    public Map<String, Object> startRegistration(User user, String originHeader) {
        String origin = requireAllowedOrigin(originHeader);
        UserIdentity identity = UserIdentity.builder()
                .name(user.getEmployeeCode())
                .displayName(user.getFullName() == null ? user.getEmployeeCode() : user.getFullName())
                .id(userHandle(user))
                .build();
        StartRegistrationOptions options = StartRegistrationOptions.builder()
                .user(identity)
                .timeout(CHALLENGE_TTL_SECONDS * 1000L)
                .authenticatorSelection(AuthenticatorSelectionCriteria.builder()
                        .residentKey(ResidentKeyRequirement.PREFERRED)
                        .userVerification(UserVerificationRequirement.REQUIRED)
                        .build())
                .build();
        PublicKeyCredentialCreationOptions request = relyingPartyFor(rpIdFor(origin), origin).startRegistration(options);
        try {
            return saveChallenge(user, CEREMONY_REGISTER, origin, request.toJson());
        } catch (Exception e) {
            throw new WebAuthnException("Không tạo được yêu cầu đăng ký WebAuthn.", e);
        }
    }

    @Transactional
    public Map<String, Object> finishRegistration(User user, String challengeId, String credentialJson) {
        WebAuthnChallenge challenge = requireChallenge(challengeId, user.getId(), CEREMONY_REGISTER);
        PublicKeyCredentialCreationOptions request;
        PublicKeyCredential<AuthenticatorAttestationResponse, ClientRegistrationExtensionOutputs> response;
        try {
            request = PublicKeyCredentialCreationOptions.fromJson(challenge.getRequestJson());
            response = PublicKeyCredential.parseRegistrationResponseJson(credentialJson);
        } catch (Exception e) {
            log.warn("WebAuthn registration payload invalid for {}: {}", user.getEmployeeCode(), e.getMessage(), e);
            throw new WebAuthnException("Dữ liệu đăng ký thiết bị không hợp lệ. Vui lòng thử lại.", e);
        }

        RegistrationResult result;
        try {
            result = relyingPartyFor(rpIdFor(challenge.getOrigin()), challenge.getOrigin()).finishRegistration(FinishRegistrationOptions.builder()
                    .request(request)
                    .response(response)
                    .build());
        } catch (Exception e) {
            log.warn("WebAuthn registration failed for {}: {}", user.getEmployeeCode(), e.getMessage());
            throw new WebAuthnException("Không xác thực được thiết bị. Vui lòng thử lại bằng vân tay/Face ID.", e);
        }

        String credentialId = result.getKeyId().getId().getBase64Url();
        DeviceRegistration device = deviceRepository.findByCredentialId(credentialId).orElse(null);
        if (device != null && !device.getUserId().equals(user.getId())) {
            throw new WebAuthnException("Thiết bị này đã được đăng ký cho tài khoản khác.");
        }
        boolean isNew = device == null;
        if (isNew) {
            device = DeviceRegistration.builder()
                    .userId(user.getId())
                    .deviceFingerprint("passkey-" + credentialId)
                    .deviceModel("Passkey (WebAuthn)")
                    .osVersion("Web")
                    .isApproved(false)
                    .grantDays(0)
                    .lastActiveAt(LocalDateTime.now())
                    .build();
            device.setCreatedAt(LocalDateTime.now());
        }
        int maxDevices = ruleService.getInt("attendance_security", "max_devices", 2);
        long approvedCount = deviceRepository.countByUserIdAndIsApprovedTrue(user.getId());
        boolean approved = Boolean.TRUE.equals(device.getIsApproved()) || approvedCount < maxDevices;

        device.setCredentialId(credentialId);
        device.setPublicKeyCose(result.getPublicKeyCose().getBytes());
        device.setUserHandleB64(userHandle(user).getBase64Url());
        device.setSignatureCount(result.getSignatureCount());
        device.setBackupEligible(result.isBackupEligible());
        device.setBackupState(result.isBackedUp());
        device.setAuthenticatorAttachment(result.getAuthenticatorAttachment()
                .map(Enum::name).orElse(null));
        if (response.getResponse() instanceof com.yubico.webauthn.data.AuthenticatorAttestationResponse att
                && att.getTransports() != null) {
            device.setTransports(att.getTransports().stream()
                    .map(t -> t.getId()).collect(Collectors.joining(",")));
        }
        device.setIsApproved(approved);
        device.setLastActiveAt(LocalDateTime.now());
        device.setUpdatedAt(LocalDateTime.now());
        deviceRepository.save(device);
        consume(challenge);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deviceId", device.getId());
        out.put("approved", approved);
        out.put("hasPasskey", true);
        out.put("message", approved
                ? "Thiết bị đã được đăng ký và có thể dùng để chấm công ngay."
                : "Đã ghi nhận passkey — thiết bị đang chờ HR duyệt vì đã đủ hạn mức.");
        return out;
    }

    public Map<String, Object> startAssertion(User user, String originHeader) {
        String origin = requireAllowedOrigin(originHeader);
        List<DeviceRegistration> approved = deviceRepository.findByUserIdAndIsApprovedTrue(user.getId())
                .stream()
                .filter(d -> d.isHasPasskey() && d.getRevokedAt() == null)
                .toList();
        if (approved.isEmpty()) {
            return Map.of(
                    "needsRegistration", true,
                    "message", "Thiết bị này chưa đăng ký passkey. Hãy đăng ký thiết bị bằng vân tay/Face ID trước khi chấm công.");
        }
        StartAssertionOptions options = StartAssertionOptions.builder()
                .username(user.getEmployeeCode())
                .timeout(CHALLENGE_TTL_SECONDS * 1000L)
                .userVerification(UserVerificationRequirement.REQUIRED)
                .build();
        AssertionRequest request = relyingPartyFor(rpIdFor(origin), origin).startAssertion(options);
        try {
            return saveChallenge(user, CEREMONY_ASSERT, origin, request.toJson());
        } catch (Exception e) {
            throw new WebAuthnException("Không tạo được yêu cầu xác thực WebAuthn.", e);
        }
    }

    /**
     * Verify assertion và trả device. REQUIRES_NEW: challenge phải bị tiêu thụ kể cả khi
     * transaction chấm công phía ngoài rollback vì lỗi lớp khác.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public DeviceRegistration finishAssertion(User user, String challengeId, String credentialJson) {
        WebAuthnChallenge challenge = requireChallenge(challengeId, user.getId(), CEREMONY_ASSERT);
        AssertionRequest request;
        PublicKeyCredential<AuthenticatorAssertionResponse, ClientAssertionExtensionOutputs> response;
        try {
            request = AssertionRequest.fromJson(challenge.getRequestJson());
            response = PublicKeyCredential.parseAssertionResponseJson(credentialJson);
        } catch (Exception e) {
            throw new WebAuthnException("Dữ liệu xác thực thiết bị không hợp lệ. Vui lòng thử lại.", e);
        }

        AssertionResult result;
        try {
            result = relyingPartyFor(rpIdFor(challenge.getOrigin()), challenge.getOrigin()).finishAssertion(FinishAssertionOptions.builder()
                    .request(request)
                    .response(response)
                    .build());
        } catch (Exception e) {
            log.warn("WebAuthn assertion failed for {}: {}", user.getEmployeeCode(), e.getMessage());
            throw new WebAuthnException("Xác thực thiết bị thất bại. Vui lòng thử lại bằng vân tay/Face ID.", e);
        }

        String credentialId = result.getCredentialId().getBase64Url();
        DeviceRegistration device = deviceRepository.findByCredentialId(credentialId)
                .orElseThrow(() -> new WebAuthnException("Thiết bị chưa được đăng ký."));
        if (!device.getUserId().equals(user.getId())) {
            throw new WebAuthnException("Thiết bị không thuộc tài khoản này.");
        }
        if (!Boolean.TRUE.equals(device.getIsApproved())) {
            throw new WebAuthnException("Thiết bị đang chờ HR duyệt — chưa thể chấm công.");
        }
        if (device.getRevokedAt() != null) {
            throw new WebAuthnException("Thiết bị đã bị thu hồi — vui lòng đăng ký lại.");
        }
        device.setSignatureCount(result.getSignatureCount());
        device.setBackupState(result.isBackedUp());
        device.setLastActiveAt(LocalDateTime.now());
        device.setUpdatedAt(LocalDateTime.now());
        deviceRepository.save(device);
        consume(challenge);
        return device;
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private Map<String, Object> saveChallenge(User user, String ceremony, String origin, String requestJson) {
        WebAuthnChallenge challenge = challengeRepository.save(WebAuthnChallenge.builder()
                // LOGIN (usernameless) chưa biết người dùng — user_id được suy ra từ credential khi verify.
                .userId(user == null ? null : user.getId())
                .ceremonyType(ceremony)
                .requestJson(requestJson)
                .origin(origin)
                .expiresAt(LocalDateTime.now().plusSeconds(CHALLENGE_TTL_SECONDS))
                .build());
        try {
            // Lưu JSON gốc (không bọc publicKey) vì *Options.fromJson chỉ đọc phần trong;
            // còn client cần wrapper chuẩn PublicKeyCredential{Request|Creation}OptionsJSON.
            Map<String, Object> inner = objectMapper.readValue(requestJson, Map.class);
            // AssertionRequest.toJson() bọc options trong publicKeyCredentialRequestOptions;
            // client cần đúng PublicKeyCredentialRequestOptionsJSON ở trong wrapper publicKey.
            if (inner.get("publicKeyCredentialRequestOptions") instanceof Map<?, ?> nested) {
                @SuppressWarnings("unchecked")
                Map<String, Object> casted = (Map<String, Object>) nested;
                inner = casted;
            }
            Map<String, Object> options = Map.of("publicKey", inner);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("challengeId", challenge.getId());
            out.put("options", options);
            return out;
        } catch (IOException e) {
            throw new WebAuthnException("Không tạo được challenge WebAuthn.", e);
        }
    }

    /**
     * Bắt đầu đăng nhập bằng passkey (usernameless): không truyền username nên
     * authenticator tự chọn discoverable credential; server biết user sau khi verify.
     */
    public Map<String, Object> startLoginAssertion(String originHeader) {
        String origin = requireAllowedOrigin(originHeader);
        StartAssertionOptions options = StartAssertionOptions.builder()
                .timeout(CHALLENGE_TTL_SECONDS * 1000L)
                .userVerification(UserVerificationRequirement.REQUIRED)
                .build();
        AssertionRequest request = relyingPartyFor(rpIdFor(origin), origin).startAssertion(options);
        try {
            return saveChallenge(null, CEREMONY_LOGIN, origin, request.toJson());
        } catch (Exception e) {
            throw new WebAuthnException("Không tạo được yêu cầu đăng nhập WebAuthn.", e);
        }
    }

    /**
     * Verify assertion đăng nhập và trả user sở hữu credential.
     * REQUIRES_NEW: challenge phải bị tiêu thụ kể cả khi phát hành session phía ngoài lỗi.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public User finishLoginAssertion(String challengeId, String credentialJson) {
        WebAuthnChallenge challenge = requireLoginChallenge(challengeId);
        AssertionRequest request;
        PublicKeyCredential<AuthenticatorAssertionResponse, ClientAssertionExtensionOutputs> response;
        try {
            request = AssertionRequest.fromJson(challenge.getRequestJson());
            response = PublicKeyCredential.parseAssertionResponseJson(credentialJson);
        } catch (Exception e) {
            throw new WebAuthnException("Dữ liệu đăng nhập không hợp lệ. Vui lòng thử lại.", e);
        }

        AssertionResult result;
        try {
            result = relyingPartyFor(rpIdFor(challenge.getOrigin()), challenge.getOrigin())
                    .finishAssertion(FinishAssertionOptions.builder()
                            .request(request)
                            .response(response)
                            .build());
        } catch (Exception e) {
            log.warn("WebAuthn login assertion failed: {}", e.getMessage());
            throw new WebAuthnException("Không xác thực được passkey. Vui lòng thử lại bằng vân tay/Face ID.", e);
        }

        String credentialId = result.getCredentialId().getBase64Url();
        DeviceRegistration device = deviceRepository.findByCredentialId(credentialId)
                .orElseThrow(() -> new WebAuthnException(
                        "Thiết bị này chưa đăng ký passkey. Hãy đăng nhập bằng mật khẩu rồi đăng ký passkey trong Cài đặt."));
        if (device.getRevokedAt() != null) {
            throw new WebAuthnException("Passkey của thiết bị này đã bị HR thu hồi — vui lòng đăng ký lại.");
        }
        User user = userRepository.findById(device.getUserId())
                .orElseThrow(() -> new WebAuthnException("Không tìm thấy tài khoản gắn với passkey này."));
        device.setSignatureCount(result.getSignatureCount());
        device.setBackupState(result.isBackedUp());
        device.setLastActiveAt(LocalDateTime.now());
        device.setUpdatedAt(LocalDateTime.now());
        deviceRepository.save(device);
        consume(challenge);
        log.info("Passkey login OK user={} credential={}", user.getEmployeeCode(), credentialId);
        return user;
    }

    private WebAuthnChallenge requireLoginChallenge(String challengeId) {
        UUID id = parseChallengeId(challengeId);
        WebAuthnChallenge challenge = challengeRepository
                .findByIdAndCeremonyTypeAndConsumedAtIsNull(id, CEREMONY_LOGIN)
                .orElseThrow(() -> new WebAuthnException("Challenge đã dùng hoặc không tồn tại. Vui lòng thử lại."));
        if (challenge.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new WebAuthnException("Challenge đã hết hạn. Vui lòng thử lại.");
        }
        return challenge;
    }

    private WebAuthnChallenge requireChallenge(String challengeId, UUID userId, String ceremony) {
        UUID id = parseChallengeId(challengeId);
        WebAuthnChallenge challenge = challengeRepository
                .findByIdAndUserIdAndCeremonyTypeAndConsumedAtIsNull(id, userId, ceremony)
                .orElseThrow(() -> new WebAuthnException("Challenge đã dùng hoặc không tồn tại. Vui lòng thử lại."));
        if (challenge.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new WebAuthnException("Challenge đã hết hạn. Vui lòng thử lại.");
        }
        return challenge;
    }

    private static UUID parseChallengeId(String challengeId) {
        try {
            return UUID.fromString(challengeId);
        } catch (Exception e) {
            throw new WebAuthnException("Challenge không hợp lệ.");
        }
    }

    private void consume(WebAuthnChallenge challenge) {
        challenge.setConsumedAt(LocalDateTime.now());
        challengeRepository.save(challenge);
    }

    private String requireAllowedOrigin(String originHeader) {
        String normalized = normalizeOrigin(originHeader);
        boolean exact = normalized != null && allowedOrigins.contains(normalized);
        boolean patterned = normalized != null
                && allowedOriginPatterns.stream().anyMatch(p -> p.matcher(normalized).matches());
        if (!exact && !patterned) {
            throw new WebAuthnException("Origin không hợp lệ cho WebAuthn: " + originHeader);
        }
        return normalized;
    }

    private static String normalizeOrigin(String origin) {
        if (origin == null || origin.isBlank()) return null;
        return origin.trim().replaceAll("/+$", "");
    }

    private static ByteArray userHandle(User user) {
        ByteBuffer buf = ByteBuffer.allocate(16);
        buf.putLong(user.getId().getMostSignificantBits());
        buf.putLong(user.getId().getLeastSignificantBits());
        return new ByteArray(buf.array());
    }

    private static ByteArray b64u(String value) {
        try {
            return ByteArray.fromBase64Url(value);
        } catch (Exception e) {
            throw new WebAuthnException("Credential ID không hợp lệ.", e);
        }
    }

    /** Credential repository đọc/ghi DB — không giữ trạng thái trong RAM. */
    private final class DbCredentialRepository implements CredentialRepository {

        private Optional<DeviceRegistration> usableByCredential(ByteArray credentialId) {
            // Không lọc isApproved ở đây: đăng nhập passkey phải chạy được với thiết bị đang chờ duyệt;
            // lớp chấm công tự kiểm tra duyệt/thu hồi với thông báo riêng.
            return deviceRepository.findByCredentialId(credentialId.getBase64Url())
                    .filter(d -> d.getRevokedAt() == null);
        }

        @Override
        public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
            return userRepository.findByEmployeeCode(username)
                    .map(u -> deviceRepository.findByUserIdAndIsApprovedTrue(u.getId()).stream()
                            .filter(DeviceRegistration::isHasPasskey)
                            .filter(d -> d.getRevokedAt() == null)
                            .map(d -> PublicKeyCredentialDescriptor.builder()
                                    .id(b64u(d.getCredentialId()))
                                    .build())
                            .collect(Collectors.toSet()))
                    .orElseGet(Set::of);
        }

        @Override
        public Optional<ByteArray> getUserHandleForUsername(String username) {
            return userRepository.findByEmployeeCode(username).map(WebAuthnService::userHandle);
        }

        @Override
        public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
            try {
                ByteBuffer buf = ByteBuffer.wrap(userHandle.getBytes());
                UUID id = new UUID(buf.getLong(), buf.getLong());
                return userRepository.findById(id).map(User::getEmployeeCode);
            } catch (Exception e) {
                return Optional.empty();
            }
        }

        @Override
        public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
            return usableByCredential(credentialId).flatMap(d -> {
                if (userHandle != null) {
                    UUID id = uuidFromHandle(userHandle);
                    if (id == null || !id.equals(d.getUserId())) return Optional.empty();
                }
                ByteArray handle = d.getUserHandleB64() == null
                        ? userHandle
                        : b64u(d.getUserHandleB64());
                if (handle == null) return Optional.empty();
                return Optional.of(RegisteredCredential.builder()
                        .credentialId(b64u(d.getCredentialId()))
                        .userHandle(handle)
                        .publicKeyCose(new ByteArray(d.getPublicKeyCose()))
                        .signatureCount(d.getSignatureCount() == null ? 0 : d.getSignatureCount())
                        .build());
            });
        }

        @Override
        public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
            return lookup(credentialId, null).map(Set::of).orElseGet(Set::of);
        }

        private UUID uuidFromHandle(ByteArray handle) {
            if (handle.size() != 16) return null;
            try {
                ByteBuffer buf = ByteBuffer.wrap(handle.getBytes());
                return new UUID(buf.getLong(), buf.getLong());
            } catch (Exception e) {
                return null;
            }
        }
    }
}
