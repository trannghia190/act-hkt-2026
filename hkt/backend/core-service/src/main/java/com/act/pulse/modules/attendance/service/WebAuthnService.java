package com.act.pulse.modules.attendance.service;

import com.act.pulse.modules.attendance.entity.PasskeyCredential;
import com.act.pulse.modules.attendance.entity.WebAuthnChallenge;
import com.act.pulse.modules.attendance.repository.PasskeyCredentialRepository;
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
 * WebAuthn/Passkey dùng để ĐĂNG NHẬP nhanh (passwordless).
 *
 * <p>Đã tách hoàn toàn khỏi chấm công: chấm công chỉ dùng fingerprint thiết bị + khuôn mặt.
 * Passkey nằm ở bảng riêng {@code passkey_credentials}, không chiếm hạn mức thiết bị.
 * Server không bao giờ nhận private key — chỉ lưu public key COSE.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebAuthnService {

    private static final String CEREMONY_REGISTER = "REGISTER";
    /** Đăng nhập usernameless — challenge chưa gắn user, biết user sau khi verify. */
    private static final String CEREMONY_LOGIN = "LOGIN";
    private static final int CHALLENGE_TTL_SECONDS = 120;
    private static final String DEFAULT_LABEL = "Passkey (WebAuthn)";

    private final UserRepository userRepository;
    private final PasskeyCredentialRepository passkeyRepository;
    private final WebAuthnChallengeRepository challengeRepository;
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

    private Set<String> allowedOrigins = Set.of();
    private List<Pattern> allowedOriginPatterns = List.of();

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

    // ── Đăng ký passkey (đã đăng nhập bằng mật khẩu) ──────────────────────

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
            throw new WebAuthnException("Dữ liệu đăng ký passkey không hợp lệ. Vui lòng thử lại.", e);
        }

        RegistrationResult result;
        try {
            result = relyingPartyFor(rpIdFor(challenge.getOrigin()), challenge.getOrigin()).finishRegistration(
                    FinishRegistrationOptions.builder()
                            .request(request)
                            .response(response)
                            .build());
        } catch (Exception e) {
            log.warn("WebAuthn registration failed for {}: {}", user.getEmployeeCode(), e.getMessage());
            throw new WebAuthnException("Không xác thực được passkey. Vui lòng thử lại bằng vân tay/Face ID.", e);
        }

        String credentialId = result.getKeyId().getId().getBase64Url();
        PasskeyCredential passkey = passkeyRepository.findByCredentialId(credentialId).orElse(null);
        if (passkey != null && !passkey.getUserId().equals(user.getId())) {
            throw new WebAuthnException("Passkey này đã được đăng ký cho tài khoản khác.");
        }
        if (passkey == null) {
            passkey = PasskeyCredential.builder()
                    .userId(user.getId())
                    .credentialId(credentialId)
                    .label(DEFAULT_LABEL)
                    .build();
            passkey.setCreatedAt(LocalDateTime.now());
        }
        passkey.setPublicKeyCose(result.getPublicKeyCose().getBytes());
        passkey.setUserHandleB64(userHandle(user).getBase64Url());
        passkey.setSignatureCount(result.getSignatureCount());
        passkey.setBackupEligible(result.isBackupEligible());
        passkey.setBackupState(result.isBackedUp());
        passkey.setAuthenticatorAttachment(result.getAuthenticatorAttachment()
                .map(Enum::name).orElse(null));
        if (response.getResponse() instanceof AuthenticatorAttestationResponse att
                && att.getTransports() != null) {
            passkey.setTransports(att.getTransports().stream()
                    .map(t -> t.getId()).collect(Collectors.joining(",")));
        }
        passkey.setLastUsedAt(LocalDateTime.now());
        passkey.setRevokedAt(null);
        passkey.setUpdatedAt(LocalDateTime.now());
        passkeyRepository.save(passkey);
        consume(challenge);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", passkey.getId());
        out.put("credentialId", credentialId);
        out.put("hasPasskey", true);
        out.put("message", "Đã đăng ký passkey — có thể dùng để đăng nhập nhanh.");
        return out;
    }

    // ── Đăng nhập bằng passkey (usernameless) ─────────────────────────────

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
        PasskeyCredential passkey = passkeyRepository.findByCredentialId(credentialId)
                .orElseThrow(() -> new WebAuthnException(
                        "Thiết bị này chưa đăng ký passkey. Hãy đăng nhập bằng mật khẩu rồi đăng ký passkey trong Cài đặt."));
        if (passkey.getRevokedAt() != null) {
            throw new WebAuthnException("Passkey này đã bị gỡ — hãy đăng ký lại trong Cài đặt.");
        }
        User user = userRepository.findById(passkey.getUserId())
                .orElseThrow(() -> new WebAuthnException("Không tìm thấy tài khoản gắn với passkey này."));
        passkey.setSignatureCount(result.getSignatureCount());
        passkey.setBackupState(result.isBackedUp());
        passkey.setLastUsedAt(LocalDateTime.now());
        passkey.setUpdatedAt(LocalDateTime.now());
        passkeyRepository.save(passkey);
        consume(challenge);
        log.info("Passkey login OK user={} credential={}", user.getEmployeeCode(), credentialId);
        return user;
    }

    // ── Quản lý passkey ───────────────────────────────────────────────────

    public List<PasskeyCredential> listPasskeys(User user) {
        return passkeyRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    /** Gỡ passkey của chính mình — thu hồi mềm, giữ dấu vết trong DB. */
    @Transactional
    public void removePasskey(User user, UUID passkeyId) {
        PasskeyCredential passkey = passkeyRepository.findByIdAndUserId(passkeyId, user.getId())
                .orElseThrow(() -> new WebAuthnException("Không tìm thấy passkey của bạn."));
        if (passkey.getRevokedAt() == null) {
            passkey.setRevokedAt(LocalDateTime.now());
            passkey.setUpdatedAt(LocalDateTime.now());
            passkeyRepository.save(passkey);
        }
    }

    public long countActivePasskeys(UUID userId) {
        return passkeyRepository.countByUserIdAndRevokedAtIsNull(userId);
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

        private Optional<PasskeyCredential> usableByCredential(ByteArray credentialId) {
            return passkeyRepository.findByCredentialIdAndRevokedAtIsNull(credentialId.getBase64Url());
        }

        @Override
        public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
            return userRepository.findByEmployeeCode(username)
                    .map(u -> passkeyRepository.findByUserIdOrderByCreatedAtDesc(u.getId()).stream()
                            .filter(p -> p.getRevokedAt() == null)
                            .map(p -> PublicKeyCredentialDescriptor.builder()
                                    .id(b64u(p.getCredentialId()))
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
            return usableByCredential(credentialId).flatMap(p -> {
                if (userHandle != null) {
                    UUID id = uuidFromHandle(userHandle);
                    if (id == null || !id.equals(p.getUserId())) return Optional.empty();
                }
                ByteArray handle = p.getUserHandleB64() == null
                        ? userHandle
                        : b64u(p.getUserHandleB64());
                if (handle == null) return Optional.empty();
                return Optional.of(RegisteredCredential.builder()
                        .credentialId(b64u(p.getCredentialId()))
                        .userHandle(handle)
                        .publicKeyCose(new ByteArray(p.getPublicKeyCose()))
                        .signatureCount(p.getSignatureCount() == null ? 0 : p.getSignatureCount())
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
