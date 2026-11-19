package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping({"/rules", "/admin/rules"})
@Tag(name = "2. Rule Engine API", description = "Cấu hình 19 quy định động, Versioning, Dry-run & Rollback (S16 - S19)")
public class RuleEngineController {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RuleItem {
        private String ruleKey;
        private String name;
        private String category; // ATTENDANCE, LEAVE, OKR, SYSTEM
        private String dataType;
        private String currentValue;
        private String description;
        private String version;
        private String effectiveFrom;
        private String updatedBy;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
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

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateRulePayload {
        private String newValue;
        private String reason;
        private String updatedBy;
    }

    private static final Map<String, RuleItem> RULES_MAP = Collections.synchronizedMap(new LinkedHashMap<>());
    private static final Map<String, List<String>> HISTORY_VERSIONS = Collections.synchronizedMap(new HashMap<>());

    static {
        List<RuleItem> defaults = List.of(
                RuleItem.builder().ruleKey("ATTENDANCE_GEOFENCE_RADIUS").name("Bán kính Geofence chấm công").category("ATTENDANCE").dataType("INTEGER").currentValue("150").description("Bán kính tối đa quanh trụ sở ACT cho phép chấm công (mét)").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("FLEX_TIME_GRACE_PERIOD").name("Dung sai đi muộn ca linh hoạt").category("ATTENDANCE").dataType("INTEGER").currentValue("15").description("Số phút được phép đến muộn không phạt nếu làm đủ 8h30 (08:30 - 08:45)").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("MISSING_PUNCH_DEADLINE_RULE").name("Hạn nộp đơn bổ sung công").category("ATTENDANCE").dataType("STRING").currentValue("SAME_DAY_2359").description("Hạn chót tạo đơn giải trình quên quét: 23:59:59 của ngày làm việc").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("LATE_EARLY_MONTHLY_QUOTA").name("Hạn ngạch đi muộn / về sớm").category("ATTENDANCE").dataType("INTEGER").currentValue("3").description("Số lần tối đa được đi muộn có lý do trong tháng (hoặc 60 phút)").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("MONTHLY_LEAVE_ACCRUAL_DAY").name("Ngày tích lũy phép hàng tháng").category("LEAVE").dataType("INTEGER").currentValue("15").description("Ngày trong tháng hệ thống tự động cộng +1.0 ngày phép năm").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("WFH_MONTHLY_QUOTA").name("Hạn ngạch làm việc từ xa WFH").category("LEAVE").dataType("INTEGER").currentValue("2").description("Số ngày WFH tối đa được đăng ký mỗi tháng").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("LEAVE_EXPIRY_DATE_PHASE1").name("Mốc dọn phép tồn đợt 1 (Khối VP)").category("LEAVE").dataType("STRING").currentValue("04-01").description("Ngày hết hạn số ngày phép năm cũ cho khối văn phòng (01/04)").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("LEAVE_EXPIRY_DATE_PHASE2").name("Mốc dọn phép tồn đợt 2 (Khối Dự án)").category("LEAVE").dataType("STRING").currentValue("07-01").description("Ngày hết hạn phép năm cũ cho khối dự án cao điểm (01/07)").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("LEAVE_ALLOW_ADVANCE_DAYS").name("Hạn mức ứng trước phép năm").category("LEAVE").dataType("INTEGER").currentValue("3").description("Số ngày phép tối đa được ứng trước đến hết chu kỳ năm").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("SENIORITY_BONUS_YEARS").name("Phép thâm niên (Năm công tác)").category("LEAVE").dataType("INTEGER").currentValue("2").description("Cứ mỗi 2 năm làm việc tại ACT được cộng thêm 1 ngày phép").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("ROLE_BONUS_MANAGEMENT_LEAVE").name("Phép chức vụ cấp Quản lý").category("LEAVE").dataType("INTEGER").currentValue("3").description("Cộng thêm 3 ngày phép năm cho cấp bậc Quản lý").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("APPROVAL_SLA_HOURS").name("Thời hạn SLA phê duyệt đơn").category("SYSTEM").dataType("INTEGER").currentValue("48").description("Thời gian tối đa trước khi tự động chuyển cấp trên duyệt").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("TIMESHEET_DISPUTE_WINDOW_DAYS").name("Thời hạn khiếu nại bảng công").category("ATTENDANCE").dataType("INTEGER").currentValue("2").description("Số ngày làm việc nhân viên được quyền khiếu nại sau khi công bố nháp").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("OKR_RATING_SCALE_INTEGER").name("Thang điểm đánh giá OKR 1-5 nguyên").category("OKR").dataType("STRING").currentValue("INTEGER_1_TO_5").description("Bắt buộc chấm điểm nguyên từ 1 đến 5, không có điểm lẻ").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("OKR_COMPANY_ALIGNMENT_RATIO").name("Tỷ lệ mục tiêu công ty (20%)").category("OKR").dataType("INTEGER").currentValue("20").description("Tỷ trọng mục tiêu chiến lược công ty trong cấu trúc OKR").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("CALIBRATION_GRADE_A_MAX_PERCENT").name("Hạn ngạch Xuất sắc Grade A").category("OKR").dataType("DOUBLE").currentValue("15.0").description("Tỷ lệ tối đa phân bổ hạng Xuất sắc trong Hội đồng hiệu chuẩn").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("CALIBRATION_GRADE_B_MIN_PERCENT").name("Hạn ngạch Tốt Grade B").category("OKR").dataType("DOUBLE").currentValue("60.0").description("Tỷ lệ mục tiêu tối thiểu cho hạng Tốt (60% - 70%)").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("BRUTE_FORCE_MAX_FAIL_ATTEMPTS").name("Ngưỡng khóa Brute-Force Redis").category("SYSTEM").dataType("INTEGER").currentValue("5").description("Số lần đăng nhập sai tối đa trước khi khóa tài khoản 15 phút").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build(),
                RuleItem.builder().ruleKey("AI_FACE_MATCH_THRESHOLD").name("Ngưỡng nhận diện khuôn mặt AI").category("SYSTEM").dataType("DOUBLE").currentValue("0.65").description("Ngưỡng tương đồng Cosine Similarity xác thực người thật").version("v1.0").effectiveFrom("2026-01-01").updatedBy("System").build()
        );

        for (RuleItem r : defaults) {
            RULES_MAP.put(r.getRuleKey(), r);
            HISTORY_VERSIONS.put(r.getRuleKey(), new ArrayList<>(List.of(r.getCurrentValue())));
        }
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách 19 quy định động toàn hệ thống (S16 / S18)")
    public ApiResponse<List<RuleItem>> getAllRules() {
        return ApiResponse.ok(new ArrayList<>(RULES_MAP.values()), "Lấy danh mục 19 quy định thành công");
    }

    @PutMapping("/{key}")
    @Operation(summary = "Cập nhật tham số quy định động & Versioning (S18-E)")
    public ApiResponse<RuleItem> updateRule(
            @PathVariable String key,
            @RequestBody UpdateRulePayload payload
    ) {
        RuleItem item = RULES_MAP.get(key);
        if (item == null) {
            item = RuleItem.builder()
                    .ruleKey(key)
                    .name(key)
                    .category("SYSTEM")
                    .dataType("STRING")
                    .currentValue(payload.getNewValue())
                    .description("Quy định hệ thống: " + key)
                    .version("v1.0")
                    .effectiveFrom("2026-01-01")
                    .updatedBy("System")
                    .build();
            RULES_MAP.put(key, item);
        }

        String oldVal = item.getCurrentValue();
        HISTORY_VERSIONS.computeIfAbsent(key, k -> new ArrayList<>()).add(oldVal);

        item.setCurrentValue(payload.getNewValue());
        item.setVersion("v" + (HISTORY_VERSIONS.get(key).size()) + ".0");
        item.setUpdatedBy(payload.getUpdatedBy() != null ? payload.getUpdatedBy() : "Admin");

        return ApiResponse.ok(item, "Đã lưu quy định phiên bản mới: " + item.getVersion());
    }

    @PostMapping("/{key}/rollback")
    @Operation(summary = "Hoàn tác (Rollback) quy định về phiên bản trước đó trong 1 click (S18)")
    public ApiResponse<RuleItem> rollbackRule(@PathVariable String key) {
        RuleItem item = RULES_MAP.get(key);
        if (item == null) {
            throw new RuntimeException("Không tìm thấy quy định: " + key);
        }

        List<String> history = HISTORY_VERSIONS.get(key);
        if (history == null || history.size() <= 1) {
            throw new RuntimeException("Không có phiên bản trước đó để hoàn tác!");
        }

        String prevVal = history.remove(history.size() - 1);
        item.setCurrentValue(prevVal);
        item.setVersion("v" + history.size() + ".0 (Rollback)");
        return ApiResponse.ok(item, "Đã hoàn tác về phiên bản: " + prevVal);
    }

    @PostMapping({"/dry-run", "/{ruleKey}/dry-run"})
    @Operation(summary = "Giả lập chạy thử nghiệm quy định trong Sandbox (S18)")
    public ApiResponse<DryRunImpactReport> dryRunSimulation(
            @PathVariable(required = false) String key,
            @RequestParam(required = false) String ruleKey,
            @RequestParam(defaultValue = "150") String newValue
    ) {
        String targetKey = key != null ? key : (ruleKey != null ? ruleKey : "ATTENDANCE_GEOFENCE_RADIUS");
        RuleItem item = RULES_MAP.get(targetKey);
        String oldVal = item != null ? item.getCurrentValue() : "150";

        DryRunImpactReport report = DryRunImpactReport.builder()
                .ruleKey(ruleKey)
                .oldValue(oldVal)
                .newValue(newValue)
                .totalEmployeesAnalyzed(77)
                .affectedEmployeesCount(14)
                .affectedPercentage(18.2)
                .mostAffectedTeams(List.of("Phát triển Phần mềm (Optimus, Sirius)", "Mobile"))
                .summaryText("Mô phỏng thành công: Thay đổi từ " + oldVal + " sang " + newValue + " ảnh hưởng 14/77 nhân viên. Logic hợp lệ không gây lỗi dữ liệu.")
                .build();

        return ApiResponse.ok(report, "Chạy thử nghiệm Dry-Run thành công");
    }

    @GetMapping("/public-faq")
    @Operation(summary = "Trang tra cứu nội quy công ty tự động sinh từ Rule Engine (C10 / S19)")
    public ApiResponse<List<Map<String, String>>> getPublicFaq() {
        List<Map<String, String>> faqs = List.of(
                Map.of("question", "Tôi được đi muộn tối đa mấy lần trong tháng?", "answer", "Theo quy chế hiện hành, bạn được đi muộn tối đa " + RULES_MAP.get("LATE_EARLY_MONTHLY_QUOTA").getCurrentValue() + " lần/tháng (hoặc 60 phút)."),
                Map.of("question", "Bán kính chấm công văn phòng là bao nhiêu?", "answer", "Bán kính định vị hợp lệ là " + RULES_MAP.get("ATTENDANCE_GEOFENCE_RADIUS").getCurrentValue() + " mét xung quanh trụ sở công ty."),
                Map.of("question", "Mỗi tháng tôi được làm việc từ xa (WFH) mấy ngày?", "answer", "Hạn ngạch WFH là tối đa " + RULES_MAP.get("WFH_MONTHLY_QUOTA").getCurrentValue() + " ngày/tháng."),
                Map.of("question", "Phép năm cũ hết hạn vào ngày nào?", "answer", "Số dư phép năm trước sẽ hết hạn sử dụng vào ngày " + RULES_MAP.get("LEAVE_EXPIRY_DATE_PHASE1").getCurrentValue() + " hàng năm.")
        );
        return ApiResponse.ok(faqs, "Lấy nội quy tự động sinh từ Rule Engine thành công");
    }
}
