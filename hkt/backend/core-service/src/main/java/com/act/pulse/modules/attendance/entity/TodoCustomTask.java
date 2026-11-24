package com.act.pulse.modules.attendance.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Việc cần làm do người dùng tự tạo trong Todo Inbox (S02).
 * <p>Trước đây lưu trong {@code ConcurrentHashMap} tĩnh — mất khi backend restart.
 * Nay lưu DB để số việc chờ / badge sidebar / digest 08:00 luôn khớp nhau.</p>
 */
@Entity
@Table(name = "todo_custom_tasks")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TodoCustomTask {
    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "urgency", nullable = false, length = 20)
    private String urgency;

    @Column(name = "module", nullable = false, length = 20)
    private String module;

    @Column(name = "action_url", length = 255)
    private String actionUrl;

    @Column(name = "action_label", length = 100)
    private String actionLabel;

    @Column(name = "due_date", length = 50)
    private String dueDate;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
