package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.TimesheetCellAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface TimesheetCellAuditRepository extends JpaRepository<TimesheetCellAudit, UUID> {}
