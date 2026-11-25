package com.act.pulse.modules.notification.service;

import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.Holiday;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.Shift;
import com.act.pulse.modules.attendance.entity.Timesheet;
import com.act.pulse.modules.attendance.entity.TimesheetDispute;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.HolidayRepository;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.TimesheetDisputeRepository;
import com.act.pulse.modules.attendance.repository.TimesheetRepository;
import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.attendance.service.ShiftResolver;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.okr.entity.OKRCycle;
import com.act.pulse.modules.okr.entity.OKRReview;
import com.act.pulse.modules.okr.repository.OKRItemRepository;
import com.act.pulse.modules.okr.repository.OKRReviewRepository;
import com.act.pulse.modules.okr.service.OKRManagementService;
import com.act.pulse.modules.okr.service.OKRPhaseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Producer cho các mốc nhắc theo lịch (S36) — trước đây các sự kiện này có ô
 * bật/tắt trên UI nhưng KHÔNG có code nào phát sinh.
 * <p>Mỗi sự kiện đi qua {@link NotificationDispatcher} nên tôn trọng cấu hình
 * kênh/giờ yên lặng/dedupe của từng người. Dedupe key gắn theo ngày để job chạy
 * lại trong ngày không sinh trùng.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationReminderJob {

    private static final int GRACE_MINUTES = 30;
    private static final Set<String> NON_WORKING_STATUS = Set.of("RESIGNED", "SUSPENDED");

    private final UserRepository userRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final HolidayRepository holidayRepository;
    private final ShiftResolver shiftResolver;
    private final TimesheetRepository timesheetRepository;
    private final TimesheetDisputeRepository timesheetDisputeRepository;
    private final RequestRepository requestRepository;
    private final LeaveLedgerRepository leaveLedgerRepository;
    private final RuleService ruleService;
    private final NotificationDispatcher dispatcher;
    private final OKRPhaseService okrPhaseService;
    private final OKRManagementService okrManagement;
    private final OKRReviewRepository okrReviewRepository;
    private final OKRItemRepository okrItemRepository;

    /** Chạy hằng ngày 09:10 — sau các job chấm công/bảng công buổi sáng. */
    @Scheduled(cron = "0 10 9 * * *")
    public void scheduledReminders() {
        try {
            runAll(LocalDate.now(), LocalTime.now());
        } catch (Exception e) {
            log.warn("Không chạy được job nhắc thông báo", e);
        }
    }

    /**
     * Chạy toàn bộ phép quét. {@code today}/{@code at} cho phép mô phỏng thời
     * điểm (dùng trong test) thay vì phụ thuộc đồng hồ máy chủ.
     */
    public Map<String, Integer> runAll(LocalDate today, LocalTime at) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        Set<LocalDate> holidays = holidayDates();
        List<User> workers = workers();
        LocalDateTime now = today.atTime(at);

        scanAttendance(today, now, holidays, workers, counts);
        scanAdjustDeadlines(today, holidays, workers, counts);
        scanWfhReports(today, now, holidays, counts);
        scanApprovalOverdue(today, now, counts);
        scanLeaveExpiry(today, workers, counts);
        scanDisputeDeadline(today, counts);
        scanHrReminders(today, at, counts);
        scanOkr(today, workers, counts);
        return counts;
    }

    // ── Chấm công ──────────────────────────────────────────────────────────

    private void scanAttendance(LocalDate today, LocalDateTime now, Set<LocalDate> holidays,
                                List<User> workers, Map<String, Integer> counts) {
        if (!isWorkingDay(today, holidays)) return;
        Set<UUID> exempt = exemptOn(today);

        for (User u : workers) {
            if (exempt.contains(u.getId())) continue;
            Shift shift = shiftResolver.resolveFor(u);
            if (shift == null || Boolean.FALSE.equals(shift.getIsActive())) continue;

            AttendanceLog log = attendanceLogRepository.findByUserIdAndWorkDate(u.getId(), today).orElse(null);
            boolean afterIn = now.isAfter(LocalDateTime.of(today, shift.getCheckInEnd()).plusMinutes(GRACE_MINUTES));
            boolean afterOut = now.isAfter(LocalDateTime.of(today, shift.getCheckOutEnd()).plusMinutes(GRACE_MINUTES));

            if (afterIn && (log == null || log.getCheckInAt() == null)) {
                send(counts, "MISSING_CHECKIN", u.getId(),
                        "Chưa check-in hôm nay",
                        "Bạn chưa check-in cho ca làm việc hôm nay (" + shift.getName() + ").",
                        "/attendance/checkin", "missing-checkin:" + u.getId() + ":" + today);
            }
            if (afterOut && log != null && log.getCheckInAt() != null && log.getCheckOutAt() == null) {
                send(counts, "MISSING_CHECKOUT", u.getId(),
                        "Chưa check-out hôm nay",
                        "Bạn đã check-in nhưng chưa check-out. Vui lòng chấm công ra để đủ công.",
                        "/attendance/checkin", "missing-checkout:" + u.getId() + ":" + today);
            }
        }

        // Quên chấm công 2 ngày làm việc liên tiếp trước hôm nay.
        List<LocalDate> prev = previousWorkingDays(today, 2, holidays);
        if (prev.size() < 2 || !isWorkingDay(today, holidays)) return;
        LocalDateTime graceIn = LocalDateTime.of(today, shiftResolver.standardShift().getCheckInEnd())
                .plusMinutes(GRACE_MINUTES);
        if (now.isBefore(graceIn)) return;

        Set<UUID> exemptPrev1 = exemptOn(prev.get(0));
        Set<UUID> exemptPrev2 = exemptOn(prev.get(1));
        for (User u : workers) {
            if (exemptPrev1.contains(u.getId()) || exemptPrev2.contains(u.getId())) continue;
            boolean missing1 = attendanceLogRepository.findByUserIdAndWorkDate(u.getId(), prev.get(0)).isEmpty();
            boolean missing2 = attendanceLogRepository.findByUserIdAndWorkDate(u.getId(), prev.get(1)).isEmpty();
            if (missing1 && missing2) {
                send(counts, "FORGOT_ATTENDANCE", u.getId(),
                        "Quên chấm công 2 ngày liên tiếp",
                        "Bạn không có bản ghi chấm công ngày " + prev.get(1) + " và " + prev.get(0)
                                + ". Vui lòng nộp đơn bổ sung công.",
                        "/attendance/requests", "forgot-attendance:" + u.getId() + ":" + today);
            }
        }
    }

    private void scanAdjustDeadlines(LocalDate today, Set<LocalDate> holidays,
                                     List<User> workers, Map<String, Integer> counts) {
        int deadlineDays = ruleService.getInt("makeup", "deadline_working_days", 3);
        List<LocalDate> lookback = previousWorkingDaysInclusive(today, deadlineDays + 3, holidays);
        for (User u : workers) {
            for (LocalDate day : lookback) {
                if (exemptOn(day).contains(u.getId())) continue;
                AttendanceLog log = attendanceLogRepository.findByUserIdAndWorkDate(u.getId(), day).orElse(null);
                boolean incomplete = log == null || log.getCheckInAt() == null || log.getCheckOutAt() == null;
                if (!incomplete) continue;
                boolean filed = requestRepository.findByUserIdAndRequestTypeAndWorkDate(u.getId(), "ADJUST", day)
                        .stream().anyMatch(r -> "PENDING_APPROVAL".equals(r.getStatus()) || "APPROVED".equals(r.getStatus()));
                if (filed) continue;

                LocalDate deadline = addWorkingDays(day, deadlineDays, holidays);
                long left = ChronoUnit.DAYS.between(today, deadline);
                if (left == 1) {
                    send(counts, "ADJUST_DEADLINE_SOON", u.getId(),
                            "Sắp hết hạn bổ sung công ngày " + day,
                            "Bạn còn 1 ngày để nộp đơn bổ sung công cho ngày " + day + " (hạn " + deadline + ").",
                            "/attendance/requests", "adjust-soon:" + u.getId() + ":" + day);
                } else if (left < 0) {
                    send(counts, "ADJUST_OVERDUE", u.getId(),
                            "Đã quá hạn bổ sung công ngày " + day,
                            "Ngày " + day + " thiếu công và đã quá hạn nộp bổ sung. Liên hệ HR nếu cần hỗ trợ.",
                            "/attendance/requests", "adjust-overdue:" + u.getId() + ":" + day);
                }
            }
        }
    }

    private void scanWfhReports(LocalDate today, LocalDateTime now, Set<LocalDate> holidays,
                                Map<String, Integer> counts) {
        if (!isWorkingDay(today, holidays)) return;
        for (RequestEntity r : requestRepository.findApprovedAbsencesOn(today)) {
            if (!"WFH".equalsIgnoreCase(r.getRequestType())) continue;
            Shift shift = userRepository.findById(r.getUserId()).map(shiftResolver::resolveFor).orElse(null);
            LocalTime out = shift == null ? LocalTime.of(17, 0) : shift.getCheckOutEnd();
            if (now.isBefore(LocalDateTime.of(today, out))) continue;
            AttendanceLog log = attendanceLogRepository.findByUserIdAndWorkDate(r.getUserId(), today).orElse(null);
            if (log != null && log.getCheckInAt() != null) continue;
            send(counts, "WFH_MISSING_REPORT", r.getUserId(),
                    "Chưa gửi báo cáo WFH hôm nay",
                    "Bạn có đơn WFH được duyệt hôm nay nhưng chưa ghi nhận kết quả làm việc.",
                    "/attendance/requests", "wfh-report:" + r.getUserId() + ":" + today);
        }
    }

    // ── Đơn từ & phép ──────────────────────────────────────────────────────

    private void scanApprovalOverdue(LocalDate today, LocalDateTime now, Map<String, Integer> counts) {
        int slaHours = ruleService.getInt("approval_flow", "sla_hours", 48);
        Map<UUID, User> users = new HashMap<>();
        userRepository.findAll().forEach(u -> users.put(u.getId(), u));
        for (RequestEntity r : requestRepository.findByStatusAndCreatedAtBefore(
                "PENDING_APPROVAL", now.minusHours(slaHours))) {
            User owner = users.get(r.getUserId());
            if (owner == null || owner.getManagerId() == null || owner.getManagerId().equals(owner.getId())) continue;
            String name = owner.getFullName() == null ? owner.getEmployeeCode() : owner.getFullName();
            send(counts, "APPROVAL_OVERDUE", owner.getManagerId(),
                    "Đơn chờ duyệt quá " + slaHours + " giờ",
                    "Đơn " + r.getRequestType() + " của " + name + " nộp ngày " + r.getCreatedAt().toLocalDate()
                            + " vẫn chờ duyệt.",
                    "/attendance/approvals", "approval-overdue:" + r.getId() + ":" + today);
        }
    }

    private void scanLeaveExpiry(LocalDate today, List<User> workers, Map<String, Integer> counts) {
        Map<String, Object> rule = ruleService.get("leave_carryover");
        String expireFrom = rule.get("expire_from") == null ? "07-01" : String.valueOf(rule.get("expire_from"));
        LocalDate expireDate;
        try {
            String[] parts = expireFrom.split("-");
            expireDate = LocalDate.of(today.getYear(), Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
        } catch (Exception ex) {
            return;
        }
        long daysLeft = ChronoUnit.DAYS.between(today, expireDate);
        if (daysLeft < 0 || daysLeft > 15) return;

        for (User u : workers) {
            BigDecimal carried = carriedRemaining(u.getId());
            if (carried.signum() <= 0) continue;
            send(counts, "LEAVE_EXPIRY_SOON", u.getId(),
                    "Phép tồn sắp hết hạn",
                    "Bạn còn " + carried.stripTrailingZeros().toPlainString()
                            + " ngày phép tồn, hết hạn vào " + expireFrom + ". Hãy dùng trước hạn.",
                    "/attendance/leaves", "leave-expiry:" + u.getId() + ":" + today.getYear());
        }
    }

    /** Phép tồn còn lại — cùng nguyên tắc trừ dồn của bảng cân bằng phép. */
    private BigDecimal carriedRemaining(UUID userId) {
        BigDecimal granted = BigDecimal.ZERO;
        BigDecimal used = BigDecimal.ZERO;
        for (LeaveLedgerEntry e : leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            String reason = e.getReason() == null ? "" : e.getReason().toLowerCase();
            boolean carryGrant = "GRANT".equals(e.getAction())
                    && (reason.contains("tồn") || reason.contains("bảo lưu"));
            if (carryGrant) granted = granted.add(e.getAmount());
            if ("USED".equals(e.getAction()) && !"S".equalsIgnoreCase(e.getLeaveType())) {
                used = used.add(e.getAmount().abs());
            }
        }
        if (granted.signum() <= 0) return BigDecimal.ZERO;
        return granted.subtract(used.min(granted)).max(BigDecimal.ZERO);
    }

    // ── Bảng công & HR ─────────────────────────────────────────────────────

    private void scanDisputeDeadline(LocalDate today, Map<String, Integer> counts) {
        List<User> hr = hrUsers();
        for (TimesheetDispute d : timesheetDisputeRepository.findByStatus("PENDING")) {
            if (d.getDeadline() == null) continue;
            long daysLeft = ChronoUnit.DAYS.between(today, d.getDeadline().toLocalDate());
            if (daysLeft < 0 || daysLeft > 1) continue;
            for (User u : hr) {
                send(counts, "TIMESHEET_COMPLAINT_EXPIRING", u.getId(),
                        "Khiếu nại bảng công sắp quá hạn xử lý",
                        "Khiếu nại " + d.getId() + " (ngày công " + d.getWorkDate() + ") hết hạn xử lý "
                                + d.getDeadline().toLocalDate() + ".",
                        "/attendance/disputes", "dispute-expiring:" + d.getId() + ":" + today);
            }
        }
    }

    private void scanHrReminders(LocalDate today, LocalTime at, Map<String, Integer> counts) {
        List<User> hr = hrUsers();

        int closeDay = ruleService.getInt("payroll_period", "close_day", 1);
        if (today.getDayOfMonth() == closeDay) {
            YearMonth prev = YearMonth.from(today).minusMonths(1);
            boolean pending = timesheetRepository.findByPeriodMonthAndPeriodYear(prev.getMonthValue(), prev.getYear())
                    .stream().anyMatch(t -> !"locked".equalsIgnoreCase(t.getStatus()));
            if (pending) {
                for (User u : hr) {
                    send(counts, "HR_CLOSE_TIMESHEET", u.getId(),
                            "Hôm nay là ngày chốt bảng công",
                            "Bảng công kỳ " + prev + " chưa khoá hết. Vui lòng rà soát và chốt kỳ.",
                            "/attendance/timesheet", "hr-close:" + prev + ":" + u.getId());
                }
            }
        }

        OKRCycle cycle = okrPhaseService.cycle(null).orElse(null);
        if (cycle != null && !okrPhaseService.isCycleLocked(cycle)
                && okrPhaseService.isOpen(cycle, OKRPhaseService.MIDYEAR, today)) {
            LocalDate due = okrPhaseService.dueDate(cycle, OKRPhaseService.MIDYEAR);
            if (due != null && ChronoUnit.DAYS.between(today, due) <= 3) {
                for (User u : hr) {
                    send(counts, "HR_UNLOCK_OKR", u.getId(),
                            "Rà soát mở khoá điều chỉnh OKR",
                            "Kỳ coaching giữa năm " + cycle.getCycleYear() + " sắp tới hạn ("
                                    + due + "). Kiểm tra và mở khoá điều chỉnh nếu cần.",
                            "/okr/cycles", "hr-unlock-okr:" + cycle.getCycleYear() + ":" + u.getId());
                }
            }
        }
    }

    // ── OKR ────────────────────────────────────────────────────────────────

    private void scanOkr(LocalDate today, List<User> workers, Map<String, Integer> counts) {
        OKRCycle cycle = okrPhaseService.cycle(null).orElse(null);
        if (cycle == null || okrPhaseService.isCycleLocked(cycle)) return;

        if (okrPhaseService.isOpen(cycle, OKRPhaseService.SETUP, today)) {
            Map<UUID, OKRReview> byUser = new HashMap<>();
            okrReviewRepository.findByCycleYear(cycle.getCycleYear()).forEach(r -> byUser.put(r.getUserId(), r));
            for (User u : workers) {
                OKRReview r = byUser.get(u.getId());
                boolean noGoals = r == null || (!"locked".equalsIgnoreCase(r.getStatus())
                        && okrItemRepository.findByReviewIdAndDeletedAtIsNull(r.getId()).isEmpty());
                if (noGoals) {
                    send(counts, "OKR_NOT_CREATED", u.getId(),
                            "Chưa thiết lập mục tiêu OKR " + cycle.getCycleYear(),
                            "Kỳ thiết lập mục tiêu đang mở nhưng bạn chưa có mục tiêu nào. Hoàn thành trước hạn.",
                            "/okr/my-okr", "okr-not-created:" + u.getId() + ":" + cycle.getCycleYear());
                }
            }
        }

        boolean assessing = okrPhaseService.isOpen(cycle, OKRPhaseService.FINAL, today);
        if (assessing) {
            for (OKRReview r : okrReviewRepository.findByCycleYear(cycle.getCycleYear())) {
                if (okrManagement.isCurrentlyApproved(r) && !okrManagement.selfAssessed(r)) {
                    send(counts, "OKR_SELF_ASSESSMENT", r.getUserId(),
                            "Tự đánh giá OKR cuối năm",
                            "Kỳ đánh giá cuối năm đang mở. Vui lòng hoàn thành tự đánh giá OKR của bạn.",
                            "/okr/my-okr", "okr-self-assessment:" + r.getId() + ":" + today);
                }
            }
        }
    }

    // ── helper ─────────────────────────────────────────────────────────────

    private void send(Map<String, Integer> counts, String eventKey, UUID userId,
                      String title, String content, String actionUrl, String dedupeKey) {
        if (userId == null) return;
        try {
            dispatcher.dispatch(eventKey, userId, title, content, eventKey, "MEDIUM", actionUrl, dedupeKey);
            counts.merge(eventKey, 1, Integer::sum);
        } catch (Exception e) {
            log.warn("Không gửi được thông báo {} cho {}", eventKey, userId, e);
        }
    }

    private List<User> workers() {
        return userRepository.findAll().stream()
                .filter(u -> !"ADMIN".equalsIgnoreCase(u.getRole()))
                .filter(u -> u.getStatus() == null || !NON_WORKING_STATUS.contains(u.getStatus().toUpperCase()))
                .filter(u -> u.getStatus() == null || "ACTIVE".equalsIgnoreCase(u.getStatus()))
                .toList();
    }

    private List<User> hrUsers() {
        return userRepository.findByRoleIn(List.of("ADMIN", "HR_ADMIN")).stream()
                .filter(u -> u.getStatus() == null || "ACTIVE".equalsIgnoreCase(u.getStatus()))
                .toList();
    }

    private Set<LocalDate> holidayDates() {
        Set<LocalDate> out = new HashSet<>();
        for (Holiday h : holidayRepository.findAll()) out.addAll(h.dates());
        return out;
    }

    private Set<UUID> exemptOn(LocalDate day) {
        Set<UUID> out = new HashSet<>();
        for (RequestEntity r : requestRepository.findApprovedAbsencesOn(day)) out.add(r.getUserId());
        return out;
    }

    private boolean isWorkingDay(LocalDate day, Set<LocalDate> holidays) {
        return day.getDayOfWeek().getValue() < 6 && !holidays.contains(day);
    }

    private List<LocalDate> previousWorkingDays(LocalDate today, int count, Set<LocalDate> holidays) {
        List<LocalDate> out = new ArrayList<>();
        LocalDate d = today.minusDays(1);
        for (int i = 0; i < 15 && out.size() < count; i++, d = d.minusDays(1)) {
            if (isWorkingDay(d, holidays)) out.add(d);
        }
        return out;
    }

    private List<LocalDate> previousWorkingDaysInclusive(LocalDate today, int count, Set<LocalDate> holidays) {
        List<LocalDate> out = new ArrayList<>();
        LocalDate d = today;
        for (int i = 0; i < 30 && out.size() < count; i++, d = d.minusDays(1)) {
            if (isWorkingDay(d, holidays)) out.add(d);
        }
        return out;
    }

    private LocalDate addWorkingDays(LocalDate from, int days, Set<LocalDate> holidays) {
        LocalDate d = from;
        int added = 0;
        while (added < days) {
            d = d.plusDays(1);
            if (isWorkingDay(d, holidays)) added++;
        }
        return d;
    }
}
