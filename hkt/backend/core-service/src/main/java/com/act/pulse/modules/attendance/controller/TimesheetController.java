package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.Holiday;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.Team;
import com.act.pulse.modules.attendance.entity.Timesheet;
import com.act.pulse.modules.attendance.entity.TimesheetCell;
import com.act.pulse.modules.attendance.entity.TimesheetCellAudit;
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
    private final TimesheetRepository timesheetRepository;
    private final TimesheetCellRepository timesheetCellRepository;
    private final TimesheetCellAuditRepository timesheetCellAuditRepository;
    private final TimesheetDisputeRepository timesheetDisputeRepository;
    private final NotificationRepository notificationRepository;

    @lombok.Data
    public static class EditCellRequest {
        private String employeeCode;
        private int day;
        private String symbol;
        private String reason;
        private java.util.List<String> employeeCodes; // cho sửa hàng loạt
    }

    private String statusOf(YearMonth ym) {
        List<Timesheet> rows = timesheetRepository.findByPeriodMonthAndPeriodYear(ym.getMonthValue(), ym.getYear());
        return rows.isEmpty() ? "draft" : rows.get(0).getStatus();
    }

    private Timesheet sheetOf(UUID userId, YearMonth ym) {
        return timesheetRepository.findByUserIdAndPeriodMonthAndPeriodYear(userId, ym.getMonthValue(), ym.getYear())
                .orElseGet(() -> timesheetRepository.save(Timesheet.builder()
                        .userId(userId).periodMonth(ym.getMonthValue()).periodYear(ym.getYear()).status("draft").build()));
    }

    private void ensureAllSheets(YearMonth ym) {
        for (User u : userRepository.findAll()) sheetOf(u.getId(), ym);
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
            double present = 0;
            for (AttendanceLog log : logs) {
                if (log.getWorkDate() == null || !YearMonth.from(log.getWorkDate()).equals(ym)) continue;
                boolean full = log.getCheckInAt() != null && log.getCheckOutAt() != null;
                daySymbol.put(log.getWorkDate().getDayOfMonth(), full ? "1.00" : "0.50");
                present += full ? 1 : 0;
            }
            int late = 0;
            double leave = 0, wfh = 0;
            for (RequestEntity r : requestRepository.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                if (!"APPROVED".equals(r.getStatus()) || r.getWorkDate() == null || !YearMonth.from(r.getWorkDate()).equals(ym)) continue;
                int d = r.getWorkDate().getDayOfMonth();
                switch (r.getRequestType()) {
                    case "WFH" -> {
                        boolean halfDay = r.getPayload() != null && r.getPayload().contains("half_day_period");
                        daySymbol.put(d, halfDay ? "R/0.50" : "R");
                        wfh += halfDay ? 0.5 : 1;
                        present += halfDay ? 0.5 : 1;
                    }
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

            // Ô đã sửa tay lưu trong DB (ưu tiên hơn dữ liệu gốc)
            timesheetRepository.findByUserIdAndPeriodMonthAndPeriodYear(u.getId(), ym.getMonthValue(), ym.getYear())
                    .ifPresent(sheet -> timesheetCellRepository.findByTimesheetId(sheet.getId()).forEach(cell -> {
                        if (cell.getWorkDate() != null) daySymbol.put(cell.getWorkDate().getDayOfMonth(), cell.getSymbol());
                    }));

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
        out.put("status", statusOf(ym));
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
        if ("locked".equals(statusOf(ym))) {
            throw new RuntimeException("Kỳ công đã khoá — không sửa được ô");
        }
        User target = userRepository.findByEmployeeCode(req.getEmployeeCode())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên: " + req.getEmployeeCode()));
        Timesheet sheet = sheetOf(target.getId(), ym);
        LocalDate workDate = ym.atDay(req.getDay());
        TimesheetCell cell = timesheetCellRepository.findByTimesheetIdAndWorkDate(sheet.getId(), workDate)
                .orElseGet(() -> TimesheetCell.builder().timesheetId(sheet.getId()).workDate(workDate).isManual(true).build());
        String oldVal = cell.getSymbol();
        cell.setSymbol(req.getSymbol());
        cell.setIsManual(true);
        cell = timesheetCellRepository.save(cell);
        String key = ym + "|" + req.getEmployeeCode() + "|" + req.getDay();
        timesheetCellAuditRepository.save(TimesheetCellAudit.builder()
                .timesheetCellId(cell.getId()).oldValue(oldVal).newValue(req.getSymbol())
                .reason(req.getReason()).changedBy(CurrentUser.userId()).build());
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
        if ("locked".equals(statusOf(ym))) {
            throw new RuntimeException("Kỳ công đã khoá — không sửa được");
        }
        for (String code : req.getEmployeeCodes()) {
            userRepository.findByEmployeeCode(code).ifPresent(u -> {
                Timesheet sheet = sheetOf(u.getId(), ym);
                LocalDate workDate = ym.atDay(req.getDay());
                TimesheetCell cell = timesheetCellRepository.findByTimesheetIdAndWorkDate(sheet.getId(), workDate)
                        .orElseGet(() -> TimesheetCell.builder().timesheetId(sheet.getId()).workDate(workDate).build());
                String oldVal = cell.getSymbol();
                cell.setSymbol(req.getSymbol());
                cell.setIsManual(true);
                cell = timesheetCellRepository.save(cell);
                timesheetCellAuditRepository.save(TimesheetCellAudit.builder()
                        .timesheetCellId(cell.getId()).oldValue(oldVal).newValue(req.getSymbol())
                        .reason(req.getReason()).changedBy(CurrentUser.userId()).build());
            });
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
        ensureAllSheets(ym);
        int window = ruleService.getInt("payroll_period", "dispute_window_days", 2);
        LocalDate deadline = LocalDate.now().plusDays(window);
        List<Timesheet> rows = timesheetRepository.findByPeriodMonthAndPeriodYear(ym.getMonthValue(), ym.getYear());
        for (Timesheet s : rows) {
            s.setStatus("published");
            s.setPublishedAt(java.time.LocalDateTime.now());
            s.setDisputeDeadline(deadline.atTime(23, 59));
        }
        timesheetRepository.saveAll(rows);
        return ApiResponse.ok(Map.of("month", ym.toString(), "status", "published", "disputeDeadline", deadline.toString()),
                "Đã công bố bảng công — khiếu nại đến " + deadline);
    }

    @PostMapping("/lock")
    @Operation(summary = "Khoá kỳ công — chặn đơn/quyết định sau khoá")
    public ApiResponse<Map<String, Object>> lock(@RequestParam(required = false) String month,
                                                 @RequestParam(required = false, defaultValue = "false") boolean force) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        long pending = timesheetDisputeRepository.findByStatus("PENDING").stream()
                .filter(d -> d.getDeadline() == null || d.getDeadline().isAfter(now)).count();
        if (!force && pending > 0) {
            throw new RuntimeException("Còn " + pending + " khiếu nại chưa xử lý — xử lý hết trước khi khoá kỳ công");
        }
        YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now() : YearMonth.parse(month);
        ensureAllSheets(ym);
        List<Timesheet> rows = timesheetRepository.findByPeriodMonthAndPeriodYear(ym.getMonthValue(), ym.getYear());
        for (Timesheet s : rows) { s.setStatus("locked"); s.setLockedAt(now); }
        timesheetRepository.saveAll(rows);
        return ApiResponse.ok(Map.of("month", ym.toString(), "status", "locked",
                "lockedBy", String.valueOf(CurrentUser.employeeCode())), "Đã khoá kỳ công");
    }
}
