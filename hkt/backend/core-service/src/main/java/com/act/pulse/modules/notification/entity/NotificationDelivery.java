package com.act.pulse.modules.notification.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Lịch sử **một lần gửi** trên một kênh — nền tảng cho cửa sổ chống trùng (dedupe)
 * và giới hạn số push mỗi ngày. Trước đây hai job OKR tự quét toàn bộ lịch sử
 * thông báo để chống trùng theo "1 lần/ngày" (không liên quan cấu hình người dùng).
 */
@Entity
@Table(name = "notification_deliveries")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDelivery {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Khóa sự kiện chuẩn hóa (MISSING_CHECKIN, REQUEST_REJECTED, OKR_*…). */
    @Column(name = "event_key", nullable = false, length = 50)
    private String eventKey;

    /** WEB | EMAIL | PUSH */
    @Column(name = "channel", nullable = false, length = 10)
    private String channel;

    @Column(name = "notification_id")
    private UUID notificationId;

    /** Khóa nhận diện nội dung — cùng key trong cửa sổ dedupe thì không gửi lại. */
    @Column(name = "dedupe_key", length = 255)
    private String dedupeKey;

    /** Nội dung dự phòng cho mục bị dồn — kênh WEB có thể đang tắt nên không có Notification. */
    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "text")
    private String content;

    @Column(name = "action_url", length = 500)
    private String actionUrl;

    /** Thời điểm job digest 08:00 đã gộp mục bị dồn vào email — null = còn chờ gửi. */
    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;

    @Column(name = "delivered_at", nullable = false)
    private LocalDateTime deliveredAt;

    @PrePersist
    void onCreate() {
        if (deliveredAt == null) deliveredAt = LocalDateTime.now();
    }
}
