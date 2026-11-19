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

    @Column(name = "last_active_at")
    private java.time.LocalDateTime lastActiveAt;
}
