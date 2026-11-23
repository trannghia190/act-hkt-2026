package com.act.pulse.modules.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalTime;
import java.util.UUID;

/**
 * Cấu hình tùy chỉnh thông báo cá nhân (S36).
 * <p>Thay cho {@code ConcurrentHashMap} in-memory trước đây — mất khi restart
 * và không có code nào đọc. Giờ mọi lớp kiểm tra của {@code NotificationDispatcher}
 * đọc trực tiếp từ bảng này.</p>
 */
@Entity
@Table(name = "notification_preferences")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreference {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    /** Tắt Web Push trong khung giờ nghỉ — việc vẫn hiện badge, chỉ không bắn push. */
    @Column(name = "quiet_hours_enabled", nullable = false)
    @Builder.Default
    private Boolean quietHoursEnabled = true;

    @Column(name = "quiet_hours_start", nullable = false)
    @Builder.Default
    private LocalTime quietHoursStart = LocalTime.of(21, 0);

    @Column(name = "quiet_hours_end", nullable = false)
    @Builder.Default
    private LocalTime quietHoursEnd = LocalTime.of(7, 0);

    /** Tối đa số lần bắn push mỗi ngày; phần vượt được dồn vào digest 08:00. */
    @Column(name = "max_push_per_day", nullable = false)
    @Builder.Default
    private Integer maxPushPerDay = 3;

    /** Cửa sổ chống trùng: cùng một việc không nhắc lặp trong N giờ. */
    @Column(name = "dedupe_hours", nullable = false)
    @Builder.Default
    private Integer dedupeHours = 12;

    /** Tắt hoàn toàn kênh push của tài khoản. */
    @Column(name = "push_enabled", nullable = false)
    @Builder.Default
    private Boolean pushEnabled = true;

    /**
     * Bật/tắt theo từng sự kiện × kênh.
     * Cấu trúc: {@code {"MISSING_CHECKIN": {"web": true, "email": false, "push": true}, ...}}
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "events", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private String events = "{}";

    @Column(name = "created_at", nullable = false)
    private java.time.LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private java.time.LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = java.time.LocalDateTime.now();
        updatedAt = java.time.LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = java.time.LocalDateTime.now();
    }
}
