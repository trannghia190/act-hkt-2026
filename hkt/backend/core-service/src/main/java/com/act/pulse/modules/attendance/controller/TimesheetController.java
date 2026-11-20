package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.Holiday;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.Team;
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
    private final TeamRepository teamRepository;
    private final RuleService ruleService;
    private final AuditLogRepository auditLogRepository;

    public static final java.util.concurrent.atomic.AtomicInteger DISPUTES_PENDING = new java.util.concurrent.atomic.AtomicInteger(2);
    private static final Map<String, String> STATUS = new java.util.concurrent.ConcurrentHashMap<>();
    /** Ô đã sửa tay: key = month|employeeCode|day */
    private static final Map<String, String> CELL_OVERRIDES = new java.util.concurrent.ConcurrentHashMap<>();

    @lombok.Data
    public static class EditCellRequest {
        private String employeeCode;
        private int day;
        private String symbol;
        private String reason;
        private java.util.List<String> employeeCodes; // cho sửa hàng loạt
    }

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
            int wfh = 0, late = 0;
            double leave = 0;
            for (RequestEntity r : requestRepository.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                if (!"APPROVED".equals(r.getStatus()) || r.getWorkDate() == null || !YearMonth.from(r.getWorkDate()).equals(ym)) continue;
                int d = r.getWorkDate().getDayOfMonth();
                switch (r.getRequestType()) {
                    case "WFH" -> { daySymbol.put(d, "R"); wfh++; present++; }
                    case "LEAVE" -> {
                        boolean halfDay = r.getPayload() != null && r.getPayload().contains("half_day_period");
                        String sym = r.getLeaveType() == null ? "AL" : r.getLeaveType();
                        daySymbol.put(d, halfDay ? sym + "/0.50" : sym);
                        leave += halfDay ? 0.5 : 1;
                    }
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

            // Ô đã sửa tay (ưu tiên hơn dữ liệu gốc)
            for (int d = 1; d <= ym.lengthOfMonth(); d++) {
                String ov = CELL_OVERRIDES.get(ym + "|" + u.getEmployeeCode() + "|" + d);
                if (ov != null) daySymbol.put(d, ov);
            }

            // Đếm theo ký hiệu gốc của từng ô để export khớp file HR (Pine 53 cột).
            Map<String, Integer> symCount = new HashMap<>();
            double totalDays = 0;
            for (String s : daySymbol.values()) {
                if (s == null || s.isBlank()) continue;
                String base = s.trim().replace("*", "").replace("?", "").trim();
                int slash = base.indexOf('/');
                String numeric = slash >= 0 ? base.substring(slash + 1) : base;
                // Chỉ ký hiệu công (1.00/0.50) hoặc R/0.50 mới cộng vào tổng ngày công;
                // AL/0.50 là nghỉ nửa ngày, không phải công.
                if (base.matches("\\d+(\\.\\d+)?") || base.startsWith("R/")) {
                    try { totalDays += Double.parseDouble(numeric); } catch (NumberFormatException ignored) { }
                } else {
                    String code = slash >= 0 ? base.substring(0, slash) : base;
                    symCount.merge(code.toUpperCase(), 1, Integer::sum);
                }
            }

            String teamName = u.getTeamId() == null ? null
                    : teamRepository.findById(u.getTeamId()).map(Team::getName).orElse(null);
            String managerCode = u.getManagerId() == null ? null
                    : userRepository.findById(u.getManagerId()).map(User::getEmployeeCode).orElse(null);

            Map<String, Object> row = new HashMap<>();
            row.put("employeeCode", u.getEmployeeCode());
            row.put("fullName", u.getFullName());
            row.put("positionName", u.getPositionName());
            row.put("teamName", teamName);
            row.put("managerCode", managerCode);
            row.put("days", daySymbol);
            row.put("standardDays", workingDays);
            row.put("actualDays", Math.min(present, workingDays));
            row.put("wfhDays", wfh);
            row.put("leaveDays", leave);
            row.put("lateCount", late);
            row.put("holidayDays", holidayCount);
            row.put("sickDays", symCount.getOrDefault("S", 0));
            row.put("sickBhDays", symCount.getOrDefault("S-BH", symCount.getOrDefault("SBH", 0)));
            row.put("compDays", symCount.getOrDefault("RO", 0));
            row.put("unpaidDays", symCount.getOrDefault("UP", 0));
            row.put("maternityDays", symCount.getOrDefault("ML", 0));
            row.put("paternityDays", symCount.getOrDefault("PL", 0));
            row.put("specialLeaveDays", symCount.getOrDefault("CL", 0));
            row.put("totalDays", totalDays);
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

    @PostMapping("/cell")
    @Operation(summary = "Sửa 1 ô ngày — bắt buộc lý do, ghi audit, ô hiện màu đỏ")
    public ApiResponse<Map<String, Object>> editCell(@RequestBody EditCellRequest req,
                                                     @RequestParam(required = false) String month) {
        if (req.getReason() == null || req.getReason().isBlank()) {
            throw new RuntimeException("Sửa ô bảng công phải nhập lý do");
        }
        if (req.getSymbol() == null || req.getSymbol().isBlank()) {
            throw new RuntimeException("Thiếu ký hiệu công mới");
        }
        YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now() : YearMonth.parse(month);
        if ("locked".equals(STATUS.get(ym.toString()))) {
            throw new RuntimeException("Kỳ công đã khoá — không sửa được ô");
        }
        String key = ym + "|" + req.getEmployeeCode() + "|" + req.getDay();
        String oldVal = CELL_OVERRIDES.get(key);
        CELL_OVERRIDES.put(key, req.getSymbol());
        AuditLog log = AuditLog.builder().action("EDIT_TIMESHEET_CELL").entityName("TIMESHEET_CELL")
                .entityId(key).userId(CurrentUser.userId()).userCode(CurrentUser.employeeCode())
                .oldValue(oldVal).newValue(req.getSymbol()).reason(req.getReason()).build();
        log.setCreatedAt(java.time.LocalDateTime.now());
        auditLogRepository.save(log);
        return ApiResponse.ok(Map.of("key", key, "symbol", req.getSymbol(), "edited", true), "Đã sửa ô — có ghi nhật ký");
    }

    @PostMapping("/bulk")
    @Operation(summary = "Sửa hàng loạt nhiều nhân sự — 1 audit log cho cả lô")
    public ApiResponse<Map<String, Object>> bulkEdit(@RequestBody EditCellRequest req,
                                                     @RequestParam(required = false) String month) {
        if (req.getReason() == null || req.getReason().isBlank()) {
            throw new RuntimeException("Sửa hàng loạt phải nhập lý do");
        }
        if (req.getEmployeeCodes() == null || req.getEmployeeCodes().isEmpty()) {
            throw new RuntimeException("Chưa chọn nhân sự nào");
        }
        YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now() : YearMonth.parse(month);
        if ("locked".equals(STATUS.get(ym.toString()))) {
            throw new RuntimeException("Kỳ công đã khoá — không sửa được");
        }
        for (String code : req.getEmployeeCodes()) {
            CELL_OVERRIDES.put(ym + "|" + code + "|" + req.getDay(), req.getSymbol());
        }
        AuditLog log = AuditLog.builder().action("BULK_EDIT_TIMESHEET").entityName("TIMESHEET_CELL")
                .entityId(ym + "|" + req.getDay()).userId(CurrentUser.userId()).userCode(CurrentUser.employeeCode())
                .newValue(req.getSymbol()).reason(req.getReason() + " · " + req.getEmployeeCodes().size() + " nhân sự")
                .build();
        log.setCreatedAt(java.time.LocalDateTime.now());
        auditLogRepository.save(log);
        return ApiResponse.ok(Map.of("updated", req.getEmployeeCodes().size(), "symbol", req.getSymbol()), "Đã sửa hàng loạt");
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
    public ApiResponse<Map<String, Object>> lock(@RequestParam(required = false) String month,
                                                 @RequestParam(required = false, defaultValue = "false") boolean force) {
        if (!force && DISPUTES_PENDING.get() > 0) {
            throw new RuntimeException("Còn " + DISPUTES_PENDING.get() + " khiếu nại chưa xử lý — xử lý hết trước khi khoá kỳ công");
        }
        YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now() : YearMonth.parse(month);
        STATUS.put(ym.toString(), "locked");
        return ApiResponse.ok(Map.of("month", ym.toString(), "status", "locked",
                "lockedBy", String.valueOf(CurrentUser.employeeCode())), "Đã khoá kỳ công");
    }
}
