package com.act.pulse.modules.attendance.service;

import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.Shift;
import com.act.pulse.modules.attendance.repository.ShiftRepository;
import com.act.pulse.modules.attendance.repository.TeamRepository;
import com.act.pulse.modules.auth.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Phân giải ca làm việc theo mô hình **ca chuẩn làm base toàn công ty** + **danh sách ca ngoại lệ
 * xếp theo thứ tự ưu tiên**:
 * <ul>
 *   <li>{@code SHIFT_STANDARD} là ca mặc định — áp dụng cho mọi nhân sự không khớp ca ngoại lệ nào.</li>
 *   <li>Mỗi ca ngoại lệ đang bật là một "luật ca": khớp theo nhóm / chức danh / mã nhân viên,
 *       trừ các mã nhân viên bị loại trừ.</li>
 *   <li>Ca càng ở <b>dưới cùng</b> danh sách ({@code priority} càng lớn) thì <b>ưu tiên ghi đè càng cao</b>:
 *       một người khớp nhiều ca sẽ nhận ca có priority lớn nhất.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class ShiftResolver {

    public static final String STANDARD_CODE = "SHIFT_STANDARD";

    private final ShiftRepository shiftRepository;
    private final TeamRepository teamRepository;

    /** Ca chuẩn dùng chung toàn công ty (null nếu chưa cấu hình — migration luôn bảo đảm có). */
    public Shift standardShift() {
        return shiftRepository.findByCode(STANDARD_CODE).orElse(null);
    }

    /** Ca ngoại lệ đang bật, xếp từ trên xuống dưới (priority tăng dần). */
    public List<Shift> exceptionShifts() {
        return shiftRepository.findAll().stream()
                .filter(s -> !isStandard(s))
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .sorted(Comparator
                        .comparing((Shift s) -> s.getPriority() == null ? Integer.MAX_VALUE : s.getPriority())
                        .thenComparing(Shift::getCode))
                .toList();
    }

    /**
     * Ca hiệu lực của một người: duyệt ca ngoại lệ từ dưới lên (ưu tiên cao nhất trước),
     * ca đầu tiên khớp nhóm/chức danh/nhân viên và không bị loại trừ sẽ thắng.
     * Không khớp ca nào → ca đã gán tay (nếu còn hiệu lực) → ca chuẩn.
     */
    public Shift resolveFor(User user) {
        if (user == null) return standardShift();
        List<Shift> rules = exceptionShifts();
        for (int i = rules.size() - 1; i >= 0; i--) {
            if (matches(user, rules.get(i))) return rules.get(i);
        }
        if (user.getShiftId() != null) {
            Shift assigned = shiftRepository.findById(user.getShiftId()).orElse(null);
            if (assigned != null && Boolean.TRUE.equals(assigned.getIsActive())) {
                return assigned;
            }
        }
        return standardShift();
    }

    /**
     * Ca áp dụng cho một bản ghi chấm công: ưu tiên ca đã ghi nhận trên log (đúng ca tại thời
     * điểm chấm), nếu log cũ chưa có {@code shift_id} thì dùng ca hiệu lực hiện tại của người đó.
     */
    public Shift resolveFor(User user, AttendanceLog log) {
        if (log != null && log.getShiftId() != null) {
            Shift saved = shiftRepository.findById(log.getShiftId()).orElse(null);
            if (saved != null) return saved;
        }
        return resolveFor(user);
    }

    /** Số giờ làm bắt buộc của ca (mặc định 8 giờ/ngày nếu ca chưa cấu hình). */
    public double requiredHours(Shift shift) {
        if (shift == null || shift.getRequiredWorkHours() == null) return 8.0;
        return shift.getRequiredWorkHours().doubleValue();
    }

    /** Số phút nghỉ trưa thực tế nằm trong khoảng chấm công, theo khung nghỉ của ca. */
    public long lunchMinutes(Shift shift, LocalDateTime checkIn, LocalDateTime checkOut) {
        if (checkIn == null || checkOut == null || !checkOut.isAfter(checkIn)) return 0;
        LocalTime lunchStart = shift != null && shift.getLunchBreakStart() != null
                ? shift.getLunchBreakStart() : LocalTime.of(12, 0);
        LocalTime lunchEnd = shift != null && shift.getLunchBreakEnd() != null
                ? shift.getLunchBreakEnd() : LocalTime.of(13, 0);
        LocalDate day = checkIn.toLocalDate();
        LocalDateTime start = LocalDateTime.of(day, lunchStart);
        LocalDateTime end = LocalDateTime.of(day, lunchEnd);
        LocalDateTime overlapStart = checkIn.isAfter(start) ? checkIn : start;
        LocalDateTime overlapEnd = checkOut.isBefore(end) ? checkOut : end;
        return overlapEnd.isAfter(overlapStart) ? Duration.between(overlapStart, overlapEnd).toMinutes() : 0;
    }

    /** Giờ làm thực tế trong ngày = giờ ra − giờ vào − nghỉ trưa giao với khoảng làm việc. */
    public double workedHours(Shift shift, AttendanceLog log) {
        if (log == null || log.getCheckInAt() == null || log.getCheckOutAt() == null) return 0;
        long minutes = Duration.between(log.getCheckInAt(), log.getCheckOutAt()).toMinutes();
        if (minutes <= 0) return 0;
        long net = Math.max(0, minutes - lunchMinutes(shift, log.getCheckInAt(), log.getCheckOutAt()));
        return net / 60.0;
    }

    /**
     * Công trong ngày theo ca hiệu lực: đủ số giờ yêu cầu → 1.00, đủ nửa → 0.50, còn lại → 0.00.
     * Thiếu giờ vào hoặc giờ ra → 0.00 (phải làm đơn bổ sung công mới được tính).
     */
    public double workUnits(Shift shift, AttendanceLog log) {
        if (log == null || log.getCheckInAt() == null || log.getCheckOutAt() == null) return 0.0;
        double worked = workedHours(shift, log);
        double required = requiredHours(shift);
        if (worked + 1e-6 >= required) return 1.0;
        if (worked + 1e-6 >= required / 2.0) return 0.5;
        return 0.0;
    }

    /** Ký hiệu ô công tương ứng (1.00 / 0.50 / 0.00). */
    public String workSymbol(Shift shift, AttendanceLog log) {
        double units = workUnits(shift, log);
        if (units >= 1.0) return "1.00";
        if (units >= 0.5) return "0.50";
        return "0.00";
    }

    /**
     * Số phút đi muộn so với khung vào của ca hiệu lực:
     * <ul>
     *   <li>Ca thường: muộn sau {@code check_in_end}.</li>
     *   <li>Ca linh hoạt: vào/ra trong khung linh hoạt và đủ số giờ → không muộn; ngược lại
     *       tính từ cuối khung vào linh hoạt.</li>
     * </ul>
     */
    public int lateMinutes(Shift shift, AttendanceLog log) {
        if (shift == null || log == null || log.getCheckInAt() == null) return 0;
        LocalTime in = log.getCheckInAt().toLocalTime();
        if (Boolean.TRUE.equals(shift.getIsFlexible())) {
            LocalTime from = shift.getFlexibleCheckinFrom() != null
                    ? shift.getFlexibleCheckinFrom() : shift.getCheckInStart();
            LocalTime to = shift.getFlexibleCheckinTo() != null
                    ? shift.getFlexibleCheckinTo() : shift.getCheckInEnd();
            boolean inWindow = (from == null || !in.isBefore(from)) && (to == null || !in.isAfter(to));
            if (inWindow && workUnits(shift, log) >= 1.0) return 0;
            if (to == null) return 0;
            return (int) Math.max(0, Duration.between(to, in).toMinutes());
        }
        LocalTime threshold = shift.getCheckInEnd() != null ? shift.getCheckInEnd() : shift.getCheckInStart();
        if (threshold == null) return 0;
        return (int) Math.max(0, Duration.between(threshold, in).toMinutes());
    }

    /** Người này có thuộc phạm vi áp dụng của ca không (đã trừ danh sách loại trừ). */
    public boolean matches(User user, Shift shift) {
        if (user == null || shift == null) return false;
        if (containsCode(shift.getExcludeEmployees(), user.getEmployeeCode())) return false;

        Set<String> employees = csv(shift.getTargetEmployees());
        Set<String> groups = csv(shift.getTargetGroup());
        Set<String> positions = csv(shift.getTargetPosition());
        if (employees.isEmpty() && groups.isEmpty() && positions.isEmpty()) return false;

        if (!employees.isEmpty() && containsCode(shift.getTargetEmployees(), user.getEmployeeCode())) return true;
        if (!positions.isEmpty() && user.getPositionName() != null
                && contains(positions, user.getPositionName())) return true;
        if (!groups.isEmpty() && user.getTeamId() != null) {
            return teamRepository.findById(user.getTeamId())
                    .map(team -> contains(groups, team.getName()))
                    .orElse(false);
        }
        return false;
    }

    /** Ca này có phải ca chuẩn (base toàn công ty) không. */
    public boolean isStandard(Shift shift) {
        return shift != null && STANDARD_CODE.equals(shift.getCode());
    }

    public UUID standardShiftId() {
        Shift standard = standardShift();
        return standard == null ? null : standard.getId();
    }

    private static Set<String> csv(String raw) {
        if (raw == null || raw.isBlank()) return Set.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toLowerCase())
                .collect(Collectors.toSet());
    }

    private static boolean contains(Set<String> values, String actual) {
        return actual != null && values.contains(actual.trim().toLowerCase());
    }

    private static boolean containsCode(String raw, String employeeCode) {
        if (raw == null || employeeCode == null) return false;
        return contains(csv(raw), employeeCode);
    }
}
