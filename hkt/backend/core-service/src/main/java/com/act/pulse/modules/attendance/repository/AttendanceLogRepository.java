package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.AttendanceLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AttendanceLogRepository extends JpaRepository<AttendanceLog, UUID> {

    Optional<AttendanceLog> findByUserIdAndWorkDate(UUID userId, LocalDate workDate);

    List<AttendanceLog> findByUserIdOrderByWorkDateDesc(UUID userId);

    List<AttendanceLog> findByUserIdAndWorkDateBetweenOrderByWorkDateAsc(UUID userId, LocalDate start, LocalDate end);
}
