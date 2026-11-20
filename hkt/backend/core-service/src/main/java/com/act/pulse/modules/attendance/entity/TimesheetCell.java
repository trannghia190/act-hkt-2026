package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.util.UUID;

/** Ô công sửa tay — 1 ô/ngày/kỳ, lưu DB thay vì RAM. */
@Entity
@Table(name = "timesheet_cells")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TimesheetCell extends BaseEntity {
    @Column(name = "timesheet_id", nullable = false) private UUID timesheetId;
    @Column(name = "work_date", nullable = false) private LocalDate workDate;
    @Column(name = "symbol", length = 20) private String symbol;
    @Column(name = "work_minutes", nullable = false) @Builder.Default private Integer workMinutes = 0;
    @Column(name = "is_manual", nullable = false) @Builder.Default private Boolean isManual = false;
}
