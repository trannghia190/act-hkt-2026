package com.act.pulse.modules.okr.repository;

import com.act.pulse.modules.okr.entity.OKRCheckInAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OKRCheckInAttachmentRepository extends JpaRepository<OKRCheckInAttachment, UUID> {
    List<OKRCheckInAttachment> findByBatchIdOrderByCreatedAtAsc(UUID batchId);
    long countByBatchId(UUID batchId);
}
