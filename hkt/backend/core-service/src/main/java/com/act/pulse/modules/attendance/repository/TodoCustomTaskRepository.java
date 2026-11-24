package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.TodoCustomTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TodoCustomTaskRepository extends JpaRepository<TodoCustomTask, String> {
    List<TodoCustomTask> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<TodoCustomTask> findByIdAndUserId(String id, UUID userId);

    long deleteByIdAndUserId(String id, UUID userId);
}
