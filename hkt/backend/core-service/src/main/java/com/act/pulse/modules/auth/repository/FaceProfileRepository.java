package com.act.pulse.modules.auth.repository;

import com.act.pulse.modules.auth.entity.FaceProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FaceProfileRepository extends JpaRepository<FaceProfile, UUID> {

    Optional<FaceProfile> findByUserId(UUID userId);

    boolean existsByUserIdAndStatus(UUID userId, String status);
}
