package com.act.pulse.modules.okr.repository;

import com.act.pulse.modules.okr.entity.OKRCheckInAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Repository
public interface OKRCheckInAttachmentRepository extends JpaRepository<OKRCheckInAttachment, UUID> {
    List<OKRCheckInAttachment> findByBatchIdOrderByCreatedAtAsc(UUID batchId);
    long countByBatchId(UUID batchId);

    /** Tệp đính kèm không có FK nên phải xoá tay theo batch của check-in thuộc chu kỳ. */
    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = """
            DELETE FROM okr_checkin_attachments WHERE batch_id IN (
                SELECT ci.batch_id FROM okr_checkins ci
                WHERE ci.review_id IN (SELECT r.id FROM okr_reviews r WHERE r.cycle_id = :cycleId)
                   OR ci.review_id IN (SELECT r2.id FROM okr_reviews r2 WHERE r2.cycle_year = :year)
            )
            """, nativeQuery = true)
    int deleteAttachmentsByCycle(@Param("cycleId") UUID cycleId, @Param("year") Integer year);

    @Query(value = """
            SELECT count(*) FROM okr_checkin_attachments WHERE batch_id IN (
                SELECT ci.batch_id FROM okr_checkins ci
                WHERE ci.review_id IN (SELECT r.id FROM okr_reviews r WHERE r.cycle_id = :cycleId)
                   OR ci.review_id IN (SELECT r2.id FROM okr_reviews r2 WHERE r2.cycle_year = :year)
            )
            """, nativeQuery = true)
    long countByCycleIdAndYear(@Param("cycleId") UUID cycleId, @Param("year") Integer year);
}
