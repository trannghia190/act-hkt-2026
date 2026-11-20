package com.act.pulse.modules.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "todo_completions")
@IdClass(TodoCompletion.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TodoCompletion {
    @Id @Column(name = "user_id", nullable = false) private UUID userId;
    @Id @Column(name = "todo_id", nullable = false, length = 50) private String todoId;
    @Column(name = "completed_at") private LocalDateTime completedAt;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID userId;
        private String todoId;
    }
}
