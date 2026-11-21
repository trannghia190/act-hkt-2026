package com.act.pulse.modules.okr.service;

import com.act.pulse.modules.okr.entity.OKRCycle;
import com.act.pulse.modules.okr.repository.OKRCycleRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Nguồn sự thật duy nhất về chu kỳ & phase OKR.
 * <p>
 * Trạng thái hiệu lực của phase được TÍNH TỪ NGÀY (start_date/due_date), không đọc cứng từ JSON:
 * <ul>
 *   <li>Chu kỳ đã chốt (status=closed) → mọi phase "locked".</li>
 *   <li>Phase bị khoá cứng (status lưu = locked/closed) → "locked" cho tới khi HR mở lại.</li>
 *   <li>Trước start_date → "upcoming"; sau due_date → "locked" (tự khoá sau hạn chót); còn lại → "active".</li>
 * </ul>
 * Nhiều phase có thể cùng active (ví dụ check-in Apr–Nov chồng với đánh giá cuối năm từ 15/11).
 */
@Service
@RequiredArgsConstructor
public class OKRPhaseService {

    public static final String SETUP = "setup";
    public static final String CHECKIN = "checkin";
    public static final String MIDYEAR = "midyear";
    public static final String FINAL = "final";
    public static final String SUMMARY = "summary";
    public static final List<String> REQUIRED_KEYS = List.of(SETUP, CHECKIN, MIDYEAR, FINAL, SUMMARY);

    public static final String ACTIVE = "active";
    public static final String UPCOMING = "upcoming";
    public static final String LOCKED = "locked";

    private static final Map<String, String> LABELS = Map.of(
            SETUP, "Thiết lập OKR",
            CHECKIN, "Check-in định kỳ",
            MIDYEAR, "Review giữa năm",
            FINAL, "Đánh giá cuối năm",
            SUMMARY, "Tổng hợp & Báo cáo"
    );

    private final OKRCycleRepository cycleRepository;
    private final ObjectMapper objectMapper;

    // ---------------------------------------------------------------- cycle

    /** Chu kỳ của năm (ưu tiên active). year = null → chu kỳ active mới nhất. Không lấy chéo năm. */
    public Optional<OKRCycle> cycle(Integer year) {
        if (year == null) {
            return cycleRepository.findFirstByStatusOrderByCreatedAtDesc("active")
                    // Không có active → dùng chu kỳ không phải draft mới nhất; draft tương lai không được chen ngang.
                    .or(() -> cycleRepository.findAllByOrderByCycleYearDesc().stream()
                            .filter(c -> c.getStatus() != null && !"draft".equalsIgnoreCase(c.getStatus()))
                            .findFirst())
                    .or(() -> cycleRepository.findAllByOrderByCycleYearDesc().stream().findFirst());
        }
        return cycleRepository.findFirstByCycleYearAndStatusOrderByCreatedAtDesc(year, "active")
                .or(() -> cycleRepository.findAllByOrderByCycleYearDesc().stream()
                        .filter(c -> year.equals(c.getCycleYear()))
                        .filter(c -> c.getStatus() != null && !"draft".equalsIgnoreCase(c.getStatus()))
                        .findFirst())
                .or(() -> cycleRepository.findAllByOrderByCycleYearDesc().stream()
                        .filter(c -> year.equals(c.getCycleYear())).findFirst());
    }

    /** Năm làm việc: tham số truyền vào → năm của chu kỳ active → năm hiện tại. */
    public int resolveYear(Integer year) {
        if (year != null) return year;
        return cycle(null).map(OKRCycle::getCycleYear).orElse(Year.now().getValue());
    }

    public boolean isCycleLocked(OKRCycle cycle) {
        return cycle == null || !"active".equalsIgnoreCase(cycle.getStatus());
    }

    // ---------------------------------------------------------------- phases

