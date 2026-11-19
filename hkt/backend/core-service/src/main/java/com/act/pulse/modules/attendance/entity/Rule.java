package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Quy định trong catalog — {@code rule_key} là {@code rule_id} của business
 * (docs/06 §3.1), {@code current_value} là JSON object chứa các field của rule.
 */
@Entity
@Table(name = "rules")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Rule extends BaseEntity {

    @Column(name = "rule_key", nullable = false, unique = true, length = 100)
    private String ruleKey;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "data_type", nullable = false, length = 30)
    private String dataType;

    @Column(name = "current_value", nullable = false, columnDefinition = "text")
    private String currentValue;

    @Column(name = "description", columnDefinition = "text")
    private String description;
}
