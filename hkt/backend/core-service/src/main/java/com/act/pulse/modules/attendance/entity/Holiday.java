package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "holidays")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Holiday extends BaseEntity {
    @Column(name = "name", nullable = false, length = 150)
    private String name;
    @Column(name = "holiday_date", nullable = false)
    private LocalDate holidayDate;
    @Column(name = "is_paid", nullable = false)
    @Builder.Default private Boolean isPaid = true;
}
