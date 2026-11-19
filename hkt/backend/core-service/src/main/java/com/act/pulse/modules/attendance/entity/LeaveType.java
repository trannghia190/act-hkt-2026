package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "leave_types")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LeaveType extends BaseEntity {
    @Column(name = "code", unique = true, nullable = false, length = 20)
    private String code;
    @Column(name = "name", nullable = false, length = 150)
    private String name;
    @Column(name = "default_days", precision = 6, scale = 2)
    private BigDecimal defaultDays;
    @Column(name = "requires_attachment", nullable = false)
    @Builder.Default
    private Boolean requiresAttachment = false;
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
    @Column(name = "config", columnDefinition = "jsonb")
    private String config;
}
