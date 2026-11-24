package com.act.pulse.modules.notification.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.notification.entity.PushSubscription;
import com.act.pulse.modules.notification.repository.PushSubscriptionRepository;
import com.act.pulse.modules.notification.service.NotificationDigestJob;
import com.act.pulse.modules.notification.service.NotificationEventCatalog;
import com.act.pulse.modules.notification.service.NotificationPreferenceService;
import com.act.pulse.modules.notification.service.NotificationPushService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tuỳ chỉnh thông báo cá nhân (S36).
 * <p>Trước đây nằm trong {@code BusinessGapController} với bộ nhớ tĩnh — mất khi restart
 * và không có code nào đọc. Nay lưu trong bảng {@code notification_preferences} và
 * được {@code NotificationDispatcher} áp dụng thật khi phát thông báo.</p>
 */
@RestController
@RequestMapping("/notifications")
@Tag(name = "8. Notification API", description = "Tuỳ chỉnh thông báo cá nhân + Web Push (S36)")
@RequiredArgsConstructor
public class NotificationPreferenceController {

    private final NotificationPreferenceService preferenceService;
    private final NotificationPushService pushService;
    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final NotificationDigestJob digestJob;
    private final UserRepository userRepository;

    @GetMapping("/preferences")
    @Operation(summary = "Lấy cấu hình tuỳ chỉnh thông báo của tôi (S36)")
    public ApiResponse<Map<String, Object>> preferences() {
        UUID uid = CurrentUser.userId();
        var prefs = preferenceService.resolve(uid, CurrentUser.role());
        Map<String, Object> out = new LinkedHashMap<>(preferenceService.describe(prefs));
        out.put("events", eventsWithDefaults(prefs, visibleEvents(uid)));
        // Số việc thật đang chờ — lấy từ Todo Inbox, cùng nguồn với digest 08:00.
        out.put("personalTasksCount", uid == null ? 0 : digestJob.pendingTaskCount(uid));
        out.put("approvalTasksCount", uid == null ? 0 : digestJob.pendingApprovalCount(uid));
        out.put("pushSupported", pushService.isEnabled());
        return ApiResponse.ok(out, "Lấy tùy chỉnh thông báo thành công");
    }

    @PutMapping("/preferences")
    @Operation(summary = "Lưu cấu hình tuỳ chỉnh thông báo của tôi (S36)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> savePreferences(
            @RequestBody(required = false) Map<String, Object> body) {
        UUID uid = CurrentUser.userId();
        String role = CurrentUser.role();

        // Chỉ sửa được cấu hình của chính mình; HR được sửa của người khác.
        if (body != null && body.get("targetUserId") != null) {
            String target = String.valueOf(body.get("targetUserId")).trim();
            boolean isSelf = target.isEmpty()
                    || target.equalsIgnoreCase("current")
                    || target.equalsIgnoreCase("default")
                    || (uid != null && target.equalsIgnoreCase(uid.toString()));
            if (!isSelf && !CurrentUser.isHr()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(ApiResponse.error("Bạn không có quyền sửa đổi tùy chỉnh thông báo của người khác!"));
            }
            if (!isSelf) {
                UUID targetId = parseUuid(target);
                if (targetId == null) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(ApiResponse.error("targetUserId không hợp lệ."));
                }
                var prefs = preferenceService.update(targetId, role, body);
                Map<String, Object> out = new LinkedHashMap<>(preferenceService.describe(prefs));
                out.put("events", eventsWithDefaults(prefs, visibleEvents(targetId)));
                return ResponseEntity.ok(ApiResponse.ok(out, "Đã lưu cài đặt thông báo thành công"));
            }
        }

