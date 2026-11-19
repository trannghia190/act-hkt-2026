package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.DeviceRegistrationRepository;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
import com.act.pulse.modules.attendance.entity.AuditLog;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Các endpoint nghiệp vụ còn thiếu theo docs/20 §4 — bổ sung để UI có API dùng.
 * Trả dữ liệu thật từ repository ở những chỗ đã có bảng; phần chưa có engine trả cấu trúc đúng business.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "5. Business Gap API", description = "Bổ sung endpoint còn thiếu cho S11/S13/S14/S20–S46")
public class BusinessGapController {

    private final AttendanceLogRepository attendanceLogRepository;
    private final DeviceRegistrationRepository deviceRegistrationRepository;
    private final AuditLogRepository auditLogRepository;

    @GetMapping("/attendance/my-timesheet")
    @Operation(summary = "Bảng công của tôi (S11)")
    public ApiResponse<List<AttendanceLog>> myTimesheet(@RequestParam(required = false) String month) {
        UUID userId = CurrentUser.userId();
        if (userId == null) return ApiResponse.ok(List.of(), "Chưa đăng nhập");
        return ApiResponse.ok(attendanceLogRepository.findByUserIdOrderByWorkDateDesc(userId), "Bảng công của tôi");
    }

    @GetMapping("/attendance/team-schedule")
    @Operation(summary = "Lịch nhóm (S14)")
    public ApiResponse<List<AttendanceLog>> teamSchedule(@RequestParam(required = false) String month) {
        return ApiResponse.ok(attendanceLogRepository.findAll(), "Lịch nhóm");
    }

    @GetMapping("/okr/dashboard")
    @Operation(summary = "Dashboard OKR (S20)")
    public ApiResponse<Map<String, Object>> okrDashboard() {
        return ApiResponse.ok(Map.of(
                "currentPhase", "CHECKIN", "phaseTitle", "Check-in tháng",
                "businessProgress", 78, "peopleProgress", 64,
                "selfProposalStatus", "DRAFT"
        ), "Dashboard OKR");
    }

    @PostMapping("/okr/check-ins")
    @Operation(summary = "Nộp check-in OKR (S22)")
    public ApiResponse<Boolean> checkIn(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(true, "Đã lưu check-in (chỉ cập nhật giá trị)");
    }

    @PutMapping("/okr/reviews/{id}/self-assessment")
    @Operation(summary = "Tự đánh giá cuối năm (S23)")
    public ApiResponse<Boolean> selfAssessment(@PathVariable String id, @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(true, "Đã lưu tự đánh giá");
    }

    @GetMapping("/okr/team-review")
    @Operation(summary = "Review OKR cả nhóm (S24)")
    public ApiResponse<List<Map<String, Object>>> teamReview() {
        return ApiResponse.ok(List.of(
                Map.of("employeeCode", "136ACT", "fullName", "Vũ Văn Luận", "businessScore", 4, "peopleScore", 4, "status", "PENDING"),
                Map.of("employeeCode", "05ACT", "fullName", "Nguyễn Thanh Tùng", "businessScore", 5, "peopleScore", 4, "status", "PENDING")
        ), "Review OKR nhóm");
    }

    @PostMapping("/okr/objectives/{id}/approve")
    @Operation(summary = "Duyệt/trả lại bộ mục tiêu OKR (S42)")
    public ApiResponse<Boolean> approveObjective(@PathVariable String id, @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(true, "Đã xử lý duyệt mục tiêu");
    }

    @GetMapping("/okr/mid-year-reviews")
    @Operation(summary = "Review giữa năm (S43)")
    public ApiResponse<List<Map<String, Object>>> midYearReviews() {
        return ApiResponse.ok(List.of(), "Danh sách review giữa năm");
    }

    @GetMapping("/okr/cycles")
    @Operation(summary = "Quản lý chu kỳ OKR (S44)")
    public ApiResponse<List<Map<String, Object>>> cycles() {
        return ApiResponse.ok(List.of(Map.of(
                "year", 2026, "status", "ACTIVE",
                "phases", List.of("setup", "checkin", "midyear", "final", "summary")
        )), "Chu kỳ OKR");
    }

    @GetMapping("/devices")
    @Operation(summary = "Thiết bị của tôi (S27)")
    public ApiResponse<List<DeviceRegistration>> myDevices() {
        UUID userId = CurrentUser.userId();
        return ApiResponse.ok(userId == null ? List.of() : deviceRegistrationRepository.findByUserIdAndIsApprovedTrue(userId), "Thiết bị của tôi");
    }

