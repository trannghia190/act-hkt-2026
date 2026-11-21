package com.act.pulse.modules.okr.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/** Một dòng check-in tiến độ của 1 đầu việc trong 1 kỳ. Không ghi đè lịch sử. */
@Entity
@Table(name = "okr_checkins")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OKRCheckIn extends BaseEntity {

    @Column(name = "batch_id", nullable = false)
    private UUID batchId;

    @Column(name = "review_id", nullable = false)
    private UUID reviewId;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "period", nullable = false, length = 10)
    private String period;

    @Column(name = "previous_value")
    private Double previousValue;

    @Column(name = "new_value", nullable = false)
    private Double newValue;

    @Column(name = "progress_snapshot", nullable = false)
    private Integer progressSnapshot;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;
}
