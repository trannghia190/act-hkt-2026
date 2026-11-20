package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.RequestAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface RequestAttachmentRepository extends JpaRepository<RequestAttachment, UUID> {
    List<RequestAttachment> findByRequestIdOrderByCreatedAtAsc(UUID requestId);
    long countByRequestId(UUID requestId);
}
