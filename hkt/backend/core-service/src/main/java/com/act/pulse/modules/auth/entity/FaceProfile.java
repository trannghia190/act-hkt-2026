package com.act.pulse.modules.auth.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Hồ sơ khuôn mặt — **chỉ lưu vector đặc trưng, KHÔNG lưu ảnh thô**
 * (business: docs/01 "Hồ sơ khuôn mặt").
 */
@Entity
@Table(name = "face_profiles")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FaceProfile extends BaseEntity {

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    /** Vector 512 chiều — lưu dạng pgvector. */
    @Column(name = "embedding", nullable = false, columnDefinition = "vector(512)")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VECTOR)
    private float[] embedding;

    @Column(name = "model_version", nullable = false, length = 30)
    @Builder.Default
    private String modelVersion = "sface-512-v1";

    /** active | reset */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "active";

    @Column(name = "consent_at")
    private LocalDateTime consentAt;

    @Column(name = "enrolled_at")
    private LocalDateTime enrolledAt;

    @Column(name = "enrolled_by")
    private UUID enrolledBy;

    @Column(name = "reset_by")
    private UUID resetBy;

    @Column(name = "reset_reason", columnDefinition = "text")
    private String resetReason;

    @Column(name = "last_verified_at")
    private LocalDateTime lastVerifiedAt;
}
