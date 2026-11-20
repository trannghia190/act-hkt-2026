package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.NotificationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {

    List<NotificationEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<NotificationEntity> findByOrderByCreatedAtDesc();

    long countByUserIdAndIsReadFalse(UUID userId);
}
