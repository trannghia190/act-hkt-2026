package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.WebAuthnChallenge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WebAuthnChallengeRepository extends JpaRepository<WebAuthnChallenge, UUID> {

    Optional<WebAuthnChallenge> findByIdAndUserIdAndCeremonyTypeAndConsumedAtIsNull(
            UUID id, UUID userId, String ceremonyType);

    /** Challenge đăng nhập chưa gắn user (usernameless). */
    Optional<WebAuthnChallenge> findByIdAndCeremonyTypeAndConsumedAtIsNull(UUID id, String ceremonyType);

    long deleteByExpiresAtBefore(LocalDateTime cutoff);
}
