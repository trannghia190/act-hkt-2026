package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.LeaveType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface LeaveTypeRepository extends JpaRepository<LeaveType, UUID> {
    Optional<LeaveType> findByCode(String code);
}
