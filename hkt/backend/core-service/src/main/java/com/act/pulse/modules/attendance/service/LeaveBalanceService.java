package com.act.pulse.modules.attendance.service;

import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.entity.LeaveType;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.attendance.repository.LeaveTypeRepository;
import com.act.pulse.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Nguồn duy nhất tính số dư phép năm.
 * <p>S09 (trang Nghỉ phép) và thẻ "Số dư phép năm" trên Todo Inbox trước đây mỗi nơi
 * tính một kiểu: Todo hard-code 10,5 ngày, còn S09 cộng dồn thô nên ra 31,5 sau khi
 * có đơn duyệt. Tách về đây để mọi màn hình cùng một con số, và tính theo thứ tự
 * thời gian để phép tồn chỉ được trừ trong thời hạn bảo lưu.</p>
 */
@Service
@RequiredArgsConstructor
public class LeaveBalanceService {

    private final LeaveTypeRepository leaveTypeRepository;
    private final LeaveLedgerRepository leaveLedgerRepository;
    private final UserRepository userRepository;
    private final RuleService ruleService;

    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public Map<String, Object> balanceOf(UUID userId) {
        if (userId == null) {
            return Map.of("granted", 0, "used", 0, "remaining", 0,
                    "annualRemaining", 0, "carriedRemaining", 0);
        }

        // Cấu hình "trừ phép năm" của từng loại là nguồn sự thật duy nhất.
        // (AL được seed deduct = TRUE — xem V42; không hard-code để HR sửa được.)
        List<LeaveType> leaveTypes = leaveTypeRepository.findAll();
        java.util.Set<String> deductTypes = leaveTypes.stream()
                .filter(lt -> Boolean.TRUE.equals(lt.getDeductsAnnualLeave()))
                .map(lt -> lt.getCode().toUpperCase(Locale.ROOT))
                .collect(Collectors.toSet());

        Map<String, Object> carryRule = ruleService.get("leave_carryover");
        int maxKeep = parseInt(carryRule.get("max_keep_days"), 5);
        String expireFrom = stringOr(carryRule.get("expire_from"), "07-01");
        String capFrom = stringOr(carryRule.get("max_keep_from"), "04-01");

        BigDecimal annualRemaining = BigDecimal.ZERO;
        BigDecimal carryRemaining = BigDecimal.ZERO;
        BigDecimal annualGrant = BigDecimal.ZERO;
        BigDecimal carryGrant = BigDecimal.ZERO;
        BigDecimal seniorityGrant = BigDecimal.ZERO;
        BigDecimal used = BigDecimal.ZERO;
        BigDecimal adjust = BigDecimal.ZERO;
        BigDecimal sickUsed = BigDecimal.ZERO;

        // Xử lý theo thứ tự thời gian: phép tồn chỉ bị trừ khi đơn nghỉ diễn ra
        // trước hạn bảo lưu. Cách cộng dồn cũ trừ toàn bộ đơn AL vào phép tồn kể cả
        // đơn sau 01/07, làm số dư sai (31,5 ngày thay vì 4,5).
        List<LeaveLedgerEntry> entries = new ArrayList<>(leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId));
        entries.sort(Comparator.comparing(LeaveLedgerEntry::getCreatedAt,
                Comparator.nullsFirst(Comparator.naturalOrder())));

        for (LeaveLedgerEntry e : entries) {
            String reasonLower = e.getReason() == null ? "" : e.getReason().toLowerCase(Locale.ROOT);
            boolean isCarry = reasonLower.contains("bảo lưu") || reasonLower.contains("tồn");
            boolean isSeniority = reasonLower.contains("thâm niên");
            boolean affectsAnnual = e.getLeaveType() == null
                    || deductTypes.contains(e.getLeaveType().toUpperCase(Locale.ROOT));
            BigDecimal amount = e.getAmount() == null ? BigDecimal.ZERO : e.getAmount();

            switch (String.valueOf(e.getAction()).toUpperCase(Locale.ROOT)) {
                case "GRANT" -> {
                    if (isSeniority) {
                        seniorityGrant = seniorityGrant.add(amount);
                        annualRemaining = annualRemaining.add(amount);
                    } else if (isCarry) {
                        carryGrant = carryGrant.add(amount);
                        carryRemaining = carryRemaining.add(amount);
                    } else {
                        annualGrant = annualGrant.add(amount);
                        annualRemaining = annualRemaining.add(amount);
                    }
                }
                case "USED" -> {
                    if (e.getLeaveType() != null && "S".equalsIgnoreCase(e.getLeaveType())) {
                        sickUsed = sickUsed.add(amount.abs());
                    }
                    if (affectsAnnual) {
                        BigDecimal usedAmount = amount.abs();
                        used = used.add(usedAmount);
                        boolean withinCarryWindow = isBeforeCarryExpiry(e.getCreatedAt(), expireFrom);
                        BigDecimal fromCarry = withinCarryWindow
                                ? carryRemaining.max(BigDecimal.ZERO).min(usedAmount)
                                : BigDecimal.ZERO;
                        carryRemaining = carryRemaining.subtract(fromCarry);
                        annualRemaining = annualRemaining.subtract(usedAmount.subtract(fromCarry));
                    }
                }
                case "ADJUST" -> {
                    if (affectsAnnual) {
                        adjust = adjust.add(amount);
                        annualRemaining = annualRemaining.add(amount);
                    }
                }
                case "EXPIRED" -> carryRemaining = carryRemaining.subtract(amount.abs()).max(BigDecimal.ZERO);
                default -> { /* bỏ qua action lạ để không làm sai số dư */ }
            }
        }

