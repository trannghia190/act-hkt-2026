package com.act.pulse.modules.okr.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "okr_reviews")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OKRReview extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "cycle_year", nullable = false)
    private Integer cycleYear;

    @Column(name = "box2_business_text", columnDefinition = "TEXT")
    private String box2BusinessText;

    @Column(name = "box2_attachment_url")
    private String box2AttachmentUrl;

    @Column(name = "box2_self_score")
    private Integer box2SelfScore; // 1 to 5

    @Column(name = "box2_manager_score")
    private Integer box2ManagerScore; // 1 to 5

    @Column(name = "box3_people_text", columnDefinition = "TEXT")
    private String box3PeopleText;

    @Column(name = "box3_attachment_url")
    private String box3AttachmentUrl;

    @Column(name = "box3_self_score")
    private Integer box3SelfScore; // 1 to 5

    @Column(name = "box3_manager_score")
    private Integer box3ManagerScore; // 1 to 5

    @Column(name = "box4_proposal_next_year", columnDefinition = "TEXT")
    private String box4ProposalNextYear;

    @Column(name = "final_average_score", precision = 3, scale = 2)
    private BigDecimal finalAverageScore;

    @Column(name = "final_ranking", length = 10)
    private String finalRanking; // A, B, C, D

    @Column(name = "current_step")
    @Builder.Default
    private Integer currentStep = 1; // 1 to 5
}
