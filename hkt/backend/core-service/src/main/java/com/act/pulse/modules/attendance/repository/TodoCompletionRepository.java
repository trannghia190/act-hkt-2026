package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.TodoCompletion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface TodoCompletionRepository extends JpaRepository<TodoCompletion, TodoCompletion.Key> {
    List<TodoCompletion> findByUserId(UUID userId);

    /** Nhật ký gần đây, mới nhất trước — tránh trả cả lịch sử dài cho mỗi lần mở trang. */
    List<TodoCompletion> findTop50ByUserIdOrderByCompletedAtDesc(UUID userId);
}
