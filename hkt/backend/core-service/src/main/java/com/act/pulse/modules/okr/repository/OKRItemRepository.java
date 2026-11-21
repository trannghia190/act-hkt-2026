package com.act.pulse.modules.okr.repository;

import com.act.pulse.modules.okr.entity.OKRItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OKRItemRepository extends JpaRepository<OKRItem, UUID> {
    List<OKRItem> findByReviewIdAndDeletedAtIsNull(UUID reviewId);
    List<OKRItem> findByReviewIdAndDeletedAtIsNullOrderById(UUID reviewId);
    List<OKRItem> findByReviewId(UUID reviewId);
    List<OKRItem> findByReviewIdOrderById(UUID reviewId);
}
