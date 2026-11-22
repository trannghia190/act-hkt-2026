package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Passkey (WebAuthn) dùng để ĐĂNG NHẬP nhanh — tách hoàn toàn khỏi thiết bị chấm công.
 * <p>Public key nằm ở server; private key ở Secure Enclave/TPM và không bao giờ rời thiết bị.
 * Một user có thể có nhiều passkey; gỡ passkey chỉ thu hồi credential đó, không ảnh hưởng
 * thiết bị đã đăng ký để chấm công.</p>
 */
@Entity
@Table(name = "passkey_credentials")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasskeyCredential extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Base64URL của credential ID — khoá tra cứu khi verify assertion. */
    @Column(name = "credential_id", nullable = false, unique = true, length = 255)
    private String credentialId;

    /** Khóa công khai COSE — không trả ra API/JSON. */
    @JsonIgnore
    @Column(name = "public_key_cose", nullable = false, columnDefinition = "bytea")
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

    /** Nhãn người dùng thấy, ví dụ "Passkey (WebAuthn)". */
    @Column(name = "label", length = 100)
    private String label;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    /** Thời điểm người dùng gỡ passkey — credential bị từ chối khi đăng nhập. */
    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;
}
