package com.act.pulse.modules.notification.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Registry chuẩn của các sự kiện thông báo (S36).
 * <p>Một nguồn sự thật duy nhất cho: nhãn hiển thị trên UI, nhóm nghiệp vụ và
 * kênh mặc định. Mọi sự kiện trong danh mục đều có producer thật (xem
 * {@code NotificationReminderJob} cho các mốc nhắc theo lịch).</p>
 */
public final class NotificationEventCatalog {

    /** Nhóm nghiệp vụ. */
    public static final String CATEGORY_ATTENDANCE = "ATTENDANCE";
    public static final String CATEGORY_REQUEST = "REQUEST";
    public static final String CATEGORY_OKR = "OKR";
    public static final String CATEGORY_TIMESHEET = "TIMESHEET";
    public static final String CATEGORY_SYSTEM = "SYSTEM";

    /** Vai trò nhận sự kiện — dùng để lọc danh mục cấu hình theo người dùng. */
    public static final String ROLE_EMPLOYEE = "EMPLOYEE";
    public static final String ROLE_MANAGER = "MANAGER";
    public static final String ROLE_HR = "HR";

    /** Một sự kiện trong ma trận bật/tắt. */
    public record EventDef(String key, String label, String category,
                            boolean defaultWeb, boolean defaultEmail, boolean defaultPush,
                            Set<String> roles) {}

    private static final Map<String, EventDef> EVENTS = new LinkedHashMap<>();

    /** Sự kiện áp dụng cho mọi nhân viên (mặc định). */
    private static void def(String key, String label, String category,
                            boolean web, boolean email, boolean push) {
        defFor(Set.of(ROLE_EMPLOYEE), key, label, category, web, email, push);
    }

    /** Sự kiện chỉ áp dụng cho một số vai trò; HR vẫn thấy sự kiện EMPLOYEE của chính họ. */
    private static void defFor(Set<String> roles, String key, String label, String category,
                               boolean web, boolean email, boolean push) {
        EVENTS.put(key, new EventDef(key, label, category, web, email, push, roles));
    }

