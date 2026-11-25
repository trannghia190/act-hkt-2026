package com.act.pulse.modules.okr.repository;

import com.act.pulse.modules.okr.entity.OKRReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OKRReviewRepository extends JpaRepository<OKRReview, UUID> {
    Optional<OKRReview> findByUserIdAndCycleYear(UUID userId, Integer cycleYear);
    List<OKRReview> findByManagerIdAndCycleYear(UUID managerId, Integer cycleYear);

    /** Xoá hồ sơ gắn trực tiếp với chu kỳ (FK okr_reviews.cycle_id). */
    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = "DELETE FROM okr_reviews WHERE cycle_id = :cycleId", nativeQuery = true)
    int deleteReviewsByCycleId(@Param("cycleId") UUID cycleId);

    List<OKRReview> findByCycleYear(Integer cycleYear);
    long countByCycleYear(Integer cycleYear);
    long countByCycleId(UUID cycleId);
    List<OKRReview> findByManagerId(UUID managerId);
}
