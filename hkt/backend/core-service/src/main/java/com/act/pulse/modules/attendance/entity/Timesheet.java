package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/** Kỳ bảng công theo người/tháng — lưu trạng thái draft/published/locked. */
@Entity
@Table(name = "timesheets")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Timesheet extends BaseEntity {
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "period_month", nullable = false) private Integer periodMonth;
    @Column(name = "period_year", nullable = false) private Integer periodYear;
    @Column(name = "status", nullable = false, length = 20) @Builder.Default private String status = "draft";
    @Column(name = "published_at") private LocalDateTime publishedAt;
    @Column(name = "dispute_deadline") private LocalDateTime disputeDeadline;
    @Column(name = "locked_at") private LocalDateTime lockedAt;
}