    public List<Map<String, Object>> rawPhases(OKRCycle cycle) {
        if (cycle == null || cycle.getPhases() == null || cycle.getPhases().isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(cycle.getPhases(), new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /** Danh sách phase kèm effective_status, days_left tính theo hôm nay. */
    public List<Map<String, Object>> phases(OKRCycle cycle) {
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> p : rawPhases(cycle)) {
            Map<String, Object> m = new LinkedHashMap<>(p);
            String eff = effectiveStatus(cycle, p, today);
            m.put("effective_status", eff);
            LocalDate due = parseDate(p.get("due_date"));
            m.put("days_left", due == null ? null : Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(today, due)));
            // Mốc tháng là nhãn suy ra từ ngày thật — không dùng giá trị HR gõ tay.
            m.put("months", monthsLabel(parseDate(p.get("start_date")), due));
            out.add(m);
        }
        return out;
    }

    public String effectiveStatus(OKRCycle cycle, Map<String, Object> phase, LocalDate today) {
        if (isCycleLocked(cycle)) return LOCKED;
        String stored = String.valueOf(phase.get("status")).toLowerCase();
        if (LOCKED.equals(stored) || "closed".equals(stored)) return LOCKED;
        LocalDate start = parseDate(phase.get("start_date"));
        LocalDate due = parseDate(phase.get("due_date"));
        if (start != null && today.isBefore(start)) return UPCOMING;
        if (due != null && today.isAfter(due)) return LOCKED;
        return ACTIVE;
    }

    public Optional<Map<String, Object>> phase(OKRCycle cycle, String key) {
        return phases(cycle).stream().filter(p -> key.equalsIgnoreCase(String.valueOf(p.get("key")))).findFirst();
    }

    public boolean isOpen(OKRCycle cycle, String key) {
        return phase(cycle, key).map(p -> ACTIVE.equals(p.get("effective_status"))).orElse(false);
    }

    public LocalDate dueDate(OKRCycle cycle, String key) {
        return phase(cycle, key).map(p -> parseDate(p.get("due_date"))).orElse(null);
    }

    public String label(String key) {
        return LABELS.getOrDefault(key, key);
    }

    /** Ném lỗi 409 nếu chu kỳ đã chốt hoặc phase không mở. */
    public void requireOpen(OKRCycle cycle, String key) {
        if (cycle == null) throw OKRRuleException.conflict("Chưa có chu kỳ OKR cho năm này");
        if (isCycleLocked(cycle)) {
            throw OKRRuleException.conflict("Chu kỳ OKR " + cycle.getCycleYear() + " đã được HR chốt & khoá — chỉ HR mới mở lại được");
        }
        Map<String, Object> p = phase(cycle, key).orElse(null);
        if (p == null) throw OKRRuleException.conflict("Chu kỳ chưa cấu hình phase " + label(key));
        String eff = String.valueOf(p.get("effective_status"));
        if (UPCOMING.equals(eff)) {
            throw OKRRuleException.conflict("Phase " + label(key) + " chưa mở (bắt đầu " + p.get("start_date") + ")");
        }
        if (LOCKED.equals(eff)) {
            throw OKRRuleException.conflict("Phase " + label(key) + " đã khoá sau hạn chót " + p.get("due_date")
                    + " — chỉ HR mở lại được");
        }
    }

    public void requireCycleOpen(OKRCycle cycle) {
        if (cycle == null) throw OKRRuleException.conflict("Chưa có chu kỳ OKR cho năm này");
        if (isCycleLocked(cycle)) {
            throw OKRRuleException.conflict("Chu kỳ OKR " + cycle.getCycleYear() + " đã được HR chốt & khoá — chỉ HR mới mở lại được");
        }
    }

    /**
     * Phase chính để hiển thị trên dashboard: trong các phase đang active, lấy phase bắt đầu muộn nhất
     * (ví dụ 21/11: check-in và cuối năm cùng mở → hiển thị "Đánh giá cuối năm").
     * Không có phase active → phase sắp tới gần nhất → phase cuối cùng.
     */
    public Map<String, Object> primaryPhase(OKRCycle cycle) {
        List<Map<String, Object>> all = phases(cycle);
        Comparator<Map<String, Object>> byStart = Comparator.comparing(
                p -> Optional.ofNullable(parseDate(p.get("start_date"))).orElse(LocalDate.MIN));
        return all.stream().filter(p -> ACTIVE.equals(p.get("effective_status"))).max(byStart)
                .or(() -> all.stream().filter(p -> UPCOMING.equals(p.get("effective_status"))).min(byStart))
                .or(() -> all.stream().max(byStart))
                .orElse(null);
    }

    // ---------------------------------------------------------------- check-in period

    /** Kỳ check-in hiện tại theo tần suất cấu hình (MONTHLY → yyyy-MM, QUARTERLY → yyyy-Qn). */
    public String currentPeriod(OKRCycle cycle) {
        LocalDate today = LocalDate.now();
        if (cycle != null && "QUARTERLY".equalsIgnoreCase(cycle.getCheckinInterval())) {
            return today.getYear() + "-Q" + ((today.getMonthValue() - 1) / 3 + 1);
        }
        return YearMonth.from(today).toString();
    }

    /** Hạn check-in của kỳ hiện tại = cuối kỳ (tháng/quý), không vượt quá hạn phase check-in. */
    public LocalDate currentPeriodDeadline(OKRCycle cycle) {
        LocalDate today = LocalDate.now();
        LocalDate endOfPeriod;
        if (cycle != null && "QUARTERLY".equalsIgnoreCase(cycle.getCheckinInterval())) {
            int lastMonth = ((today.getMonthValue() - 1) / 3 + 1) * 3;
            endOfPeriod = YearMonth.of(today.getYear(), lastMonth).atEndOfMonth();
        } else {
            endOfPeriod = YearMonth.from(today).atEndOfMonth();
        }
        LocalDate phaseDue = dueDate(cycle, CHECKIN);
        return phaseDue != null && phaseDue.isBefore(endOfPeriod) ? phaseDue : endOfPeriod;
    }

    /** Mốc tính thời gian công tác cho báo cáo: cấu hình của chu kỳ, mặc định 31/12 năm chu kỳ (doc/OKR_doc.md Bước 5). */
    public LocalDate seniorityCutoff(OKRCycle cycle, int year) {
        if (cycle != null && cycle.getSeniorityCutoffDate() != null) return cycle.getSeniorityCutoffDate();
        return LocalDate.of(year, 12, 31);
    }

    // ---------------------------------------------------------------- company objectives (20%)

    public List<Map<String, Object>> companyObjectives(OKRCycle cycle) {
        if (cycle == null || cycle.getCompanyObjectives() == null || cycle.getCompanyObjectives().isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(cycle.getCompanyObjectives(), new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    // ---------------------------------------------------------------- utils

    /** Nhãn mốc tháng suy ra từ start_date/due_date, ví dụ Jan–Mar, Apr–Nov, Dec. */
    public static String monthsLabel(LocalDate start, LocalDate due) {
        if (start == null || due == null) return "";
        DateTimeFormatter month = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);
        if (start.getYear() != due.getYear()) {
            return month.format(start) + " " + start.getYear() + "–" + month.format(due) + " " + due.getYear();
        }
        if (start.getMonth() == due.getMonth()) return month.format(start);
        return month.format(start) + "–" + month.format(due);
    }

    public static LocalDate parseDate(Object value) {
        if (value == null) return null;
        String s = value.toString();
        if (s.length() < 10) return null;
        try {
            return LocalDate.parse(s.substring(0, 10));
        } catch (Exception e) {
            return null;
        }
    }
}
