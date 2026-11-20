package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AuditLog extends BaseEntity {
    @Column(name = "action", nullable = false, length = 100) private String action;
    @Column(name = "entity_name", nullable = false, length = 100) private String entityName;
    @Column(name = "entity_id", length = 100) private String entityId;
    @Column(name = "user_id") private UUID userId;
    @Column(name = "user_code", length = 50) private String userCode;
    @Column(name = "user_name", length = 150) private String userName;
    @Column(name = "old_value", columnDefinition = "text") private String oldValue;
    @Column(name = "new_value", columnDefinition = "text") private String newValue;
    @Column(name = "reason", columnDefinition = "text") private String reason;
    @Column(name = "ip_address", length = 50) private String ipAddress;
}