    static {
        // ── Chấm công ───────────────────────────────────────────────────────
        def("MISSING_CHECKIN", "Chưa check-in khi quá 30 phút", CATEGORY_ATTENDANCE, true, false, true);
        def("MISSING_CHECKOUT", "Chưa check-out khi quá 30 phút", CATEGORY_ATTENDANCE, true, false, true);
        def("FORGOT_ATTENDANCE", "Quên chấm công 2 ngày liên tiếp", CATEGORY_ATTENDANCE, true, true, true);
        def("ADJUST_DEADLINE_SOON", "Hạn nộp đơn bổ sung công sắp tới", CATEGORY_ATTENDANCE, true, false, true);
        def("ADJUST_OVERDUE", "Hạn nộp đơn bổ sung công quá hạn", CATEGORY_ATTENDANCE, true, true, true);
        // ── Đơn từ & phép ───────────────────────────────────────────────────
        defFor(Set.of(ROLE_MANAGER),
                "APPROVAL_OVERDUE", "Đơn chờ duyệt quá hạn SLA 48h", CATEGORY_REQUEST, true, true, true);
        defFor(Set.of(ROLE_MANAGER),
                "REQUEST_SUBMITTED", "Đơn mới được nộp (cần duyệt)", CATEGORY_REQUEST, true, false, true);
        def("REQUEST_APPROVED", "Đơn của tôi được duyệt", CATEGORY_REQUEST, true, false, true);
        def("REQUEST_REJECTED", "Đơn của tôi bị từ chối / trả lại", CATEGORY_REQUEST, true, false, true);
        def("LEAVE_EXPIRY_SOON", "Phép tồn năm sắp hết hạn", CATEGORY_REQUEST, true, false, true);
        def("WFH_MISSING_REPORT", "Đơn WFH chưa gửi báo cáo cuối ngày", CATEGORY_REQUEST, true, false, true);
        defFor(Set.of(ROLE_HR),
                "DISPUTE_RAISED", "Khiếu nại bảng công cần xử lý", CATEGORY_REQUEST, true, false, true);
        def("DISPUTE_RESOLVED", "Khiếu nại bảng công đã được xử lý", CATEGORY_REQUEST, true, false, true);
        def("DISPUTE_REJECTED", "Khiếu nại bảng công bị từ chối", CATEGORY_REQUEST, true, false, true);
        // ── OKR ─────────────────────────────────────────────────────────────
        def("OKR_CHECKIN_DUE", "Check-in tiến độ OKR đến hạn", CATEGORY_OKR, true, false, true);
        def("OKR_NOT_CREATED", "Chưa thiết lập mục tiêu OKR quý", CATEGORY_OKR, true, true, true);
        def("OKR_SELF_ASSESSMENT", "Tự đánh giá OKR cuối năm đến hạn", CATEGORY_OKR, true, false, true);
        def("OKR_OBJECTIVE_RETURNED", "Mục tiêu OKR bị trả lại cần sửa", CATEGORY_OKR, true, false, true);
        // Vòng đời OKR — producer gửi với type = event key nên bật/tắt được từng bước.
        def("OKR_SETUP_OPEN", "Mở kỳ thiết lập mục tiêu OKR", CATEGORY_OKR, true, false, true);
        defFor(Set.of(ROLE_MANAGER),
                "OKR_SUBMITTED", "OKR được nộp chờ duyệt", CATEGORY_OKR, true, false, true);
        def("OKR_APPROVED", "OKR được quản lý duyệt", CATEGORY_OKR, true, false, true);
        defFor(Set.of(ROLE_MANAGER),
                "OKR_WITHDRAWN", "OKR bị rút lại", CATEGORY_OKR, true, false, true);
        def("OKR_REOPENED", "OKR được mở lại để bổ sung", CATEGORY_OKR, true, false, true);
        defFor(Set.of(ROLE_MANAGER),
                "OKR_SELF_ASSESSED", "Người lao động đã tự đánh giá OKR", CATEGORY_OKR, true, false, true);
        def("OKR_ASSESSED", "Quản lý đã chấm điểm OKR", CATEGORY_OKR, true, false, true);
        def("OKR_ADJUSTED", "OKR được điều chỉnh giữa năm", CATEGORY_OKR, true, false, true);
        def("OKR_MIDYEAR", "Cập nhật biên bản coaching giữa năm", CATEGORY_OKR, true, false, true);
        def("OKR_DEADLINE_SETUP", "Sắp hết hạn thiết lập OKR", CATEGORY_OKR, true, false, true);
        defFor(Set.of(ROLE_MANAGER),
                "OKR_DEADLINE_MIDYEAR", "Sắp hết hạn coaching giữa năm", CATEGORY_OKR, true, false, true);
        defFor(Set.of(ROLE_EMPLOYEE, ROLE_MANAGER),
                "OKR_DEADLINE_FINAL", "Sắp hết hạn đánh giá cuối năm", CATEGORY_OKR, true, false, true);
        defFor(Set.of(ROLE_HR),
                "OKR_DEADLINE_SUMMARY", "Sắp hết hạn tổng hợp OKR", CATEGORY_OKR, true, false, true);
        // ── Bảng công ───────────────────────────────────────────────────────
        def("TIMESHEET_CLOSED", "Bảng công vừa chốt (khiếu nại 2 ngày)", CATEGORY_TIMESHEET, true, true, true);
        defFor(Set.of(ROLE_HR),
                "TIMESHEET_COMPLAINT_EXPIRING", "Sắp hết hạn khiếu nại bảng công", CATEGORY_TIMESHEET, true, false, true);
        // ── Hệ thống ────────────────────────────────────────────────────────
        defFor(Set.of(ROLE_HR),
                "HR_CLOSE_TIMESHEET", "Nhắc HR chốt bảng công kỳ này", CATEGORY_SYSTEM, true, true, true);
        defFor(Set.of(ROLE_HR),
                "HR_UNLOCK_OKR", "Nhắc HR mở khóa điều chỉnh OKR", CATEGORY_SYSTEM, true, true, true);
        def("ONBOARDING", "Chào mừng tài khoản mới", CATEGORY_SYSTEM, true, true, false);
    }

