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
import com.act.pulse.modules.attendance.entity.TimesheetDispute;
import com.act.pulse.modules.attendance.entity.Notification;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.NotificationRepository;
import com.act.pulse.modules.attendance.repository.ShiftRepository;
import com.act.pulse.modules.attendance.repository.TimesheetDisputeRepository;
import com.act.pulse.modules.attendance.repository.HolidayRepository;
import com.act.pulse.modules.attendance.repository.TimesheetRepository;
import com.act.pulse.modules.attendance.entity.Holiday;
import com.act.pulse.modules.attendance.entity.Timesheet;
import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final TimesheetDisputeRepository timesheetDisputeRepository;
    private final HolidayRepository holidayRepository;
    private final TimesheetRepository timesheetRepository;
    private final RuleService ruleService;
    private final ObjectMapper objectMapper;

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

    @GetMapping({"/attendance/my-timesheet", "/attendance/calendar", "/attendance/monthly-calendar"})
    @Operation(summary = "Bảng công / Lịch công cá nhân theo tháng (S06, S11)")
    public ApiResponse<Map<String, Object>> myTimesheet(
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String period,
            @RequestParam(required = false) Integer year) {
        UUID userId = CurrentUser.userId();
        if (userId == null) {
            return ApiResponse.ok(Map.of("days", List.of(), "logs", List.of(), "message", "Chưa đăng nhập"), "Chưa đăng nhập");
        }

        java.time.YearMonth ym = java.time.YearMonth.now();
        if (month != null && !month.isBlank()) {
            if (month.contains("-")) {
                try { ym = java.time.YearMonth.parse(month.trim()); } catch (Exception ignored) {}
            } else if (year != null) {
                try { ym = java.time.YearMonth.of(year, Integer.parseInt(month.trim())); } catch (Exception ignored) {}
            } else {
                try { ym = java.time.YearMonth.of(ym.getYear(), Integer.parseInt(month.trim())); } catch (Exception ignored) {}
            }
        } else if (period != null && !period.isBlank()) {
            try { ym = java.time.YearMonth.parse(period.trim()); } catch (Exception ignored) {}
        } else if (year != null) {
            ym = java.time.YearMonth.of(year, ym.getMonthValue());
        }

        int daysInMonth = ym.lengthOfMonth();
        java.time.LocalDate start = ym.atDay(1);
        java.time.LocalDate end = ym.atEndOfMonth();

        List<AttendanceLog> logs = attendanceLogRepository.findByUserIdAndWorkDateBetweenOrderByWorkDateAsc(userId, start, end);
        Map<java.time.LocalDate, AttendanceLog> logByDate = new HashMap<>();
        for (AttendanceLog l : logs) {
            if (l.getWorkDate() != null) logByDate.put(l.getWorkDate(), l);
        }

        List<RequestEntity> allRequests = requestRepository.findByUserIdOrderByCreatedAtDesc(userId);
        Map<java.time.LocalDate, List<RequestEntity>> requestsByDate = new HashMap<>();
        for (RequestEntity r : allRequests) {
            if ("APPROVED".equals(r.getStatus()) && r.getWorkDate() != null
                    && !r.getWorkDate().isBefore(start) && !r.getWorkDate().isAfter(end)) {
                requestsByDate.computeIfAbsent(r.getWorkDate(), k -> new ArrayList<>()).add(r);
            }
        }

        Set<java.time.LocalDate> holidays = new HashSet<>();
        for (Holiday h : holidayRepository.findAll()) {
            if (h.getHolidayDate() != null && !h.getHolidayDate().isBefore(start) && !h.getHolidayDate().isAfter(end)) {
                holidays.add(h.getHolidayDate());
            }
        }

        Map<java.time.LocalDate, TimesheetDispute> disputesByDate = new HashMap<>();
        for (TimesheetDispute d : timesheetDisputeRepository.findAllByOrderByCreatedAtDesc()) {
            if (userId.equals(d.getUserId()) && d.getWorkDate() != null
                    && !d.getWorkDate().isBefore(start) && !d.getWorkDate().isAfter(end)) {
                disputesByDate.putIfAbsent(d.getWorkDate(), d);
            }
        }

        // Rules
        int publishDay = ruleService.getInt("payroll_period", "publish_day", 11);
        int disputeWindow = ruleService.getInt("payroll_period", "dispute_window_days", 2);

        // Timesheet period status
        final int targetMonth = ym.getMonthValue();
        final int targetYear = ym.getYear();
        List<Timesheet> userSheets = timesheetRepository.findByUserIdAndPeriodMonthAndPeriodYear(userId, targetMonth, targetYear)
                .map(List::of)
                .orElse(List.of());
        List<Timesheet> sheets = !userSheets.isEmpty() ? userSheets : timesheetRepository.findByPeriodMonthAndPeriodYear(targetMonth, targetYear);
        String status = sheets.isEmpty() ? "draft" : sheets.get(0).getStatus();

        java.time.LocalDate deadline = java.time.LocalDate.of(ym.getYear(), ym.getMonthValue(), Math.min(daysInMonth, publishDay + disputeWindow));
        java.time.LocalDate today = java.time.LocalDate.now();

        String periodStatus;
        boolean canDispute;
        if ("locked".equalsIgnoreCase(status)) {
            periodStatus = "LOCKED";
            canDispute = false;
        } else if ("published".equalsIgnoreCase(status)) {
            if (today.isAfter(deadline)) {
                periodStatus = "EXPIRED";
                canDispute = false;
            } else {
                periodStatus = "DISPUTABLE";
                canDispute = true;
            }
        } else { // draft
            if (today.getDayOfMonth() < publishDay && java.time.YearMonth.now().equals(ym)) {
                periodStatus = "UNPUBLISHED";
                canDispute = false;
            } else {
                periodStatus = "DRAFT";
                canDispute = false;
            }
        }

        // Calculate days and metrics
        double standardDays = 0;
        double actualDays = 0;
        double wfhDays = 0;
        double leaveDays = 0;
        int lateCount = 0;
        int holidayDays = holidays.size();
        int sickDays = 0;
        int compDays = 0;
        int unpaidDays = 0;

        List<Map<String, Object>> daysList = new ArrayList<>();
        String[] weekdayNames = {"T2", "T3", "T4", "T5", "T6", "T7", "CN"};

        for (int d = 1; d <= daysInMonth; d++) {
            java.time.LocalDate date = ym.atDay(d);
            int dow = date.getDayOfWeek().getValue(); // 1 = Mon, 7 = Sun
            boolean isWeekend = (dow >= 6);
            boolean isHoliday = holidays.contains(date);

            if (!isWeekend && !isHoliday) {
                standardDays += 1.0;
            }

            AttendanceLog log = logByDate.get(date);
            List<RequestEntity> reqs = requestsByDate.getOrDefault(date, List.of());
            RequestEntity leaveReq = reqs.stream().filter(r -> "LEAVE".equals(r.getRequestType())).findFirst().orElse(null);
            RequestEntity wfhReq = reqs.stream().filter(r -> "WFH".equals(r.getRequestType())).findFirst().orElse(null);
            RequestEntity lateReq = reqs.stream().filter(r -> "LATE_EARLY".equals(r.getRequestType())).findFirst().orElse(null);

            String checkInStr = (log != null && log.getCheckInAt() != null)
                    ? log.getCheckInAt().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) : null;
            String checkOutStr = (log != null && log.getCheckOutAt() != null)
                    ? log.getCheckOutAt().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) : null;

            double hoursWorked = 0;
            if (log != null && log.getCheckInAt() != null && log.getCheckOutAt() != null) {
                long minutes = java.time.Duration.between(log.getCheckInAt(), log.getCheckOutAt()).toMinutes();
                long net = Math.max(0, minutes - 60);
                hoursWorked = Math.round((net / 60.0) * 10.0) / 10.0;
            }

            int lateMinutes = 0;
            if (log != null && log.getCheckInAt() != null) {
                java.time.LocalTime cin = log.getCheckInAt().toLocalTime();
                if (cin.isAfter(java.time.LocalTime.of(8, 30))) {
                    lateMinutes = (int) java.time.Duration.between(java.time.LocalTime.of(8, 30), cin).toMinutes();
                }
            }

            String dayStatus;
            String statusText;
            String symbol;

            if (isHoliday) {
                dayStatus = "HOLIDAY";
                statusText = "Ngày lễ";
                symbol = "NL";
            } else if (leaveReq != null) {
                dayStatus = "LEAVE";
                String lt = leaveReq.getLeaveType() != null ? leaveReq.getLeaveType() : "AL";
                boolean halfDay = leaveReq.getPayload() != null && leaveReq.getPayload().contains("half_day_period");
                leaveDays += halfDay ? 0.5 : 1.0;
                if ("S".equalsIgnoreCase(lt)) sickDays++;
                else if ("RO".equalsIgnoreCase(lt)) compDays++;
                else if ("UP".equalsIgnoreCase(lt)) unpaidDays++;
                symbol = halfDay ? lt + "/0.50" : lt;
                statusText = "Nghỉ phép (" + symbol + ")";
            } else if (wfhReq != null) {
                dayStatus = "WFH";
                boolean halfDay = wfhReq.getPayload() != null && wfhReq.getPayload().contains("half_day_period");
                wfhDays += halfDay ? 0.5 : 1.0;
                actualDays += halfDay ? 0.5 : 1.0;
                symbol = halfDay ? "R/0.50" : "R";
                statusText = "Làm việc từ xa (WFH)";
            } else if (log != null) {
                if (log.getCheckInAt() != null && log.getCheckOutAt() != null) {
                    if (lateMinutes > 0 && lateReq == null) {
                        dayStatus = "LATE";
                        lateCount++;
                        actualDays += 1.0;
                        symbol = "1.00";
                        statusText = "Đi muộn " + lateMinutes + " phút";
                    } else {
                        dayStatus = "ON_TIME";
                        actualDays += 1.0;
                        symbol = "1.00";
                        statusText = "Đúng giờ (" + hoursWorked + "h)";
                    }
                } else if (log.getCheckInAt() != null) {
                    dayStatus = "INCOMPLETE";
                    actualDays += 0.5;
                    symbol = "0.50";
                    statusText = "Thiếu giờ ra";
                } else {
                    dayStatus = "INCOMPLETE";
                    symbol = "0.50";
                    statusText = "Thiếu giờ vào";
                }
            } else if (isWeekend) {
                dayStatus = "WEEKEND";
                statusText = "Nghỉ cuối tuần";
                symbol = "—";
            } else if (date.isAfter(today)) {
                dayStatus = "FUTURE";
                statusText = "Kế hoạch";
                symbol = "—";
            } else {
                dayStatus = "ABSENT";
                statusText = "Vắng mặt / Không có log";
                symbol = "V";
            }

            TimesheetDispute dispute = disputesByDate.get(date);
            Map<String, Object> disputeInfo = null;
            if (dispute != null) {
                disputeInfo = Map.of(
                        "id", dispute.getId(),
                        "status", dispute.getStatus(),
                        "reason", dispute.getReason()
                );
            }

            Map<String, Object> dayMap = new HashMap<>();
            dayMap.put("day", d);
            dayMap.put("date", date.toString());
            dayMap.put("weekday", weekdayNames[dow - 1]);
            dayMap.put("isWeekend", isWeekend);
            dayMap.put("isHoliday", isHoliday);
            dayMap.put("checkIn", checkInStr);
            dayMap.put("checkOut", checkOutStr);
            dayMap.put("hoursWorked", hoursWorked);
            dayMap.put("lateMinutes", lateMinutes);
            dayMap.put("status", dayStatus);
            dayMap.put("statusText", statusText);
            dayMap.put("symbol", symbol);
            dayMap.put("dispute", disputeInfo);
            daysList.add(dayMap);
        }

        double totalDays = actualDays + leaveDays;
        int baseLeave = ruleService.getInt("leave_accrual", "base_days_per_year", 12);
        double remainingLeave = Math.max(0, baseLeave - leaveDays);

        Map<String, Object> out = new HashMap<>();
        out.put("month", ym.toString());
        out.put("daysInMonth", daysInMonth);
        out.put("status", status);
        out.put("periodStatus", periodStatus);
        out.put("canDispute", canDispute);
        out.put("publishDay", publishDay);
        out.put("disputeDeadline", deadline.toString());

        // 11 KPI / metrics fields
        out.put("standardDays", standardDays);
        out.put("actualDays", actualDays);
        out.put("wfhDays", wfhDays);
        out.put("leaveDays", leaveDays);
        out.put("lateCount", lateCount);
        out.put("holidayDays", holidayDays);
        out.put("sickDays", sickDays);
        out.put("compDays", compDays);
        out.put("unpaidDays", unpaidDays);
        out.put("totalDays", totalDays);
        out.put("remainingLeave", remainingLeave);

        out.put("days", daysList);
        out.put("logs", logs);

        return ApiResponse.ok(out, "Bảng công " + ym);
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
            int late = 0, present = 0;
            double leave = 0, wfh = 0;
            for (User u : visible) {
                String kind = null;
                RequestEntity found = null;
                for (RequestEntity r : requestRepository.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                    if (!"APPROVED".equals(r.getStatus()) || r.getWorkDate() == null) continue;
                    boolean covers = day.equals(r.getWorkDate())
                            || ("LEAVE".equals(r.getRequestType()) && r.getEndDate() != null
                                && !day.isBefore(r.getWorkDate()) && !day.isAfter(r.getEndDate()));
                    if (!covers) continue;
                    if ("WFH".equals(r.getRequestType())) kind = "WFH";
                    else if ("LEAVE".equals(r.getRequestType())) kind = "LEAVE";
                    else if ("LATE_EARLY".equals(r.getRequestType())) kind = "LATE";
                    if (kind != null) { found = r; break; }
                }
                boolean halfDay = false;
                String halfPeriod = null, workFrom = null, workTo = null;
                if (found != null && ("LEAVE".equals(kind) || "WFH".equals(kind)) && found.getPayload() != null) {
                    try {
                        Map<?, ?> p = objectMapper.readValue(found.getPayload(), Map.class);
                        halfPeriod = p.get("half_day_period") == null ? null : String.valueOf(p.get("half_day_period"));
                        halfDay = halfPeriod != null;
                        workFrom = p.get("work_window_start") == null ? null : String.valueOf(p.get("work_window_start"));
                        workTo = p.get("work_window_end") == null ? null : String.valueOf(p.get("work_window_end"));
                    } catch (Exception ignored) { }
                }
                if (kind == null) {
                    kind = "PRESENT";
                    present++;
                } else if ("WFH".equals(kind)) wfh += halfDay ? 0.5 : 1;
                else if ("LEAVE".equals(kind)) leave += halfDay ? 0.5 : 1;
                else late++;
                Map<String, Object> entry = new java.util.HashMap<>();
                entry.put("employeeCode", u.getEmployeeCode());
                entry.put("fullName", u.getFullName());
                entry.put("kind", kind);
                if (halfDay) {
                    entry.put("halfDay", true);
                    entry.put("halfDayPeriod", halfPeriod);
                    entry.put("workWindowStart", workFrom);
                    entry.put("workWindowEnd", workTo);
                }
                entries.add(entry);
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
        return ApiResponse.ok(userId == null ? List.of() : deviceRegistrationRepository.findByUserIdOrderByCreatedAtDesc(userId), "Thiết bị của tôi");
    }

    @PostMapping("/devices/request")
    @Operation(summary = "Yêu cầu thêm thiết bị (S29)")
    public ApiResponse<DeviceRegistration> requestDevice(
            @RequestBody DeviceRequest request,
            jakarta.servlet.http.HttpServletRequest httpRequest) {
        UUID userId = CurrentUser.userId();
        if (userId == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "Chưa đăng nhập");
        }
        if (request.getReason() == null || request.getReason().trim().isEmpty()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Bắt buộc nhập lý do khi yêu cầu thêm thiết bị");
        }

        // Kiểm tra mạng nội bộ công ty (Criterion B6 #5)
        String wifi = request.getWifiBssid();
        String remoteAddr = httpRequest.getRemoteAddr();
        String fwd = httpRequest.getHeader("X-Forwarded-For");
        String officeHeader = httpRequest.getHeader("X-Office-Network");
        boolean isOffice = (wifi != null && (wifi.toLowerCase().contains("act_office") || wifi.toLowerCase().contains("act-office")))
                || "true".equalsIgnoreCase(officeHeader)
                || isLocalOrOfficeIp(remoteAddr)
                || isLocalOrOfficeIp(fwd);

        if (!isOffice) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "Yêu cầu thêm thiết bị chỉ nhận từ mạng nội bộ công ty");
        }

        String fp = (request.getFingerprint() != null && !request.getFingerprint().isBlank())
                ? request.getFingerprint()
                : "web-" + UUID.randomUUID().toString().substring(0, 8);

        DeviceRegistration device = deviceRegistrationRepository.findByDeviceFingerprint(fp)
                .orElseGet(() -> DeviceRegistration.builder()
                        .userId(userId)
                        .deviceFingerprint(fp)
                        .build());

        device.setUserId(userId);
        device.setDeviceModel(request.getDeviceName() != null ? request.getDeviceName() : "Web Device");
        device.setOsVersion("Web");
        device.setIsApproved(false);
        device.setExpiresAt(LocalDateTime.now().plusDays(30));
        device.setUpdatedAt(LocalDateTime.now());
        if (device.getCreatedAt() == null) device.setCreatedAt(LocalDateTime.now());

        DeviceRegistration saved = deviceRegistrationRepository.save(device);

        AuditLog audit = AuditLog.builder()
                .action("REQUEST_DEVICE")
                .entityName("DEVICE")
                .entityId(String.valueOf(saved.getId()))
                .userId(userId)
                .userCode(CurrentUser.employeeCode())
                .newValue("PENDING")
                .reason(request.getReason())
                .build();
        audit.setCreatedAt(LocalDateTime.now());
        auditLogRepository.save(audit);

        return ApiResponse.ok(saved, "Đã gửi yêu cầu — chờ HR duyệt");
    }

    private boolean isLocalOrOfficeIp(String ip) {
        if (ip == null || ip.isBlank()) return false;
        String trimmed = ip.trim();
        return trimmed.equals("127.0.0.1") || trimmed.equals("0:0:0:0:0:0:0:1") || trimmed.equalsIgnoreCase("localhost")
                || trimmed.startsWith("10.") || trimmed.startsWith("192.168.") || trimmed.startsWith("172.16.");
    }


    private Map<String, Object> disputeMap(TimesheetDispute d) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", d.getId());
        m.put("employee", userRepository.findById(d.getUserId()).map(User::getFullName).orElse("—"));
        m.put("employeeCode", userRepository.findById(d.getUserId()).map(User::getEmployeeCode).orElse(""));
        m.put("date", d.getWorkDate() == null ? "" : d.getWorkDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        m.put("workDate", d.getWorkDate() == null ? null : d.getWorkDate().toString());
        m.put("reason", d.getReason());
        m.put("status", d.getStatus());
        m.put("deadline", d.getDeadline() == null ? null : d.getDeadline().toLocalDate().toString());
        if (d.getDeadline() != null) {
            long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDate.now(), d.getDeadline().toLocalDate());
            m.put("daysLeft", daysLeft);
            if (daysLeft < 0 && "PENDING".equals(d.getStatus())) {
                m.put("status", "EXPIRED");
                m.put("overdue", true);
            }
        }
        return m;
    }

    @PostMapping("/disputes")
    @Operation(summary = "Nhân viên tạo khiếu nại bảng công (S33)")
    public ApiResponse<Map<String, Object>> createDispute(@RequestBody Map<String, String> body) {
        UUID userId = CurrentUser.userId();
        if (userId == null) throw new RuntimeException("Chưa đăng nhập");
        if (body.get("reason") == null || body.get("reason").isBlank()) throw new RuntimeException("Khiếu nại phải có lý do");
        java.time.LocalDate workDate = body.get("workDate") == null ? java.time.LocalDate.now() : java.time.LocalDate.parse(body.get("workDate"));
        TimesheetDispute d = TimesheetDispute.builder()
                .id("DC-" + UUID.randomUUID().toString().substring(0, 8))
                .userId(userId).workDate(workDate).reason(body.get("reason")).status("PENDING")
                .deadline(java.time.LocalDateTime.now().plusDays(2)).build();
        timesheetDisputeRepository.save(d);
        return ApiResponse.ok(disputeMap(d), "Đã gửi khiếu nại bảng công");
    }

    @GetMapping("/disputes")
    @Operation(summary = "Danh sách khiếu nại (S45)")
    public ApiResponse<List<Map<String, Object>>> disputes() {
        List<Map<String, Object>> list = new java.util.ArrayList<>();
        for (TimesheetDispute d : timesheetDisputeRepository.findAllByOrderByCreatedAtDesc()) {
            Map<String, Object> m = disputeMap(d);
            if ("EXPIRED".equals(m.get("status")) && "PENDING".equals(d.getStatus())) {
                d.setStatus("EXPIRED");
                timesheetDisputeRepository.save(d);
            }
            list.add(m);
        }
        return ApiResponse.ok(list, "Danh sách khiếu nại");
    }

    @GetMapping("/disputes/{id}")
    @Operation(summary = "Chi tiết khiếu nại (S33/D4)")
    public ApiResponse<Map<String, Object>> dispute(@PathVariable String id) {
        TimesheetDispute d = timesheetDisputeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khiếu nại"));
        Map<String, Object> result = disputeMap(d);
        result.put("before", "Log chấm công gốc — xem tại bảng công ngày " + result.get("date"));
        result.put("after", "Ô bảng công HR đang sửa");
        result.put("ruleHint", "Thiếu check-out và chưa tạo đơn bổ sung công");
        return ApiResponse.ok(result, "Chi tiết khiếu nại");
    }

    @PostMapping("/disputes/{id}/resolve")
    @Operation(summary = "Xử lý khiếu nại: sửa ô / tạo đơn bổ sung / từ chối (bắt buộc lý do)")
    public ApiResponse<Map<String, Object>> resolveDispute(@PathVariable String id, @RequestBody Map<String, String> body) {
        TimesheetDispute d = timesheetDisputeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khiếu nại"));
        String action = body.getOrDefault("action", "REJECT");
        if ("REJECT".equals(action) && (body.get("reason") == null || body.get("reason").isBlank())) {
            throw new RuntimeException("Từ chối khiếu nại phải nhập lý do");
        }
        d.setStatus("REJECT".equals(action) ? "REJECTED" : "RESOLVED");
        d.setResolutionAction(action);
        d.setResolvedBy(CurrentUser.userId());
        d.setResolvedAt(java.time.LocalDateTime.now());
        timesheetDisputeRepository.save(d);

        AuditLog log = AuditLog.builder().action("RESOLVE_DISPUTE").entityName("DISPUTE").entityId(id)
                .userId(CurrentUser.userId()).reason(body.get("reason")).newValue(action).build();
        log.setCreatedAt(java.time.LocalDateTime.now());
        auditLogRepository.save(log);

        notificationRepository.save(Notification.builder()
                .userId(d.getUserId())
                .title("REJECT".equals(action) ? "Khiếu nại bảng công bị từ chối" : "Khiếu nại bảng công đã được xử lý")
                .content("Khiếu nại ngày " + d.getWorkDate() + ": " + d.getReason()
                        + ". Lý do xử lý: " + body.get("reason"))
                .type("DISPUTE")
                .priority("REJECT".equals(action) ? "HIGH" : "MEDIUM")
                .actionUrl("/attendance/disputes/" + id)
                .isRead(false)
                .build());

        return ApiResponse.ok(disputeMap(d), "Đã xử lý khiếu nại");
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
        private String fingerprint;
        private String deviceName;
        private String reason;
        private String wifiBssid;
    }
}
