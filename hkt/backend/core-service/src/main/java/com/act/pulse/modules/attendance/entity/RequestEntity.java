package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "requests")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RequestEntity extends BaseEntity {
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Column(name = "request_type", nullable = false, length = 20)
    private String requestType; // LATE_EARLY | ADJUST | LEAVE | WFH
    @Column(name = "leave_type", length = 20)
    private String leaveType;
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private String payload;
    @Column(name = "applied_parameters", columnDefinition = "jsonb")
    private String appliedParameters;
    @Column(name = "work_date")
    private LocalDate workDate;
    @Column(name = "minutes")
    private Integer minutes;
    @Column(name = "reason", nullable = false, columnDefinition = "text")
    private String reason;
    @Column(name = "status", nullable = false, length = 20)
    private String status; // DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | WITHDRAWN
    @Column(name = "current_step", nullable = false)
    @Builder.Default
    private Integer currentStep = 0;
    @Column(name = "decided_by")
    private UUID decidedBy;
    @Column(name = "decided_at")
    private LocalDateTime decidedAt;
    @Column(name = "decision_comment", columnDefinition = "text")
    private String decisionComment;
}