        var prefs = preferenceService.update(uid, role, body);
        Map<String, Object> out = new LinkedHashMap<>(preferenceService.describe(prefs));
        out.put("events", eventsWithDefaults(prefs, visibleEvents(uid)));
        out.put("pushSupported", pushService.isEnabled());
        return ResponseEntity.ok(ApiResponse.ok(out, "Đã lưu cài đặt thông báo thành công"));
    }

    /** Danh sách sự kiện trong catalog (nhãn + nhóm) để UI dựng ma trận. */
    @GetMapping("/preferences/events")
    @Operation(summary = "Danh mục sự kiện thông báo (mỗi sự kiện × 3 kênh)")
    public ApiResponse<List<Map<String, Object>>> events() {
        List<Map<String, Object>> list = visibleEvents(CurrentUser.userId()).stream().map(def -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", def.key());
            m.put("label", def.label());
            m.put("category", def.category());
            m.put("categoryLabel", NotificationEventCatalog.categoryLabel(def.category()));
            m.put("defaultWeb", def.defaultWeb());
            m.put("defaultEmail", def.defaultEmail());
            m.put("defaultPush", def.defaultPush());
            m.put("roles", def.roles());
            return m;
        }).toList();
        return ApiResponse.ok(list, "Danh mục sự kiện thông báo");
    }

    // ── Web Push ────────────────────────────────────────────────────────────

    @GetMapping("/push/public-key")
    @Operation(summary = "VAPID public key để trình duyệt đăng ký Web Push")
    public ApiResponse<Map<String, Object>> publicKey() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("publicKey", pushService.publicKey());
        out.put("enabled", pushService.isEnabled());
        return ApiResponse.ok(out, "Khoá công khai VAPID");
    }

    @PostMapping("/push/subscribe")
    @Operation(summary = "Đăng ký thiết bị nhận Web Push")
    public ApiResponse<Boolean> subscribe(@RequestBody Map<String, Object> body) {
        UUID uid = CurrentUser.userId();
        if (uid == null) return ApiResponse.error("Vui lòng đăng nhập để bật thông báo push.");
        String endpoint = str(body.get("endpoint"));
        // Trình duyệt gửi đúng shape của PushSubscription.toJSON(): endpoint + keys{p256dh,auth}.
        // Vẫn nhận dạng phẳng p256dh/auth ở top-level cho client cũ.
        Object keysRaw = body.get("keys");
        Map<?, ?> keys = keysRaw instanceof Map<?, ?> m ? m : Map.of();
        String flatP256dh = str(body.get("p256dh"));
        String flatAuth = str(body.get("auth"));
        String p256dh = flatP256dh != null ? flatP256dh : str(keys.get("p256dh"));
        String auth = flatAuth != null ? flatAuth : str(keys.get("auth"));
        if (endpoint == null || p256dh == null || auth == null) {
            return ApiResponse.error("Thiếu endpoint/p256dh/auth — không đăng ký được push.");
        }
        PushSubscription sub = pushSubscriptionRepository.findByEndpoint(endpoint)
                .orElseGet(() -> PushSubscription.builder()
                        .userId(uid)
                        .endpoint(endpoint)
                        .p256dh(p256dh)
                        .auth(auth)
                        .build());
        sub.setUserId(uid);
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        sub.setUserAgent(str(body.get("userAgent")));
        pushSubscriptionRepository.save(sub);
        // Có thiết bị nhận push nghĩa là người dùng muốn dùng kênh này — bật công tắc tổng
        // để NotificationDispatcher thực sự bắn (pushEnabled=false sẽ chặn mọi push).
        preferenceService.update(uid, CurrentUser.role(), Map.of("pushEnabled", true));
        return ApiResponse.ok(true, "Đã đăng ký nhận thông báo push trên thiết bị này");
    }

    @PostMapping("/push/unsubscribe")
    @Operation(summary = "Huỷ đăng ký Web Push của thiết bị")
    public ApiResponse<Boolean> unsubscribe(@RequestBody Map<String, Object> body) {
        UUID uid = CurrentUser.userId();
        String endpoint = str(body.get("endpoint"));
        if (uid == null || endpoint == null) return ApiResponse.error("Thiếu endpoint.");
        long removed = pushSubscriptionRepository.deleteByUserIdAndEndpoint(uid, endpoint);
        // Hết thiết bị nhận push → tắt công tắc tổng, tránh dispatcher ghi delivery
        // PUSH cho user không còn thiết bị nào.
        if (removed > 0 && pushSubscriptionRepository.findByUserId(uid).isEmpty()) {
            preferenceService.update(uid, CurrentUser.role(), Map.of("pushEnabled", false));
        }
        return ApiResponse.ok(removed > 0, removed > 0 ? "Đã tắt thông báo push" : "Không tìm thấy đăng ký push");
    }

    @GetMapping("/push/subscriptions")
    @Operation(summary = "Danh sách thiết bị đang bật push của tôi")
    public ApiResponse<List<Map<String, Object>>> subscriptions() {
        UUID uid = CurrentUser.userId();
        if (uid == null) return ApiResponse.ok(List.of(), "Danh sách đăng ký push");
        List<Map<String, Object>> list = pushSubscriptionRepository.findByUserId(uid).stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("endpoint", s.getEndpoint());
            m.put("userAgent", s.getUserAgent());
            m.put("createdAt", s.getCreatedAt() == null ? null : s.getCreatedAt().toString());
            m.put("lastUsedAt", s.getLastUsedAt() == null ? null : s.getLastUsedAt().toString());
            return m;
        }).toList();
        return ApiResponse.ok(list, "Danh sách đăng ký push");
    }

    @GetMapping("/push/status")
    @Operation(summary = "Trạng thái Web Push của tài khoản (đã đăng ký thiết bị nào)")
    public ApiResponse<Map<String, Object>> pushStatus() {
        UUID uid = CurrentUser.userId();
        List<PushSubscription> subs = uid == null ? List.of() : pushSubscriptionRepository.findByUserId(uid);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("subscribed", !subs.isEmpty());
        out.put("count", subs.size());
        out.put("pushEnabled", pushService.isEnabled());
        return ApiResponse.ok(out, "Trạng thái thông báo push");
    }

    // ── helper ──────────────────────────────────────────────────────────────

    /** Sự kiện áp dụng cho người dùng: nhân viên, thêm quản lý nếu có cấp dưới, thêm HR nếu là HR/Admin. */
    private List<NotificationEventCatalog.EventDef> visibleEvents(UUID userId) {
        boolean hr = CurrentUser.isHr();
        boolean manager = "MANAGER".equalsIgnoreCase(CurrentUser.role())
                || (userId != null && userRepository.countByManagerId(userId) > 0);
        return NotificationEventCatalog.allFor(manager, hr);
    }

    private Map<String, Object> eventsWithDefaults(NotificationPreferenceService.ResolvedPrefs prefs,
                                                   List<NotificationEventCatalog.EventDef> visible) {
        Map<String, Object> events = new LinkedHashMap<>();
        for (var def : visible) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("label", def.label());
            item.put("category", def.category());
            item.put("web", prefs.channelEnabled(def.key(), "web"));
            item.put("email", prefs.channelEnabled(def.key(), "email"));
            item.put("push", prefs.channelEnabled(def.key(), "push"));
            item.put("roles", def.roles());
            events.put(def.key(), item);
        }
        return events;
    }

    private static String str(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    private static UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (Exception ex) {
            return null;
        }
    }
}
