package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "teams")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Team extends BaseEntity {
    @Column(name = "name", nullable = false, length = 100) private String name;
    @Column(name = "parent_id") private UUID parentId;
    @Column(name = "leader_id") private UUID leaderId;
    @Column(name = "is_special_approval") private Boolean isSpecialApproval;
}
