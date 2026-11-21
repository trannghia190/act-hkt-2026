package com.act.pulse.modules.okr.repository;

import com.act.pulse.modules.okr.entity.OKRCheckIn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OKRCheckInRepository extends JpaRepository<OKRCheckIn, UUID> {
    List<OKRCheckIn> findByBatchId(UUID batchId);
    List<OKRCheckIn> findByItemIdOrderByCreatedAtDesc(UUID itemId);
    List<OKRCheckIn> findByReviewIdAndPeriodOrderByCreatedAtDesc(UUID reviewId, String period);
    Optional<OKRCheckIn> findFirstByItemIdOrderByCreatedAtDesc(UUID itemId);
}
