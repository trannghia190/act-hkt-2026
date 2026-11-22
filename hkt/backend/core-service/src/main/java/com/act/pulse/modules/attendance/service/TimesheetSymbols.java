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
     * Số ngày công của một ô: 1.00 → 1, 0.50 → 0.5, R (WFH cả ngày) → 1.
     * Ô nửa ngày ghép hai buổi — R/0.50, 0.50/R, AL/0.50, 0.50/AL, AL/R — tính 0.5 vì buổi
     * còn lại vẫn là ngày công (WFH hoặc đi làm). Ký hiệu nghỉ cả ngày (AL, S, NL…) → 0.
     */
    public static double workUnits(String raw) {
        String base = normalize(raw);
        if (base == null) return 0;
        if ("R".equalsIgnoreCase(base)) return 1.0;
        int slash = base.indexOf('/');
        if (slash < 0) return base.matches("\\d+(\\.\\d+)?") ? Double.parseDouble(base) : 0;
        String left = base.substring(0, slash).trim().toUpperCase();
        String right = base.substring(slash + 1).trim().toUpperCase();
        if (left.matches("\\d+(\\.\\d+)?")) return Double.parseDouble(left);
        if (right.matches("\\d+(\\.\\d+)?")) return Double.parseDouble(right);
        if ("R".equals(left) || "R".equals(right)) return 0.5;
        return 0;
    }

    /**
     * Số ngày phép năm (AL) của một ô: AL → 1, AL/0.50 hoặc 0.50/AL → 0.5,
     * AL/R hoặc R/AL (nửa phép + nửa WFH) → 0.5. Nghỉ ốm/chế độ/không lương (S, RO, UP,
     * ML…) trả 0 — không trừ vào phép năm.
     */
    public static double annualLeaveUnits(String raw) {
        String base = normalize(raw);
        if (base == null) return 0;
        String upper = base.toUpperCase();
        if ("AL".equals(upper)) return 1.0;
        int slash = upper.indexOf('/');
        if (slash < 0) return 0;
        String left = upper.substring(0, slash).trim(), right = upper.substring(slash + 1).trim();
        if ("AL".equals(left) && right.matches("\\d+(\\.\\d+)?")) return Double.parseDouble(right);
        if ("AL".equals(right) && left.matches("\\d+(\\.\\d+)?")) return Double.parseDouble(left);
        if ("AL".equals(left) || "AL".equals(right)) return 0.5;
        return 0;
    }

    /**
     * Số ngày WFH của một ô: R → 1, R/0.50 hoặc 0.50/R → 0.5.
     * Ô nửa nghỉ + nửa WFH (AL/R, S/R, R/AL…) tính 0.5; ký hiệu khác → 0.
     */
    public static double wfhUnits(String raw) {
        String base = normalize(raw);
        if (base == null) return 0;
        String upper = base.toUpperCase();
        if ("R".equals(upper)) return 1.0;
        int slash = upper.indexOf('/');
        if (slash < 0) return 0;
        String left = upper.substring(0, slash).trim(), right = upper.substring(slash + 1).trim();
        boolean leftNumeric = left.matches("\\d+(\\.\\d+)?"), rightNumeric = right.matches("\\d+(\\.\\d+)?");
        if ("R".equals(left) && !rightNumeric) return 0.5;
        if ("R".equals(right) && !leftNumeric) return 0.5;
        if ("R".equals(left)) return Double.parseDouble(right);
        if ("R".equals(right)) return Double.parseDouble(left);
        return 0;
    }

    /**
     * Mã loại nghỉ của ô (AL, S, RO, UP, ML, PL, CL…), null nếu ô là số công/WFH/rỗng.
     * Ký hiệu dạng {@code CODE/0.50} trả về CODE; ô ghép nửa nghỉ nửa WFH (AL/R, R/AL) vẫn ra CODE.
     */
    public static String leaveCode(String raw) {
        String base = normalize(raw);
        if (base == null) return null;
        String upper = base.toUpperCase();
        if (upper.matches("\\d+(\\.\\d+)?")) return null;
        int slash = upper.indexOf('/');
        if (slash < 0) return "R".equals(upper) ? null : upper;
        String left = upper.substring(0, slash).trim(), right = upper.substring(slash + 1).trim();
        boolean leftNumeric = left.matches("\\d+(\\.\\d+)?"), rightNumeric = right.matches("\\d+(\\.\\d+)?");
        String code;
        if (leftNumeric) code = rightNumeric ? "" : right;          // 0.50/AL → AL
        else if (rightNumeric) code = left;                          // AL/0.50 → AL
        else if ("R".equals(left)) code = right;                     // R/AL → AL
        else code = left;                                            // AL/R → AL
        return code.isEmpty() || "R".equals(code) ? null : code;
    }

    /**
     * Buổi của đơn nửa ngày đọc từ payload đơn: "MORNING" | "AFTERNOON" | null (đơn cả ngày).
     * Quy ước payload của luồng đơn thường và luồng khiếu nại giống nhau: có khoá
     * {@code half_day_period} là đơn nửa ngày.
     */
    public static String halfDayPeriod(String payload) {
        if (payload == null || !payload.contains("half_day_period")) return null;
        return payload.contains("AFTERNOON") ? "AFTERNOON" : "MORNING";
    }

    /** Buổi còn lại của ngày khi đã nghỉ/WFH một buổi: MORNING → AFTERNOON và ngược lại. */
    public static String otherHalf(String half) {
        return "MORNING".equals(half) ? "AFTERNOON" : "MORNING";
    }

    /**
     * Số ngày nghỉ của ô có mã loại nghỉ: AL → 1, S → 1, AL/0.50 → 0.5, AL/R → 0.5
     * (nửa nghỉ + nửa WFH). Ô chỉ có WFH (R, R/0.50) → 0.
     */
    public static double leaveUnits(String raw) {
        String base = normalize(raw);
        if (base == null) return 0;
        String code = leaveCode(base);
        if (code == null || "R".equals(code)) return 0;
        int slash = base.indexOf('/');
        if (slash < 0) return 1.0;
        String right = base.substring(slash + 1).trim().toUpperCase();
        if ("R".equals(right)) return 0.5;
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
