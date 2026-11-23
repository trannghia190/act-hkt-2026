package com.act.pulse.modules.notification.service;

import com.act.pulse.modules.attendance.entity.Notification;
import com.act.pulse.modules.attendance.repository.NotificationRepository;
import com.act.pulse.modules.notification.entity.NotificationDelivery;
import com.act.pulse.modules.notification.repository.NotificationDeliveryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Điểm giao duy nhất để phát thông báo (S36).
 * <p>Trước đây có 7 chỗ gọi thẳng {@code notificationRepository.save(...)} và
 * **không chỗ nào đọc cấu hình của người dùng** — mọi lựa chọn trên trang
 * Tuỳ chỉnh thông báo chỉ là mô phỏng. Dispatcher áp dụng thật:</p>
 * <ol>
 *   <li>bật/tắt theo từng sự kiện × kênh (web / email / push),</li>
 *   <li>giờ yên lặng — không bắn push, dồn sang digest 08:00,</li>
 *   <li>cửa sổ chống trùng — cùng việc không nhắc lặp trong N giờ,</li>
 *   <li>giới hạn số push mỗi ngày — phần vượt được dồn sang digest.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationDispatcher {

    public static final String CHANNEL_WEB = "WEB";
    public static final String CHANNEL_EMAIL = "EMAIL";
    public static final String CHANNEL_PUSH = "PUSH";

    /** Kênh "dồn" — mục bị chặn (quiet hours / vượt hạn mức) sẽ được gửi trong digest 08:00. */
    private static final String CHANNEL_DEFERRED = "DEFERRED";

    private final NotificationRepository notificationRepository;
    private final NotificationDeliveryRepository deliveryRepository;
    private final NotificationPreferenceService preferenceService;
    private final NotificationPushService pushService;
    private final com.act.pulse.common.service.EmailService emailService;
    private final com.act.pulse.modules.auth.repository.UserRepository userRepository;

    /** Kết quả gửi một sự kiện (dùng cho test + log). */
    public record DispatchResult(String eventKey, String notificationId,
                                 boolean webDelivered, boolean emailDelivered,
                                 boolean pushDelivered, boolean deferredToDigest,
                                 String reason) {}

    /**
     * Gửi một sự kiện cho một người dùng.
     *
     * @param eventKey  khóa sự kiện chuẩn hóa (xem {@link NotificationEventCatalog})
     * @param type     loại thông báo cũ (giữ tương thích với dữ liệu cũ)
     * @param priority HIGH thì bỏ qua dedupe và giới hạn push/ngày
     * @param dedupeKey khóa nhận diện nội dung; null = không áp dedupe
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public DispatchResult dispatch(String eventKey, UUID userId, String title, String content,
                                   String type, String priority, String actionUrl, String dedupeKey) {
        if (userId == null || eventKey == null || eventKey.isBlank()) {
            return new DispatchResult(eventKey, null, false, false, false, false, "INVALID_INPUT");
        }
        String pr = priority == null || priority.isBlank() ? "MEDIUM" : priority.toUpperCase();
        boolean urgent = "HIGH".equals(pr);

        NotificationPreferenceService.ResolvedPrefs prefs = preferenceService.resolve(userId, null);

        boolean wantWeb = prefs.channelEnabled(eventKey, "web");
        boolean wantEmail = prefs.channelEnabled(eventKey, "email");
        boolean wantPush = prefs.channelEnabled(eventKey, "push") && prefs.pushEnabled();

        if (!wantWeb && !wantEmail && !wantPush) {
            return new DispatchResult(eventKey, null, false, false, false, false, "ALL_CHANNELS_DISABLED");
        }

        // ── Cửa sổ chống trùng ───────────────────────────────────────────────
        if (!urgent && dedupeKey != null && !dedupeKey.isBlank() && prefs.dedupeHours() > 0) {
            LocalDateTime since = LocalDateTime.now().minusHours(prefs.dedupeHours());
            long sent = deliveryRepository.countByUserIdAndEventKeyAndDedupeKeyAndDeliveredAtAfter(
                    userId, eventKey, dedupeKey, since);
            if (sent > 0) {
                return new DispatchResult(eventKey, null, false, false, false, false, "DEDUPED");
            }
        }

        // ── Kênh WEB (in-app): ghi dòng thông báo + badge ────────────────────
        Notification entity = null;
        if (wantWeb) {
            entity = Notification.builder()
                    .userId(userId)
                    .title(title)
                    .content(content)
                    .type(type == null ? eventKey : type)
                    .eventKey(eventKey)
                    .priority(pr)
                    .actionUrl(actionUrl)
                    .isRead(false)
                    .createdAt(LocalDateTime.now())
                    .build();
            notificationRepository.save(entity);
            recordDelivery(userId, eventKey, CHANNEL_WEB, entity.getId(), null);
        }

        // ── Kênh PUSH: bị chặn bởi quiet hours hoặc vượt hạn mức/ngày ───────
        boolean pushDelivered = false;
        boolean deferred = false;
        String reason = "OK";
        if (wantPush) {
            boolean quiet = prefs.inQuietHours(LocalDateTime.now().toLocalTime());
            boolean overQuota = !urgent && pushQuotaExceeded(userId, prefs.maxPushPerDay());
            if (quiet || overQuota) {
                deferred = true;
                reason = quiet ? "QUIET_HOURS" : "MAX_PUSH_PER_DAY";
                // Ghi lại để job digest 08:00 gửi bù — kèm nội dung vì WEB có thể đang tắt.
                recordDelivery(userId, eventKey, CHANNEL_DEFERRED, entity == null ? null : entity.getId(),
                        dedupeKey == null ? eventKey : dedupeKey, title, content, actionUrl);
            } else {
                pushDelivered = pushService.send(userId, title, content, actionUrl);
                recordDelivery(userId, eventKey, CHANNEL_PUSH, entity == null ? null : entity.getId(), null);
            }
        }

        // ── Kênh EMAIL ───────────────────────────────────────────────────────
        boolean emailDelivered = false;
        if (wantEmail) {
            emailDelivered = emailService.sendEventEmail(recipientEmail(userId), recipientName(userId),
                    title, content, actionUrl);
            recordDelivery(userId, eventKey, CHANNEL_EMAIL, entity == null ? null : entity.getId(), null);
        }

        return new DispatchResult(eventKey, entity == null ? null : entity.getId().toString(),
                wantWeb, emailDelivered, pushDelivered, deferred, reason);
    }

    /** Đã vượt hạn mức push trong ngày chưa? */
    private boolean pushQuotaExceeded(UUID userId, int maxPerDay) {
        if (maxPerDay <= 0) return true;
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        return deliveryRepository.countByUserIdAndChannelAndDeliveredAtAfter(userId, CHANNEL_PUSH, startOfDay) >= maxPerDay;
    }

    private void recordDelivery(UUID userId, String eventKey, String channel, UUID notificationId, String dedupeKey) {
        recordDelivery(userId, eventKey, channel, notificationId, dedupeKey, null, null, null);
    }

    private void recordDelivery(UUID userId, String eventKey, String channel, UUID notificationId,
                                String dedupeKey, String title, String content, String actionUrl) {
        deliveryRepository.save(NotificationDelivery.builder()
                .userId(userId)
                .eventKey(eventKey)
                .channel(channel)
                .notificationId(notificationId)
                .dedupeKey(dedupeKey)
                .title(title)
                .content(content)
                .actionUrl(actionUrl)
                .deliveredAt(LocalDateTime.now())
                .build());
    }

    private String recipientEmail(UUID userId) {
        return userRepository.findById(userId).map(u -> u.getEmail()).orElse(null);
    }

    private String recipientName(UUID userId) {
        return userRepository.findById(userId).map(u -> u.getFullName()).orElse(null);
    }

    /** Các mục bị dồn (chưa gửi) của user — job digest 08:00 dùng để gửi bù. */
    @Transactional(readOnly = true)
    public List<NotificationDelivery> deferredItems(UUID userId) {
        return deliveryRepository.findDeferred(userId, CHANNEL_DEFERRED);
    }

    /** Nội dung thông báo đã ghi (dùng khi dựng email digest). */
    @Transactional(readOnly = true)
    public java.util.Optional<Notification> notificationContent(UUID notificationId) {
        return notificationRepository.findById(notificationId);
    }

    /** Đánh dấu các mục đã gộp vào digest 08:00 để sáng mai không gửi lặp. */
    @Transactional
    public void markDeferredConsumed(List<NotificationDelivery> deliveries) {
        LocalDateTime now = LocalDateTime.now();
        for (NotificationDelivery d : deliveries) {
            d.setConsumedAt(now);
        }
        deliveryRepository.saveAll(deliveries);
    }
}
