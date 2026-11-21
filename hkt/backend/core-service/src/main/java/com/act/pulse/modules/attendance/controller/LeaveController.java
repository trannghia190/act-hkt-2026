package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.entity.LeaveType;
import com.act.pulse.modules.attendance.entity.Team;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.attendance.repository.LeaveTypeRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.TeamRepository;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.attendance.service.RuleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Loại nghỉ cấu hình được (S32) + số dư/sổ phép (S09/S34) + bảng phép (S46).
 * Business: docs/02 §2.3, docs/06 `leave_type_defaults`.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "4. Leave Types & Ledger API")
public class LeaveController {

    private final LeaveTypeRepository leaveTypeRepository;
    private final LeaveLedgerRepository leaveLedgerRepository;
    private final RequestRepository requestRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final RuleService ruleService;

    @GetMapping("/leave-types")
    @Operation(summary = "Danh sách loại nghỉ đang áp dụng (S30/S32)")
    public ApiResponse<List<LeaveType>> publicTypes() {
        return ApiResponse.ok(leaveTypeRepository.findAll().stream()
                .filter(LeaveType::getIsActive).toList(), "Danh sách loại nghỉ");
    }

    @GetMapping("/admin/leave-types")
    @Operation(summary = "HR quản lý toàn bộ loại nghỉ (S32)")
    public ApiResponse<List<LeaveType>> allTypes() {
        return ApiResponse.ok(leaveTypeRepository.findAll(), "Danh sách loại nghỉ");
    }

    @PostMapping("/admin/leave-types")
    @Operation(summary = "Thêm loại nghỉ mới — không cần sửa code")
    public ApiResponse<LeaveType> create(@RequestBody LeaveType payload) {
        if (leaveTypeRepository.findByCode(payload.getCode()).isPresent()) {
            throw new RuntimeException("Mã loại nghỉ đã tồn tại: " + payload.getCode());
        }
        payload.setIsActive(payload.getIsActive() == null || payload.getIsActive());
        payload.setRequiresAttachment(Boolean.TRUE.equals(payload.getRequiresAttachment()));
        payload.setIsSystem(false); // loại HR tự thêm → được xóa
        return ApiResponse.ok(leaveTypeRepository.save(payload), "Đã thêm loại nghỉ");
    }

    /** DTO sửa từng phần: field null = giữ nguyên (LeaveType có default khởi tạo nên không dùng trực tiếp được). */
    @lombok.Data
    public static class UpdatePayload {
        private String name;
        private BigDecimal defaultDays;
        private Boolean requiresAttachment;
        private Boolean isActive;
        private String config;
        private Boolean isPaid;
        private Boolean deductsAnnualLeave;
        private String unit;
        private Integer submitWithinDays;
    }

    @PutMapping("/admin/leave-types/{code}")
    @Operation(summary = "Sửa loại nghỉ")
    public ApiResponse<LeaveType> update(@PathVariable String code, @RequestBody UpdatePayload payload) {
        LeaveType type = leaveTypeRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy loại nghỉ: " + code));
        type.setName(payload.getName() != null ? payload.getName() : type.getName());
        type.setDefaultDays(payload.getDefaultDays() != null ? payload.getDefaultDays() : type.getDefaultDays());
        type.setRequiresAttachment(payload.getRequiresAttachment() != null ? payload.getRequiresAttachment() : type.getRequiresAttachment());
        type.setIsActive(payload.getIsActive() != null ? payload.getIsActive() : type.getIsActive());
        type.setConfig(payload.getConfig() != null ? payload.getConfig() : type.getConfig());
        type.setIsPaid(payload.getIsPaid() != null ? payload.getIsPaid() : type.getIsPaid());
        type.setDeductsAnnualLeave(payload.getDeductsAnnualLeave() != null ? payload.getDeductsAnnualLeave() : type.getDeductsAnnualLeave());
        type.setUnit(payload.getUnit() != null ? payload.getUnit() : type.getUnit());
        type.setSubmitWithinDays(payload.getSubmitWithinDays() != null ? payload.getSubmitWithinDays() : type.getSubmitWithinDays());
        return ApiResponse.ok(leaveTypeRepository.save(type), "Đã cập nhật loại nghỉ");
    }

    @DeleteMapping("/admin/leave-types/{code}")
    @Operation(summary = "Xóa loại nghỉ HR tự thêm (master data chỉ được tắt)")
    public ApiResponse<Void> delete(@PathVariable String code) {
        LeaveType type = leaveTypeRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy loại nghỉ: " + code));
        if (Boolean.TRUE.equals(type.getIsSystem())) {
            throw new RuntimeException("Loại nghỉ " + type.getName() + " (" + code + ") là danh mục khởi tạo sẵn — chỉ được tắt, không được xóa");
        }
        if (requestRepository.existsByLeaveTypeIgnoreCase(code)) {
            throw new RuntimeException("Loại nghỉ " + code + " đã phát sinh đơn từ — không thể xóa, hãy tắt (Đang áp dụng) để giữ lịch sử");
        }
        if (leaveLedgerRepository.existsByLeaveTypeIgnoreCase(code)) {
            throw new RuntimeException("Loại nghỉ " + code + " đã phát sinh sổ phép — không thể xóa, hãy tắt (Đang áp dụng) để giữ lịch sử");
        }
        leaveTypeRepository.delete(type);
        return ApiResponse.ok(null, "Đã xóa loại nghỉ");
    }

