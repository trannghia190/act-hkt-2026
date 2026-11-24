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
import com.act.pulse.modules.attendance.service.LeaveBalanceService;
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
    private final LeaveBalanceService leaveBalanceService;

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
        var user = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(code)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên: " + code));
        return ApiResponse.ok(leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId()), "Sổ phép nhân viên");
    }

    @PostMapping("/leaves/adjust")
    @Operation(summary = "HR điều chỉnh tay số dư phép — tạo dòng ADJUST có lý do")
    public ApiResponse<LeaveLedgerEntry> adjust(@RequestBody Map<String, Object> body) {
        String code = String.valueOf(body.get("employeeCode"));
        var user = userRepository.findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(code)
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
        return leaveBalanceService.balanceOf(userId);
    }
}
