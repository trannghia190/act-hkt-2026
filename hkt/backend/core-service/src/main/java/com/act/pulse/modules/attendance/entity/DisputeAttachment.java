package com.act.pulse.modules.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Giấy tờ đính kèm của khiếu nại bảng công — lưu nội dung thật trong DB (bytea).
 * Dùng khi nhân viên khiếu nại theo hướng "chuyển thành nghỉ" mà loại nghỉ
 * yêu cầu giấy tờ (ốm, thai sản…): thiếu giấy tờ thì không tạo/duyệt được.
 */
@Entity
@Table(name = "dispute_attachments")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DisputeAttachment {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "dispute_id", nullable = false, length = 20) private String disputeId;
    @Column(name = "file_name", nullable = false, length = 255) private String fileName;
    @Column(name = "content_type", length = 100) private String contentType;
    @Column(name = "size_bytes", nullable = false) private Long sizeBytes;
    @Column(name = "data", nullable = false, columnDefinition = "bytea") private byte[] data;
    @Column(name = "uploaded_by") private UUID uploadedBy;
    @Column(name = "created_at") private LocalDateTime createdAt;

    @PrePersist void onCreate() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
