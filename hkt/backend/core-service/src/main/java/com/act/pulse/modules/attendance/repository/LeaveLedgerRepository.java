package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface LeaveLedgerRepository extends JpaRepository<LeaveLedgerEntry, UUID> {
    List<LeaveLedgerEntry> findByUserIdOrderByCreatedAtDesc(UUID userId);
    boolean existsByLeaveTypeIgnoreCase(String leaveType);
}
