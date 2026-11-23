package com.act.pulse.modules.notification.service;

import com.act.pulse.modules.notification.entity.PushSubscription;
import com.act.pulse.modules.notification.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import io.jsonwebtoken.Jwts;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import nl.martijndwars.webpush.jwt.JwtFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.spec.ECGenParameterSpec;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Gửi Web Push (VAPID) tới các thiết bị đã đăng ký.
 * <p>Cần HTTPS (hoặc localhost) ở phía trình duyệt để {@code pushManager.subscribe()}
 * hoạt động. Không có subscription nào thì kênh push coi như không gửi được —
 * nhưng thông báo in-app vẫn được ghi bình thường.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationPushService {

    private final PushSubscriptionRepository subscriptionRepository;

    /**
     * webpush 6.x không gắn JwtFactory mặc định khi dùng {@code builder()} —
     * thiếu nó thì build ném "No JwtFactory provided". Ký VAPID JWT bằng jjwt (ES256).
     */
    private static final JwtFactory JWT_FACTORY = (header, claims, privateKey) ->
            Jwts.builder()
                    .header().add(header).and()
                    .claims(claims)
                    .signWith(privateKey, Jwts.SIG.ES256)
                    .compact();

    @Value("${app.push.vapid.public-key:}")
    private String vapidPublicKey;

    @Value("${app.push.vapid.private-key:}")
    private String vapidPrivateKey;

    @Value("${app.push.vapid.subject:mailto:it@act-corp.internal}")
    private String vapidSubject;

    @Value("${app.push.enabled:false}")
    private boolean pushEnabled;

    /** Key pair sinh một lần khi khởi động (nếu chưa cấu hình) — chỉ dùng cho dev. */
    private volatile PushService pushService;
    private volatile String generatedPublicKey;

    /** VAPID public key mà frontend dùng để subscribe. */
    public String publicKey() {
        if (vapidPublicKey != null && !vapidPublicKey.isBlank()) return vapidPublicKey;
        ensureService();
        return generatedPublicKey;
    }

    public boolean isEnabled() {
        return pushEnabled && publicKey() != null;
    }

    /**
     * Bắn push tới mọi thiết bị của user.
     *
     * @return true nếu có ít nhất một thiết bị nhận thành công.
     */
    public boolean send(UUID userId, String title, String content, String actionUrl) {
        if (!pushEnabled) return false;
        List<PushSubscription> subs = subscriptionRepository.findByUserId(userId);
        if (subs.isEmpty()) return false;
        PushService service = ensureService();
        if (service == null) return false;

        String payload = buildPayload(title, content, actionUrl);
        boolean any = false;
        for (PushSubscription sub : subs) {
            try {
                Subscription subscription = new Subscription(sub.getEndpoint(),
                        new Subscription.Keys(sub.getP256dh(), sub.getAuth()));
                Notification notification = Notification.builder()
                        .endpoint(URI.create(sub.getEndpoint()))
                        .userPublicKey(sub.getP256dh())
                        .userAuth(sub.getAuth())
                        .payload(payload)
                        .urgency(Notification.Urgency.NORMAL)
                        .ttl(3600)
                        .build();
                var response = service.send(notification);
                int status = response.statusCode();
                if (status >= 200 && status < 300) {
                    any = true;
                } else if (status == 404 || status == 410) {
                    // Subscription đã hết hạn → dọn khỏi DB.
                    subscriptionRepository.delete(sub);
                    log.info("Xoá push subscription hết hạn ({}), user={}", status, userId);
                } else {
                    log.warn("Gửi push thất bại HTTP {} cho user {}", status, userId);
                }
                sub.setLastUsedAt(LocalDateTime.now());
                subscriptionRepository.save(sub);
            } catch (Exception ex) {
                log.warn("Lỗi gửi push cho user {}: {}", userId, ex.getMessage());
            }
        }
        return any;
    }

    private String buildPayload(String title, String content, String actionUrl) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"title\":").append(jsonString(title)).append(',');
        sb.append("\"body\":").append(jsonString(content));
        if (actionUrl != null && !actionUrl.isBlank()) {
            sb.append(",\"actionUrl\":").append(jsonString(actionUrl));
        }
        sb.append('}');
        return sb.toString();
    }

    private static String jsonString(String value) {
        if (value == null) return "\"\"";
        StringBuilder sb = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.append('"').toString();
    }

    private synchronized PushService ensureService() {
        if (pushService != null) return pushService;
        try {
            PushService service;
            if (vapidPublicKey != null && !vapidPublicKey.isBlank()
                    && vapidPrivateKey != null && !vapidPrivateKey.isBlank()) {
                service = PushService.builder()
                        .withVapidPublicKey(vapidPublicKey)
                        .withVapidPrivateKey(vapidPrivateKey)
                        .withVapidSubject(vapidSubject)
                        .withJwtFactory(JWT_FACTORY)
                        .build();
            } else {
                KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
                gen.initialize(new ECGenParameterSpec("secp256r1"));
                KeyPair pair = gen.generateKeyPair();
                service = PushService.builder()
                        .withVapidKeyPair(pair)
                        .withVapidSubject(vapidSubject)
                        .withJwtFactory(JWT_FACTORY)
                        .build();
                generatedPublicKey = base64Url(toUncompressedPoint(
                        (java.security.interfaces.ECPublicKey) pair.getPublic()));
                log.warn("Chưa cấu hình app.push.vapid.* — dùng key tạm cho dev. "
                        + "Đặt VAPID keys cố định khi triển khai. Public key tạm: {}", generatedPublicKey);
            }
            pushService = service;
            return service;
        } catch (NoSuchAlgorithmException | java.security.spec.InvalidParameterSpecException ex) {
            log.error("Không khởi tạo được Web Push service: {}", ex.getMessage());
            return null;
        } catch (Exception ex) {
            log.error("Không khởi tạo được Web Push service: {}", ex.getMessage());
            return null;
        }
    }

    /**
     * Khoá công khai VAPID mà trình duyệt chấp nhận là **điểm EC không nén 65 byte**:
     * {@code 0x04 || X(32) || Y(32)} — không phải DER/X.509 từ {@code getEncoded()}.
     * Dùng sai định dạng khiến {@code pushManager.subscribe()} ném
     * "The provided applicationServerKey is not valid".
     */
    private static byte[] toUncompressedPoint(java.security.interfaces.ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 0x04;
        copyCoordinate(key.getW().getAffineX().toByteArray(), out, 1);
        copyCoordinate(key.getW().getAffineY().toByteArray(), out, 33);
        return out;
    }

    /** BigInteger có thể kèm byte 0x00 dấu dương hoặc ngắn hơn 32 byte → căn phải vào 32 byte. */
    private static void copyCoordinate(byte[] src, byte[] dst, int offset) {
        int len = Math.min(src.length, 32);
        System.arraycopy(src, src.length - len, dst, offset + (32 - len), len);
    }

    private static String base64Url(byte[] bytes) {
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
