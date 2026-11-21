package com.act.pulse.modules.okr.repository;

import com.act.pulse.modules.okr.entity.OKRMidYearReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OKRMidYearReviewRepository extends JpaRepository<OKRMidYearReview, UUID> {
    Optional<OKRMidYearReview> findByReviewId(UUID reviewId);
    List<OKRMidYearReview> findByManagerId(UUID managerId);
}
