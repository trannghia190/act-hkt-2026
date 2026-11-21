package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Bản ghi chấm công — 1 dòng / người / ngày (unique {@code user_id, work_date}).
 * <p>Business: docs/02 §2.1 (cấu trúc bản ghi) + docs/05 (mô hình dữ liệu).</p>
 */
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

    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    /**
     * Cột phân loại punch có sẵn trong DB (NOT NULL). Mô hình hiện tại lưu cả giờ vào + giờ ra trên
     * cùng 1 dòng/ngày nên giá trị luôn là {@code CHECK_IN} — giữ để INSERT không vỡ ràng buộc.
     */
    @Column(name = "type", nullable = false, length = 20)
    @Builder.Default
    private String type = "CHECK_IN";

    /** Giờ vào — thời gian máy chủ (NTP), không bao giờ dùng client_time. */
    @Column(name = "check_in_at")
    private LocalDateTime checkInAt;

    /** Giờ ra — cùng ngày, cùng dòng với giờ vào. */
    @Column(name = "check_out_at")
    private LocalDateTime checkOutAt;

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

    /** VALID | INCOMPLETE — không có trạng thái "gắn cờ nhưng vẫn tính công". */
    @Column(name = "status", nullable = false, length = 30)
    private String status;

    // ── Kết quả xác thực khuôn mặt ──────────────────────────────────────
    /** passed | failed | pending_sync | not_required */
    @Column(name = "face_check_status", length = 20)
    private String faceCheckStatus;

    @Column(name = "face_match_score", precision = 5, scale = 2)
    private BigDecimal faceMatchScore;

    @Column(name = "face_liveness_passed")
    private Boolean faceLivenessPassed;

    @Column(name = "face_checked_at")
    private LocalDateTime faceCheckedAt;

    @Column(name = "face_attempts")
    @Builder.Default
    private Integer faceAttempts = 1;

    @Column(name = "reject_reason", length = 200)
    private String rejectReason;
}