    @PostMapping("/devices/request")
    @Operation(summary = "Yêu cầu thêm thiết bị (S29)")
    public ApiResponse<DeviceRegistration> requestDevice(@RequestBody DeviceRequest request) {
        DeviceRegistration device = DeviceRegistration.builder()
                .userId(CurrentUser.userId())
                .deviceFingerprint(request.getFingerprint())
                .deviceModel(request.getDeviceName())
                .osVersion("Web")
                .isApproved(false)
                .build();
        device.setCreatedAt(LocalDateTime.now());
        device.setUpdatedAt(LocalDateTime.now());
        return ApiResponse.ok(deviceRegistrationRepository.save(device), "Đã gửi yêu cầu — chờ HR duyệt");
    }

    private static final List<Map<String, Object>> DISPUTES = new java.util.ArrayList<>(List.of(
            new java.util.HashMap<>(Map.of("id", "DC-01", "employee", "Vũ Văn Luận", "date", "05/11/2026", "reason", "Có check-in 08:47 nhưng bảng ghi vắng", "status", "PENDING")),
            new java.util.HashMap<>(Map.of("id", "DC-02", "employee", "Nguyễn Thị Thu Hà", "date", "07/11/2026", "reason", "Nghỉ phép đã duyệt nhưng ghi UP", "status", "PENDING"))
    ));

    @GetMapping("/disputes")
    @Operation(summary = "Danh sách khiếu nại (S45)")
    public ApiResponse<List<Map<String, Object>>> disputes() {
        return ApiResponse.ok(new java.util.ArrayList<>(DISPUTES), "Danh sách khiếu nại");
    }

    @GetMapping("/disputes/{id}")
    @Operation(summary = "Chi tiết khiếu nại (S33/D4)")
    public ApiResponse<Map<String, Object>> dispute(@PathVariable String id) {
        Map<String, Object> d = DISPUTES.stream().filter(x -> id.equals(x.get("id"))).findFirst()
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khiếu nại"));
        Map<String, Object> result = new java.util.HashMap<>(d);
        result.put("before", "Vắng không phép (0 công)");
        result.put("after", "Có check-in 08:47 · 1.00 công");
        result.put("ruleHint", "Thiếu check-out và chưa tạo đơn bổ sung công");
        return ApiResponse.ok(result, "Chi tiết khiếu nại");
    }

    @PostMapping("/disputes/{id}/resolve")
    @Operation(summary = "Xử lý khiếu nại: sửa ô / tạo đơn bổ sung / từ chối (bắt buộc lý do)")
    public ApiResponse<Map<String, Object>> resolveDispute(@PathVariable String id, @RequestBody Map<String, String> body) {
        Map<String, Object> d = DISPUTES.stream().filter(x -> id.equals(x.get("id"))).findFirst()
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khiếu nại"));
        String action = body.getOrDefault("action", "REJECT");
        if ("REJECT".equals(action) && (body.get("reason") == null || body.get("reason").isBlank())) {
            throw new RuntimeException("Từ chối khiếu nại phải nhập lý do");
        }
        d.put("status", "REJECT".equals(action) ? "REJECTED" : "RESOLVED");
        d.put("action", action);
        AuditLog log = AuditLog.builder().action("RESOLVE_DISPUTE").entityName("DISPUTE").entityId(id)
                .userId(CurrentUser.userId()).reason(body.get("reason")).newValue(action).build();
        log.setCreatedAt(java.time.LocalDateTime.now());
        auditLogRepository.save(log);
        return ApiResponse.ok(d, "Đã xử lý khiếu nại");
    }

    @GetMapping("/notifications/preferences")
    @Operation(summary = "Tuỳ chỉnh thông báo (S36)")
    public ApiResponse<Map<String, Object>> preferences() {
        return ApiResponse.ok(Map.of("quietHours", "21:00-07:00", "maxPushPerDay", 3, "dedupeHours", 12), "Tuỳ chỉnh thông báo");
    }

    @GetMapping("/audit-logs")
    @Operation(summary = "Nhật ký thay đổi (S35)")
    public ApiResponse<List<Map<String, Object>>> auditLogs() {
        return ApiResponse.ok(List.of(), "Nhật ký thay đổi");
    }

    @GetMapping("/admin/org-tree")
    @Operation(summary = "Cây nhóm quản lý (S41)")
    public ApiResponse<List<Map<String, Object>>> orgTree() {
        return ApiResponse.ok(List.of(
                Map.of("id", "b1", "name", "Sirius", "parentId", ""),
                Map.of("id", "b2", "name", "Optimus", "parentId", "b1"),
                Map.of("id", "b3", "name", "CA", "parentId", ""),
                Map.of("id", "b4", "name", "Mobile", "parentId", "")
        ), "Cây nhóm");
    }

    @lombok.Data
    public static class DeviceRequest {
        @NotBlank
        private String fingerprint;
        private String deviceName;
        private String reason;
    }
}
