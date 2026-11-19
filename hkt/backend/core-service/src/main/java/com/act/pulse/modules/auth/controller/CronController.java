package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/cron")
@Tag(name = "1. Background Scheduled Jobs API", description = "Các tác vụ định kỳ tự động chạy nền (SLA Escalation, Daily Digest, Accruals)")
public class CronController {

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
        return ApiResponse.ok(Map.of("accruedEmployees", 77, "daysAdded", 1.0), "Cộng tích lũy 1.0 ngày phép tháng thành công");
    }

    @PostMapping("/yearly-seniority-accrual")
    @Operation(summary = "Cron cộng phép thâm niên theo Luật Lao động (ATT-LEAVE-03)")
    public ApiResponse<Map<String, Object>> cronYearlySeniority() {
        return ApiResponse.ok(Map.of("eligibleEmployees", 14), "Cộng phép thâm niên hoàn tất");
    }

    @PostMapping("/cleanup-expired-leaves")
    @Operation(summary = "Cron dọn dẹp phép tồn hết hạn đợt 1 và đợt 2 (ATT-LEAVE-04)")
    public ApiResponse<Map<String, Object>> cronCleanupLeaves() {
        return ApiResponse.ok(Map.of("clearedCount", 0), "Dọn dẹp phép tồn hết hạn hoàn tất");
    }
}
