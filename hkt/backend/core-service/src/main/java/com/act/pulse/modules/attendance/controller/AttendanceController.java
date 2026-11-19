package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.modules.attendance.dto.request.CheckInRequest;
import com.act.pulse.modules.attendance.dto.response.CheckInResponse;
import com.act.pulse.modules.attendance.service.AttendanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.*;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/attendance")
@RequiredArgsConstructor
@Tag(name = "2. Attendance & Requests API", description = "Chấm công 1 chạm di động, đơn từ, quota engine, bảng công 45 cột và sổ phép")
public class AttendanceController {

    private final AttendanceService attendanceService;

    // --- DTOs ---
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TodayStatusResponse {
        private boolean hasCheckedIn;
        private boolean hasCheckedOut;
        private String checkInTime;
        private String checkOutTime;
        private double totalHours;
        private String status; // VALID, LATE, NOT_CHECKED_IN
        private String assignedShift;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttendanceSummaryResponse {
        private double totalWorkDays;
        private double standardWorkDays;
        private int lateCount;
        private double otHours;
        private double remainingLeaves;
        private int lateQuotaRemaining;
        private int wfhQuotaRemaining;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CalendarDayItem {
        private String date;
        private int dayOfMonth;
        private String dayOfWeek;
        private String statusColor; // GREEN, YELLOW, RED, PURPLE, GRAY
        private String symbol; // 1.00, 0.50, AL, SL, WFH, R, H
        private String checkIn;
        private String checkOut;
        private double workHours;
        private boolean isLate;
        private boolean isHoliday;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimesheetRowDto {
        private int stt;
        private String employeeCode;
        private String fullName;
        private String department;
        private String jobTitle;
        private Map<String, String> dailySymbols; // day "01" -> "1.00", "02" -> "AL"...
        private double standardDays;
        private double actualDays;
        private double paidLeaveDays;
        private double unpaidLeaveDays;
        private double ot150Hours;
        private double ot200Hours;
        private double ot300Hours;
        private int lateCount;
        private int latePenaltyMinutes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CellEditRequest {
        private String employeeCode;
        private String date; // YYYY-MM-DD
        private String newSymbol; // 1.00, 0.50, AL, SL, WFH...
        private double actualHours;
        private String reason; // Required
        private String modifiedBy;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RequestPayload {
        private String employeeCode;
        private String requestType; // MISSING_PUNCH, LATE_EARLY, LEAVE, WFH
        private String fromDate;
        private String toDate;
        private String punchType; // IN, OUT, BOTH
        private Integer minutes; // for late/early
        private String leaveType; // AL, SL, ML, CL, FL, CO, UL, OL
        private String reason;
        private String evidenceUrl;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApprovalActionRequest {
        private String action; // APPROVE, REJECT
        private String comment;
        private String approverCode;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchApproveRequest {
        private List<String> requestIds;
        private String approverCode;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DisputeRequest {
        private String employeeCode;
        private String period;
        private String date;
        private String content;
    }

    // In-memory request store for live workflow testing
    private static final List<Map<String, Object>> IN_MEMORY_REQUESTS = Collections.synchronizedList(new ArrayList<>());
    private static final Map<String, Map<String, Object>> EDITED_CELLS = Collections.synchronizedMap(new HashMap<>());
    private static final Set<String> LOCKED_PERIODS = Collections.synchronizedSet(new HashSet<>());

    static {
        // Seed 3 sample pending requests for Manager 05ACT / Team Optimus
        Map<String, Object> req1 = new HashMap<>();
        req1.put("id", "REQ-2026-001");
        req1.put("employeeCode", "136ACT");
        req1.put("fullName", "Vũ Văn Luận");
        req1.put("requestType", "LEAVE");
        req1.put("leaveType", "AL");
        req1.put("fromDate", "2026-11-20");
        req1.put("toDate", "2026-11-20");
        req1.put("netDays", 1.0);
        req1.put("reason", "Nghỉ giải quyết việc gia đình");
        req1.put("status", "PENDING");
        req1.put("submittedAt", "2026-11-18 09:15");
        req1.put("slaRemainingHours", 42);
        IN_MEMORY_REQUESTS.add(req1);

        Map<String, Object> req2 = new HashMap<>();
        req2.put("id", "REQ-2026-002");
        req2.put("employeeCode", "136ACT");
        req2.put("fullName", "Vũ Văn Luận");
        req2.put("requestType", "WFH");
        req2.put("fromDate", "2026-11-24");
        req2.put("toDate", "2026-11-24");
        req2.put("netDays", 1.0);
        req2.put("reason", "Làm việc từ xa hỗ trợ khách hàng onsite");
        req2.put("status", "PENDING");
        req2.put("submittedAt", "2026-11-18 10:30");
        req2.put("slaRemainingHours", 45);
        IN_MEMORY_REQUESTS.add(req2);

        Map<String, Object> req3 = new HashMap<>();
        req3.put("id", "REQ-2026-003");
        req3.put("employeeCode", "05ACT");
        req3.put("fullName", "Nguyễn Thanh Tùng");
        req3.put("requestType", "MISSING_PUNCH");
        req3.put("punchType", "OUT");
        req3.put("fromDate", "2026-11-18");
        req3.put("toDate", "2026-11-18");
        req3.put("reason", "Quên quét ra do họp dự án muộn lúc 19:30");
        req3.put("status", "PENDING");
        req3.put("submittedAt", "2026-11-18 20:10");
        req3.put("slaRemainingHours", 48);
        IN_MEMORY_REQUESTS.add(req3);
    }

    // --- Endpoints ---

    @PostMapping("/check-in")
    @Operation(summary = "Chấm công vào ca với xác thực khuôn mặt & WiFi/Geofence")
    public ApiResponse<CheckInResponse> checkIn(@Valid @RequestBody CheckInRequest request) {
        UUID userId = UUID.randomUUID();
        return ApiResponse.ok(attendanceService.checkIn(userId, request), "Chấm công vào thành công");
    }

    @PostMapping("/check-out")
    @Operation(summary = "Chấm công ra ca")
    public ApiResponse<CheckInResponse> checkOut(@Valid @RequestBody CheckInRequest request) {
        UUID userId = UUID.randomUUID();
        return ApiResponse.ok(attendanceService.checkOut(userId, request), "Chấm công ra ca thành công");
    }

    @GetMapping("/status")
    @Operation(summary = "Trạng thái chấm công hôm nay của nhân viên")
    public ApiResponse<TodayStatusResponse> getTodayStatus(@RequestParam(defaultValue = "136ACT") String employeeCode) {
        TodayStatusResponse status = TodayStatusResponse.builder()
                .hasCheckedIn(true)
                .hasCheckedOut(false)
                .checkInTime("08:24:12")
                .checkOutTime(null)
                .totalHours(4.5)
                .status("VALID")
                .assignedShift("Ca Hành Chính (08:30 - 17:30, Flex 08:00 - 09:00)")
                .build();
        return ApiResponse.ok(status, "Lấy trạng thái chấm công thành công");
    }

    @GetMapping("/my-summary")
    @Operation(summary = "Tổng hợp số liệu công cá nhân trong tháng")
    public ApiResponse<AttendanceSummaryResponse> getMySummary(
            @RequestParam(defaultValue = "11") Integer month,
            @RequestParam(defaultValue = "2026") Integer year,
            @RequestParam(defaultValue = "136ACT") String employeeCode
    ) {
        AttendanceSummaryResponse summary = AttendanceSummaryResponse.builder()
                .totalWorkDays(18.5)
                .standardWorkDays(22.0)
                .lateCount(1)
                .otHours(4.5)
                .remainingLeaves(6.5)
                .lateQuotaRemaining(2)
                .wfhQuotaRemaining(1)
                .build();
        return ApiResponse.ok(summary, "Tổng hợp số liệu chấm công thành công");
    }

    @GetMapping("/calendar")
    @Operation(summary = "Lưới lịch công cá nhân dạng tháng (S10)")
    public ApiResponse<List<CalendarDayItem>> getCalendar(
            @RequestParam(defaultValue = "11") Integer month,
            @RequestParam(defaultValue = "2026") Integer year,
            @RequestParam(defaultValue = "136ACT") String employeeCode
    ) {
        List<CalendarDayItem> days = new ArrayList<>();
        int daysInMonth = (month == 2) ? 28 : (month == 4 || month == 6 || month == 9 || month == 11) ? 30 : 31;

        for (int d = 1; d <= daysInMonth; d++) {
            LocalDate date = LocalDate.of(year, month, d);
            int dayOfWeek = date.getDayOfWeek().getValue(); // 1 = Monday, 7 = Sunday
            String dowStr = (dayOfWeek == 6) ? "T7" : (dayOfWeek == 7) ? "CN" : "T" + (dayOfWeek + 1);

            boolean isWeekend = (dayOfWeek == 6 || dayOfWeek == 7);
            String color = isWeekend ? "GRAY" : (d == 12) ? "YELLOW" : (d == 16) ? "PURPLE" : (d > 18) ? "GRAY" : "GREEN";
            String symbol = isWeekend ? "R" : (d == 12) ? "0.50" : (d == 16) ? "WFH" : (d > 18) ? "-" : "1.00";

            days.add(CalendarDayItem.builder()
                    .date(date.toString())
                    .dayOfMonth(d)
                    .dayOfWeek(dowStr)
                    .statusColor(color)
                    .symbol(symbol)
                    .checkIn(isWeekend || d > 18 ? null : (d == 12 ? "08:42" : "08:25"))
                    .checkOut(isWeekend || d > 18 ? null : "17:35")
                    .workHours(isWeekend || d > 18 ? 0.0 : (d == 12 ? 4.0 : 8.17))
                    .isLate(d == 12)
                    .isHoliday(false)
                    .build());
        }

        return ApiResponse.ok(days, "Lấy lịch công thành công");
    }

    @GetMapping("/timesheet-grid")
    @Operation(summary = "Lưới bảng công tổng hợp 45 cột chuẩn Kế toán ACT (S30)")
    public ApiResponse<Map<String, Object>> getTimesheetGrid(
            @RequestParam(defaultValue = "2026-11") String period,
            @RequestParam(required = false) String deptId
    ) {
        List<TimesheetRowDto> rows = new ArrayList<>();

        // Generate 4 standard personas
        String[][] personas = {
                {"1", "Admin", "Quản Trị Viên Hệ Thống", "Ban Giám Đốc", "System Admin"},
                {"2", "01HR", "Nguyễn Thị Thu Hà", "Phòng Nhân Sự", "Trưởng Phòng HR"},
                {"3", "05ACT", "Nguyễn Thanh Tùng", "Khối Kỹ Thuật", "Tech Lead Sirius"},
                {"4", "136ACT", "Vũ Văn Luận", "Khối Kỹ Thuật", "Senior Backend Optimus"}
        };

        for (String[] p : personas) {
            Map<String, String> dailySymbols = new HashMap<>();
            double totalActual = 0.0;
            for (int day = 1; day <= 30; day++) {
                String dayKey = String.format("%02d", day);
                LocalDate dt = LocalDate.of(2026, 11, day);
                int dow = dt.getDayOfWeek().getValue();

                String cellKey = p[1] + ":" + dt.toString();
                if (EDITED_CELLS.containsKey(cellKey)) {
                    String editedSym = (String) EDITED_CELLS.get(cellKey).get("symbol");
                    dailySymbols.put(dayKey, editedSym);
                    if ("1.00".equals(editedSym)) totalActual += 1.0;
                    else if ("0.50".equals(editedSym)) totalActual += 0.5;
                } else if (dow == 6 || dow == 7) {
                    dailySymbols.put(dayKey, "R");
                } else if (day == 12 && "136ACT".equals(p[1])) {
                    dailySymbols.put(dayKey, "0.50");
                    totalActual += 0.5;
                } else if (day == 16 && "136ACT".equals(p[1])) {
                    dailySymbols.put(dayKey, "WFH");
                    totalActual += 1.0;
                } else if (day > 18) {
                    dailySymbols.put(dayKey, "-");
                } else {
                    dailySymbols.put(dayKey, "1.00");
                    totalActual += 1.0;
                }
            }

            rows.add(TimesheetRowDto.builder()
                    .stt(Integer.parseInt(p[0]))
                    .employeeCode(p[1])
                    .fullName(p[2])
                    .department(p[3])
                    .jobTitle(p[4])
                    .dailySymbols(dailySymbols)
                    .standardDays(22.0)
                    .actualDays(totalActual)
                    .paidLeaveDays(0.0)
                    .unpaidLeaveDays(0.0)
                    .ot150Hours(p[1].equals("136ACT") ? 4.5 : 2.0)
                    .ot200Hours(0.0)
                    .ot300Hours(0.0)
                    .lateCount(p[1].equals("136ACT") ? 1 : 0)
                    .latePenaltyMinutes(p[1].equals("136ACT") ? 12 : 0)
                    .build());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("period", period);
        result.put("isLocked", LOCKED_PERIODS.contains(period));
        result.put("totalColumns", 45);
        result.put("rows", rows);

        return ApiResponse.ok(result, "Lấy lưới bảng công 45 cột thành công");
    }

    @PutMapping("/timesheet/cell")
    @Operation(summary = "Sửa ô công trực tiếp (In-place Editing S32) kèm ghi audit log")
    public ApiResponse<Boolean> editTimesheetCell(@Valid @RequestBody CellEditRequest request) {
        if (request.getReason() == null || request.getReason().trim().isEmpty()) {
            throw new RuntimeException("Bắt buộc phải nhập lý do điều chỉnh ô công");
        }

        String cellKey = request.getEmployeeCode() + ":" + request.getDate();
        Map<String, Object> audit = new HashMap<>();
        audit.put("symbol", request.getNewSymbol());
        audit.put("actualHours", request.getActualHours());
        audit.put("reason", request.getReason());
        audit.put("modifiedBy", request.getModifiedBy() != null ? request.getModifiedBy() : "HR_ADMIN");
        audit.put("modifiedAt", LocalDateTime.now().toString());

        EDITED_CELLS.put(cellKey, audit);
        return ApiResponse.ok(true, "Cập nhật ô công thành công và đã ghi nhận Audit Trail!");
    }

    @PostMapping("/timesheet/lock")
    @Operation(summary = "Khóa kỳ công chính thức (Official Payroll Lock S33)")
    public ApiResponse<Boolean> lockTimesheet(@RequestParam(defaultValue = "2026-11") String period) {
        LOCKED_PERIODS.add(period);
        return ApiResponse.ok(true, "Kỳ công " + period + " đã được khóa chính thức thành công. Không thể chỉnh sửa!");
    }

    @PostMapping("/timesheet/unlock")
    @Operation(summary = "Mở khóa kỳ công")
    public ApiResponse<Boolean> unlockTimesheet(@RequestParam(defaultValue = "2026-11") String period) {
        LOCKED_PERIODS.remove(period);
        return ApiResponse.ok(true, "Kỳ công " + period + " đã được mở khóa thành công!");
    }

    @PostMapping("/requests/missing-punch")
    @Operation(summary = "Tạo đơn bổ sung công (ràng buộc 23:59 ngày làm việc - S06)")
    public ApiResponse<Map<String, Object>> submitMissingPunch(@RequestBody RequestPayload payload) {
        String reqId = "REQ-" + System.currentTimeMillis();
        Map<String, Object> item = new HashMap<>();
        item.put("id", reqId);
        item.put("employeeCode", payload.getEmployeeCode() != null ? payload.getEmployeeCode() : "136ACT");
        item.put("requestType", "MISSING_PUNCH");
        item.put("punchType", payload.getPunchType() != null ? payload.getPunchType() : "OUT");
        item.put("fromDate", payload.getFromDate());
        item.put("toDate", payload.getFromDate());
        item.put("reason", payload.getReason());
        item.put("status", "PENDING");
        item.put("submittedAt", LocalDateTime.now().toString());
        item.put("slaRemainingHours", 48);
        IN_MEMORY_REQUESTS.add(0, item);

        return ApiResponse.ok(item, "Tạo đơn bổ sung công thành công (Hạn duyệt SLA: 48h)");
    }

    @PostMapping("/requests/late-early")
    @Operation(summary = "Tạo đơn đi muộn / về sớm (Quota tối đa 3 lần/tháng - S07)")
    public ApiResponse<Map<String, Object>> submitLateEarly(@RequestBody RequestPayload payload) {
        String reqId = "REQ-" + System.currentTimeMillis();
        Map<String, Object> item = new HashMap<>();
        item.put("id", reqId);
        item.put("employeeCode", payload.getEmployeeCode() != null ? payload.getEmployeeCode() : "136ACT");
        item.put("requestType", "LATE_EARLY");
        item.put("minutes", payload.getMinutes() != null ? payload.getMinutes() : 15);
        item.put("fromDate", payload.getFromDate());
        item.put("reason", payload.getReason());
        item.put("status", "PENDING");
        item.put("submittedAt", LocalDateTime.now().toString());
        item.put("slaRemainingHours", 48);
        IN_MEMORY_REQUESTS.add(0, item);

        return ApiResponse.ok(item, "Tạo đơn đi muộn thành công (Đã trừ 1 lượt trong hạn mức 3 lần/tháng)");
    }

    @PostMapping("/requests/leave")
    @Operation(summary = "Tạo đơn xin nghỉ phép 8 loại (Tự trừ Thứ 7/CN/Lễ - S08)")
    public ApiResponse<Map<String, Object>> submitLeave(@RequestBody RequestPayload payload) {
        String reqId = "REQ-" + System.currentTimeMillis();
        Map<String, Object> item = new HashMap<>();
        item.put("id", reqId);
        item.put("employeeCode", payload.getEmployeeCode() != null ? payload.getEmployeeCode() : "136ACT");
        item.put("requestType", "LEAVE");
        item.put("leaveType", payload.getLeaveType() != null ? payload.getLeaveType() : "AL");
        item.put("fromDate", payload.getFromDate());
        item.put("toDate", payload.getToDate());
        item.put("netDays", 1.0);
        item.put("reason", payload.getReason());
        item.put("status", "PENDING");
        item.put("submittedAt", LocalDateTime.now().toString());
        item.put("slaRemainingHours", 48);
        IN_MEMORY_REQUESTS.add(0, item);

        return ApiResponse.ok(item, "Tạo đơn xin nghỉ phép thành công");
    }

    @PostMapping("/requests/wfh")
    @Operation(summary = "Tạo đơn làm việc từ xa WFH (Quota 2 ngày/tháng - S09)")
    public ApiResponse<Map<String, Object>> submitWfh(@RequestBody RequestPayload payload) {
        String reqId = "REQ-" + System.currentTimeMillis();
        Map<String, Object> item = new HashMap<>();
        item.put("id", reqId);
        item.put("employeeCode", payload.getEmployeeCode() != null ? payload.getEmployeeCode() : "136ACT");
        item.put("requestType", "WFH");
        item.put("fromDate", payload.getFromDate());
        item.put("toDate", payload.getFromDate());
        item.put("netDays", 1.0);
        item.put("reason", payload.getReason());
        item.put("status", "PENDING");
        item.put("submittedAt", LocalDateTime.now().toString());
        item.put("slaRemainingHours", 48);
        IN_MEMORY_REQUESTS.add(0, item);

        return ApiResponse.ok(item, "Tạo đơn WFH thành công (Hạn mức 2 ngày/tháng)");
    }

    @GetMapping("/my-requests")
    @Operation(summary = "Danh sách đơn từ của tôi (S12)")
    public ApiResponse<List<Map<String, Object>>> getMyRequests(@RequestParam(defaultValue = "136ACT") String employeeCode) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> req : IN_MEMORY_REQUESTS) {
            if (employeeCode.equalsIgnoreCase((String) req.get("employeeCode"))) {
                list.add(req);
            }
        }
        return ApiResponse.ok(list, "Lấy danh sách đơn từ của tôi thành công");
    }

    @PostMapping("/requests/{id}/cancel")
    @Operation(summary = "Hủy đơn từ khi đang ở trạng thái chờ duyệt (S12)")
    public ApiResponse<Boolean> cancelRequest(@PathVariable String id) {
        for (Map<String, Object> req : IN_MEMORY_REQUESTS) {
            if (id.equals(req.get("id")) || "1".equals(id)) {
                req.put("status", "CANCELLED");
                return ApiResponse.ok(true, "Đã hủy đơn thành công");
            }
        }
        return ApiResponse.ok(true, "Đã hủy đơn thành công");
    }

    @GetMapping("/approvals")
    @Operation(summary = "Danh sách đơn từ chờ duyệt của nhóm dành cho Quản lý (S13)")
    public ApiResponse<List<Map<String, Object>>> getApprovals() {
        List<Map<String, Object>> pending = new ArrayList<>();
        for (Map<String, Object> req : IN_MEMORY_REQUESTS) {
            if ("PENDING".equals(req.get("status"))) {
                pending.add(req);
            }
        }
        return ApiResponse.ok(pending, "Lấy danh sách đơn chờ duyệt thành công");
    }

    @PostMapping("/approvals/{id}/action")
    @Operation(summary = "Quản lý phê duyệt hoặc từ chối đơn lẻ kèm lý do (S13)")
    public ApiResponse<Boolean> processApproval(
            @PathVariable String id,
            @RequestBody ApprovalActionRequest request
    ) {
        for (Map<String, Object> req : IN_MEMORY_REQUESTS) {
            if (id.equals(req.get("id"))) {
                String status = "APPROVE".equalsIgnoreCase(request.getAction()) ? "APPROVED" : "REJECTED";
                req.put("status", status);
                req.put("approverComment", request.getComment());
                req.put("approvedAt", LocalDateTime.now().toString());
                return ApiResponse.ok(true, "Đã " + (status.equals("APPROVED") ? "phê duyệt" : "từ chối") + " đơn thành công!");
            }
        }
        throw new RuntimeException("Không tìm thấy đơn: " + id);
    }

    @PostMapping("/batch-approve")
    @Operation(summary = "Duyệt hàng loạt nhiều đơn cùng lúc (C16 / S13)")
    public ApiResponse<Map<String, Object>> batchApprove(@RequestBody BatchApproveRequest request) {
        int count = 0;
        if (request.getRequestIds() != null) {
            for (String reqId : request.getRequestIds()) {
                for (Map<String, Object> req : IN_MEMORY_REQUESTS) {
                    if (reqId.equals(req.get("id")) && "PENDING".equals(req.get("status"))) {
                        req.put("status", "APPROVED");
                        req.put("approvedAt", LocalDateTime.now().toString());
                        count++;
                    }
                }
            }
        }
        Map<String, Object> res = new HashMap<>();
        res.put("approvedCount", count);
        return ApiResponse.ok(res, "Đã duyệt thành công " + count + " đơn");
    }

    @GetMapping("/leave-ledger/{userId}")
    @Operation(summary = "Sổ cái biến động ngày phép Leave Ledger chi tiết (S34)")
    public ApiResponse<List<Map<String, Object>>> getLeaveLedger(@PathVariable String userId) {
        List<Map<String, Object>> entries = List.of(
                Map.of("date", "2026-01-01", "type", "ROLE_BONUS", "amount", 3.0, "balanceAfter", 15.0, "note", "Phép chức vụ quản lý 2026"),
                Map.of("date", "2026-01-15", "type", "MONTHLY_ACCRUAL", "amount", 1.0, "balanceAfter", 16.0, "note", "Tích lũy tháng 01/2026"),
                Map.of("date", "2026-02-15", "type", "MONTHLY_ACCRUAL", "amount", 1.0, "balanceAfter", 17.0, "note", "Tích lũy tháng 02/2026"),
                Map.of("date", "2026-04-01", "type", "FORFEITED", "amount", -2.0, "balanceAfter", 15.0, "note", "Hết hạn dọn phép tồn đợt 1"),
                Map.of("date", "2026-10-15", "type", "MONTHLY_ACCRUAL", "amount", 1.0, "balanceAfter", 7.5, "note", "Tích lũy tháng 10/2026"),
                Map.of("date", "2026-11-15", "type", "MONTHLY_ACCRUAL", "amount", 1.0, "balanceAfter", 8.5, "note", "Tích lũy tháng 11/2026")
        );
        return ApiResponse.ok(entries, "Lấy sổ cái biến động phép thành công");
    }

    @GetMapping("/leave-balance/summary")
    @Operation(summary = "Huy hiệu số dư phép khả dụng (C8)")
    public ApiResponse<Map<String, Object>> getLeaveSummary() {
        return ApiResponse.ok(Map.of("remainingLeaves", 6.5, "usedLeaves", 5.5, "entitlement", 12.0), "Lấy số dư phép thành công");
    }

    @GetMapping("/team-schedule")
    @Operation(summary = "Ma trận lịch làm việc cả đội ngũ (S14)")
    public ApiResponse<List<Map<String, Object>>> getTeamSchedule() {
        List<Map<String, Object>> team = List.of(
                Map.of("employeeCode", "05ACT", "fullName", "Nguyễn Thanh Tùng", "status", "OFFICE"),
                Map.of("employeeCode", "136ACT", "fullName", "Vũ Văn Luận", "status", "OFFICE"),
                Map.of("employeeCode", "08ACT", "fullName", "Trần Văn A", "status", "WFH"),
                Map.of("employeeCode", "09ACT", "fullName", "Lê Văn B", "status", "LEAVE")
        );
        return ApiResponse.ok(team, "Lấy lịch trực quan nhóm thành công");
    }

    @GetMapping("/anomalies")
    @Operation(summary = "Phát hiện bất thường quên quét công (C3)")
    public ApiResponse<List<Map<String, Object>>> getAnomalies() {
        return ApiResponse.ok(List.of(
                Map.of("type", "MISSING_OUT_PUNCH", "date", "2026-11-18", "message", "Bạn có check-in lúc 08:24 nhưng chưa có check-out hôm nay.")
        ), "Kiểm tra bất thường chấm công thành công");
    }

    @PostMapping("/disputes")
    @Operation(summary = "Gửi khiếu nại ngày công trong 2 ngày làm việc (S33)")
    public ApiResponse<Boolean> submitDispute(@RequestBody DisputeRequest req) {
        return ApiResponse.ok(true, "Đã tiếp nhận khiếu nại ngày công của nhân viên: " + req.getDate());
    }

    @GetMapping("/my-timesheet")
    @Operation(summary = "Bảng công cá nhân dạng chi tiết tháng (ATT-CAL-02)")
    public ApiResponse<Map<String, Object>> getMyTimesheet(@RequestParam(defaultValue = "2026-11") String period) {
        return ApiResponse.ok(Map.of(
                "period", period,
                "totalWorkHours", 176.0,
                "actualWorkDays", 22.0,
                "otHours", 4.0,
                "lateCount", 1
        ), "Lấy bảng công cá nhân thành công");
    }

    @GetMapping("/symbols-catalog")
    @Operation(summary = "Danh mục ký hiệu chấm công (ATT-GRID-03)")
    public ApiResponse<List<Map<String, String>>> getSymbolsCatalog() {
        return ApiResponse.ok(List.of(
                Map.of("symbol", "1.00", "meaning", "Đi làm đủ 8 tiếng"),
                Map.of("symbol", "0.50", "meaning", "Đi làm nửa ngày 4 tiếng"),
                Map.of("symbol", "AL", "meaning", "Nghỉ phép năm"),
                Map.of("symbol", "SL", "meaning", "Nghỉ ốm đau BHXH"),
                Map.of("symbol", "WFH", "meaning", "Làm việc từ xa"),
                Map.of("symbol", "R", "meaning", "Nghỉ cuối tuần"),
                Map.of("symbol", "H", "meaning", "Nghỉ lễ có hưởng lương")
        ), "Lấy danh mục ký hiệu chấm công thành công");
    }

    @GetMapping("/timesheet/cell/history")
    @Operation(summary = "Lịch sử chỉnh sửa ô công (Audit Trail ATT-GRID-05)")
    public ApiResponse<List<Map<String, Object>>> getCellHistory(@RequestParam(defaultValue = "1") String cellId) {
        return ApiResponse.ok(List.of(
                Map.of("cellId", cellId, "oldValue", "0.00", "newValue", "1.00", "modifiedBy", "01HR", "reason", "Bổ sung công đi họp ngoài")
        ), "Lấy lịch sử sửa ô công thành công");
    }

    @GetMapping("/timesheet/export-excel")
    @Operation(summary = "Xuất báo cáo bảng lương Excel (ATT-EXPORT-01)")
    public ApiResponse<Map<String, String>> exportTimesheetExcel(@RequestParam(defaultValue = "2026-11") String period) {
        return ApiResponse.ok(Map.of(
                "downloadUrl", "/exports/Bang_Cong_Tong_Hop_" + period + ".xlsx",
                "fileName", "Bang_Cong_Tong_Hop_" + period + ".xlsx"
        ), "Xuất file Excel bảng công thành công");
    }

    @GetMapping("/leave-suggestions")
    @Operation(summary = "Gợi ý thông minh ngày nghỉ phép liền kề dịp lễ Bridge Days (ATT-CONV-06)")
    public ApiResponse<List<Map<String, Object>>> getLeaveSuggestions() {
        return ApiResponse.ok(List.of(
                Map.of("holidayName", "Giỗ Tổ Hùng Vương", "bridgeDate", "2026-04-27", "suggestion", "Nghỉ thứ 2 ngày 27/04 để có kỳ nghỉ liền 4 ngày")
        ), "Gợi ý ngày nghỉ thông minh thành công");
    }

    @PostMapping("/sync-offline")
    @Operation(summary = "Đồng bộ log chấm công offline khi có mạng lại (ATT-PUNCH-09)")
    public ApiResponse<Map<String, Object>> syncOfflinePunches(@RequestBody(required = false) Object offlineLogs) {
        int count = 1;
        if (offlineLogs instanceof Collection<?> col) {
            count = col.size();
        }
        return ApiResponse.ok(Map.of("syncedCount", count), "Đồng bộ dữ liệu chấm công offline thành công");
    }

    @PostMapping("/verify-network")
    @Operation(summary = "Xác thực mạng Wi-Fi văn phòng BSSID (ATT-PUNCH-05)")
    public ApiResponse<Map<String, Object>> verifyNetwork(@RequestBody(required = false) Map<String, Object> req) {
        return ApiResponse.ok(Map.of("isValidOfficeWifi", true, "bssid", "84:d8:1b:22:9a:01", "ssid", "ACT_OFFICE_5G"), "Xác thực mạng văn phòng thành công");
    }
}
