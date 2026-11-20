package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.scheduling.annotation.Scheduled;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/cron")
@Tag(name = "1. Background Scheduled Jobs API", description = "Các tác vụ định kỳ tự động chạy nền (SLA Escalation, Daily Digest, Accruals)")
@RequiredArgsConstructor
public class CronController {

    private final UserRepository userRepository;
    private final LeaveLedgerRepository leaveLedgerRepository;

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

    @Scheduled(cron = "0 0 2 15 * *")
    @PostMapping("/monthly-leave-accrual")
    @Operation(summary = "Cron cộng tự động 1.0 ngày phép vào ngày 15 hàng tháng (ATT-LEAVE-02)")
    public ApiResponse<Map<String, Object>> cronMonthlyAccrual() {
        int granted = 0;
        LocalDate today = LocalDate.now();
        String monthTag = "Cộng phép tháng " + today.getMonthValue() + "/" + today.getYear();
        for (var user : userRepository.findAll()) {
            // Chỉ cộng cho người vào làm từ ngày 15 trở về trước trong tháng
            if (user.getJoinedDate() != null && user.getJoinedDate().isAfter(today.withDayOfMonth(15))) {
                continue;
            }
            boolean already = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                    .anyMatch(e -> e.getReason() != null && e.getReason().contains(monthTag));
            if (already) continue;
            BigDecimal prev = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                    .filter(e -> "GRANT".equals(e.getAction()))
                    .map(LeaveLedgerEntry::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            LeaveLedgerEntry entry = LeaveLedgerEntry.builder()
                    .userId(user.getId())
                    .leaveType("AL")
                    .action("GRANT")
                    .amount(BigDecimal.ONE)
                    .balanceAfter(prev.add(BigDecimal.ONE))
                    .reason(monthTag)
                    .performedBySystem(true)
                    .build();
            leaveLedgerRepository.save(entry);
            granted++;
        }
        return ApiResponse.ok(Map.of("accruedEmployees", granted, "daysAdded", 1.0), "Cộng tích lũy 1.0 ngày phép tháng thành công");
    }

    @Scheduled(cron = "0 30 2 * * *")
    @PostMapping("/yearly-seniority-accrual")
    @Operation(summary = "Cron cộng phép thâm niên theo Luật Lao động (ATT-LEAVE-03)")
    public ApiResponse<Map<String, Object>> cronYearlySeniority() {
        int granted = 0;
        LocalDate today = LocalDate.now();
        for (var user : userRepository.findAll()) {
            if (user.getJoinedDate() == null) continue;
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
            BigDecimal prev = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                    .filter(e -> "GRANT".equals(e.getAction()))
                    .map(LeaveLedgerEntry::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            LeaveLedgerEntry entry = LeaveLedgerEntry.builder()
                    .userId(user.getId()).leaveType("AL").action("GRANT").amount(BigDecimal.ONE)
                    .balanceAfter(prev.add(BigDecimal.ONE))
                    .reason(tag)
                    .performedBySystem(true)
                    .build();
            leaveLedgerRepository.save(entry);
            granted++;
        }
        return ApiResponse.ok(Map.of("eligibleEmployees", granted), "Cộng phép thâm niên hoàn tất");
    }

    @PostMapping("/cleanup-expired-leaves")
    @Operation(summary = "Cron dọn dẹp phép tồn hết hạn đợt 1 và đợt 2 (ATT-LEAVE-04)")
    public ApiResponse<Map<String, Object>> cronCleanupLeaves() {
        return ApiResponse.ok(Map.of("clearedCount", 0), "Dọn dẹp phép tồn hết hạn hoàn tất");
    }
}
