package com.act.pulse.modules.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** Khiếu nại bảng công — lưu DB để không mất khi restart. */
@Entity
@Table(name = "timesheet_disputes")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TimesheetDispute {
    @Id @Column(name = "id", length = 20) private String id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "work_date", nullable = false) private LocalDate workDate;
    @Column(name = "reason", nullable = false, columnDefinition = "text") private String reason;
    @Column(name = "status", nullable = false, length = 20) @Builder.Default private String status = "PENDING";
    @Column(name = "deadline") private LocalDateTime deadline;
    @Column(name = "resolution_action", length = 30) private String resolutionAction;
    @Column(name = "resolved_by") private UUID resolvedBy;
    @Column(name = "resolved_at") private LocalDateTime resolvedAt;
    @Column(name = "created_at") private LocalDateTime createdAt;

    @PrePersist void onCreate() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
