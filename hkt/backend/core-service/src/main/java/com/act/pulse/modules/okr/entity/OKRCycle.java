package com.act.pulse.modules.okr.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "okr_cycles")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OKRCycle extends BaseEntity {

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "cycle_year", nullable = false)
    private Integer cycleYear;

    @Column(name = "phases", nullable = false, columnDefinition = "JSONB")
    private String phases;

    @Column(name = "checkin_interval", nullable = false, length = 20)
    @Builder.Default
    private String checkinInterval = "MONTHLY";

    @Column(name = "scale_min", nullable = false)
    @Builder.Default
    private Integer scaleMin = 1;

    @Column(name = "scale_max", nullable = false)
    @Builder.Default
    private Integer scaleMax = 5;

    @Column(name = "score_categories", nullable = false)
    @Builder.Default
    private Integer scoreCategories = 2;

    @Column(name = "alignment_enabled", nullable = false)
    @Builder.Default
    private Boolean alignmentEnabled = false;

    /** Mục tiêu công ty (20%) — JSON [{id,title,category,progress,note}]; ghi qua native query. */
    @Column(name = "company_objectives", columnDefinition = "JSONB", insertable = false, updatable = false)
    private String companyObjectives;

    /** Mốc tính "thời gian công tác" trong báo cáo tổng hợp. Null = 31/12 năm chu kỳ. */
    @Column(name = "seniority_cutoff_date")
    private java.time.LocalDate seniorityCutoffDate;

    /** Bước 4: Giám đốc đánh giá chung trước khi HR chốt & khoá. */
    @Column(name = "director_reviewed_at")
    private java.time.LocalDateTime directorReviewedAt;

    @Column(name = "director_reviewed_by")
    private java.util.UUID directorReviewedBy;

    @Column(name = "director_review_comment", columnDefinition = "TEXT")
    private String directorReviewComment;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "active";
}
