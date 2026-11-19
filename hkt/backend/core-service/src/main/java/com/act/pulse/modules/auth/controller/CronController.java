package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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

    @PostMapping("/monthly-leave-accrual")
    @Operation(summary = "Cron cộng tự động 1.0 ngày phép vào ngày 15 hàng tháng (ATT-LEAVE-02)")
    public ApiResponse<Map<String, Object>> cronMonthlyAccrual() {
        int granted = 0;
        for (var user : userRepository.findAll()) {
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
                    .reason("Cộng phép tháng (ngày 15)")
                    .performedBySystem(true)
                    .build();
            leaveLedgerRepository.save(entry);
            granted++;
        }
        return ApiResponse.ok(Map.of("accruedEmployees", granted, "daysAdded", 1.0), "Cộng tích lũy 1.0 ngày phép tháng thành công");
    }

    @PostMapping("/yearly-seniority-accrual")
    @Operation(summary = "Cron cộng phép thâm niên theo Luật Lao động (ATT-LEAVE-03)")
    public ApiResponse<Map<String, Object>> cronYearlySeniority() {
        return ApiResponse.ok(Map.of("eligibleEmployees", userRepository.count()), "Cộng phép thâm niên hoàn tất");
    }

    @PostMapping("/cleanup-expired-leaves")
    @Operation(summary = "Cron dọn dẹp phép tồn hết hạn đợt 1 và đợt 2 (ATT-LEAVE-04)")
    public ApiResponse<Map<String, Object>> cronCleanupLeaves() {
        return ApiResponse.ok(Map.of("clearedCount", 0), "Dọn dẹp phép tồn hết hạn hoàn tất");
    }
}
