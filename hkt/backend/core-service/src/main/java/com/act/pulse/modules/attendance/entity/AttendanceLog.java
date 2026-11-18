package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "attendance_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceLog extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "shift_id")
    private UUID shiftId;

    @Column(name = "type", nullable = false, length = 20)
    private String type; // CHECK_IN, CHECK_OUT

    @Column(name = "server_timestamp", nullable = false)
    @Builder.Default
    private LocalDateTime serverTimestamp = LocalDateTime.now();

    @Column(name = "is_offline_sync")
    @Builder.Default
    private Boolean isOfflineSync = false;

    @Column(name = "wifi_bssid", length = 100)
    private String wifiBssid;

    @Column(name = "latitude", precision = 10, scale = 8)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 11, scale = 8)
    private BigDecimal longitude;

    @Column(name = "distance_meters", precision = 10, scale = 2)
    private BigDecimal distanceMeters;

    @Column(name = "status", nullable = false, length = 30)
    private String status; // VALID, FLAGGED_LOW_GPS, FLAGGED_OUTSIDE_WIFI, REJECTED
}
