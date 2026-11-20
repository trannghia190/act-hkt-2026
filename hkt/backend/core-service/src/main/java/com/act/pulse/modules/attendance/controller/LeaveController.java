package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.entity.LeaveType;
import com.act.pulse.modules.attendance.entity.Team;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.attendance.repository.LeaveTypeRepository;
import com.act.pulse.modules.attendance.repository.TeamRepository;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;

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
        return ApiResponse.ok(leaveTypeRepository.save(payload), "Đã thêm loại nghỉ");
    }

    @PutMapping("/admin/leave-types/{code}")
    @Operation(summary = "Sửa loại nghỉ")
    public ApiResponse<LeaveType> update(@PathVariable String code, @RequestBody LeaveType payload) {
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
            Map<String, Object> b = balanceOf(u.getId());
            BigDecimal annualGrant = BigDecimal.ZERO, annualUsed = BigDecimal.ZERO, sickUsed = BigDecimal.ZERO;
            BigDecimal seniorityGrant = BigDecimal.ZERO, otherUsed = BigDecimal.ZERO;
            for (LeaveLedgerEntry e : leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                boolean seniority = e.getReason() != null && e.getReason().toLowerCase().contains("thâm niên");
                if ("GRANT".equals(e.getAction())) {
                    if (seniority) seniorityGrant = seniorityGrant.add(e.getAmount());
                    else annualGrant = annualGrant.add(e.getAmount());
                } else if ("USED".equals(e.getAction())) {
                    if ("S".equals(e.getLeaveType())) sickUsed = sickUsed.add(e.getAmount());
                    else annualUsed = annualUsed.add(e.getAmount());
                    otherUsed = otherUsed.add(e.getAmount());
                }
            }
            b.put("employeeCode", u.getEmployeeCode());
            b.put("fullName", u.getFullName());
            b.put("teamName", u.getTeamId() == null ? null
                    : teamRepository.findById(u.getTeamId()).map(Team::getName).orElse(null));
            b.put("annualRemaining", annualGrant.subtract(annualUsed));
            b.put("carriedOver", b.getOrDefault("carriedRemaining", BigDecimal.ZERO));
            b.put("sickUsed", sickUsed);
            b.put("seniority", seniorityGrant);
            b.put("totalUsed", otherUsed);
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
        java.util.Set<String> deductTypes = leaveTypeRepository.findAll().stream()
                .filter(lt -> Boolean.TRUE.equals(lt.getDeductsAnnualLeave()))
                .map(lt -> lt.getCode().toUpperCase()).collect(java.util.stream.Collectors.toSet());
        deductTypes.add("AL");
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
        Map<String, Object> map = new HashMap<>();
        map.put("granted", annualGrant.add(carryGrant).add(seniorityGrant));
        map.put("used", used);
        map.put("remaining", annualRemaining.add(carriedRemaining));
        map.put("annualRemaining", annualRemaining);
        map.put("carriedRemaining", carriedRemaining);
        map.put("seniority", seniorityGrant);
        map.put("adjust", adjust);
        map.put("sickUsed", sickUsed);
        map.put("baseAnnual", annualGrant);
        map.put("carriedGrant", carryGrant);
        return map;
    }
}
