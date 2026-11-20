package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.RequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface RequestRepository extends JpaRepository<RequestEntity, UUID> {
    List<RequestEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<RequestEntity> findByUserIdInAndStatusOrderByCreatedAtDesc(Collection<UUID> userIds, String status);
    List<RequestEntity> findByUserIdAndStatus(UUID userId, String status);
}
