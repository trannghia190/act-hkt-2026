package com.act.pulse.modules.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/** File đính kèm của đơn từ — lưu nội dung thật trong DB (bytea). */
@Entity
@Table(name = "request_attachments")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RequestAttachment {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "request_id", nullable = false) private UUID requestId;
    @Column(name = "file_name", nullable = false, length = 255) private String fileName;
    @Column(name = "content_type", length = 100) private String contentType;
    @Column(name = "size_bytes", nullable = false) private Long sizeBytes;
    @Column(name = "data", nullable = false, columnDefinition = "bytea") private byte[] data;
    @Column(name = "uploaded_by") private UUID uploadedBy;
    @Column(name = "created_at") private LocalDateTime createdAt;

    @PrePersist void onCreate() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
