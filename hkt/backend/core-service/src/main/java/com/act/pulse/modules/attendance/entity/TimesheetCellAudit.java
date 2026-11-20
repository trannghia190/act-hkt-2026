package com.act.pulse.modules.attendance.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/** Nhật ký sửa ô công (append-only). */
@Entity
@Table(name = "timesheet_audit_logs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TimesheetCellAudit {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "timesheet_cell_id", nullable = false) private UUID timesheetCellId;
    @Column(name = "old_value", length = 20) private String oldValue;
    @Column(name = "new_value", length = 20) private String newValue;
    @Column(name = "reason", nullable = false, columnDefinition = "text") private String reason;
    @Column(name = "changed_by") private UUID changedBy;
    @Column(name = "ip_address", length = 50) private String ipAddress;
    @Column(name = "created_at") private LocalDateTime createdAt;

    @PrePersist void onCreate() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