    private NotificationEventCatalog() {}

    public static List<EventDef> all() {
        return List.copyOf(EVENTS.values());
    }

    /**
     * Sự kiệnphù hợp với người dùng hiện tại.
     * <p>Mọi tài khoản đều là nhân viên nên luôn thấy sự kiện {@link #ROLE_EMPLOYEE};
     * người có cấp dưới trực tiếp thấy thêm sự kiện quản lý; ADMIN/HR_ADMIN thấy
     * thêm sự kiện HR.</p>
     */
    public static List<EventDef> allFor(boolean manager, boolean hr) {
        return EVENTS.values().stream()
                .filter(def -> def.roles().contains(ROLE_EMPLOYEE)
                        || (manager && def.roles().contains(ROLE_MANAGER))
                        || (hr && def.roles().contains(ROLE_HR)))
                .toList();
    }

    public static EventDef get(String key) {
        return EVENTS.get(key);
    }

    public static boolean exists(String key) {
        return EVENTS.containsKey(key);
    }

    /** Nhãn hiển thị của một nhóm sự kiện (dùng cho bộ lọc hộp thư). */
    public static String categoryLabel(String category) {
        if (category == null) return null;
        return switch (category) {
            case CATEGORY_ATTENDANCE -> "Chấm công";
            case CATEGORY_REQUEST -> "Đơn từ & phép";
            case CATEGORY_OKR -> "OKR";
            case CATEGORY_TIMESHEET -> "Bảng công";
            case CATEGORY_SYSTEM -> "Hệ thống";
            default -> category;
        };
    }

    /** Các event key thuộc một nhóm — dùng để lọc hộp thư theo nhóm. */
    public static List<String> keysInCategory(String category) {
        if (category == null) return List.of();
        return EVENTS.values().stream()
                .filter(def -> category.equalsIgnoreCase(def.category()))
                .map(EventDef::key)
                .toList();
    }

    /**
     * Nhóm của thông báo CŨ chỉ có {@code type}, chưa có {@code eventKey}.
     * Giữ khớp với cách phân nhóm của các producer hiện tại.
     */
    public static String categoryForType(String type) {
        if (type == null || type.isBlank()) return null;
        String t = type.trim().toUpperCase();
        if (t.startsWith("OKR")) return CATEGORY_OKR;
        return switch (t) {
            case "ATTENDANCE" -> CATEGORY_ATTENDANCE;
            case "REQUEST", "DISPUTE" -> CATEGORY_REQUEST;
            case "TIMESHEET" -> CATEGORY_TIMESHEET;
            case "ONBOARDING", "SYSTEM", "MANUAL" -> CATEGORY_SYSTEM;
            default -> null;
        };
    }

    /** Các giá trị {@code type} cũ thuộc một nhóm — lọc được cả thông báo trước khi có eventKey. */
    public static List<String> legacyTypesInCategory(String category) {
        if (category == null) return List.of();
        List<String> types = new java.util.ArrayList<>();
        for (String t : List.of("ATTENDANCE", "REQUEST", "DISPUTE", "TIMESHEET",
                "ONBOARDING", "SYSTEM", "MANUAL")) {
            if (category.equalsIgnoreCase(categoryForType(t))) types.add(t);
        }
        if (category.equalsIgnoreCase(CATEGORY_OKR)) {
            types.add("OKR");
            types.add("OKR_SETUP_OPEN");
        }
        return types;
    }

    /** Map mặc định web/email/push cho toàn bộ sự kiện — dùng khi tạo pref lần đầu. */
    public static Map<String, Map<String, Boolean>> defaultChannelMap() {
        Map<String, Map<String, Boolean>> out = new LinkedHashMap<>();
        for (EventDef e : EVENTS.values()) {
            out.put(e.key(), Map.of("web", e.defaultWeb(), "email", e.defaultEmail(), "push", e.defaultPush()));
        }
        return out;
    }
}
