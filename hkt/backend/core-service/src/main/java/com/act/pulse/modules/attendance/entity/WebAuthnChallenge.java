package com.act.pulse.modules.attendance.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Challenge WebAuthn dùng một lần cho đăng ký hoặc xác thực passkey.
 * <p>Challenge được server sinh và lưu cùng user/ceremony/origin; client chỉ nhận JSON options.
 * Hết hạn sau 2 phút hoặc sau lần verify đầu tiên — chống replay.</p>
 */
@Entity
@Table(name = "webauthn_challenges")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebAuthnChallenge extends BaseEntity {

    /** REGISTER/ASSERT của một user; null với LOGIN (đăng nhập usernameless — biết user sau khi verify). */
    @Column(name = "user_id")
    private UUID userId;

    /** REGISTER | ASSERT | LOGIN */
    @Column(name = "ceremony_type", nullable = false, length = 16)
    private String ceremonyType;

    @Column(name = "request_json", nullable = false, columnDefinition = "text")
    private String requestJson;

    @Column(name = "origin", nullable = false, length = 255)
    private String origin;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;
}
