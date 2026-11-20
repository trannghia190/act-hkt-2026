package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.TimesheetCell;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.*;

public interface TimesheetCellRepository extends JpaRepository<TimesheetCell, UUID> {
    List<TimesheetCell> findByTimesheetId(UUID timesheetId);
    Optional<TimesheetCell> findByTimesheetIdAndWorkDate(UUID timesheetId, LocalDate workDate);
}
