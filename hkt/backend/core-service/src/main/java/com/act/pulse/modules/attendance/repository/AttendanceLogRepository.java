package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.AttendanceLog;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /** Gỡ tham chiếu ca khỏi log trước khi xóa ca (log lịch sử quay về ca hiệu lực hiện hành). */
    @Modifying
    @Transactional
    @Query("update AttendanceLog l set l.shiftId = null where l.shiftId = :shiftId")
    void clearShiftReference(@Param("shiftId") UUID shiftId);
}
