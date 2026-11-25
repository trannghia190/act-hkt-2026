package com.act.pulse.modules.attendance.service;

import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.auth.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Period;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Tính quỹ phép năm theo ngày vào làm (onboard) và cộng bù vào sổ phép.
 *
 * <p>Nguồn duy nhất cho 3 phép tính mới dùng chung ở nhiều nơi:</p>
 * <ul>
 *   <li><b>Thâm niên</b> — số năm làm việc tính từ ngày onboard.</li>
 *   <li><b>Phép thâm niên</b> — thâm niên / {@code interval_years} × {@code days_per_interval}
 *       (rule {@code leave_seniority}, mặc định +1 ngày mỗi 2 năm).</li>
 *   <li><b>Phép năm tích lũy</b> — số tháng đủ điều kiện cộng phép × {@code base_days_per_year/12}
 *       (rule {@code leave_accrual}, mặc định 1 ngày vào ngày 15 hằng tháng).</li>
 * </ul>
 *
 * <p><b>Vì sao cần cộng bù:</b> cron phép thâm niên chỉ cấp đúng NGÀY kỷ niệm, còn cron phép
 * tháng bắt đầu từ tháng hiện tại khi chưa có dòng nào. Nhân viên được thêm với ngày onboard
 * trong quá khứ sẽ bị thiếu các mốc đã đi qua nếu không cộng bù — {@link #backfillForOnboarding(User)}
 * ghi phần còn thiếu vào sổ phép để "tổng phép năm" đúng ngay khi tạo tài khoản.</p>
 */
@Service
@RequiredArgsConstructor
public class LeaveAccrualService {

    private final LeaveLedgerRepository leaveLedgerRepository;
    private final RuleService ruleService;

    public static final String MONTH_TAG = "Cộng phép tháng ";
    public static final String SENIORITY_TAG = "thâm niên";

    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // ── Đọc rule ──────────────────────────────────────────────────────────

    /** Ngày cộng phép tháng (leave_accrual.accrual_on, mặc định 15). */
    public int accrualDay() {
        Object day = ruleService.get("leave_accrual").get("accrual_on");
        try { return day == null ? 15 : Integer.parseInt(String.valueOf(day)); }
        catch (Exception e) { return 15; }
    }

    /** Số ngày phép cộng mỗi tháng = base_days_per_year / 12 (mặc định 12/12 = 1). */
    public BigDecimal monthlyDays() {
        BigDecimal base;
        try {
            base = new BigDecimal(String.valueOf(ruleService.get("leave_accrual")
                    .getOrDefault("base_days_per_year", 12)));
        } catch (Exception e) {
            base = BigDecimal.valueOf(12);
        }
        return base.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
    }

    /** Số năm cho mỗi mốc cộng phép thâm niên (leave_seniority.interval_years, mặc định 2). */
    public int intervalYears() {
        Object iv = ruleService.get("leave_seniority").get("interval_years");
        try {
            int v = iv == null ? 2 : Integer.parseInt(String.valueOf(iv));
            return v <= 0 ? 2 : v;
        } catch (Exception e) {
            return 2;
        }
    }

    /** Số ngày cộng mỗi mốc thâm niên (leave_seniority.days_per_interval, mặc định 1). */
    public BigDecimal daysPerInterval() {
        Object d = ruleService.get("leave_seniority").get("days_per_interval");
        try { return d == null ? BigDecimal.ONE : new BigDecimal(String.valueOf(d)); }
        catch (Exception e) { return BigDecimal.ONE; }
    }

    // ── Tính toán ─────────────────────────────────────────────────────────

    /** Số năm làm việc tròn tính đến {@code on} (chưa tới kỷ niệm thì chưa tính năm đó). */
    public int completedYears(LocalDate joined, LocalDate on) {
        if (joined == null || on == null || on.isBefore(joined)) return 0;
        int years = on.getYear() - joined.getYear();
        if (on.getMonthValue() < joined.getMonthValue()
                || (on.getMonthValue() == joined.getMonthValue()
                    && on.getDayOfMonth() < joined.getDayOfMonth())) {
            years--;
        }
        return Math.max(0, years);
    }

    /** Số mốc thâm niên đã đạt = số năm tròn / interval_years. */
    public int completedIntervals(LocalDate joined, LocalDate on) {
        return completedYears(joined, on) / intervalYears();
    }

    /** Tổng ngày phép thâm niên người này đáng được hưởng tính đến {@code on}. */
    public BigDecimal eligibleSeniorityDays(LocalDate joined, LocalDate on) {
        return daysPerInterval().multiply(BigDecimal.valueOf(completedIntervals(joined, on)));
    }

    /**
     * Các tháng đủ điều kiện cộng phép năm cơ bản, tính từ tháng onboard đến tháng hiện tại.
     * Theo đúng quy tắc của cron: vào làm ≤ ngày cộng thì tháng đó được cộng; vào sau ngày
     * cộng thì hoãn sang tháng sau; tháng hiện tại chỉ cộng khi đã tới ngày cộng.
     */
    public List<YearMonth> eligibleAccrualMonths(LocalDate joined, LocalDate today) {
        List<YearMonth> out = new ArrayList<>();
        if (joined == null || today == null) return out;
        int accrualDay = accrualDay();
        YearMonth current = YearMonth.from(today);
        for (YearMonth ym = YearMonth.from(joined); !ym.isAfter(current); ym = ym.plusMonths(1)) {
            LocalDate target = ym.atDay(Math.min(accrualDay, ym.lengthOfMonth()));
            if (joined.isAfter(target)) continue;
            if (ym.equals(current) && today.getDayOfMonth() < accrualDay) continue;
            out.add(ym);
        }
        return out;
    }

    /** Tổng phép năm cơ bản sẽ tích lũy được tính đến {@code today} theo ngày onboard. */
    public BigDecimal theoreticalBaseAccrual(LocalDate joined, LocalDate today) {
        return monthlyDays().multiply(BigDecimal.valueOf(eligibleAccrualMonths(joined, today).size()));
    }

    /** Ngày onboard thực tế đang dùng: ưu tiên hire_date rồi mới tới joined_date. */
    public LocalDate onboardDate(User user) {
        if (user == null) return null;
        return user.getHireDate() != null ? user.getHireDate() : user.getJoinedDate();
    }

    /**
     * Dữ liệu xem trước cho form thêm nhân viên — tính đúng như những gì sẽ được cấp:
     * thâm niên, phép thâm niên, phép năm cơ bản tích lũy và tổng phép năm.
     */
    public Map<String, Object> preview(LocalDate joined, String role) {
        LocalDate today = LocalDate.now();
        Map<String, Object> out = new HashMap<>();
        if (joined == null) joined = today;

        Period p = joined.isAfter(today) ? Period.ZERO : Period.between(joined, today);
        int years = Math.max(0, p.getYears());
        int months = Math.max(0, p.getMonths());
        int intervals = completedIntervals(joined, today);
        BigDecimal seniorityDays = eligibleSeniorityDays(joined, today);
        BigDecimal baseAccruedDays = theoreticalBaseAccrual(joined, today);
        BigDecimal totalAnnualDays = baseAccruedDays.add(seniorityDays);

        // Mốc thâm niên kế tiếp (để HR biết khi nào cộng thêm phép).
        LocalDate nextMilestone = joined.plusYears((long) (intervals + 1) * intervalYears());

        out.put("joinedDate", joined.toString());
        out.put("seniorityYears", years);
        out.put("seniorityMonths", months);
        out.put("seniorityIntervals", intervals);
        out.put("seniorityDays", seniorityDays);
        out.put("baseAccruedDays", baseAccruedDays);
        out.put("totalAnnualDays", totalAnnualDays);
        out.put("nextSeniorityDate", nextMilestone.toString());
        out.put("isFuture", joined.isAfter(today));
        return out;
    }

    // ── Cộng bù sổ phép ───────────────────────────────────────────────────

    /**
     * Cộng bù phần phép còn thiếu cho nhân viên vừa được thêm với ngày onboard trong quá khứ:
     * các kỳ phép tháng đã đi qua + các mốc phép thâm niên đã đạt. Idempotent — chạy lại không
     * cộng trùng vì mỗi kỳ/mốc được nhận diện qua nội dung lý do.
     *
     * @return số dòng sổ phép đã tạo
     */
    @Transactional
    public int backfillForOnboarding(User user) {
        if (user == null || user.getId() == null) return 0;
        LocalDate joined = onboardDate(user);
        if (joined == null) return 0;
        LocalDate today = LocalDate.now();
        int created = 0;

        List<LeaveLedgerEntry> entries = new ArrayList<>(
                leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId()));

        // Tránh cộng đôi với khoản cấp phép năm trọn gói (giống cron phép tháng).
        String annualTag = "Cấp phép năm " + today.getYear();
        String annualTagPeriodic = "Cấp phép năm định kỳ " + today.getYear();
        boolean hasAnnualGrant = entries.stream().anyMatch(e -> "GRANT".equals(e.getAction())
                && e.getReason() != null
                && (e.getReason().contains(annualTag) || e.getReason().contains(annualTagPeriodic)));

        if (!hasAnnualGrant) {
            BigDecimal days = monthlyDays();
            for (YearMonth ym : eligibleAccrualMonths(joined, today)) {
                String tag = MONTH_TAG + ym.getMonthValue() + "/" + ym.getYear();
                boolean already = entries.stream()
                        .anyMatch(e -> e.getReason() != null && e.getReason().contains(tag));
                if (already) continue;
                BigDecimal prev = sumAmounts(entries);
                LeaveLedgerEntry entry = LeaveLedgerEntry.builder()
                        .userId(user.getId()).leaveType("AL").action("GRANT").amount(days)
                        .balanceAfter(prev.add(days)).reason(tag)
                        .performedBySystem(true).build();
                leaveLedgerRepository.save(entry);
                entries.add(entry);
                created++;
            }
        }

        created += reconcileSeniority(user, joined, today, entries);
        return created;
    }

    /** Cộng phần phép thâm niên còn thiếu của MỘT nhân viên (dùng cho cron). */
    @Transactional
    public int reconcileSeniority(User user) {
        LocalDate joined = onboardDate(user);
        if (joined == null) return 0;
        return reconcileSeniority(user, joined, LocalDate.now(),
                leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId()));
    }

    private int reconcileSeniority(User user, LocalDate joined, LocalDate today,
                                   List<LeaveLedgerEntry> entries) {
        BigDecimal eligible = eligibleSeniorityDays(joined, today);
        BigDecimal granted = entries.stream()
                .filter(e -> "GRANT".equalsIgnoreCase(e.getAction()))
                .filter(e -> e.getReason() != null
                        && e.getReason().toLowerCase(Locale.ROOT).contains(SENIORITY_TAG))
                .map(e -> e.getAmount() == null ? BigDecimal.ZERO : e.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal missing = eligible.subtract(granted);
        if (missing.compareTo(BigDecimal.ZERO) <= 0) return 0;

        int years = completedYears(joined, today);
        BigDecimal prev = sumAmounts(entries);
        leaveLedgerRepository.save(LeaveLedgerEntry.builder()
                .userId(user.getId()).leaveType("AL").action("GRANT").amount(missing)
                .balanceAfter(prev.add(missing))
                .reason("Cộng phép thâm niên " + years + " năm (từ ngày vào làm "
                        + joined.format(DMY) + ")")
                .performedBySystem(true).build());
        return 1;
    }

    private BigDecimal sumAmounts(List<LeaveLedgerEntry> entries) {
        return entries.stream()
                .map(e -> e.getAmount() == null ? BigDecimal.ZERO : e.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
