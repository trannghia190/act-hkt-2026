package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
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

    /** Thời điểm HR thu hồi. NULL = chưa từng bị thu hồi; dùng để phân biệt với yêu cầu đang chờ duyệt. */
    @Column(name = "revoked_at")
    private java.time.LocalDateTime revokedAt;

    @Column(name = "last_active_at")
    private java.time.LocalDateTime lastActiveAt;

    // ── WebAuthn / Passkey ────────────────────────────────────────────────
    // Public key + credential ID là bằng chứng khóa thiết bị phần cứng. Private key
    // không bao giờ rời Secure Enclave/TPM và không được lưu ở server.
    @Column(name = "credential_id", unique = true, length = 255)
    private String credentialId;

    /** Khóa công khai COSE — không trả ra API/JSON. */
    @JsonIgnore
    @Column(name = "public_key_cose", columnDefinition = "bytea")
    private byte[] publicKeyCose;

    @Column(name = "user_handle_b64", length = 64)
    private String userHandleB64;

    @Column(name = "signature_count", nullable = false)
    @Builder.Default
    private Long signatureCount = 0L;

    @Column(name = "transports", length = 255)
    private String transports;

    @Column(name = "backup_eligible")
    private Boolean backupEligible;

    @Column(name = "backup_state")
    private Boolean backupState;

    @Column(name = "authenticator_attachment", length = 32)
    private String authenticatorAttachment;

    /** Thiết bị cũ (đăng ký bằng fingerprint) chưa gắn passkey → phải đăng ký lại. */
    @Transient
    public boolean isHasPasskey() {
        return credentialId != null && !credentialId.isBlank();
    }
}
