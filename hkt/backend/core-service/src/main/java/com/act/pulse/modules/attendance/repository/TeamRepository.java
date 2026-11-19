package com.act.pulse.modules.attendance.repository;
import com.act.pulse.modules.attendance.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface TeamRepository extends JpaRepository<Team, java.util.UUID> { Optional<Team> findByName(String name); }
