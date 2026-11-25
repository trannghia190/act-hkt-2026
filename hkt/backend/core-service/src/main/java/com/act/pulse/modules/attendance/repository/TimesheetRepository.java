package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.Timesheet;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface TimesheetRepository extends JpaRepository<Timesheet, UUID> {
    Optional<Timesheet> findByUserIdAndPeriodMonthAndPeriodYear(UUID userId, Integer month, Integer year);
    List<Timesheet> findByPeriodMonthAndPeriodYear(Integer month, Integer year);
    List<Timesheet> findByUserId(UUID userId);
}
