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
import com.act.pulse.modules.attendance.service.ShiftResolver;
import com.act.pulse.modules.attendance.service.TimesheetSymbols;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.scheduling.annotation.Scheduled;

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
@Tag(name = "8. Timesheet API", description = "Bảng công 53 cột — kỳ đang mở cho khiếu nại ngay; cuối kỳ chốt theo close_day rồi khoá sau cửa sổ khiếu nại")
public class TimesheetController {

    private final UserRepository userRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final RequestRepository requestRepository;
    private final HolidayRepository holidayRepository;
    private final TeamRepository teamRepository;
    private final RuleService ruleService;
    private final ShiftResolver shiftResolver;
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

    /**
     * Kỳ đang chạy phải giữ MỞ để nhân viên khiếu nại ngay (mô hình kỳ MỞ).
     * Chỉ được chốt kỳ đã kết thúc; kỳ đang chạy/tương lai do job close_day tự chốt đầu tháng sau.
     */
    private void assertPeriodClosed(YearMonth ym) {
        if (!ym.isBefore(YearMonth.now())) {
            int closeDay = ruleService.getInt("payroll_period", "close_day", 1);
            throw new RuntimeException("Chỉ chốt được kỳ đã kết thúc — kỳ " + ym
                    + " đang chạy hoặc ở tương lai. Hệ thống tự chốt kỳ trước theo ngày chốt (mùng "
                    + closeDay + ") ở đầu tháng sau.");
        }
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
        for (Holiday h : holidayRepository.findAll()) holidays.addAll(h.dates());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (User u : userRepository.findAll()) {
            Map<Integer, String> daySymbol = new HashMap<>();
            List<AttendanceLog> logs = attendanceLogRepository.findByUserIdOrderByWorkDateDesc(u.getId());
            for (AttendanceLog log : logs) {
                if (log.getWorkDate() == null || !YearMonth.from(log.getWorkDate()).equals(ym)) continue;
                // Công tính theo ca hiệu lực (ưu tiên ca ghi trên log): đủ giờ ca = 1.00,
                // đủ nửa = 0.50, thiếu giờ vào/ra hoặc dưới nửa = 0.00.
                daySymbol.put(log.getWorkDate().getDayOfMonth(),
                        shiftResolver.workSymbol(shiftResolver.resolveFor(u, log), log));
            }
            int late = 0;
            // Ngày nửa ngày có thể gồm 2 buổi khác loại (nghỉ buổi sáng + WFH buổi chiều…).
            // Gom buổi nghỉ / buổi WFH riêng rồi ghép thành một ký hiệu duy nhất cho ngày:
            // CODE/0.50 (nghỉ nửa ngày), R/0.50 (WFH nửa ngày), CODE/R (nửa nghỉ + nửa WFH).
            Map<Integer, String> leaveHalfByDay = new HashMap<>();
            Set<Integer> wfhHalfDays = new HashSet<>();
            for (RequestEntity r : requestRepository.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                if (!"APPROVED".equals(r.getStatus()) || r.getWorkDate() == null) continue;
                boolean rangeType = "LEAVE".equals(r.getRequestType()) || "WFH".equals(r.getRequestType());
                LocalDate rangeEnd = r.getEndDate() == null ? r.getWorkDate() : r.getEndDate();
                boolean inMonth = YearMonth.from(r.getWorkDate()).equals(ym)
                        || (rangeType && !YearMonth.from(rangeEnd).isBefore(ym) && !YearMonth.from(r.getWorkDate()).isAfter(ym));
                if (!inMonth) continue;
                int d = r.getWorkDate().getDayOfMonth();
                switch (r.getRequestType()) {
                    case "WFH" -> {
                        boolean halfDay = r.getPayload() != null && r.getPayload().contains("half_day_period");
                        LocalDate start = r.getWorkDate();
                        LocalDate end = halfDay || r.getEndDate() == null ? start : r.getEndDate();
                        for (LocalDate cur = start; !cur.isAfter(end); cur = cur.plusDays(1)) {
                            if (!YearMonth.from(cur).equals(ym)) continue;
                            if (cur.getDayOfWeek().getValue() >= 6 || holidays.contains(cur)) continue;
                            if (halfDay) wfhHalfDays.add(cur.getDayOfMonth());
                            else daySymbol.put(cur.getDayOfMonth(), "R");
                        }
                    }
                    case "LEAVE" -> {
                        boolean halfDay = r.getPayload() != null && r.getPayload().contains("half_day_period");
                        String sym = r.getLeaveType() == null ? "AL" : r.getLeaveType();
                        LocalDate start = r.getWorkDate();
                        LocalDate end = r.getEndDate() == null || halfDay ? start : r.getEndDate();
                        for (LocalDate cur = start; !cur.isAfter(end); cur = cur.plusDays(1)) {
                            if (!YearMonth.from(cur).equals(ym)) continue;
                            if (cur.getDayOfWeek().getValue() >= 6 || holidays.contains(cur)) continue;
                            if (halfDay) leaveHalfByDay.put(cur.getDayOfMonth(), sym);
                            else daySymbol.put(cur.getDayOfMonth(), sym);
                        }
                    }
                    default -> { if ("LATE_EARLY".equals(r.getRequestType())) late++; }
                }
            }
            for (Map.Entry<Integer, String> e : leaveHalfByDay.entrySet()) {
                if (wfhHalfDays.contains(e.getKey())) continue;
                daySymbol.put(e.getKey(), e.getValue() + "/0.50");
            }
            for (int d : wfhHalfDays) {
                String leaveSym = leaveHalfByDay.get(d);
                daySymbol.put(d, leaveSym == null ? "R/0.50" : leaveSym + "/R");
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
            // Công thực tế phải khớp đúng các ô đang hiển thị trên lưới — gồm cả ô HR
            // sửa tay / duyệt khiếu nại (timesheet_cells). Trước đây chỉ đếm attendance_logs
            // nên lưới hiện 21 ô "1.00" mà tổng vẫn là 2–3. Chỉ tính ngày làm việc
            // (bỏ cuối tuần/lễ) và không vượt công chuẩn.
            double workDays = 0;
            // Ngày phép năm (AL) lấy từ chính ô trên lưới — không cộng dồn từ đơn LEAVE,
            // vì đơn nghỉ ốm/chế độ/không lương (S, RO, UP, ML…) không được trừ vào phép năm
            // và từng bị đếm trùng ở cả cột AL lẫn cột S trước đây.
            double annualLeave = 0;
            // WFH cũng lấy từ ô lưới: HR sửa R → 1.00/AL thì cột WFH phải giảm theo,
            // nếu cộng từ đơn đã duyệt sẽ lệch với file xuất và với lưới.
            double wfhDays = 0;
            for (Map.Entry<Integer, String> e : daySymbol.entrySet()) {
                String s = e.getValue();
                if (s == null || s.isBlank()) continue;
                boolean isWorkDay = e.getKey() <= ym.lengthOfMonth()
                        && ym.atDay(e.getKey()).getDayOfWeek().getValue() < 6
                        && !holidays.contains(ym.atDay(e.getKey()));
                String base = s.trim().replace("*", "").replace("?", "").trim();
                // Ký hiệu công: 1.00/0.50, R (WFH cả ngày), R/0.50; AL/0.50 là nghỉ nửa ngày, không phải công.
                double units = TimesheetSymbols.workUnits(base);
                if (units > 0 && isWorkDay) {
                    workDays += units;
                } else if (units == 0 && isWorkDay) {
                    int slash = base.indexOf('/');
                    String code = slash >= 0 ? base.substring(0, slash) : base;
                    symCount.merge(code.toUpperCase(), 1, Integer::sum);
                }
                // Nghỉ chỉ trừ quỹ khi rơi vào ngày làm việc — ô nghỉ trên cuối tuần/lễ không tính.
                if (isWorkDay) {
                    annualLeave += TimesheetSymbols.annualLeaveUnits(base);
                    wfhDays += TimesheetSymbols.wfhUnits(base);
                }
            }
            double totalDays = workDays;

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
            row.put("actualDays", Math.min(workDays, workingDays));
            row.put("wfhDays", wfhDays);
            row.put("leaveDays", annualLeave);
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
            row.put("remainingLeave", ruleService.getInt("leave_accrual", "base_days_per_year", 12) - annualLeave);
            rows.add(row);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("month", ym.toString());
        out.put("daysInMonth", ym.lengthOfMonth());
        // Ngày lễ của kỳ — UI tô màu cột ngày để HR nhận biết cuối tuần / ngày lễ.
        out.put("holidayDates", holidays.stream()
                .filter(d -> YearMonth.from(d).equals(ym))
                .sorted()
                .map(LocalDate::toString)
                .toList());
        out.put("rows", rows);
        out.put("status", statusOf(ym));
        out.put("closeDay", ruleService.getInt("payroll_period", "close_day", 1));
        out.put("disputeWindowDays", ruleService.getInt("payroll_period", "dispute_window_days", 2));
        out.put("lockDelayDays", ruleService.getInt("payroll_period", "lock_delay_days", 0));
        out.put("allowAdjustAfterLock", ruleService.getBoolean("payroll_period", "allow_adjust_after_lock", false));
        // Hạn khiếu nại THẬT đã lưu khi chốt kỳ — để UI hiển thị đúng số ngày còn lại,
        // không lấy số ngày cấu hình (sau hạn vẫn có thể hiện "còn N ngày").
        List<Timesheet> periodSheets = timesheetRepository.findByPeriodMonthAndPeriodYear(ym.getMonthValue(), ym.getYear());
        java.time.LocalDateTime periodDeadline = periodSheets.stream()
                .map(Timesheet::getDisputeDeadline).filter(java.util.Objects::nonNull).findFirst().orElse(null);
        out.put("disputeDeadline", periodDeadline == null ? null : periodDeadline.toLocalDate().toString());
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
        assertPeriodEditable(ym);
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
        assertPeriodEditable(ym);
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

    private Map<String, Object> doPublish(YearMonth ym) {
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
        return Map.of("month", ym.toString(), "status", "published", "disputeDeadline", deadline.toString());
    }

    @PostMapping("/publish")
    @Operation(summary = "Chốt bảng công kỳ đã kết thúc — mở cửa sổ khiếu nại")
    public ApiResponse<Map<String, Object>> publish(@RequestParam(required = false) String month) {
        YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now() : YearMonth.parse(month);
        assertPeriodClosed(ym);
        String cur = statusOf(ym);
        if ("locked".equals(cur)) throw new RuntimeException("Kỳ " + ym + " đã khoá — không chốt lại được");
        if ("published".equals(cur)) throw new RuntimeException("Kỳ " + ym + " đã chốt — không chốt lại (hạn khiếu nại giữ nguyên)");
        Map<String, Object> out = doPublish(ym);
        return ApiResponse.ok(out, "Đã công bố bảng công — khiếu nại đến " + out.get("disputeDeadline"));
    }

    /**
     * Tự CHỐT bảng công của kỳ trước khi tới `close_day` (vd mùng 1).
     * Kỳ đang chạy vẫn MỞ và nhân viên khiếu nại được; chỉ khi chốt mới mở cửa sổ sau chốt.
     */
    @Scheduled(cron = "0 10 1 * * *")
    public void scheduledAutoClose() {
        try { autoClose(null); } catch (Exception ignored) { }
    }

    @PostMapping("/auto-close")
    @Operation(summary = "Tự chốt bảng công kỳ trước theo close_day (mặc định kỳ trước; truyền month để chốt tay kỳ cụ thể)")
    public ApiResponse<Map<String, Object>> autoClose(@RequestParam(required = false) String month) {
        int closeDay = ruleService.getInt("payroll_period", "close_day", 1);
        boolean explicit = month != null && !month.isBlank();
        YearMonth ym = explicit ? YearMonth.parse(month) : YearMonth.now().minusMonths(1);
        assertPeriodClosed(ym);
        String st = statusOf(ym);
        if (!explicit && LocalDate.now().getDayOfMonth() < closeDay) {
            return ApiResponse.ok(Map.of("month", ym.toString(), "status", st, "closed", false, "closeDay", closeDay),
                    "Chưa tới ngày chốt (" + closeDay + ")");
        }
        if ("published".equals(st) || "locked".equals(st)) {
            return ApiResponse.ok(Map.of("month", ym.toString(), "status", st, "closed", false), "Kỳ đã chốt/khoá — bỏ qua");
        }
        Map<String, Object> out = new HashMap<>(doPublish(ym));
        out.put("closed", true);
        return ApiResponse.ok(out, "Đã chốt bảng công kỳ " + ym + " — khiếu nại đến " + out.get("disputeDeadline"));
    }

    /** @deprecated giữ tương thích: chốt kỳ (mặc định kỳ trước, giống /auto-close). */
    @Deprecated
    @PostMapping("/auto-publish")
    public ApiResponse<Map<String, Object>> autoPublishLegacy(@RequestParam(required = false) String month) {
        return autoClose(month);
    }

    private Map<String, Object> doLock(YearMonth ym, boolean force) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        // Chỉ đếm khiếu nại còn hạn CỦA ĐÚNG KỲ này — đơn của tháng khác không được chặn khoá.
        long pending = timesheetDisputeRepository.findByStatus("PENDING").stream()
                .filter(d -> d.getWorkDate() != null && YearMonth.from(d.getWorkDate()).equals(ym))
                .filter(d -> d.getDeadline() == null || d.getDeadline().isAfter(now))
                .count();
        if (!force && pending > 0) {
            throw new RuntimeException("Còn " + pending + " khiếu nại chưa xử lý trong kỳ " + ym
                    + " — xử lý hết trước khi khoá kỳ công");
        }
        if (force && pending > 0) {
            AuditLog log = AuditLog.builder().action("FORCE_LOCK_TIMESHEET").entityName("TIMESHEET_PERIOD")
                    .entityId(ym.toString()).userId(CurrentUser.userId()).userCode(CurrentUser.employeeCode())
                    .reason("Khoá cưỡng bức — còn " + pending + " khiếu nại đang mở trong kỳ").build();
            log.setCreatedAt(now);
            auditLogRepository.save(log);
        }
        ensureAllSheets(ym);
        List<Timesheet> rows = timesheetRepository.findByPeriodMonthAndPeriodYear(ym.getMonthValue(), ym.getYear());
        for (Timesheet s : rows) { s.setStatus("locked"); s.setLockedAt(now); }
        timesheetRepository.saveAll(rows);
        return Map.of("month", ym.toString(), "status", "locked", "lockedBy", String.valueOf(CurrentUser.employeeCode()));
    }

    /**
     * Tự động khoá khi đã quá `payroll_period.lock_delay_days` ngày kể từ lúc công bố
     * và không còn khiếu nại đang mở. Chạy hằng ngày; cũng gọi tay được.
     */
    @Scheduled(cron = "0 20 1 * * *")
    @PostMapping("/auto-lock")
    @Operation(summary = "Tự khoá kỳ sau lock_delay_days (dùng cấu hình Kỳ công & khiếu nại)")
    public ApiResponse<List<Map<String, Object>>> autoLock() {
        int delay = ruleService.getInt("payroll_period", "lock_delay_days", 0);
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        List<Map<String, Object>> done = new ArrayList<>();
        for (Timesheet s : timesheetRepository.findAll()) {
            if (!"published".equalsIgnoreCase(s.getStatus()) || s.getPublishedAt() == null) continue;
            // Hạn khoá = hạn khiếu nại + ân hạn cấu hình (lock_delay_days, 0 = khoá ngay khi hết hạn).
            java.time.LocalDateTime deadline = s.getDisputeDeadline() != null
                    ? s.getDisputeDeadline().plusDays(delay)
                    : s.getPublishedAt().plusDays(ruleService.getInt("payroll_period", "dispute_window_days", 2)).plusDays(delay);
            if (now.isBefore(deadline)) continue;
            YearMonth ym = YearMonth.of(s.getPeriodYear(), s.getPeriodMonth());
            try {
                doLock(ym, false);
                done.add(Map.of("month", ym.toString(), "locked", true));
            } catch (RuntimeException e) {
                done.add(Map.of("month", ym.toString(), "locked", false, "reason", String.valueOf(e.getMessage())));
            }
        }
        return ApiResponse.ok(done, "Tự khoá kỳ công hết hạn khiếu nại (+" + delay + " ngày ân hạn): " + done.size() + " kỳ xử lý");
    }

    private boolean allowAdjustAfterLock() {
        return ruleService.getBoolean("payroll_period", "allow_adjust_after_lock", false);
    }

    private void assertPeriodEditable(YearMonth ym) {
        if ("locked".equals(statusOf(ym)) && !allowAdjustAfterLock()) {
            throw new RuntimeException("Kỳ công đã khoá — không sửa được ô. "
                    + "(Bật 'Cho phép điều chỉnh sau khi khoá' trong Cấu hình Kỳ công & khiếu nại nếu thật sự cần)");
        }
    }

    @PostMapping("/lock")
    @Operation(summary = "Khoá kỳ công — chặn đơn/quyết định sau khoá")
    public ApiResponse<Map<String, Object>> lock(@RequestParam(required = false) String month,
                                                 @RequestParam(required = false, defaultValue = "false") boolean force) {
        YearMonth ym = (month == null || month.isBlank()) ? YearMonth.now() : YearMonth.parse(month);
        if ("draft".equals(statusOf(ym))) {
            throw new RuntimeException("Kỳ " + ym + " chưa chốt — hãy chốt bảng công trước khi khoá (để nhân viên còn cửa sổ khiếu nại)");
        }
        return ApiResponse.ok(doLock(ym, force), "Đã khoá kỳ công");
    }
}
