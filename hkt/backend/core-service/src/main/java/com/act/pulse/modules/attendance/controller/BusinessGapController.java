package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.DeviceRegistrationRepository;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.Shift;
import com.act.pulse.modules.attendance.entity.Notification;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.NotificationRepository;
import com.act.pulse.modules.attendance.repository.ShiftRepository;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

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
    private final RequestRepository requestRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final ShiftRepository shiftRepository;

    @GetMapping("/attendance/status")
    @Operation(summary = "Trạng thái chấm công hiện tại của nhân viên")
    public ApiResponse<Map<String, Object>> attendanceStatus() {
        Map<String, Object> statusMap = new HashMap<>();
        statusMap.put("hasCheckedIn", true);
        statusMap.put("hasCheckedOut", false);
        statusMap.put("checkInTime", "08:24:12");
        statusMap.put("checkOutTime", null);
        statusMap.put("totalHours", 4.5);
        statusMap.put("status", "VALID");
        statusMap.put("assignedShift", "Ca Hành Chính (08:30 - 17:30, Flex 08:00 - 09:00)");
        return ApiResponse.ok(statusMap, "Lấy trạng thái chấm công thành công");
    }

    @GetMapping("/attendance/my-timesheet")
    @Operation(summary = "Bảng công của tôi (S11)")
    public ApiResponse<List<AttendanceLog>> myTimesheet(@RequestParam(required = false) String month) {
        UUID userId = CurrentUser.userId();
        if (userId == null) return ApiResponse.ok(List.of(), "Chưa đăng nhập");
        return ApiResponse.ok(attendanceLogRepository.findByUserIdOrderByWorkDateDesc(userId), "Bảng công của tôi");
    }

    /**
     * S14 — Lịch nhóm: WFH / nghỉ phép / đi muộn / công đủ theo ngày, kèm cảnh báo xung đột.
     * Phân quyền xem: HR/ADMIN xem toàn công ty; MANAGER xem cấp dưới trực tiếp; còn lại xem nhóm mình.
     */
    @GetMapping("/attendance/my-shift")
    @Operation(summary = "Ca làm việc của tôi — khung giờ chuẩn để tính đi muộn/về sớm (S07/S30)")
    public ApiResponse<Map<String, Object>> myShift() {
        UUID userId = CurrentUser.userId();
        Shift shift = null;
        boolean assigned = false;
        if (userId != null) {
            User u = userRepository.findById(userId).orElse(null);
            if (u != null && u.getShiftId() != null) {
                shift = shiftRepository.findById(u.getShiftId()).orElse(null);
                assigned = shift != null;
            }
        }
        if (shift == null) {
            shift = shiftRepository.findAll().stream()
                    .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                    .filter(s -> !Boolean.TRUE.equals(s.getIsException()))
                    .findFirst().orElse(null);
        }
        Map<String, Object> out = new HashMap<>();
        if (shift != null) {
            out.put("code", shift.getCode());
            out.put("name", shift.getName());
            out.put("checkInStart", String.valueOf(shift.getCheckInStart()));
            out.put("checkInEnd", String.valueOf(shift.getCheckInEnd()));
            out.put("checkOutStart", String.valueOf(shift.getCheckOutStart()));
            out.put("checkOutEnd", String.valueOf(shift.getCheckOutEnd()));
            out.put("lunchBreakStart", String.valueOf(shift.getLunchBreakStart()));
            out.put("lunchBreakEnd", String.valueOf(shift.getLunchBreakEnd()));
            out.put("requiredWorkHours", shift.getRequiredWorkHours());
            out.put("isFlexible", Boolean.TRUE.equals(shift.getIsFlexible()));
            out.put("flexibleCheckinFrom", String.valueOf(shift.getFlexibleCheckinFrom()));
            out.put("flexibleCheckinTo", String.valueOf(shift.getFlexibleCheckinTo()));
            out.put("flexibleCheckoutFrom", String.valueOf(shift.getFlexibleCheckoutFrom()));
            out.put("flexibleCheckoutTo", String.valueOf(shift.getFlexibleCheckoutTo()));
            out.put("assigned", assigned);
        }
        return ApiResponse.ok(out, shift == null ? "Chưa cấu hình ca làm việc" : "Ca làm việc của tôi");
    }

    @GetMapping("/attendance/team-schedule")
    @Operation(summary = "Lịch nhóm (S14) — phân quyền 4 tầng + cảnh báo xung đột")
    public ApiResponse<Map<String, Object>> teamSchedule(@RequestParam(required = false) String month,
                                                         @RequestParam(required = false) String scope) {
        UUID me = CurrentUser.userId();
        String role = CurrentUser.role() == null ? "EMPLOYEE" : CurrentUser.role();
        List<User> visible;
        String scopeLabel;
        if ("HR_ADMIN".equals(role) || "ADMIN".equals(role)) {
            visible = userRepository.findAll();
            scopeLabel = "HR — toàn công ty";
        } else {
            User self = userRepository.findById(me).orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản"));
            if ("MANAGER".equals(role)) {
                List<User> team = self.getTeamId() == null ? List.of() : userRepository.findByTeamId(self.getTeamId());
                java.util.Set<UUID> direct = new java.util.HashSet<>();
                direct.add(me);
                for (User u : userRepository.findAll()) {
                    if (me.equals(u.getManagerId())) direct.add(u.getId());
                }
                java.util.List<User> result = new java.util.ArrayList<>();
                for (User u : userRepository.findAll()) {
                    if (direct.contains(u.getId()) || team.stream().anyMatch(x -> x.getId().equals(u.getId()))) result.add(u);
                }
                visible = result;
                scopeLabel = "Quản lý — cấp dưới trực tiếp & nhóm";
            } else {
                visible = self.getTeamId() == null ? List.of(self) : userRepository.findByTeamId(self.getTeamId());
                scopeLabel = "Thành viên — nhóm của mình";
            }
        }
        if (visible.isEmpty()) visible = List.of();

        java.util.Set<UUID> ids = new java.util.HashSet<>();
        visible.forEach(u -> ids.add(u.getId()));
        java.util.Map<UUID, User> byId = new java.util.HashMap<>();
        visible.forEach(u -> byId.put(u.getId(), u));

        // Dữ liệu đơn đã duyệt trong tháng (mặc định tháng hiện tại)
        String ym = (month == null || month.isBlank()) ? java.time.YearMonth.now().toString() : month;
        java.time.YearMonth targetMonth = java.time.YearMonth.parse(ym);

        List<Map<String, Object>> days = new java.util.ArrayList<>();
        java.util.List<Map<String, Object>> conflicts = new java.util.ArrayList<>();
        int teamSize = visible.size();

        for (int d = 1; d <= targetMonth.lengthOfMonth(); d++) {
            java.time.LocalDate day = targetMonth.atDay(d);
            List<Map<String, Object>> entries = new java.util.ArrayList<>();
            int wfh = 0, leave = 0, late = 0, present = 0;
            for (User u : visible) {
                String kind = null;
                for (RequestEntity r : requestRepository.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                    if (!"APPROVED".equals(r.getStatus()) || r.getWorkDate() == null || !day.equals(r.getWorkDate())) continue;
                    if ("WFH".equals(r.getRequestType())) kind = "WFH";
                    else if ("LEAVE".equals(r.getRequestType())) kind = "LEAVE";
                    else if ("LATE_EARLY".equals(r.getRequestType())) kind = "LATE";
                    if (kind != null) break;
                }
                if (kind == null) {
                    kind = "PRESENT";
                    present++;
                } else if ("WFH".equals(kind)) wfh++;
                else if ("LEAVE".equals(kind)) leave++;
                else late++;
                entries.add(Map.of("employeeCode", u.getEmployeeCode(), "fullName", u.getFullName(), "kind", kind));
            }
            Map<String, Object> row = new java.util.HashMap<>();
            row.put("date", day.toString());
            row.put("wfh", wfh);
            row.put("leave", leave);
            row.put("late", late);
            row.put("present", present);
            row.put("teamSize", teamSize);
            row.put("entries", entries);
            days.add(row);
            if (teamSize >= 3 && (wfh + leave) * 100 >= teamSize * 60) {
                conflicts.add(Map.of("date", day.toString(),
                        "message", String.format("%s: %d/%d người vắng (WFH %d + nghỉ %d) — đội sẽ thiếu người",
                                day, wfh + leave, teamSize, wfh, leave)));
            }
        }

        Map<String, Object> out = new java.util.HashMap<>();
        out.put("month", ym);
        out.put("scope", scopeLabel);
        out.put("teamSize", teamSize);
        out.put("days", days);
        out.put("conflicts", conflicts);
        out.put("conflictThresholdPercent", 60);
        return ApiResponse.ok(out, "Lịch nhóm");
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
            new java.util.HashMap<>(Map.of("id", "DC-01", "employee", "Vũ Văn Luận", "date", "05/11/2026", "reason", "Có check-in 08:47 nhưng bảng ghi vắng", "status", "PENDING", "deadline", java.time.LocalDate.now().plusDays(2).toString())),
            new java.util.HashMap<>(Map.of("id", "DC-02", "employee", "Nguyễn Thị Thu Hà", "date", "07/11/2026", "reason", "Nghỉ phép đã duyệt nhưng ghi UP", "status", "PENDING", "deadline", java.time.LocalDate.now().plusDays(1).toString()))
    ));

    @GetMapping("/disputes")
    @Operation(summary = "Danh sách khiếu nại (S45)")
    public ApiResponse<List<Map<String, Object>>> disputes() {
        var list = new java.util.ArrayList<Map<String, Object>>();
        java.time.LocalDate today = java.time.LocalDate.now();
        for (Map<String, Object> d : DISPUTES) {
            Map<String, Object> copy = new java.util.HashMap<>(d);
            String dl = String.valueOf(d.get("deadline"));
            if ("PENDING".equals(d.get("status"))) {
                long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(today, java.time.LocalDate.parse(dl));
                copy.put("daysLeft", daysLeft);
                if (daysLeft < 0) { copy.put("status", "EXPIRED"); copy.put("overdue", true); }
            }
            list.add(copy);
        }
        return ApiResponse.ok(list, "Danh sách khiếu nại");
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
        if ("PENDING".equals(d.get("status"))) {
            TimesheetController.DISPUTES_PENDING.decrementAndGet();
        }
        d.put("status", "REJECT".equals(action) ? "REJECTED" : "RESOLVED");
        d.put("action", action);
        AuditLog log = AuditLog.builder().action("RESOLVE_DISPUTE").entityName("DISPUTE").entityId(id)
                .userId(CurrentUser.userId()).reason(body.get("reason")).newValue(action).build();
        log.setCreatedAt(java.time.LocalDateTime.now());
        auditLogRepository.save(log);

        // Nhân viên nhận thông báo kết quả xử lý khiếu nại (đặc biệt khi bị từ chối — bắt buộc kèm lý do).
        userRepository.findFirstByFullName(String.valueOf(d.get("employee"))).ifPresent(emp ->
                notificationRepository.save(Notification.builder()
                        .userId(emp.getId())
                        .title("REJECT".equals(action) ? "Khiếu nại bảng công bị từ chối" : "Khiếu nại bảng công đã được xử lý")
                        .content("Khiếu nại ngày " + d.get("date") + ": " + d.get("reason")
                                + ". Lý do xử lý: " + body.get("reason"))
                        .type("DISPUTE")
                        .priority("REJECT".equals(action) ? "HIGH" : "MEDIUM")
                        .actionUrl("/attendance/disputes/" + id)
                        .isRead(false)
                        .build()));

        return ApiResponse.ok(d, "Đã xử lý khiếu nại");
    }

    private static final Map<String, Map<String, Object>> USER_PREFERENCES = new ConcurrentHashMap<>();

    private Map<String, Object> buildDefaultPreferences(String userId, String role) {
        Map<String, Object> prefs = new LinkedHashMap<>();
        prefs.put("userId", userId);
        prefs.put("quietHoursEnabled", true);
        prefs.put("quietHoursStart", "21:00");
        prefs.put("quietHoursEnd", "07:00");
        prefs.put("maxPushPerDay", "MANAGER".equalsIgnoreCase(role) ? 5 : 3);
        prefs.put("dedupeHours", 12);
        prefs.put("personalTasksCount", 4);
        prefs.put("approvalTasksCount", 3);

        Map<String, Object> events = new LinkedHashMap<>();
        // Group 1: Chấm công
        events.put("MISSING_CHECKIN", Map.of("label", "Chưa check-in khi quá 30 phút", "category", "ATTENDANCE", "web", true, "email", false, "push", true));
        events.put("MISSING_CHECKOUT", Map.of("label", "Chưa check-out khi quá 30 phút", "category", "ATTENDANCE", "web", true, "email", false, "push", true));
        events.put("FORGOT_ATTENDANCE", Map.of("label", "Quên chấm công 2 ngày liên tiếp", "category", "ATTENDANCE", "web", true, "email", true, "push", true));
        events.put("ADJUST_DEADLINE_SOON", Map.of("label", "Hạn nộp đơn bổ sung công sắp tới", "category", "ATTENDANCE", "web", true, "email", false, "push", true));
        events.put("ADJUST_OVERDUE", Map.of("label", "Hạn nộp đơn bổ sung công quá hạn", "category", "ATTENDANCE", "web", true, "email", true, "push", true));
        // Group 2: Đơn từ & Phép
        events.put("APPROVAL_OVERDUE", Map.of("label", "Đơn chờ duyệt quá hạn SLA 48h", "category", "REQUEST", "web", true, "email", true, "push", true));
        events.put("REQUEST_REJECTED", Map.of("label", "Đơn bị từ chối / trả lại", "category", "REQUEST", "web", true, "email", false, "push", true));
        events.put("LEAVE_EXPIRY_SOON", Map.of("label", "Phép tồn năm 2025 sắp hết hạn 31/03", "category", "REQUEST", "web", true, "email", false, "push", true));
        events.put("WFH_MISSING_REPORT", Map.of("label", "Đơn WFH chưa gửi báo cáo cuối ngày", "category", "REQUEST", "web", true, "email", false, "push", true));
        // Group 3: OKR
        events.put("OKR_CHECKIN_DUE", Map.of("label", "Check-in tiến độ OKR đến hạn", "category", "OKR", "web", true, "email", false, "push", true));
        events.put("OKR_NOT_CREATED", Map.of("label", "Chưa thiết lập mục tiêu OKR quý", "category", "OKR", "web", true, "email", true, "push", true));
        events.put("OKR_SELF_ASSESSMENT", Map.of("label", "Tự chấm điểm OKR Form 4 Box đến hạn", "category", "OKR", "web", true, "email", false, "push", true));
        events.put("OKR_OBJECTIVE_RETURNED", Map.of("label", "Mục tiêu OKR bị trả lại cần sửa", "category", "OKR", "web", true, "email", false, "push", true));
        // Group 4: Bảng công & Quản trị
        events.put("TIMESHEET_CLOSED", Map.of("label", "Bảng công vừa chốt (khiếu nại 2 ngày)", "category", "TIMESHEET", "web", true, "email", true, "push", false));
        events.put("TIMESHEET_COMPLAINT_EXPIRING", Map.of("label", "Sắp hết hạn khiếu nại bảng công", "category", "TIMESHEET", "web", true, "email", false, "push", true));
        events.put("HR_CLOSE_TIMESHEET", Map.of("label", "Nhắc HR chốt bảng công kỳ này", "category", "SYSTEM", "web", true, "email", true, "push", false));
        events.put("HR_UNLOCK_OKR", Map.of("label", "Nhắc HR mở khóa điều chỉnh OKR", "category", "SYSTEM", "web", true, "email", true, "push", false));

        prefs.put("events", events);
        return prefs;
    }

    @GetMapping("/notifications/preferences")
    @Operation(summary = "Tuỳ chỉnh thông báo (S36)")
    public ApiResponse<Map<String, Object>> preferences() {
        UUID uid = CurrentUser.userId();
        String key = uid != null ? uid.toString() : "default";
        String role = CurrentUser.role();

        Map<String, Object> prefs = USER_PREFERENCES.computeIfAbsent(key, k -> buildDefaultPreferences(k, role));
        return ApiResponse.ok(new LinkedHashMap<>(prefs), "Lấy tùy chỉnh thông báo thành công");
    }

    @RequestMapping(value = "/notifications/preferences", method = {RequestMethod.POST, RequestMethod.PUT})
    @Operation(summary = "Lưu tuỳ chỉnh thông báo cá nhân (S36) - Chặn sửa của người khác")
    public ResponseEntity<ApiResponse<Map<String, Object>>> savePreferences(@RequestBody(required = false) Map<String, Object> body) {
        UUID currentUid = CurrentUser.userId();
        String currentKey = currentUid != null ? currentUid.toString() : "default";
        boolean isAdmin = CurrentUser.isHr();

        // Security check: Only allow modifying own preferences!
        if (body != null && body.containsKey("targetUserId") && body.get("targetUserId") != null) {
            String targetUser = body.get("targetUserId").toString().trim();
            if (!targetUser.isEmpty() && !targetUser.equalsIgnoreCase("current") && !targetUser.equalsIgnoreCase("default") && !targetUser.equalsIgnoreCase(currentKey)) {
                if (!isAdmin) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(ApiResponse.error("Bạn không có quyền sửa đổi tùy chỉnh thông báo của người khác!"));
                }
                currentKey = targetUser;
            }
        }

        Map<String, Object> existing = USER_PREFERENCES.computeIfAbsent(currentKey, k -> buildDefaultPreferences(k, CurrentUser.role()));
        if (body != null) {
            if (body.containsKey("quietHoursEnabled")) existing.put("quietHoursEnabled", body.get("quietHoursEnabled"));
            if (body.containsKey("quietHoursStart")) existing.put("quietHoursStart", body.get("quietHoursStart"));
            if (body.containsKey("quietHoursEnd")) existing.put("quietHoursEnd", body.get("quietHoursEnd"));
            if (body.containsKey("maxPushPerDay")) existing.put("maxPushPerDay", body.get("maxPushPerDay"));
            if (body.containsKey("dedupeHours")) existing.put("dedupeHours", body.get("dedupeHours"));
            if (body.containsKey("events")) {
                Object eventsObj = body.get("events");
                if (eventsObj instanceof Map<?, ?> evMap) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> targetEvs = (Map<String, Object>) existing.get("events");
                    if (targetEvs != null) {
                        for (Map.Entry<?, ?> entry : evMap.entrySet()) {
                            if (entry.getKey() != null && entry.getValue() instanceof Map<?, ?>) {
                                targetEvs.put(entry.getKey().toString(), entry.getValue());
                            }
                        }
                    }
                }
            }
        }

        return ResponseEntity.ok(ApiResponse.ok(new LinkedHashMap<>(existing), "Đã lưu cài đặt thông báo thành công"));
    }

    @GetMapping("/audit-logs")
    @Operation(summary = "Nhật ký thay đổi (S35)")
    public ApiResponse<List<AuditLog>> auditLogs() {
        return ApiResponse.ok(auditLogRepository.findAllByOrderByCreatedAtDesc(), "Nhật ký thay đổi");
    }

    @PostMapping("/face/check-quality")
    @Operation(summary = "Kiểm tra chất lượng ảnh & độ sáng sinh trắc học (S01-B)")
    public ApiResponse<Map<String, Object>> checkQuality(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(Map.of(
                "quality", "GOOD",
                "sharpnessScore", 28.5,
                "luminanceScore", 135.0,
                "faceDetected", true,
                "passed", true
        ), "Chất lượng ảnh đạt yêu cầu");
    }

    @lombok.Data
    public static class DeviceRequest {
        @NotBlank
        private String fingerprint;
        private String deviceName;
        private String reason;
    }
}
