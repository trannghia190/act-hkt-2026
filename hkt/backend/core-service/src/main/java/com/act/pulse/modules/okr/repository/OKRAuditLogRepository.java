package com.act.pulse.modules.okr.repository;

import com.act.pulse.modules.okr.entity.OKRAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OKRAuditLogRepository extends JpaRepository<OKRAuditLog, UUID> {
    List<OKRAuditLog> findByReviewIdOrderByCreatedAtDesc(UUID reviewId);
    List<OKRAuditLog> findByCycleIdOrderByCreatedAtDesc(UUID cycleId);
}
