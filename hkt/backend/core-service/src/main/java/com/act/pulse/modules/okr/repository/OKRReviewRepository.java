package com.act.pulse.modules.okr.repository;

import com.act.pulse.modules.okr.entity.OKRReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OKRReviewRepository extends JpaRepository<OKRReview, UUID> {
    Optional<OKRReview> findByUserIdAndCycleYear(UUID userId, Integer cycleYear);
    java.util.List<OKRReview> findByManagerIdAndCycleYear(UUID managerId, Integer cycleYear);
    java.util.List<OKRReview> findByCycleYear(Integer cycleYear);
    long countByCycleYear(Integer cycleYear);
    java.util.List<OKRReview> findByManagerId(UUID managerId);
}
