package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.PasskeyCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PasskeyCredentialRepository extends JpaRepository<PasskeyCredential, UUID> {

    List<PasskeyCredential> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<PasskeyCredential> findByCredentialId(String credentialId);

    Optional<PasskeyCredential> findByIdAndUserId(UUID id, UUID userId);

    Optional<PasskeyCredential> findByCredentialIdAndRevokedAtIsNull(String credentialId);

    long countByUserIdAndRevokedAtIsNull(UUID userId);
}