    @GetMapping("/leaves/my-balance")
    @Operation(summary = "Số dư phép của tôi (S09)")
    public ApiResponse<Map<String, Object>> myBalance() {
        return ApiResponse.ok(balanceOf(CurrentUser.userId()), "Số dư phép");
    }

    @GetMapping("/leaves/ledger/by-code/{code}")
    @Operation(summary = "Sổ phép theo mã nhân viên (D5)")
    public ApiResponse<List<LeaveLedgerEntry>> ledgerByCode(@PathVariable String code) {
        var user = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(code, code)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên: " + code));
        return ApiResponse.ok(leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId()), "Sổ phép nhân viên");
    }

    @PostMapping("/leaves/adjust")
    @Operation(summary = "HR điều chỉnh tay số dư phép — tạo dòng ADJUST có lý do")
    public ApiResponse<LeaveLedgerEntry> adjust(@RequestBody Map<String, Object> body) {
        String code = String.valueOf(body.get("employeeCode"));
        var user = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(code, code)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên: " + code));
        BigDecimal amount = new BigDecimal(String.valueOf(body.getOrDefault("amount", "0")));
        String reason = String.valueOf(body.getOrDefault("reason", "Điều chỉnh tay"));
        BigDecimal prev = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(LeaveLedgerEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        LeaveLedgerEntry entry = LeaveLedgerEntry.builder()
                .userId(user.getId()).leaveType(String.valueOf(body.getOrDefault("leaveType", "AL")))
                .action("ADJUST").amount(amount).balanceAfter(prev.add(amount))
                .reason(reason).performedBy(CurrentUser.userId()).performedBySystem(false)
                .build();
        return ApiResponse.ok(leaveLedgerRepository.save(entry), "Đã điều chỉnh số dư phép");
    }

    @GetMapping("/leaves/my-ledger")
    @Operation(summary = "Sổ phép của tôi (S34)")
    public ApiResponse<List<LeaveLedgerEntry>> myLedger() {
        return ApiResponse.ok(leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(CurrentUser.userId()), "Sổ phép của tôi");
    }

    @GetMapping("/leaves/ledger/{userId}")
    @Operation(summary = "Sổ phép append-only của một nhân viên (S34)")
    public ApiResponse<List<LeaveLedgerEntry>> ledger(@PathVariable UUID userId) {
        return ApiResponse.ok(leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId), "Sổ phép");
    }

    @GetMapping("/leaves/table")
    @Operation(summary = "Bảng phép tất cả mọi người (S46)")
    public ApiResponse<List<Map<String, Object>>> table() {
        List<Map<String, Object>> rows = userRepository.findAll().stream().map(u -> {
            // Dùng đúng số liệu của sổ phép cá nhân để bảng tổng hợp và sổ cá nhân không lệch nhau.
            Map<String, Object> b = balanceOf(u.getId());
            BigDecimal baseAnnual = (BigDecimal) b.get("baseAnnual");
            BigDecimal adjust = (BigDecimal) b.get("adjust");
            BigDecimal carriedGrant = (BigDecimal) b.get("carriedGrant");
            BigDecimal seniority = (BigDecimal) b.get("seniority");
            BigDecimal used = (BigDecimal) b.get("used");
            BigDecimal sickUsed = (BigDecimal) b.get("sickUsed");
            b.put("employeeCode", u.getEmployeeCode());
            b.put("fullName", u.getFullName());
            b.put("teamName", u.getTeamId() == null ? null
                    : teamRepository.findById(u.getTeamId()).map(Team::getName).orElse(null));
            // 7 chỉ tiêu chi tiết của sổ phép.
            b.put("grantedThisYear", baseAnnual.add(adjust)); // cấp trong năm + điều chỉnh HR
            b.put("annualUsed", used);                        // nghỉ phép đã dùng (không gồm ốm)
            // Khoá cũ giữ lại để client khác không gãy.
            b.put("carriedOver", b.get("carriedRemaining"));
            b.put("totalUsed", used.add(sickUsed));
            return b;
        }).collect(Collectors.toList());
        return ApiResponse.ok(rows, "Bảng phép");
    }

    private Map<String, Object> balanceOf(UUID userId) {
        if (userId == null) {
            return Map.of("granted", 0, "used", 0, "remaining", 0,
                    "annualRemaining", 0, "carriedRemaining", 0);
        }
        BigDecimal annualGrant = BigDecimal.ZERO, carryGrant = BigDecimal.ZERO, seniorityGrant = BigDecimal.ZERO;
        BigDecimal used = BigDecimal.ZERO, adjust = BigDecimal.ZERO, sickUsed = BigDecimal.ZERO;
        // Cấu hình "trừ phép năm" của từng loại là nguồn sự thật duy nhất.
        // (AL được seed deduct = TRUE — xem V42; không hard-code để HR sửa được.)
        java.util.Set<String> deductTypes = leaveTypeRepository.findAll().stream()
                .filter(lt -> Boolean.TRUE.equals(lt.getDeductsAnnualLeave()))
                .map(lt -> lt.getCode().toUpperCase()).collect(java.util.stream.Collectors.toSet());
        for (LeaveLedgerEntry e : leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            String reasonLower = e.getReason() == null ? "" : e.getReason().toLowerCase();
            boolean carry = reasonLower.contains("bảo lưu") || reasonLower.contains("tồn");
            boolean seniority = reasonLower.contains("thâm niên");
            boolean affectsAnnual = e.getLeaveType() == null || deductTypes.contains(e.getLeaveType().toUpperCase());
            if ("GRANT".equals(e.getAction())) {
                if (seniority) seniorityGrant = seniorityGrant.add(e.getAmount());
                else if (carry) carryGrant = carryGrant.add(e.getAmount());
                else annualGrant = annualGrant.add(e.getAmount());
            } else if ("USED".equals(e.getAction())) {
                if (e.getLeaveType() != null && "S".equalsIgnoreCase(e.getLeaveType())) sickUsed = sickUsed.add(e.getAmount().abs());
                if (affectsAnnual) used = used.add(e.getAmount().abs());
            } else if ("ADJUST".equals(e.getAction()) && affectsAnnual) {
                adjust = adjust.add(e.getAmount());
            }
        }
        BigDecimal usedFromCarry = used.min(carryGrant.max(BigDecimal.ZERO));
        BigDecimal carriedRemaining = carryGrant.subtract(usedFromCarry);
        BigDecimal annualRemaining = annualGrant.add(seniorityGrant).add(adjust).subtract(used.subtract(usedFromCarry));

        // Luật phép tồn: 01/04 giữ tối đa N ngày, 01/07 về 0.
        Map<String, Object> carryRule = ruleService.get("leave_carryover");
        int maxKeep = carryRule.get("max_keep_days") == null ? 5 : Integer.parseInt(String.valueOf(carryRule.get("max_keep_days")));
        String expireFrom = carryRule.get("expire_from") == null ? "07-01" : String.valueOf(carryRule.get("expire_from"));
        String capFrom = carryRule.get("max_keep_from") == null ? "04-01" : String.valueOf(carryRule.get("max_keep_from"));
        LocalDate today = LocalDate.now();
        String todayMd = String.format("%02d-%02d", today.getMonthValue(), today.getDayOfMonth());
        BigDecimal carriedAvailable = carriedRemaining.max(BigDecimal.ZERO);
        String carryStatus = "AVAILABLE";
        if (todayMd.compareTo(expireFrom) >= 0) {
            carriedAvailable = BigDecimal.ZERO;
            carryStatus = "EXPIRED";
        } else if (todayMd.compareTo(capFrom) >= 0) {
            carriedAvailable = carriedAvailable.min(BigDecimal.valueOf(maxKeep));
            carryStatus = "CAPPED";
        }
        BigDecimal expiredCarry = carriedRemaining.subtract(carriedAvailable).max(BigDecimal.ZERO);

        Map<String, Object> map = new HashMap<>();
        map.put("granted", annualGrant.add(carryGrant).add(seniorityGrant));
        map.put("used", used);
        map.put("remaining", annualRemaining.add(carriedAvailable));
        map.put("annualRemaining", annualRemaining);
        map.put("carriedRemaining", carriedAvailable);
        map.put("expiredCarry", expiredCarry);
        map.put("carryStatus", carryStatus);
        map.put("seniority", seniorityGrant);
        map.put("adjust", adjust);
        map.put("sickUsed", sickUsed);
        map.put("baseAnnual", annualGrant);
        map.put("carriedGrant", carryGrant);
        Map<String, BigDecimal> usedByType = new HashMap<>();
        for (LeaveLedgerEntry e : leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            if ("USED".equals(e.getAction()) && e.getLeaveType() != null) {
                usedByType.merge(e.getLeaveType().toUpperCase(), e.getAmount().abs(), BigDecimal::add);
            }
        }
        List<Map<String, Object>> byType = new java.util.ArrayList<>();
        for (var lt : leaveTypeRepository.findAll()) {
            BigDecimal usedThis = usedByType.getOrDefault(lt.getCode().toUpperCase(), BigDecimal.ZERO);
            if (!Boolean.TRUE.equals(lt.getIsActive())) continue;
            Map<String, Object> m = new HashMap<>();
            m.put("code", lt.getCode());
            m.put("name", lt.getName());
            m.put("used", usedThis);
            m.put("defaultDays", lt.getDefaultDays());
            m.put("unit", lt.getUnit());
            byType.add(m);
        }
        map.put("byType", byType);
        return map;
    }
}