        LocalDate today = LocalDate.now();
        String todayMd = String.format("%02d-%02d", today.getMonthValue(), today.getDayOfMonth());
        BigDecimal carriedAvailable = carryRemaining.max(BigDecimal.ZERO);
        String carryStatus = "AVAILABLE";
        if (todayMd.compareTo(expireFrom) >= 0) {
            carriedAvailable = BigDecimal.ZERO;
            carryStatus = "EXPIRED";
        } else if (todayMd.compareTo(capFrom) >= 0) {
            carriedAvailable = carriedAvailable.min(BigDecimal.valueOf(maxKeep));
            carryStatus = "CAPPED";
        }
        BigDecimal expiredCarry = carryRemaining.subtract(carriedAvailable).max(BigDecimal.ZERO);

        Map<String, Object> map = new HashMap<>();
        map.put("granted", annualGrant.add(carryGrant).add(seniorityGrant));
        map.put("used", used);
        map.put("remaining", annualRemaining.add(carriedAvailable));
        map.put("annualRemaining", annualRemaining);
        map.put("carriedRemaining", carriedAvailable);
        map.put("expiredCarry", expiredCarry);
        map.put("carryStatus", carryStatus);
        map.put("seniority", seniorityGrant);
        map.put("adjust", adjust);
        map.put("sickUsed", sickUsed);

        // Phép chức vụ là một KHOẢN RIÊNG trong tổng phép năm đã cấp (không cộng thêm lần nữa):
        // quản lý hưởng manager_bonus_days, chức vụ khác hưởng position_bonus_days theo rule
        // leave_position_bonus. Tách ra để S09 hiển thị đúng từng ô, tổng quyền lợi không đổi.
        String role = userRepository.findById(userId).map(u -> u.getRole()).orElse("");
        Map<String, Object> positionRule = ruleService.get("leave_position_bonus");
        Object bonusRaw = "MANAGER".equalsIgnoreCase(role)
                ? positionRule.get("manager_bonus_days") : positionRule.get("position_bonus_days");
        BigDecimal positionBonus = parseDecimal(bonusRaw).max(BigDecimal.ZERO)
                .min(annualGrant.max(BigDecimal.ZERO));
        map.put("positionBonus", positionBonus);
        map.put("baseAnnual", annualGrant.subtract(positionBonus));
        map.put("carriedGrant", carryGrant);

        // Thông tin hiển thị cho thẻ Todo: hạn bảo lưu + câu giải thích đúng trạng thái.
        map.put("carriedExpiryDate", formatExpiryDate(today.getYear(), expireFrom));
        map.put("carriedYear", today.getYear() - 1);
        map.put("annualYear", today.getYear());
        String expiryHuman = formatExpiryDate(today.getYear(), expireFrom);
        if ("EXPIRED".equals(carryStatus)) {
            map.put("policyNotice", "Phép tồn năm " + (today.getYear() - 1)
                    + " đã hết hiệu lực từ " + expiryHuman);
        } else if ("CAPPED".equals(carryStatus)) {
            map.put("policyNotice", "Từ " + formatMonthDay(today.getYear(), capFrom)
                    + " chỉ giữ tối đa " + maxKeep + " ngày phép tồn");
        } else {
            map.put("policyNotice", "Phép tồn năm " + (today.getYear() - 1)
                    + " dùng được đến hết " + LocalDate.parse(expiryDateIso(today.getYear(), expireFrom))
                    .minusDays(1).format(DMY));
        }

        Map<String, BigDecimal> usedByType = new HashMap<>();
        for (LeaveLedgerEntry e : entries) {
            if ("USED".equals(e.getAction()) && e.getLeaveType() != null) {
                usedByType.merge(e.getLeaveType().toUpperCase(Locale.ROOT),
                        e.getAmount() == null ? BigDecimal.ZERO : e.getAmount().abs(), BigDecimal::add);
            }
        }
        List<Map<String, Object>> byType = new ArrayList<>();
        for (LeaveType lt : leaveTypes) {
            if (!Boolean.TRUE.equals(lt.getIsActive())) continue;
            Map<String, Object> m = new HashMap<>();
            m.put("code", lt.getCode());
            m.put("name", lt.getName());
            m.put("used", usedByType.getOrDefault(lt.getCode().toUpperCase(Locale.ROOT), BigDecimal.ZERO));
            m.put("defaultDays", lt.getDefaultDays());
            m.put("unit", lt.getUnit());
            byType.add(m);
        }
        map.put("byType", byType);
        return map;
    }

    private static boolean isBeforeCarryExpiry(LocalDateTime at, String expireFrom) {
        if (at == null) return false;
        String md = String.format("%02d-%02d", at.getMonthValue(), at.getDayOfMonth());
        return md.compareTo(expireFrom) < 0;
    }

    private static String formatExpiryDate(int year, String expireFrom) {
        return LocalDate.parse(expiryDateIso(year, expireFrom)).format(DMY);
    }

    private static String expiryDateIso(int year, String expireFrom) {
        String[] parts = expireFrom.split("-");
        int month = parts.length > 0 ? parseInt(parts[0], 7) : 7;
        int day = parts.length > 1 ? parseInt(parts[1], 1) : 1;
        return String.format("%04d-%02d-%02d", year, month, day);
    }

    private static String formatMonthDay(int year, String md) {
        return LocalDate.parse(year + "-" + md).format(DMY);
    }

    private static int parseInt(Object raw, int fallback) {
        if (raw == null) return fallback;
        try {
            return Integer.parseInt(String.valueOf(raw).trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static String stringOr(Object raw, String fallback) {
        if (raw == null) return fallback;
        String s = String.valueOf(raw).trim();
        return s.isEmpty() ? fallback : s;
    }

    private static BigDecimal parseDecimal(Object raw) {
        if (raw == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(String.valueOf(raw).trim());
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO;
        }
    }
}
