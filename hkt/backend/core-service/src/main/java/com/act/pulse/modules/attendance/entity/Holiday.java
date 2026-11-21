package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "holidays")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Holiday extends BaseEntity {
    @Column(name = "name", nullable = false, length = 150)
    private String name;
    /** Ngày bắt đầu (hoặc ngày duy nhất nếu lễ 1 ngày). */
    @Column(name = "holiday_date", nullable = false)
    private LocalDate holidayDate;
    /** Ngày kết thúc (bao gồm) — null nghĩa là lễ 1 ngày như holidayDate. */
    @Column(name = "end_date")
    private LocalDate endDate;
    @Column(name = "is_paid", nullable = false)
    @Builder.Default private Boolean isPaid = true;
    /** Người tạo cấu hình ngày lễ (audit). */
    @Column(name = "created_by")
    private java.util.UUID createdBy;
    @Column(name = "created_by_name", length = 150)
    private String createdByName;

    /** Ngày kết thúc thực tế của kỳ lễ (bao gồm). */
    public LocalDate lastDate() {
        return endDate != null && !endDate.isBefore(holidayDate) ? endDate : holidayDate;
    }

    /** Ngày lễ có phủ ngày d hay không (tính cả hai đầu). */
    public boolean covers(LocalDate d) {
        return d != null && holidayDate != null && !d.isBefore(holidayDate) && !d.isAfter(lastDate());
    }

    /** Toàn bộ ngày của kỳ lễ, gồm cả ngày đầu và ngày cuối. */
    public List<LocalDate> dates() {
        return holidayDate.datesUntil(lastDate().plusDays(1)).toList();
    }
}
