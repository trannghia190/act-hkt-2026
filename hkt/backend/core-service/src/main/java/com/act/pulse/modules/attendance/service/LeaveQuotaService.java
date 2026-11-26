package com.act.pulse.modules.attendance.service;

import com.act.pulse.modules.attendance.entity.Holiday;
import com.act.pulse.modules.attendance.entity.LeaveType;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.repository.HolidayRepository;
import com.act.pulse.modules.attendance.repository.LeaveTypeRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Kiểm tra quỹ phép năm khi gửi đơn nghỉ.
 * <p>Số dư thật nằm ở {@link LeaveBalanceService} (sổ phép, chỉ ghi khi quản lý DUYỆT).
 * Vì vậy đơn đang CHỜ DUYỆT chưa bị trừ sổ và phải được "giữ chỗ" riêng — nếu không,
 * nhân viên có thể gửi nhiều đơn cùng vượt quỹ và quản lý duyệt hết dẫn tới âm phép.</p>
 */
@Service
@RequiredArgsConstructor
public class LeaveQuotaService {

    private final RequestRepository requestRepository;
    private final LeaveTypeRepository leaveTypeRepository;
    private final HolidayRepository holidayRepository;
    private final LeaveBalanceService leaveBalanceService;

    /** Loại nghỉ có trừ quỹ phép năm hay không (cấu hình leave_types.deducts_annual_leave). */
    public boolean deductsAnnualLeave(String leaveTypeCode) {
        return leaveTypeRepository.findByCode(normalizeCode(leaveTypeCode))
                .map(lt -> Boolean.TRUE.equals(lt.getDeductsAnnualLeave()))
                .orElse(false);
    }

    /** Số ngày làm việc của đơn nghỉ (bỏ T7/CN và ngày lễ); đơn nửa ngày = 0.5. */
    public double dayCount(LocalDate start, LocalDate end, String payload) {
        if (payload != null && payload.contains("half_day_period")) return 0.5;
        if (start == null) return 0;
        LocalDate last = end == null || end.isBefore(start) ? start : end;
        List<Holiday> holidays = holidayRepository.findAll();
        double days = 0;
        for (LocalDate d = start; !d.isAfter(last); d = d.plusDays(1)) {
            if (d.getDayOfWeek().getValue() >= 6) continue;
            boolean onHoliday = false;
            for (Holiday h : holidays) {
                if (h.covers(d)) { onHoliday = true; break; }
            }
            if (!onHoliday) days += 1;
        }
        return days;
    }

    /** Số phép năm còn lại theo sổ phép (đã trừ mọi đơn đã duyệt). */
    public BigDecimal remainingOf(UUID userId) {
        Object value = leaveBalanceService.balanceOf(userId).get("remaining");
        return toDecimal(value);
    }

    /**
     * Số ngày phép của các đơn TRỪ QUỸ đang chờ duyệt — giữ chỗ trước khi quản lý duyệt.
     * Đơn đã duyệt KHÔNG tính ở đây vì đã nằm trong sổ phép (bị trừ ở bước duyệt).
     */
    public BigDecimal pendingDeductDays(UUID userId, UUID excludeId) {
        if (userId == null) return BigDecimal.ZERO;
        Set<String> deductCodes = leaveTypeRepository.findAll().stream()
                .filter(lt -> Boolean.TRUE.equals(lt.getDeductsAnnualLeave()))
                .map(lt -> lt.getCode().toUpperCase(Locale.ROOT))
                .collect(Collectors.toSet());
        BigDecimal total = BigDecimal.ZERO;
        for (RequestEntity r : requestRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            if (!"LEAVE".equals(r.getRequestType())) continue;
            if (!"PENDING_APPROVAL".equals(r.getStatus())) continue;
            if (excludeId != null && excludeId.equals(r.getId())) continue;
            String code = (r.getLeaveType() == null ? "AL" : r.getLeaveType()).toUpperCase(Locale.ROOT);
            if (!deductCodes.contains(code)) continue;
            total = total.add(BigDecimal.valueOf(dayCount(r.getWorkDate(), r.getEndDate(), r.getPayload())));
        }
        return total;
    }

    /** Số ngày phép khả dụng để gửi đơn mới = còn lại − đơn đang chờ duyệt (không âm). */
    public BigDecimal availableForLeave(UUID userId, UUID excludeId) {
        return remainingOf(userId).subtract(pendingDeductDays(userId, excludeId)).max(BigDecimal.ZERO);
    }

    private static String normalizeCode(String code) {
        return code == null || code.isBlank() ? "AL" : code.trim().toUpperCase(Locale.ROOT);
    }

    private static BigDecimal toDecimal(Object value) {
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }
}
