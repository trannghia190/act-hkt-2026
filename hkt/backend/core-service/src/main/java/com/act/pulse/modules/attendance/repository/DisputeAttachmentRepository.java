package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.DisputeAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DisputeAttachmentRepository extends JpaRepository<DisputeAttachment, UUID> {
    List<DisputeAttachment> findByDisputeIdOrderByCreatedAtAsc(String disputeId);
    long countByDisputeId(String disputeId);
    void deleteByDisputeId(String disputeId);
}
