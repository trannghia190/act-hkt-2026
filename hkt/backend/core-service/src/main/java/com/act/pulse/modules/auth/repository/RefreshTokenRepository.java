package com.act.pulse.modules.auth.repository;

import com.act.pulse.modules.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findByUserIdAndRevokedAtIsNull(UUID userId);

    /** Thu hồi toàn bộ phiên của một tài khoản (đổi mật khẩu / đăng xuất). */
    long deleteByUserIdAndRevokedAtIsNull(UUID userId);
}
