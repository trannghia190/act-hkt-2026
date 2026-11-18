package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.Data;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/rules")
@Tag(name = "2. Rule Engine API", description = "Cấu hình 19 quy định động, Dry-run & Rollback (S16 - S19)")
public class RuleEngineController {

    @Data
    @Builder
    public static class RuleItem {
        private String ruleKey;
        private String name;
        private String category;
        private String dataType;
        private String currentValue;
        private String description;
        private String version;
        private String effectiveFrom;
    }

    @Data
    @Builder
    public static class DryRunImpactReport {
        private String ruleKey;
        private String oldValue;
        private String newValue;
        private int totalEmployeesAnalyzed;
        private int affectedEmployeesCount;
        private double affectedPercentage;
        private List<String> mostAffectedTeams;
        private String summaryText;
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách 19 quy định động (S16)")
    public ApiResponse<List<RuleItem>> getAllRules() {
        List<RuleItem> rules = List.of(
            RuleItem.builder()
                .ruleKey("REQ_LATE_MONTHLY_QUOTA")
                .name("Hạn mức đi muộn / về sớm")
                .category("REQUESTS")
                .dataType("INTEGER")
                .currentValue("2")
                .description("Số lần đi muộn hoặc về sớm tối đa trong 1 tháng")
                .version("v1.2")
                .effectiveFrom("2026-01-01")
                .build(),
            RuleItem.builder()
                .ruleKey("REQ_ADJUST_DEADLINE_DAYS")
                .name("Hạn nộp đơn bổ sung công (ngày làm việc)")
                .category("REQUESTS")
                .dataType("INTEGER")
                .currentValue("3")
                .description("Số ngày làm việc tối đa để nộp đơn bổ sung giờ chấm (hạn 23:59:59)")
                .version("v2.0")
                .effectiveFrom("2026-10-01")
                .build(),
            RuleItem.builder()
                .ruleKey("REQ_WFH_WEEKLY_QUOTA")
                .name("Hạn mức làm việc từ xa (WFH)")
                .category("REQUESTS")
                .dataType("INTEGER")
                .currentValue("2")
                .description("Số ngày WFH tối đa mỗi tuần (chặn ngày thứ 3)")
                .version("v1.0")
                .effectiveFrom("2026-01-01")
                .build(),
            RuleItem.builder()
                .ruleKey("LEAVE_ADVANCE_ALLOWED_DAYS")
                .name("Hạn mức ứng trước phép năm")
                .category("LEAVE")
                .dataType("INTEGER")
                .currentValue("3")
                .description("Số ngày phép tối đa nhân viên được phép xin ứng trước khi số dư chưa đủ")
                .version("v1.1")
                .effectiveFrom("2026-01-01")
                .build()
        );

        return ApiResponse.ok(rules, "Lấy danh sách quy định thành công");
    }

    @PostMapping("/dry-run")
    @Operation(summary = "Giả lập chạy thử nghiệm quy định trên dữ liệu tháng trước (S18)")
    public ApiResponse<DryRunImpactReport> dryRunSimulation(@RequestParam String ruleKey, @RequestParam String newValue) {
        DryRunImpactReport report = DryRunImpactReport.builder()
            .ruleKey(ruleKey)
            .oldValue("2")
            .newValue(newValue)
            .totalEmployeesAnalyzed(77)
            .affectedEmployeesCount(14)
            .affectedPercentage(18.2)
            .mostAffectedTeams(List.of("Phát triển Phần mềm (Optimus, Sirius)", "Mobile"))
            .summaryText("Nếu áp dụng giá trị mới, có 14 nhân viên sẽ chuyển từ Hợp lệ sang Vi phạm. Hãy cân nhắc truyền thông trước cho đội ngũ.")
            .build();

        return ApiResponse.ok(report, "Chạy thử nghiệm Dry-Run thành công");
    }
}
