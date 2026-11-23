package com.act.pulse.modules.notification.service;

import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.notification.entity.NotificationPreference;
import com.act.pulse.modules.notification.repository.NotificationPreferenceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Đọc/ghi cấu hình tùy chỉnh thông báo của người dùng.
 * <p>Nếu user chưa có hàng trong DB → tạo mặc định từ
 * {@link NotificationEventCatalog} và quy tắc hệ thống {@code notification}
 * (max_push_per_day, quiet_hours_start/end, dedupe_window_hours).</p>
 */
@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    private final NotificationPreferenceRepository preferenceRepository;
    private final RuleService ruleService;
    private final ObjectMapper objectMapper;

    /** Cấu hình đã resolve (mặc định + tuỳ biến) cho một user — dùng nội bộ dispatcher. */
    public record ResolvedPrefs(UUID userId,
                                boolean quietHoursEnabled,
                                LocalTime quietHoursStart,
                                LocalTime quietHoursEnd,
                                int maxPushPerDay,
                                int dedupeHours,
                                boolean pushEnabled,
                                Map<String, Map<String, Boolean>> channels) {

        /** Kênh được bật cho một sự kiện. */
        public boolean channelEnabled(String eventKey, String channel) {
            Map<String, Boolean> ch = channels.get(eventKey);
            if (ch == null) {
                // Sự kiện chưa có trong danh mục (ví dụ loại OKR mới): KHÔNG được
                // nuốt im lặng thông báo — giữ kênh in-app như hành vi trước khi
                // có tuỳ chỉnh, để producer mới không vô tình bị mất.
                return "web".equals(channel);
            }
            return Boolean.TRUE.equals(ch.get(channel));
        }

        /**
         * Có đang nằm trong khung giờ yên lặng không. Khung có thể qua nửa đêm
         * (21:00 → 07:00) nên phải so theo hai nhánh.
         */
        public boolean inQuietHours(LocalTime now) {
            if (!quietHoursEnabled) return false;
            LocalTime s = quietHoursStart;
            LocalTime e = quietHoursEnd;
            if (s == null || e == null || s.equals(e)) return false;
            if (s.isBefore(e)) {
                return !now.isBefore(s) && now.isBefore(e);
            }
            // qua nửa đêm
            return !now.isBefore(s) || now.isBefore(e);
        }
    }

    @Transactional
    public ResolvedPrefs resolve(UUID userId, String role) {
        if (userId == null) return defaults(null, role);

        NotificationPreference pref = preferenceRepository.findById(userId).orElseGet(() -> {
            NotificationPreference fresh = new NotificationPreference();
            fresh.setUserId(userId);
            fresh.setQuietHoursEnabled(ruleService.getBoolean("notification", "quiet_hours_enabled", true));
            fresh.setQuietHoursStart(parseTime(ruleService.getString("notification", "quiet_hours_start", "21:00")));
            fresh.setQuietHoursEnd(parseTime(ruleService.getString("notification", "quiet_hours_end", "07:00")));
            fresh.setMaxPushPerDay(ruleService.getInt("notification", "max_push_per_day",
                    "MANAGER".equalsIgnoreCase(role) ? 5 : 3));
            fresh.setDedupeHours(ruleService.getInt("notification", "dedupe_window_hours", 12));
            fresh.setPushEnabled(true);
            fresh.setEvents(writeJson(NotificationEventCatalog.defaultChannelMap()));
            return preferenceRepository.save(fresh);
        });

        Map<String, Map<String, Boolean>> channels = readChannels(pref.getEvents());
        return new ResolvedPrefs(
                pref.getUserId(),
                Boolean.TRUE.equals(pref.getQuietHoursEnabled()),
                pref.getQuietHoursStart(),
                pref.getQuietHoursEnd(),
                pref.getMaxPushPerDay() == null ? 3 : pref.getMaxPushPerDay(),
                pref.getDedupeHours() == null ? 12 : pref.getDedupeHours(),
                Boolean.TRUE.equals(pref.getPushEnabled()),
                channels);
    }

    /** Payload đầy đủ cho API GET /notifications/preferences. */
    public Map<String, Object> describe(ResolvedPrefs prefs) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", prefs.userId() == null ? null : prefs.userId().toString());
        out.put("quietHoursEnabled", prefs.quietHoursEnabled());
        out.put("quietHoursStart", format(prefs.quietHoursStart()));
        out.put("quietHoursEnd", format(prefs.quietHoursEnd()));
        out.put("maxPushPerDay", prefs.maxPushPerDay());
        out.put("dedupeHours", prefs.dedupeHours());
        out.put("pushEnabled", prefs.pushEnabled());

        Map<String, Object> events = new LinkedHashMap<>();
        for (var def : NotificationEventCatalog.all()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("label", def.label());
            item.put("category", def.category());
            item.put("web", prefs.channelEnabled(def.key(), "web"));
            item.put("email", prefs.channelEnabled(def.key(), "email"));
            item.put("push", prefs.channelEnabled(def.key(), "push"));
            events.put(def.key(), item);
        }
        out.put("events", events);
        return out;
    }

    /**
     * Lưu cấu hình. {@code body} chứa các field cập nhật; {@code events} được merge
     * **theo từng key** (chỉ kênh được gửi lên mới bị ghi đè) — trước đây merge
     * cả object khiến các field khác của cùng event bị mất.
     */
    @Transactional
    public ResolvedPrefs update(UUID userId, String role, Map<String, Object> body) {
        if (userId == null) return defaults(null, role);
        NotificationPreference pref = preferenceRepository.findById(userId).orElseGet(() -> {
            NotificationPreference fresh = new NotificationPreference();
            fresh.setUserId(userId);
            fresh.setEvents(writeJson(NotificationEventCatalog.defaultChannelMap()));
            return fresh;
        });

        if (body != null) {
            if (body.containsKey("quietHoursEnabled")) {
                pref.setQuietHoursEnabled(toBoolean(body.get("quietHoursEnabled"), pref.getQuietHoursEnabled()));
            }
            if (body.containsKey("quietHoursStart")) {
                pref.setQuietHoursStart(parseTime(String.valueOf(body.get("quietHoursStart"))));
            }
            if (body.containsKey("quietHoursEnd")) {
                pref.setQuietHoursEnd(parseTime(String.valueOf(body.get("quietHoursEnd"))));
            }
            if (body.containsKey("maxPushPerDay")) {
                pref.setMaxPushPerDay(clampInt(body.get("maxPushPerDay"), 0, 100, pref.getMaxPushPerDay()));
            }
            if (body.containsKey("dedupeHours")) {
                pref.setDedupeHours(clampInt(body.get("dedupeHours"), 0, 168, pref.getDedupeHours()));
            }
            if (body.containsKey("pushEnabled")) {
                pref.setPushEnabled(toBoolean(body.get("pushEnabled"), pref.getPushEnabled()));
            }
            if (body.get("events") instanceof Map<?, ?> evMap) {
                Map<String, Map<String, Boolean>> merged = readChannels(pref.getEvents());
                for (Map.Entry<?, ?> entry : evMap.entrySet()) {
                    if (entry.getKey() == null || !(entry.getValue() instanceof Map<?, ?> raw)) continue;
                    String key = entry.getKey().toString();
                    if (!NotificationEventCatalog.exists(key)) continue;
                    Map<String, Boolean> current = merged.getOrDefault(key, new LinkedHashMap<>());
                    Map<String, Boolean> next = new LinkedHashMap<>(current);
                    for (String channel : new String[]{"web", "email", "push"}) {
                        if (raw.containsKey(channel)) {
                            next.put(channel, toBoolean(raw.get(channel), Boolean.TRUE.equals(current.get(channel))));
                        }
                    }
                    merged.put(key, next);
                }
                pref.setEvents(writeJson(merged));
            }
        }
        preferenceRepository.save(pref);
        return resolve(userId, role);
    }

    /** Mặc định khi chưa có gì trong DB (ví dụ request không đăng nhập). */
    public ResolvedPrefs defaults(UUID userId, String role) {
        return new ResolvedPrefs(
                userId,
                ruleService.getBoolean("notification", "quiet_hours_enabled", true),
                parseTime(ruleService.getString("notification", "quiet_hours_start", "21:00")),
                parseTime(ruleService.getString("notification", "quiet_hours_end", "07:00")),
                ruleService.getInt("notification", "max_push_per_day", "MANAGER".equalsIgnoreCase(role) ? 5 : 3),
                ruleService.getInt("notification", "dedupe_window_hours", 12),
                true,
                NotificationEventCatalog.defaultChannelMap());
    }

    // ── helper ──────────────────────────────────────────────────────────────
    @SuppressWarnings("unchecked")
    private Map<String, Map<String, Boolean>> readChannels(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>(NotificationEventCatalog.defaultChannelMap());
        try {
            Map<String, Map<String, Boolean>> parsed = objectMapper.readValue(json, new TypeReference<>() {});
            Map<String, Map<String, Boolean>> merged = new LinkedHashMap<>(NotificationEventCatalog.defaultChannelMap());
            for (Map.Entry<String, Map<String, Boolean>> e : parsed.entrySet()) {
                if (!NotificationEventCatalog.exists(e.getKey())) continue;
                Map<String, Boolean> ch = new LinkedHashMap<>(merged.get(e.getKey()));
                ch.putAll(e.getValue());
                merged.put(e.getKey(), ch);
            }
            return merged;
        } catch (Exception ex) {
            return new LinkedHashMap<>(NotificationEventCatalog.defaultChannelMap());
        }
    }

    private String writeJson(Map<String, Map<String, Boolean>> channels) {
        try {
            return objectMapper.writeValueAsString(channels);
        } catch (Exception ex) {
            return "{}";
        }
    }

    public static LocalTime parseTime(String value) {
        if (value == null || value.isBlank()) return null;
        String s = value.trim();
        if (s.length() == 5 && s.charAt(2) == ':') s = s + ":00";
        try {
            return LocalTime.parse(s);
        } catch (Exception ex) {
            return null;
        }
    }

    public static String format(LocalTime time) {
        return time == null ? null : time.format(HHMM);
    }

    private static boolean toBoolean(Object value, boolean fallback) {
        if (value instanceof Boolean b) return b;
        if (value instanceof String s) {
            if ("true".equalsIgnoreCase(s)) return true;
            if ("false".equalsIgnoreCase(s)) return false;
        }
        return fallback;
    }

    private static int clampInt(Object value, int min, int max, int fallback) {
        try {
            int v = value instanceof Number n ? n.intValue() : Integer.parseInt(String.valueOf(value).trim());
            return Math.max(min, Math.min(max, v));
        } catch (Exception ex) {
            return fallback;
        }
    }
}
