package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "leave_ledger")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LeaveLedgerEntry extends BaseEntity {
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Column(name = "leave_type", nullable = false, length = 20)
    private String leaveType;
    @Column(name = "action", nullable = false, length = 20)
    private String action; // GRANT | USED | EXPIRED | ADJUST
    @Column(name = "amount", nullable = false, precision = 6, scale = 2)
    private BigDecimal amount;
    @Column(name = "balance_after", nullable = false, precision = 6, scale = 2)
    private BigDecimal balanceAfter;
    @Column(name = "reason", columnDefinition = "text")
    private String reason;
    @Column(name = "performed_by")
    private UUID performedBy;
    @Column(name = "performed_by_system", nullable = false)
    @Builder.Default
    private Boolean performedBySystem = false;
}
