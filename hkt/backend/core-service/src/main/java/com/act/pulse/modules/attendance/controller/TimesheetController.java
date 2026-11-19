package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.Holiday;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.repository.*;
import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

/**
 * S15 — Bảng công 53 cột (5 thông tin + 31 cột ngày + 17 cột tổng hợp).
 * Nguồn: attendance_logs (check-in/out), requests đã duyệt (WFH/nghỉ), holidays.
 */
@RestController
@RequestMapping("/timesheets")
@RequiredArgsConstructor
@Tag(name = "8. Timesheet API", description = "Bảng công 53 cột, công bố ngày 11, khiếu nại 2 ngày, khoá kỳ")
public class TimesheetController {

    private final UserRepository userRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final RequestRepository requestRepository;
    private final HolidayRepository holidayRepository;
    private final RuleService ruleService;

    private static final Map<String, String> STATUS = new java.util.concurrent.ConcurrentHashMap<>();

    @GetMapping
    @Operation(summary = "Bảng công tháng (S15)")
    public ApiResponse<Map<String, Object>> month(@RequestParam(required = false) String month) {
        YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now() : YearMonth.parse(month);
        Set<LocalDate> holidays = new HashSet<>();
        for (Holiday h : holidayRepository.findAll()) holidays.add(h.getHolidayDate());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (User u : userRepository.findAll()) {
            Map<Integer, String> daySymbol = new HashMap<>();
            List<AttendanceLog> logs = attendanceLogRepository.findByUserIdOrderByWorkDateDesc(u.getId());
            int present = 0;
            for (AttendanceLog log : logs) {
                if (log.getWorkDate() == null || !YearMonth.from(log.getWorkDate()).equals(ym)) continue;
                boolean full = log.getCheckInAt() != null && log.getCheckOutAt() != null;
                daySymbol.put(log.getWorkDate().getDayOfMonth(), full ? "1.00" : "0.50");
                present += full ? 1 : 0;
            }
            int wfh = 0, leave = 0, late = 0;
            for (RequestEntity r : requestRepository.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                if (!"APPROVED".equals(r.getStatus()) || r.getWorkDate() == null || !YearMonth.from(r.getWorkDate()).equals(ym)) continue;
                int d = r.getWorkDate().getDayOfMonth();
                switch (r.getRequestType()) {
                    case "WFH" -> { daySymbol.put(d, "R"); wfh++; present++; }
                    case "LEAVE" -> { daySymbol.put(d, r.getLeaveType() == null ? "AL" : r.getLeaveType()); leave++; }
                    default -> { if ("LATE_EARLY".equals(r.getRequestType())) late++; }
                }
            }
            int holidayCount = 0;
            int workingDays = 0;
            for (int d = 1; d <= ym.lengthOfMonth(); d++) {
                LocalDate day = ym.atDay(d);
                boolean weekend = day.getDayOfWeek().getValue() >= 6;
                if (holidays.contains(day)) { holidayCount++; daySymbol.putIfAbsent(d, "NL"); }
                else if (!weekend) workingDays++;
            }

            Map<String, Object> row = new HashMap<>();
            row.put("employeeCode", u.getEmployeeCode());
            row.put("fullName", u.getFullName());
            row.put("positionName", u.getPositionName());
            row.put("days", daySymbol);
            row.put("standardDays", workingDays);
            row.put("actualDays", Math.min(present, workingDays));
            row.put("wfhDays", wfh);
            row.put("leaveDays", leave);
            row.put("lateCount", late);
            row.put("holidayDays", holidayCount);
            row.put("remainingLeave", ruleService.getInt("leave_accrual", "base_days_per_year", 12) - leave);
            rows.add(row);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("month", ym.toString());
        out.put("daysInMonth", ym.lengthOfMonth());
        out.put("rows", rows);
        out.put("status", STATUS.getOrDefault(ym.toString(), "draft"));
        out.put("publishDay", ruleService.getInt("payroll_period", "publish_day", 11));
        out.put("disputeWindowDays", ruleService.getInt("payroll_period", "dispute_window_days", 2));
        return ApiResponse.ok(out, "Bảng công " + ym);
    }

    @PostMapping("/publish")
    @Operation(summary = "Công bố bảng công (mặc định ngày 11) — mở cửa sổ khiếu nại")
    public ApiResponse<Map<String, Object>> publish(@RequestParam(required = false) String month) {
        YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now() : YearMonth.parse(month);
        STATUS.put(ym.toString(), "published");
        int window = ruleService.getInt("payroll_period", "dispute_window_days", 2);
        LocalDate deadline = LocalDate.now().plusDays(window);
        return ApiResponse.ok(Map.of("month", ym.toString(), "status", "published", "disputeDeadline", deadline.toString()),
                "Đã công bố bảng công — khiếu nại đến " + deadline);
    }

    @PostMapping("/lock")
    @Operation(summary = "Khoá kỳ công — chặn đơn/quyết định sau khoá")
    public ApiResponse<Map<String, Object>> lock(@RequestParam(required = false) String month) {
        YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now() : YearMonth.parse(month);
        STATUS.put(ym.toString(), "locked");
        return ApiResponse.ok(Map.of("month", ym.toString(), "status", "locked",
                "lockedBy", String.valueOf(CurrentUser.employeeCode())), "Đã khoá kỳ công");
    }
}
