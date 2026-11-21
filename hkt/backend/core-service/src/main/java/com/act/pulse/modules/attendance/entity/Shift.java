package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalTime;

@Entity
@Table(name = "shifts")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Shift extends BaseEntity {
    @Column(name = "code", unique = true, nullable = false, length = 50)
    private String code;
    @Column(name = "name", nullable = false, length = 100)
    private String name;
    @Column(name = "check_in_start", nullable = false) private LocalTime checkInStart;
    @Column(name = "check_in_end", nullable = false) private LocalTime checkInEnd;
    @Column(name = "check_out_start", nullable = false) private LocalTime checkOutStart;
    @Column(name = "check_out_end", nullable = false) private LocalTime checkOutEnd;
    @Column(name = "lunch_break_start") private LocalTime lunchBreakStart;
    @Column(name = "lunch_break_end") private LocalTime lunchBreakEnd;
    @Column(name = "required_work_hours", precision = 4, scale = 2) private BigDecimal requiredWorkHours;
    @Column(name = "is_active") @Builder.Default private Boolean isActive = true;
    @Column(name = "is_flexible") @Builder.Default private Boolean isFlexible = false;
    @Column(name = "flexible_checkin_from") private LocalTime flexibleCheckinFrom;
    @Column(name = "flexible_checkin_to") private LocalTime flexibleCheckinTo;
    @Column(name = "flexible_checkout_from") private LocalTime flexibleCheckoutFrom;
    @Column(name = "flexible_checkout_to") private LocalTime flexibleCheckoutTo;
    @Column(name = "geofence_radius_m") private Integer geofenceRadiusM;
    @Column(name = "ip_ranges", columnDefinition = "text") private String ipRanges;
    @Column(name = "is_exception") @Builder.Default private Boolean isException = false;
    @Column(name = "requires_hr_approval") @Builder.Default private Boolean requiresHrApproval = false;
    @Column(name = "target_group", length = 100) private String targetGroup;
    @Column(name = "target_position", length = 100) private String targetPosition;
    /** Mã nhân viên áp dụng trực tiếp (CSV). */
    @Column(name = "target_employees", columnDefinition = "text") private String targetEmployees;
    /** Mã nhân viên bị loại trừ khỏi ca này (CSV) — chỉ ca ngoại lệ mới có. */
    @Column(name = "exclude_employees", columnDefinition = "text") private String excludeEmployees;
    /** Thứ tự hiển thị: số càng lớn càng ở dưới danh sách → ưu tiên ghi đè càng cao. */
    @Column(name = "priority") @Builder.Default private Integer priority = 100;
}
