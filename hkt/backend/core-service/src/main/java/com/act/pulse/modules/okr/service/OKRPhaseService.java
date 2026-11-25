package com.act.pulse.modules.okr.service;

import com.act.pulse.modules.okr.entity.OKRCycle;
import com.act.pulse.modules.okr.entity.OKRReview;
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
    public static final String MIDYEAR = "midyear";
    public static final String FINAL = "final";
    /** Chu kỳ OKR chỉ có 3 phase: Thiết lập → Review giữa năm → Đánh giá cuối năm. */
    public static final List<String> REQUIRED_KEYS = List.of(SETUP, MIDYEAR, FINAL);

    public static final String ACTIVE = "active";
    public static final String UPCOMING = "upcoming";
    public static final String LOCKED = "locked";

    private static final Map<String, String> LABELS = Map.of(
            SETUP, "Thiết lập OKR",
            MIDYEAR, "Review giữa năm",
            FINAL, "Đánh giá cuối năm"
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

    private Map<String, Object> rawPhase(OKRCycle cycle, String key) {
        return rawPhases(cycle).stream()
                .filter(p -> key.equalsIgnoreCase(String.valueOf(p.get("key"))))
                .findFirst().orElse(null);
    }

    /**
     * 3 phase cố định theo đúng thứ tự setup → midyear → final. JSON cũ còn key checkin/summary
     * sẽ bị bỏ qua khi đọc; lần lưu cấu hình kế tiếp ghi lại JSON chỉ còn 3 phase.
     * Mỗi phase mang 2 cửa sổ: NV cập nhật (start_date/due_date) và QL duyệt (review_start/review_due).
     */
    public List<Map<String, Object>> phases(OKRCycle cycle) {
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> raw = rawPhases(cycle);
        List<Map<String, Object>> out = new ArrayList<>();
        boolean seenOpen = false;
        for (String key : REQUIRED_KEYS) {
            Map<String, Object> p = raw.stream()
                    .filter(x -> key.equalsIgnoreCase(String.valueOf(x.get("key"))))
                    .findFirst().orElse(null);
            if (p == null) continue;
            Map<String, Object> m = new LinkedHashMap<>(p);
            m.put("key", key);
            Object name = p.get("name");
            m.put("name", name == null || String.valueOf(name).isBlank() ? label(key) : name);
            String eff = effectiveStatus(cycle, p, today);
            String mgr = managerStatus(cycle, p, today);
            // Cửa sổ QL chưa cấu hình thì managerStatus chỉ là chế độ cũ (setup luôn cho duyệt) —
            // không tính là "đang mở" để không chặn nhầm các phase sau.
            boolean mgrWindow = parseDate(p.get("review_start")) != null && parseDate(p.get("review_due")) != null;
            // Chỉ 1 giai đoạn được mở tại một thời điểm: nếu cấu hình cũ chồng lấn cửa sổ thì
            // phase đứng sau bị coi là chưa mở cho tới khi phase trước đóng lại.
            if (seenOpen) {
                if (ACTIVE.equals(eff)) eff = UPCOMING;
                if (mgrWindow && ACTIVE.equals(mgr)) mgr = UPCOMING;
            }
            if (ACTIVE.equals(eff) || (mgrWindow && ACTIVE.equals(mgr))) seenOpen = true;
            m.put("effective_status", eff);
            m.put("manager_status", mgr);
            LocalDate due = parseDate(p.get("due_date"));
            m.put("days_left", due == null ? null : Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(today, due)));
            // Mốc tháng là nhãn suy ra từ ngày thật — không dùng giá trị HR gõ tay.
            m.put("months", monthsLabel(parseDate(p.get("start_date")), due));
            m.put("review_months", monthsLabel(parseDate(p.get("review_start")), parseDate(p.get("review_due"))));
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

    /** Trạng thái cửa sổ quản lý (duyệt / nhận xét / chấm điểm). Chưa cấu hình ngày → giữ hành vi cũ. */
    public String managerStatus(OKRCycle cycle, Map<String, Object> phase, LocalDate today) {
        if (isCycleLocked(cycle)) return LOCKED;
        String key = String.valueOf(phase.get("key"));
        LocalDate start = parseDate(phase.get("review_start"));
        LocalDate due = parseDate(phase.get("review_due"));
        if (start == null || due == null) {
            return SETUP.equalsIgnoreCase(key) ? ACTIVE : effectiveStatus(cycle, phase, today);
        }
        String stored = String.valueOf(phase.get("status")).toLowerCase();
        if (LOCKED.equals(stored) || "closed".equals(stored)) return LOCKED;
        if (today.isBefore(start)) return UPCOMING;
        if (today.isAfter(due)) return LOCKED;
        return ACTIVE;
    }

    public Optional<Map<String, Object>> phase(OKRCycle cycle, String key) {
        return phases(cycle).stream().filter(p -> key.equalsIgnoreCase(String.valueOf(p.get("key")))).findFirst();
    }

    public boolean isOpen(OKRCycle cycle, String key) {
        return phase(cycle, key).map(p -> ACTIVE.equals(p.get("effective_status"))).orElse(false);
    }

    /** Như {@link #isOpen(OKRCycle, String)} nhưng tính theo ngày cho trước (job quét lùi/giả lập). */
    public boolean isOpen(OKRCycle cycle, String key, LocalDate today) {
        return phase(cycle, key).map(p -> ACTIVE.equals(effectiveStatus(cycle, p, today))).orElse(false);
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

    // ---------------------------------------------------------------- hai cửa sổ mỗi phase

    /** Cửa sổ QL duyệt/nhận xét/chấm điểm có đang mở? Chưa cấu hình review_* → fallback hành vi cũ. */
    public boolean managerWindowOpen(OKRCycle cycle, String key) {
        if (cycle == null || isCycleLocked(cycle)) return false;
        Map<String, Object> p = rawPhase(cycle, key);
        if (p == null) return false;
        LocalDate start = parseDate(p.get("review_start"));
        LocalDate due = parseDate(p.get("review_due"));
        if (start == null || due == null) {
            // Legacy: setup được duyệt bất kỳ lúc nào chu kỳ mở; midyear/final theo cửa sổ NV.
            return SETUP.equalsIgnoreCase(key) || ACTIVE.equals(effectiveStatus(cycle, p, LocalDate.now()));
        }
        String stored = String.valueOf(p.get("status")).toLowerCase();
        if (LOCKED.equals(stored) || "closed".equals(stored)) return false;
        LocalDate today = LocalDate.now();
        return !today.isBefore(start) && !today.isAfter(due);
    }

    /** Ném 409 nếu cửa sổ QL của phase chưa mở / đã đóng. */
    public void requireManagerWindow(OKRCycle cycle, String key) {
        if (cycle == null) throw OKRRuleException.conflict("Chưa có chu kỳ OKR cho năm này");
        if (isCycleLocked(cycle)) {
            throw OKRRuleException.conflict("Chu kỳ OKR " + cycle.getCycleYear() + " đã được HR chốt & khoá — chỉ HR mới mở lại được");
        }
        Map<String, Object> p = rawPhase(cycle, key);
        if (p == null) throw OKRRuleException.conflict("Chu kỳ chưa cấu hình phase " + label(key));
        LocalDate start = parseDate(p.get("review_start"));
        LocalDate due = parseDate(p.get("review_due"));
        if (start == null || due == null) {
            if (SETUP.equalsIgnoreCase(key)) return; // legacy
            requireOpen(cycle, key);
            return;
        }
        LocalDate today = LocalDate.now();
        if (today.isBefore(start)) {
            throw OKRRuleException.conflict("Cửa sổ Quản lý phase " + label(key) + " chưa mở (bắt đầu " + p.get("review_start") + ")");
        }
        if (today.isAfter(due)) {
            throw OKRRuleException.conflict("Cửa sổ Quản lý phase " + label(key) + " đã khoá sau hạn chót " + p.get("review_due")
                    + " — chỉ HR mở lại được");
        }
    }

    /** Lý do NV không cập nhật được trong phase (null = được): cửa sổ NV, hoặc cửa sổ QL + override. */
    public String employeeWindowBlockReason(OKRCycle cycle, String key, OKRReview review) {
        if (cycle == null) return "Chưa có chu kỳ OKR cho năm này";
        if (isCycleLocked(cycle)) {
            return "Chu kỳ OKR " + cycle.getCycleYear() + " đã được HR chốt & khoá — chỉ HR mới mở lại được";
        }
        Map<String, Object> p = rawPhase(cycle, key);
        if (p == null) return "Chu kỳ chưa cấu hình phase " + label(key);
        String stored = String.valueOf(p.get("status")).toLowerCase();
        if (LOCKED.equals(stored) || "closed".equals(stored)) return "Phase " + label(key) + " đã bị khoá";

        boolean managerDone = review != null
                && review.getBox2ManagerScore() != null && review.getBox3ManagerScore() != null;
        if (FINAL.equalsIgnoreCase(key) && managerDone) {
            return "Quản lý đã hoàn tất chấm điểm cuối năm — không cập nhật được nữa";
        }

        LocalDate today = LocalDate.now();
        LocalDate start = parseDate(p.get("start_date"));
        LocalDate due = parseDate(p.get("due_date"));
        boolean open = (start == null || !today.isBefore(start)) && (due == null || !today.isAfter(due));
        if (open) return null;

        boolean reviewConfigured = parseDate(p.get("review_start")) != null && parseDate(p.get("review_due")) != null;
        if (reviewConfigured && managerWindowOpen(cycle, key)) {
            boolean allowed = review != null && (MIDYEAR.equalsIgnoreCase(key)
                    ? Boolean.TRUE.equals(review.getMidYearUpdateOverride())
                    : Boolean.TRUE.equals(review.getFinalUpdateOverride()));
            if (allowed) return null;
            return "Quản lý đang review phase " + label(key) + " — chưa mở cho nhân viên cập nhật";
        }
        if (start != null && today.isBefore(start)) return "Phase " + label(key) + " chưa mở (bắt đầu " + p.get("start_date") + ")";
        return "Phase " + label(key) + " đã khoá sau hạn chót " + p.get("due_date") + " — chỉ HR mở lại được";
    }

    public boolean employeeWindowOpen(OKRCycle cycle, String key, OKRReview review) {
        return employeeWindowBlockReason(cycle, key, review) == null;
    }

    /** Cửa sổ NV đang mở cho check-in: ưu tiên final, rồi midyear; null = ngoài cả 2. */
    public String updateWindow(OKRCycle cycle, OKRReview review) {
        if (employeeWindowOpen(cycle, FINAL, review)) return FINAL;
        if (employeeWindowOpen(cycle, MIDYEAR, review)) return MIDYEAR;
        return null;
    }

    public void requireUpdateWindow(OKRCycle cycle, OKRReview review) {
        if (cycle == null) throw OKRRuleException.conflict("Chưa có chu kỳ OKR cho năm này");
        if (isCycleLocked(cycle)) {
            throw OKRRuleException.conflict("Chu kỳ OKR " + cycle.getCycleYear() + " đã được HR chốt & khoá — chỉ HR mới mở lại được");
        }
        String window = updateWindow(cycle, review);
        if (window != null) return;
        String reason = employeeWindowBlockReason(cycle, FINAL, review);
        throw OKRRuleException.conflict(reason != null ? reason
                : "Chỉ cập nhật tiến độ trong phase Review giữa năm hoặc Đánh giá cuối năm");
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
        return all.stream()
                .filter(p -> ACTIVE.equals(p.get("effective_status")) || ACTIVE.equals(p.get("manager_status")))
                .max(byStart)
                .or(() -> all.stream()
                        .filter(p -> UPCOMING.equals(p.get("effective_status")) || UPCOMING.equals(p.get("manager_status")))
                        .min(byStart))
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

    /** Hạn check-in của kỳ hiện tại = cuối kỳ (tháng/quý), không vượt quá hạn cửa sổ cập nhật đang mở. */
    public LocalDate currentPeriodDeadline(OKRCycle cycle, OKRReview review) {
        LocalDate today = LocalDate.now();
        LocalDate endOfPeriod;
        if (cycle != null && "QUARTERLY".equalsIgnoreCase(cycle.getCheckinInterval())) {
            int lastMonth = ((today.getMonthValue() - 1) / 3 + 1) * 3;
            endOfPeriod = YearMonth.of(today.getYear(), lastMonth).atEndOfMonth();
        } else {
            endOfPeriod = YearMonth.from(today).atEndOfMonth();
        }
        String window = updateWindow(cycle, review);
        LocalDate phaseDue = window == null ? null : dueDate(cycle, window);
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
