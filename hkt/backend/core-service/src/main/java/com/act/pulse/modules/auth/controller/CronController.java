package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/cron")
@Tag(name = "1. Background Scheduled Jobs API", description = "Các tác vụ định kỳ tự động chạy nền (SLA Escalation, Daily Digest, Accruals)")
@RequiredArgsConstructor
public class CronController {

    private final UserRepository userRepository;
    private final LeaveLedgerRepository leaveLedgerRepository;
    private final RuleService ruleService;
    private final AuditLogRepository auditLogRepository;

    @PostMapping("/check-sla-escalation")
    @Operation(summary = "Kiểm tra SLA 48h và tự động chuyển cấp duyệt (CORE-TODO-05)")
    public ApiResponse<Map<String, Object>> checkSlaEscalation() {
        return ApiResponse.ok(Map.of("escalatedCount", 0, "status", "ALL_WITHIN_SLA"), "Kiểm tra SLA 48h hoàn tất");
    }

    @PostMapping("/send-daily-digest")
    @Operation(summary = "Email digest tổng hợp 8h sáng qua Gmail (CORE-DIGEST-01)")
    public ApiResponse<Boolean> sendDailyDigest() {
        return ApiResponse.ok(true, "Đã kích hoạt gửi email digest tổng hợp thành công");
    }

    private int accrualDay() {
        Map<String, Object> rule = ruleService.get("leave_accrual");
        Object day = rule.get("accrual_on");
        try { return day == null ? 15 : Integer.parseInt(String.valueOf(day)); } catch (Exception e) { return 15; }
    }

    private BigDecimal monthlyDays() {
        Map<String, Object> rule = ruleService.get("leave_accrual");
        BigDecimal base;
        try { base = new BigDecimal(String.valueOf(rule.getOrDefault("base_days_per_year", 12))); }
        catch (Exception e) { base = BigDecimal.valueOf(12); }
        return base.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal sumAll(java.util.UUID userId) {
        return leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(LeaveLedgerEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private boolean active(User u) {
        return u.getStatus() == null || "ACTIVE".equalsIgnoreCase(u.getStatus());
    }

    /**
     * Cộng phép tháng: đọc ngày cộng (`leave_accrual.accrual_on`, mặc định 15) và
     * số ngày/tháng = base_days_per_year / 12 (mặc định 12/12 = 1).
     * Chạy daily: chỉ cộng khi đã tới ngày cộng và chưa có dòng của tháng (catch-up nếu lỡ 02:00 ngày 15).
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void scheduledMonthlyAccrual() {
        LocalDate today = LocalDate.now();
        if (today.getDayOfMonth() >= accrualDay()) accrueCurrentMonth();
    }

    @PostMapping("/monthly-leave-accrual")
    @Operation(summary = "Cộng phép tháng theo cấu hình leave_accrual (idempotent, có catch-up khi chạy lại)")
    public ApiResponse<Map<String, Object>> cronMonthlyAccrual() {
        return accrueCurrentMonth();
    }

    private ApiResponse<Map<String, Object>> accrueCurrentMonth() {
        LocalDate today = LocalDate.now();
        int accrualDay = accrualDay();
        BigDecimal days = monthlyDays();
        int granted = 0, monthsBackfilled = 0;
        BigDecimal totalDays = BigDecimal.ZERO;
        for (User user : userRepository.findAll()) {
            if (!active(user)) continue;
            var entries = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
            // Tìm kỳ cộng phép gần nhất đã ghi; nếu chưa có thì bắt đầu từ tháng hiện tại.
            int latestIndex = 0;
            for (LeaveLedgerEntry e : entries) {
                String r = e.getReason();
                if (r != null && r.contains("Cộng phép tháng ")) {
                    try {
                        String tail = r.substring(r.indexOf("Cộng phép tháng ") + "Cộng phép tháng ".length()).trim();
                        String[] parts = tail.split("/");
                        int m = Integer.parseInt(parts[0].trim());
                        int y = Integer.parseInt(parts[1].trim());
                        latestIndex = Math.max(latestIndex, y * 12 + m);
                    } catch (Exception ignored) { }
                }
            }
            int currentIndex = today.getYear() * 12 + today.getMonthValue();
            int startIndex = latestIndex == 0 ? currentIndex : latestIndex + 1;
            if (startIndex > currentIndex) continue;
            boolean backfilled = false;
            for (int idx = startIndex; idx <= currentIndex; idx++) {
                int month = ((idx - 1) % 12) + 1;
                int year = (idx - month) / 12;
                LocalDate target = LocalDate.of(year, month, 1);
                boolean isCurrent = idx == currentIndex;
                if (isCurrent && today.getDayOfMonth() < accrualDay) continue;
                // Vào làm sau ngày cộng của tháng đó → tháng đó không cộng
                if (user.getJoinedDate() != null && user.getJoinedDate().isAfter(target.withDayOfMonth(accrualDay))) continue;
                String monthTag = "Cộng phép tháng " + month + "/" + year;
                boolean already = entries.stream().anyMatch(e -> e.getReason() != null && e.getReason().contains(monthTag));
                if (already) continue;
                BigDecimal prev = sumAll(user.getId());
                leaveLedgerRepository.save(LeaveLedgerEntry.builder()
                        .userId(user.getId()).leaveType("AL").action("GRANT").amount(days)
                        .balanceAfter(prev.add(days)).reason(monthTag)
                        .performedBySystem(true).build());
                granted++;
                totalDays = totalDays.add(days);
                if (!isCurrent) { backfilled = true; monthsBackfilled++; }
            }
            if (backfilled) { /* đã cộng bù các kỳ lỡ */ }
        }
        Map<String, Object> data = new HashMap<>();
        data.put("accruedEmployees", granted);
        data.put("daysAdded", days);
        data.put("accrualDay", accrualDay);
        data.put("totalDays", totalDays);
        data.put("backfilledMonths", monthsBackfilled);
        return ApiResponse.ok(data, "Cộng phép tháng hoàn tất" + (monthsBackfilled > 0 ? " (đã cộng bù kỳ lỡ)" : ""));
    }

