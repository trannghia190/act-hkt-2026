package com.act.pulse.modules.auth.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Bộ đếm đăng nhập sai — business (docs/01 §3.2):
 * sai **5 lần** → khoá 10 phút · sai **10 lần** → khoá vĩnh viễn, HR mở khóa.
 */
@Entity
@Table(name = "login_attempts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginAttempt extends BaseEntity {

    @Column(name = "identifier", nullable = false, unique = true, length = 150)
    private String identifier;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    @Column(name = "failed_count", nullable = false)
    @Builder.Default
    private Integer failedCount = 0;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    @Column(name = "permanently_locked", nullable = false)
    @Builder.Default
    private Boolean permanentlyLocked = false;

    @Column(name = "last_failed_at")
    private LocalDateTime lastFailedAt;
}
