package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.Rule;
import com.act.pulse.modules.attendance.entity.RuleVersion;
import com.act.pulse.modules.attendance.repository.RuleRepository;
import com.act.pulse.modules.attendance.repository.RuleVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Trình cấu hình quy định — **19 rule trong catalog business** (docs/06 §3.1).
 * <p>Quy tắc: mọi lần lưu tạo **phiên bản mới** (không ghi đè), bắt buộc có lý do và ngày hiệu lực;
 * **không có dry-run** — thay vào đó UI hiển thị hộp thoại xác nhận trước khi gọi API này.</p>
 */
@RestController
@RequestMapping("/rules")
@RequiredArgsConstructor
@Tag(name = "2. Rule Engine API", description = "19 quy định động — versioning, rollback, xác nhận khi lưu (S16–S19)")
public class RuleEngineController {

    private final RuleRepository ruleRepository;
    private final RuleVersionRepository ruleVersionRepository;
    private final ObjectMapper objectMapper;

    @Data
    @Builder
    public static class RuleItem {
        private String ruleKey;
        private String name;
        private String category;
        private String dataType;
        private String currentValue;
        private String description;
        private long versionCount;
        private String effectiveFrom;
    }

    @Data
    public static class UpdateRuleRequest {
        /** JSON object chứa toàn bộ field của rule — xem docs/06. */
        private String currentValue;
        /** Lý do thay đổi — bắt buộc (audit). */
        private String changeReason;
        /** Ngày hiệu lực (yyyy-MM-dd); mặc định hôm nay. */
        private String effectiveFrom;
    }

    @Data
    @Builder
    public static class VersionItem {
        private String id;
        private String version;
        private String value;
        private String effectiveFrom;
        private String changeReason;
        private String createdAt;
    }

    @GetMapping
    @Operation(summary = "Danh sách 19 quy định đang cấu hình (S16)")
    public ApiResponse<List<RuleItem>> getAllRules() {
        List<RuleItem> items = ruleRepository.findAll().stream()
                .sorted((a, b) -> a.getRuleKey().compareTo(b.getRuleKey()))
                .map(this::toItem)
                .toList();
        return ApiResponse.ok(items, "Lấy danh sách quy định thành công");
    }

    @PutMapping("/{ruleKey}")
    @Operation(summary = "Lưu quy định mới — tạo phiên bản có ngày hiệu lực + lý do (S17)")
    public ApiResponse<RuleItem> updateRule(@PathVariable String ruleKey,
                                            @Valid @RequestBody UpdateRuleRequest request) {
        Rule rule = ruleRepository.findByRuleKey(ruleKey)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy quy định: " + ruleKey));

        if (request.getChangeReason() == null || request.getChangeReason().isBlank()) {
            throw new RuntimeException("Bắt buộc nhập lý do thay đổi quy định");
        }
        try {
            objectMapper.readTree(request.getCurrentValue());
        } catch (Exception ex) {
            throw new RuntimeException("Giá trị quy định phải là JSON hợp lệ: " + ex.getMessage());
        }

        LocalDate effectiveDate = request.getEffectiveFrom() == null || request.getEffectiveFrom().isBlank()
                ? LocalDate.now()
                : LocalDate.parse(request.getEffectiveFrom());

        // Không ghi đè: tạo phiên bản mới rồi cập nhật con trỏ current_value
        long nextVersion = ruleVersionRepository.countByRuleId(rule.getId()) + 1;
        RuleVersion version = RuleVersion.builder()
                .ruleId(rule.getId())
                .version("v" + nextVersion)
                .value(request.getCurrentValue())
                .effectiveFrom(effectiveDate.atStartOfDay())
                .changeReason(request.getChangeReason())
                .createdBy(CurrentUser.userId())
                .build();
        version.setCreatedAt(LocalDateTime.now());
        version.setUpdatedAt(LocalDateTime.now());
        ruleVersionRepository.save(version);

        rule.setCurrentValue(request.getCurrentValue());
        rule.setUpdatedAt(LocalDateTime.now());
        ruleRepository.save(rule);

        return ApiResponse.ok(toItem(rule), "Đã lưu quy định mới");
    }