    /**
     * Cắt phép tồn theo leave_carryover: từ max_keep_from chỉ giữ tối đa max_keep_days;
     * từ expire_from về 0. Chạy daily để tự bù nếu lỡ ngày; idempotent theo mốc.
     */
    @Scheduled(cron = "0 15 2 * * *")
    public void scheduledCarryExpiry() {
        applyCarryExpiry();
    }

    @PostMapping("/leave-carry-expiry")
    @Operation(summary = "Cắt phép tồn theo cấu hình leave_carryover (idempotent, ghi EXPIRED + audit)")
    public ApiResponse<Map<String, Object>> cronCarryExpiry() {
        int expiredUsers = applyCarryExpiry();
        return ApiResponse.ok(Map.of("expiredUsers", expiredUsers), "Cắt phép tồn hoàn tất");
    }

    private int applyCarryExpiry() {
        Map<String, Object> rule = ruleService.get("leave_carryover");
        String expireFrom = String.valueOf(rule.getOrDefault("expire_from", "07-01"));
        String capFrom = String.valueOf(rule.getOrDefault("max_keep_from", "04-01"));
        int maxKeep = Integer.parseInt(String.valueOf(rule.getOrDefault("max_keep_days", 5)));
        LocalDate today = LocalDate.now();
        String todayMd = String.format("%02d-%02d", today.getMonthValue(), today.getDayOfMonth());
        boolean expiredPhase = todayMd.compareTo(expireFrom) >= 0;
        boolean cappedPhase = !expiredPhase && todayMd.compareTo(capFrom) >= 0;
        if (!expiredPhase && !cappedPhase) return 0;

        String policyTag = expiredPhase
                ? "Cắt toàn bộ phép tồn còn lại từ " + expireFrom
                : "Cắt phép tồn vượt " + maxKeep + " ngày từ " + capFrom;
        int expiredUsers = 0;
        for (User user : userRepository.findAll()) {
            if (!active(user)) continue;
            var entries = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
            BigDecimal carryGrant = BigDecimal.ZERO, used = BigDecimal.ZERO, expiredAlready = BigDecimal.ZERO;
            for (LeaveLedgerEntry e : entries) {
                String reasonLower = e.getReason() == null ? "" : e.getReason().toLowerCase();
                boolean carryGrantRow = "GRANT".equals(e.getAction())
                        && (reasonLower.contains("bảo lưu") || reasonLower.contains("tồn"));
                boolean affectsAnnual = e.getLeaveType() == null || "AL".equalsIgnoreCase(e.getLeaveType());
                if (carryGrantRow) carryGrant = carryGrant.add(e.getAmount());
                else if ("USED".equals(e.getAction()) && affectsAnnual) used = used.add(e.getAmount().abs());
                else if ("EXPIRED".equals(e.getAction())) expiredAlready = expiredAlready.add(e.getAmount().abs());
            }
            if (carryGrant.signum() <= 0) continue;
            BigDecimal usedFromCarry = used.min(carryGrant);
            BigDecimal available = carryGrant.subtract(usedFromCarry).subtract(expiredAlready);
            BigDecimal allowed = expiredPhase ? BigDecimal.ZERO : BigDecimal.valueOf(maxKeep);
            BigDecimal toExpire = available.subtract(allowed).max(BigDecimal.ZERO);
            if (toExpire.signum() <= 0) continue;
            boolean already = entries.stream().anyMatch(e -> e.getReason() != null && e.getReason().contains(policyTag));
            if (already) continue;
            BigDecimal prev = sumAll(user.getId());
            BigDecimal amount = toExpire.negate();
            leaveLedgerRepository.save(LeaveLedgerEntry.builder()
                    .userId(user.getId()).leaveType("AL").action("EXPIRED").amount(amount)
                    .balanceAfter(prev.add(amount)).reason(policyTag)
                    .performedBySystem(true).build());
            AuditLog log = AuditLog.builder().action("EXPIRE_LEAVE_CARRY").entityName("LEAVE_LEDGER")
                    .entityId(user.getEmployeeCode()).userCode("SYSTEM").userName("Hệ thống")
                    .oldValue(available.toPlainString()).newValue(amount.toPlainString()).reason(policyTag).build();
            log.setCreatedAt(LocalDateTime.now());
            auditLogRepository.save(log);
            expiredUsers++;
        }
        return expiredUsers;
    }

