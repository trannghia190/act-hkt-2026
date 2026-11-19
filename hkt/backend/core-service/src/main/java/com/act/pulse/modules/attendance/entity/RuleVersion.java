package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Phiên bản quy định — mỗi lần HR lưu là **một bản ghi mới**, không ghi đè.
 * Business: docs/06 §3.1.1 (versioning + rollback + ngày hiệu lực + lý do).
 */
@Entity
@Table(name = "rule_versions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuleVersion extends BaseEntity {

    @Column(name = "rule_id", nullable = false)
    private UUID ruleId;

    @Column(name = "version", nullable = false, length = 20)
    private String version;

    @Column(name = "value", nullable = false, columnDefinition = "text")
    private String value;

    @Column(name = "effective_from", nullable = false)
    private LocalDateTime effectiveFrom;

    @Column(name = "change_reason", nullable = false, columnDefinition = "text")
    private String changeReason;

    @Column(name = "created_by")
    private UUID createdBy;
}
