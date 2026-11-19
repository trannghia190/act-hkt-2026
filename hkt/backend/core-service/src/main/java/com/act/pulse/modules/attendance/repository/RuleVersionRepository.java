package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.RuleVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RuleVersionRepository extends JpaRepository<RuleVersion, UUID> {

    List<RuleVersion> findByRuleIdOrderByEffectiveFromDesc(UUID ruleId);

    long countByRuleId(UUID ruleId);
}
