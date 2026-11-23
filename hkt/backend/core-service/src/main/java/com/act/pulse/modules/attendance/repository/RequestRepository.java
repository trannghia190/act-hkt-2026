package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.RequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDate;
import java.time.LocalDateTime;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface RequestRepository extends JpaRepository<RequestEntity, UUID>, JpaSpecificationExecutor<RequestEntity> {
    List<RequestEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);
    boolean existsByLeaveTypeIgnoreCase(String leaveType);
    List<RequestEntity> findByUserIdInAndStatusOrderByCreatedAtDesc(Collection<UUID> userIds, String status);
    List<RequestEntity> findByUserIdAndStatus(UUID userId, String status);
    List<RequestEntity> findByStatusAndCreatedAtBefore(String status, LocalDateTime cutoff);
    List<RequestEntity> findByUserIdAndRequestTypeAndWorkDate(UUID userId, String requestType, LocalDate workDate);

    /** Đơn nghỉ/WFH đã duyệt phủ ngày {@code day} — dùng để miễn nhắc chấm công. */
    @Query("select r from RequestEntity r where r.status = 'APPROVED' " +
            "and r.requestType in ('LEAVE','WFH') " +
            "and r.workDate <= :day and coalesce(r.endDate, r.workDate) >= :day")
    List<RequestEntity> findApprovedAbsencesOn(@Param("day") LocalDate day);

    @Query("select r from RequestEntity r where r.userId = :userId " +
            "and (:fromDate is null or r.workDate >= :fromDate) " +
            "and (:toDate is null or r.workDate <= :toDate) " +
            "and (:type is null or r.requestType = :type) " +
            "and (:status is null or r.status = :status) " +
            "and (:kw = '' or lower(r.reason) like lower(concat('%', :kw, '%')))")
    Page<RequestEntity> searchMine(@Param("userId") UUID userId,
                                   @Param("fromDate") LocalDate fromDate,
                                   @Param("toDate") LocalDate toDate,
                                   @Param("type") String type,
                                   @Param("status") String status,
                                   @Param("kw") String kw,
                                   Pageable pageable);
}
