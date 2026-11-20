package com.act.pulse.modules.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/** Thông báo gửi cho nhân viên (bảng notifications có sẵn từ V1). */
@Entity
@Table(name = "notifications")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "type", nullable = false, length = 50)
    private String type;

    @Column(name = "priority", length = 20)
    private String priority;

    @Column(name = "action_url", length = 255)
    private String actionUrl;

    @Column(name = "is_read")
    private Boolean isRead;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (isRead == null) isRead = false;
        if (priority == null) priority = "MEDIUM";
    }
}
