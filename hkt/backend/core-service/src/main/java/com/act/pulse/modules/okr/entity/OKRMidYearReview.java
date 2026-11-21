package com.act.pulse.modules.okr.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Biên bản review & coaching giữa năm cho 1 nhân viên. */
@Entity
@Table(name = "okr_midyear_reviews")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OKRMidYearReview {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "review_id", nullable = false, unique = true)
    private UUID reviewId;

    @Column(name = "manager_id", nullable = false)
    private UUID managerId;

    @Column(name = "employee_feedback", columnDefinition = "TEXT")
    private String employeeFeedback;

    @Column(name = "manager_coaching", columnDefinition = "TEXT")
    private String managerCoaching;

    @Column(name = "h2_commitment", columnDefinition = "TEXT")
    private String h2Commitment;

    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "draft";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
