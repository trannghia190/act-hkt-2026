package com.act.pulse.modules.okr.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "okr_items")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OKRItem extends BaseEntity {

    @Column(name = "review_id", nullable = false)
    private UUID reviewId;

    @Column(name = "group_type", nullable = false, length = 20)
    private String groupType; // BUSINESS | PEOPLE

    @Column(name = "title", nullable = false, columnDefinition = "TEXT")
    private String title;

    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    @Column(name = "weight")
    private Integer weight;

    @Column(name = "progress", nullable = false)
    @Builder.Default
    private Integer progress = 0;

    @Column(name = "due_date")
    private java.time.LocalDate dueDate;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "delete_reason", columnDefinition = "TEXT")
    private String deleteReason;
}
