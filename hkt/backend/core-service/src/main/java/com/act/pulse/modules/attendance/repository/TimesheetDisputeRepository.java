package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.TimesheetDispute;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TimesheetDisputeRepository extends JpaRepository<TimesheetDispute, String> {
    List<TimesheetDispute> findByStatus(String status);
    List<TimesheetDispute> findAllByOrderByCreatedAtDesc();
}
