package com.act.pulse.modules.attendance.repository;
import com.act.pulse.modules.attendance.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> { List<AuditLog> findAllByOrderByCreatedAtDesc(); }
