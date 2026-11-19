package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.entity.LeaveType;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.attendance.repository.LeaveTypeRepository;
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
        return ApiResponse.ok(leaveTypeRepository.save(type), "Đã cập nhật loại nghỉ");
    }

    @GetMapping("/leaves/my-balance")
    @Operation(summary = "Số dư phép của tôi (S09)")
    public ApiResponse<Map<String, Object>> myBalance() {
        return ApiResponse.ok(balanceOf(CurrentUser.userId()), "Số dư phép");
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
            b.put("employeeCode", u.getEmployeeCode());
            b.put("fullName", u.getFullName());
            return b;
        }).collect(Collectors.toList());
        return ApiResponse.ok(rows, "Bảng phép");
    }

    private Map<String, Object> balanceOf(UUID userId) {
        if (userId == null) {
            return Map.of("granted", 0, "used", 0, "remaining", 0);
        }
        BigDecimal granted = BigDecimal.ZERO;
        BigDecimal used = BigDecimal.ZERO;
        for (LeaveLedgerEntry e : leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            if ("GRANT".equals(e.getAction())) granted = granted.add(e.getAmount());
            if ("USED".equals(e.getAction())) used = used.add(e.getAmount());
        }
        Map<String, Object> map = new HashMap<>();
        map.put("granted", granted);
        map.put("used", used);
        map.put("remaining", granted.subtract(used));
        return map;
    }
}
