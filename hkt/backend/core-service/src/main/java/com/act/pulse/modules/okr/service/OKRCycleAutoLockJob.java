package com.act.pulse.modules.okr.service;

import com.act.pulse.modules.okr.entity.OKRCycle;
import com.act.pulse.modules.okr.repository.OKRCycleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Ghi nhận khoá cứng các phase đã quá hạn chót (để HR thấy & audit).
 * Việc chặn thao tác không phụ thuộc job này — {@link OKRPhaseService} tự tính "locked" khi qua due_date.
 * Sau khi bị khoá cứng, chỉ HR mở lại được (POST /okr/cycles/{id}/reopen).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OKRCycleAutoLockJob {

    private final OKRCycleRepository cycleRepository;
    private final OKRPhaseService phaseService;
    private final OKRManagementService management;
    private final ObjectMapper objectMapper;

    @Scheduled(cron = "0 5 0 * * *")
    public void autoLockExpiredPhases() {
        LocalDate today = LocalDate.now();
        for (OKRCycle cycle : cycleRepository.findAllByOrderByCycleYearDesc()) {
            if (phaseService.isCycleLocked(cycle)) continue;
            try {
                List<Map<String, Object>> phases = phaseService.rawPhases(cycle);
                boolean changed = false;
                for (Map<String, Object> phase : phases) {
                    String stored = String.valueOf(phase.get("status")).toLowerCase();
                    if (OKRPhaseService.LOCKED.equals(stored)) continue;
                    LocalDate due = OKRPhaseService.parseDate(phase.get("due_date"));
                    if (due != null && due.isBefore(today)) {
                        phase.put("status", OKRPhaseService.LOCKED);
                        changed = true;
                        management.audit(null, cycle.getId(), null, "AUTO_LOCK", "phase",
                                String.valueOf(phase.get("key")), OKRPhaseService.LOCKED,
                                "Tự động khoá sau hạn chót " + due);
                    }
                }
                if (changed) {
                    cycleRepository.updatePhasesNative(cycle.getId(), objectMapper.writeValueAsString(phases));
                }
            } catch (Exception e) {
                log.warn("Không thể auto-lock chu kỳ OKR {}", cycle.getId(), e);
            }
        }
    }
}
