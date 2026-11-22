package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeviceRegistrationRepository extends JpaRepository<DeviceRegistration, UUID> {

    Optional<DeviceRegistration> findByUserIdAndDeviceFingerprintAndIsApprovedTrue(UUID userId, String deviceFingerprint);

    Optional<DeviceRegistration> findByDeviceFingerprint(String deviceFingerprint);

    Optional<DeviceRegistration> findByCredentialId(String credentialId);

    Optional<DeviceRegistration> findByUserIdAndDeviceFingerprint(UUID userId, String deviceFingerprint);

    List<DeviceRegistration> findByUserIdAndIsApprovedTrue(UUID userId);

    List<DeviceRegistration> findByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByUserIdAndIsApprovedTrue(UUID userId);
}
