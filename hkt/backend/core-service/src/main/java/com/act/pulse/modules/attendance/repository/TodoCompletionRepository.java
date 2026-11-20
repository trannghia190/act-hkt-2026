package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.TodoCompletion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface TodoCompletionRepository extends JpaRepository<TodoCompletion, TodoCompletion.Key> {
    List<TodoCompletion> findByUserId(UUID userId);
}
