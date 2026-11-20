package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TeamRepository extends JpaRepository<Team, UUID> {
    Optional<Team> findByName(String name);
    Optional<Team> findByNameIgnoreCase(String name);
    List<Team> findByParentId(UUID parentId);
    List<Team> findByParentIdIsNull();
}