    @GetMapping("/{ruleKey}/versions")
    @Operation(summary = "Lịch sử phiên bản của một quy định")
    public ApiResponse<List<VersionItem>> getVersions(@PathVariable String ruleKey) {
        Rule rule = ruleRepository.findByRuleKey(ruleKey)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy quy định: " + ruleKey));
        List<VersionItem> items = ruleVersionRepository.findByRuleIdOrderByEffectiveFromDesc(rule.getId())
                .stream()
                .map(v -> VersionItem.builder()
                        .id(v.getId().toString())
                        .version(v.getVersion())
                        .value(v.getValue())
                        .effectiveFrom(v.getEffectiveFrom().toLocalDate().toString())
                        .changeReason(v.getChangeReason())
                        .createdAt(String.valueOf(v.getCreatedAt()))
                        .build())
                .toList();
        return ApiResponse.ok(items, "Lịch sử phiên bản");
    }

    @PostMapping("/{ruleKey}/rollback/{versionId}")
    @Operation(summary = "Hoàn tác về một phiên bản cũ (tạo phiên bản mới, không xoá lịch sử)")
    public ApiResponse<RuleItem> rollback(@PathVariable String ruleKey, @PathVariable String versionId) {
        Rule rule = ruleRepository.findByRuleKey(ruleKey)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy quy định: " + ruleKey));
        RuleVersion target = ruleVersionRepository.findById(java.util.UUID.fromString(versionId))
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiên bản cần hoàn tác"));

        long nextVersion = ruleVersionRepository.countByRuleId(rule.getId()) + 1;
        RuleVersion rollbackVersion = RuleVersion.builder()
                .ruleId(rule.getId())
                .version("v" + nextVersion)
                .value(target.getValue())
                .effectiveFrom(LocalDateTime.now())
                .changeReason("ROLLBACK về " + target.getVersion())
                .createdBy(CurrentUser.userId())
                .build();
        rollbackVersion.setCreatedAt(LocalDateTime.now());
        rollbackVersion.setUpdatedAt(LocalDateTime.now());
        ruleVersionRepository.save(rollbackVersion);

        rule.setCurrentValue(target.getValue());
        rule.setUpdatedAt(LocalDateTime.now());
        ruleRepository.save(rule);

        return ApiResponse.ok(toItem(rule), "Đã hoàn tác quy định");
    }

    @GetMapping("/public-policy-doc")
    @Operation(summary = "Trang tra cứu nội quy — sinh từ giá trị đang áp dụng (S19)")
    public ApiResponse<Map<String, String>> publicPolicyDoc() {
        StringBuilder doc = new StringBuilder("QUY ĐỊNH ĐANG ÁP DỤNG CỦA CÔNG TY\n\n");
        ruleRepository.findAll().stream()
                .sorted((a, b) -> a.getRuleKey().compareTo(b.getRuleKey()))
                .forEach(rule -> doc.append("• ")
                        .append(rule.getName())
                        .append(": ")
                        .append(rule.getCurrentValue())
                        .append("\n"));
        return ApiResponse.ok(Map.of("content", doc.toString()), "Nội quy đang áp dụng");
    }

    private RuleItem toItem(Rule rule) {
        List<RuleVersion> versions = ruleVersionRepository.findByRuleIdOrderByEffectiveFromDesc(rule.getId());
        return RuleItem.builder()
                .ruleKey(rule.getRuleKey())
                .name(rule.getName())
                .category(rule.getCategory())
                .dataType(rule.getDataType())
                .currentValue(rule.getCurrentValue())
                .description(rule.getDescription())
                .versionCount(versions.size())
                .effectiveFrom(versions.isEmpty() ? null
                        : versions.get(0).getEffectiveFrom().toLocalDate().toString())
                .build();
    }
}
