package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Thiết bị đã đăng ký — lớp 1 trong 5 lớp xác thực khi chấm công.
 * <p>Business (docs/01 §2): mặc định **2 thiết bị**; máy thứ 3 phải gửi yêu cầu kèm lý do → HR duyệt;
 * gỡ máy → hạn mức tự về 2; không dùng 90 ngày → tự thu hồi.</p>
 */
@Entity
@Table(name = "devices")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceRegistration extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "device_fingerprint", nullable = false, unique = true, length = 255)
    private String deviceFingerprint;

    @Column(name = "device_model", length = 100)
    private String deviceModel;

    @Column(name = "os_version", length = 50)
    private String osVersion;

    /** DESKTOP | MOBILE | TABLET | UNKNOWN — suy ra từ User-Agent lúc đăng ký; NULL với dữ liệu cũ. */
    @Column(name = "device_type", length = 16)
    private String deviceType;

    /** User-Agent gốc của trình duyệt lúc gửi yêu cầu (đã cắt còn 255 ký tự). */
    @Column(name = "user_agent", length = 255)
    private String userAgent;

    /** Lý do nhân viên nhập khi đăng ký (đặc biệt khi vượt hạn mức). Khác lý do HR từ chối trong audit_logs. */
    @Column(name = "request_reason", length = 500)
    private String requestReason;

    /** Thiết bị đã được HR duyệt — chưa duyệt thì KHÔNG chấm công được. */
    @Column(name = "is_approved")
    @Builder.Default
    private Boolean isApproved = false;

    @Column(name = "approved_by")
    private UUID approvedBy;

    /** Số ngày tối đa được dùng (0 = không đặt hạn). */
    @Column(name = "grant_days")
    @Builder.Default
    private Integer grantDays = 0;

    /** Ngày hết hạn — quá hạn thì hệ thống tự thu hồi. */
    @Column(name = "expires_at")
    private java.time.LocalDateTime expiresAt;

    /** Thời điểm HR thu hồi. NULL = chưa từng bị thu hồi; dùng để phân biệt với yêu cầu đang chờ duyệt. */
    @Column(name = "revoked_at")
    private java.time.LocalDateTime revokedAt;

    @Column(name = "last_active_at")
    private java.time.LocalDateTime lastActiveAt;
}
