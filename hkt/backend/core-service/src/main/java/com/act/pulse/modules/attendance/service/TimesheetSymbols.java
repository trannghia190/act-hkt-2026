package com.act.pulse.modules.attendance.service;

/**
 * Quy ước ký hiệu ô bảng công (53 cột): tách số ngày công / phép năm / WFH / mã loại nghỉ
 * từ một ô. Dùng chung cho bảng công HR (S15) và bảng công cá nhân (S11) để hai màn hình
 * không bao giờ tính khác nhau trên cùng một ô.
 */
public final class TimesheetSymbols {

    private TimesheetSymbols() {
    }

    /** Bỏ dấu * (đi muộn) / ? (chưa xác nhận) và khoảng trắng, trả về null nếu ô rỗng. */
    public static String normalize(String raw) {
        if (raw == null) return null;
        String base = raw.trim().replace("*", "").replace("?", "").trim();
        return base.isEmpty() ? null : base;
    }

    /**
     * Số ngày công của một ô: 1.00 → 1, 0.50 → 0.5, R (WFH cả ngày) → 1,
     * R/0.50 → 0.5. Ký hiệu nghỉ (AL, S, NL…) hoặc rỗng → 0.
     */
    public static double workUnits(String raw) {
        String base = normalize(raw);
        if (base == null) return 0;
        if ("R".equalsIgnoreCase(base)) return 1.0;
        int slash = base.indexOf('/');
        boolean isCounted = base.matches("\\d+(\\.\\d+)?")
                || (slash == 1 && base.regionMatches(true, 0, "R/", 0, 2));
        if (!isCounted) return 0;
        return numberAfterSlash(base, slash);
    }

    /**
     * Số ngày phép năm (AL) của một ô: AL → 1, AL/0.50 hoặc 0.50/AL → 0.5.
     * Nghỉ ốm/chế độ/không lương (S, RO, UP, ML…) trả 0 — không trừ vào phép năm.
     */
    public static double annualLeaveUnits(String raw) {
        String base = normalize(raw);
        if (base == null) return 0;
        String upper = base.toUpperCase();
        if ("AL".equals(upper)) return 1.0;
        int slash = upper.indexOf('/');
        if (slash < 0) return 0;
        String left = upper.substring(0, slash), right = upper.substring(slash + 1);
        if ("AL".equals(left) && right.matches("\\d+(\\.\\d+)?")) return Double.parseDouble(right);
        if ("AL".equals(right) && left.matches("\\d+(\\.\\d+)?")) return Double.parseDouble(left);
        return 0;
    }

    /** Số ngày WFH của một ô: R → 1, R/0.50 hoặc 0.50/R → 0.5, ký hiệu khác → 0. */
    public static double wfhUnits(String raw) {
        String base = normalize(raw);
        if (base == null) return 0;
        String upper = base.toUpperCase();
        if ("R".equals(upper)) return 1.0;
        int slash = upper.indexOf('/');
        if (slash < 0) return 0;
        String left = upper.substring(0, slash), right = upper.substring(slash + 1);
        if ("R".equals(left) && right.matches("\\d+(\\.\\d+)?")) return Double.parseDouble(right);
        if ("R".equals(right) && left.matches("\\d+(\\.\\d+)?")) return Double.parseDouble(left);
        return 0;
    }

    /**
     * Mã loại nghỉ của ô (AL, S, RO, UP, ML, PL, CL…), null nếu ô là số công/WFH/rỗng.
     * Ký hiệu dạng {@code CODE/0.50} trả về CODE.
     */
    public static String leaveCode(String raw) {
        String base = normalize(raw);
        if (base == null) return null;
        String upper = base.toUpperCase();
        if (upper.matches("\\d+(\\.\\d+)?") || upper.startsWith("R")) return null;
        int slash = upper.indexOf('/');
        if (slash < 0) return upper;
        String left = upper.substring(0, slash), right = upper.substring(slash + 1);
        boolean leftNumeric = left.matches("\\d+(\\.\\d+)?"), rightNumeric = right.matches("\\d+(\\.\\d+)?");
        if (leftNumeric && !rightNumeric) return right.isEmpty() ? null : right;
        if (rightNumeric && !leftNumeric) return left.isEmpty() ? null : left;
        return left.isEmpty() ? null : left;
    }

    /** Số ngày nghỉ của ô có mã loại nghỉ: AL → 1, AL/0.50 → 0.5, S → 1. */
    public static double leaveUnits(String raw) {
        String base = normalize(raw);
        if (base == null || leaveCode(base) == null) return 0;
        int slash = base.indexOf('/');
        if (slash < 0) return 1.0;
        double units = numberAfterSlash(base, slash);
        return units > 0 ? units : 1.0;
    }

    private static double numberAfterSlash(String base, int slash) {
        String numeric = slash >= 0 ? base.substring(slash + 1) : base;
        try {
            return Double.parseDouble(numeric);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }
}