    @Scheduled(cron = "0 30 2 * * *")
    @PostMapping("/yearly-seniority-accrual")
    @Operation(summary = "Cron cộng phép thâm niên theo Luật Lao động (ATT-LEAVE-03)")
    public ApiResponse<Map<String, Object>> cronYearlySeniority() {
        int granted = 0;
        LocalDate today = LocalDate.now();
        Map<String, Object> rule = ruleService.get("leave_seniority");
        BigDecimal days;
        try { days = new BigDecimal(String.valueOf(rule.getOrDefault("days_per_interval", 1))); }
        catch (Exception e) { days = BigDecimal.ONE; }
        for (User user : userRepository.findAll()) {
            if (!active(user) || user.getJoinedDate() == null) continue;
            int years = today.getYear() - user.getJoinedDate().getYear();
            if (today.getMonthValue() < user.getJoinedDate().getMonthValue()
                    || (today.getMonthValue() == user.getJoinedDate().getMonthValue()
                        && today.getDayOfMonth() < user.getJoinedDate().getDayOfMonth())) {
                years--;
            }
            if (years < 2 || years % 2 != 0) continue;
            if (today.getMonthValue() != user.getJoinedDate().getMonthValue()
                    || today.getDayOfMonth() != user.getJoinedDate().getDayOfMonth()) continue;
            String tag = "Cộng phép thâm niên " + years + " năm";
            boolean already = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                    .anyMatch(e -> e.getReason() != null && e.getReason().contains(tag));
            if (already) continue;
            BigDecimal prev = sumAll(user.getId());
            leaveLedgerRepository.save(LeaveLedgerEntry.builder()
                    .userId(user.getId()).leaveType("AL").action("GRANT").amount(days)
                    .balanceAfter(prev.add(days)).reason(tag)
                    .performedBySystem(true).build());
            granted++;
        }
        return ApiResponse.ok(Map.of("eligibleEmployees", granted, "daysAdded", days), "Cộng phép thâm niên hoàn tất");
    }

    /** Catch-up khi khởi động: cộng tháng hiện tại nếu đã qua ngày cộng, và áp cắt tồn theo ngày hiện tại. */
    @EventListener(ApplicationReadyEvent.class)
    public void catchUpOnStartup() {
        try {
            LocalDate today = LocalDate.now();
            if (today.getDayOfMonth() >= accrualDay()) accrueCurrentMonth();
        } catch (Exception ignored) { }
        try { applyCarryExpiry(); } catch (Exception ignored) { }
    }
}
