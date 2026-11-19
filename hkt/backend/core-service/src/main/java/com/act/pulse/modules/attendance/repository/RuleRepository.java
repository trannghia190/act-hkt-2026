package com.act.pulse.modules.attendance.repository;

import com.act.pulse.modules.attendance.entity.Rule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RuleRepository extends JpaRepository<Rule, java.util.UUID> {

    Optional<Rule> findByRuleKey(String ruleKey);
}
