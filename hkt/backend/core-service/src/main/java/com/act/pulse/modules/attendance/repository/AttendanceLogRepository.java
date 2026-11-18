package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.AttendanceLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AttendanceLogRepository extends JpaRepository<AttendanceLog, UUID> {
    List<AttendanceLog> findByUserIdOrderByServerTimestampDesc(UUID userId);
}
