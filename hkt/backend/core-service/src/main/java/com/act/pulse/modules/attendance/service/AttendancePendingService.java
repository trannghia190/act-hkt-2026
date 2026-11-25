package com.act.pulse.modules.attendance.service;

import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.Holiday;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.Timesheet;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.HolidayRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.TimesheetRepository;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Nguồn sự thật duy nhất cho các việc chấm công còn chờ của MỘT nhân viên:
 * <ul>
 *   <li>Ngày công thiếu (không có log / thiếu vào / thiếu ra) chưa nộp đơn bổ sung — kèm hạn nộp.</li>
 *   <li>Kỳ bảng công đã công bố mà nhân viên còn hạn khiếu nại.</li>
 * </ul>
 * Dùng chung cho Todo Inbox ({@code TodoController}) và job nhắc thông báo
 * ({@code NotificationReminderJob}) để hai kênh không lệch nhau.
 */
@Service
@RequiredArgsConstructor
public class AttendancePendingService {

    /** Ngày công thiếu và hạn nộp đơn bổ sung (tính theo ngày làm việc). */
    public record MissingPunch(LocalDate workDate, LocalDate deadline) {
        public long daysLeft(LocalDate today) {
            return java.time.temporal.ChronoUnit.DAYS.between(today, deadline);
        }
    }

    /** Kỳ bảng công đã công bố, còn hạn khiếu nại. */
    public record DisputeWindow(YearMonth period, LocalDateTime deadline) {
        public long daysLeft(LocalDate today) {
            return java.time.temporal.ChronoUnit.DAYS.between(today, deadline.toLocalDate());
        }
    }

    private final AttendanceLogRepository attendanceLogRepository;
    private final RequestRepository requestRepository;
    private final HolidayRepository holidayRepository;
    private final TimesheetRepository timesheetRepository;
    private final UserRepository userRepository;
    private final RuleService ruleService;

    // ── Ngày công thiếu / hạn bổ sung công ─────────────────────────────────

    public List<MissingPunch> missingPunches(UUID userId, LocalDate today) {
        return missingPunches(userId, today, holidayDates());
    }

    /**
     * Quét các ngày làm việc trong cửa sổ bổ sung công (mặc định 3 ngày làm việc)
     * để tìm ngày thiếu công chưa có đơn ADJUST đang chờ/đã duyệt.
     *
     * @param holidays tập ngày lễ — truyền sẵn để job quét nhiều người không phải đọc lại bảng lễ.
     */
    public List<MissingPunch> missingPunches(UUID userId, LocalDate today, Set<LocalDate> holidays) {
        if (userId == null) return List.of();
        int deadlineDays = ruleService.getInt("makeup", "deadline_working_days", 3);
        // Cửa sổ đủ rộng để bắt cả các ngày đã quá hạn gần đây (deadlineDays ngày làm việc về trước).
        List<LocalDate> lookback = previousWorkingDaysInclusive(today, deadlineDays + 3, holidays);
        LocalDate hired = hireDate(userId);

        List<MissingPunch> out = new ArrayList<>();
        for (LocalDate day : lookback) {
            if (hired != null && day.isBefore(hired)) continue;
            if (isExempt(userId, day)) continue;

            AttendanceLog log = attendanceLogRepository.findByUserIdAndWorkDate(userId, day).orElse(null);
            boolean incomplete = log == null || log.getCheckInAt() == null || log.getCheckOutAt() == null;
            if (!incomplete) continue;

            boolean filed = requestRepository.findByUserIdAndRequestTypeAndWorkDate(userId, "ADJUST", day)
                    .stream().anyMatch(r -> "PENDING_APPROVAL".equals(r.getStatus()) || "APPROVED".equals(r.getStatus()));
            if (filed) continue;

            // Hạn tính theo NGÀY LỊCH — đúng bộ chặn ở RequestController
            // (workDate >= hôm nay − deadline_working_days) và min-date của form tạo đơn.
            // Nếu tính theo ngày làm việc, việc trong Inbox sẽ trỏ tới ngày không nộp được.
            out.add(new MissingPunch(day, day.plusDays(deadlineDays)));
        }
        out.sort(Comparator.comparing(MissingPunch::deadline).thenComparing(MissingPunch::workDate));
        return out;
    }

    // ── Cửa sổ khiếu nại bảng công ─────────────────────────────────────────

    /** Các kỳ bảng công đã công bố, chưa khoá và còn hạn khiếu nại tính đến hết {@code today}. */
    public List<DisputeWindow> openDisputeWindows(UUID userId, LocalDate today) {
        if (userId == null) return List.of();
        List<DisputeWindow> out = new ArrayList<>();
        for (Timesheet sheet : timesheetRepository.findByUserId(userId)) {
            if (sheet.getStatus() == null || !"published".equalsIgnoreCase(sheet.getStatus())) continue;
            if (sheet.getDisputeDeadline() == null) continue;
            // Hạn khiếu nại tính đến hết ngày ghi trên deadline (thường 23:59).
            if (sheet.getDisputeDeadline().toLocalDate().isBefore(today)) continue;
            out.add(new DisputeWindow(
                    YearMonth.of(sheet.getPeriodYear(), sheet.getPeriodMonth()),
                    sheet.getDisputeDeadline()));
        }
        out.sort(Comparator.comparing(DisputeWindow::deadline));
        return out;
    }

    // ── Tiện ích ngày làm việc ─────────────────────────────────────────────

    public Set<LocalDate> holidayDates() {
        Set<LocalDate> out = new HashSet<>();
        for (Holiday h : holidayRepository.findAll()) out.addAll(h.dates());
        return out;
    }

    public boolean isWorkingDay(LocalDate day, Set<LocalDate> holidays) {
        return day.getDayOfWeek().getValue() < 6 && !holidays.contains(day);
    }

    public List<LocalDate> previousWorkingDaysInclusive(LocalDate today, int count, Set<LocalDate> holidays) {
        List<LocalDate> out = new ArrayList<>();
        LocalDate d = today;
        for (int i = 0; i < 30 && out.size() < count; i++, d = d.minusDays(1)) {
            if (isWorkingDay(d, holidays)) out.add(d);
        }
        return out;
    }

    /** Ngày có đơn nghỉ/WFH đã duyệt → miễn nhắc chấm công. */
    private boolean isExempt(UUID userId, LocalDate day) {
        return requestRepository.findApprovedAbsencesOn(day).stream()
                .anyMatch(r -> userId.equals(r.getUserId()));
    }

    private LocalDate hireDate(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return null;
        return user.getHireDate() != null ? user.getHireDate() : user.getJoinedDate();
    }
}
