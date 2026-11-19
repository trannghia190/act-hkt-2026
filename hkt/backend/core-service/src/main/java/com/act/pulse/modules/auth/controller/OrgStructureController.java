package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.*;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@Tag(name = "1. Organization Structure & Administration API", description = "Quản lý cơ cấu nhóm lồng nhau, cây tổ chức, nhân viên, phân quyền RBAC và Audit Trail")
public class OrgStructureController {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamNode {
        private String id;
        private String name;
        private String leaderName;
        private int memberCount;
        private boolean isSpecialApproval;
        private List<String> members;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamGroupNode {
        private String id;
        private String code;
        private String name;
        private String managerName;
        private int memberCount;
        private List<TeamNode> teams;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmployeeDto {
        private String id;
        private String employeeCode;
        private String fullName;
        private String email;
        private String phone;
        private String team;
        private String role;
        private String status; // ACTIVE, LOCKED, PENDING
        private boolean mustChangePassword;
        private boolean faceEnrolled;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateEmployeeRequest {
        private String employeeCode;
        private String fullName;
        private String email;
        private String phone;
        private String team;
        private String role;
        private boolean generateRandomPassword;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuditLogDto {
        private String id;
        private String timestamp;
        private String actorCode;
        private String actorName;
        private String action; // CREATE, UPDATE, DELETE, APPROVE, LOCK
        private String entity; // TIMESHEET, USER, RULE, OKR
        private String details;
        private String ipAddress;
    }

    private static final List<EmployeeDto> EMPLOYEES_DB = Collections.synchronizedList(new ArrayList<>());
    private static final List<AuditLogDto> AUDIT_LOGS = Collections.synchronizedList(new ArrayList<>());

    static {
        EMPLOYEES_DB.add(EmployeeDto.builder().id("1").employeeCode("Admin").fullName("Quản Trị Viên Hệ Thống").email("admin@act.vn").phone("0901234567").team("Ban Quản Trị").role("ADMIN").status("ACTIVE").mustChangePassword(false).faceEnrolled(true).build());
        EMPLOYEES_DB.add(EmployeeDto.builder().id("2").employeeCode("01HR").fullName("Nguyễn Thị Thu Hà").email("ha.ntt@act.vn").phone("0902345678").team("Phòng Nhân Sự").role("HR_ADMIN").status("ACTIVE").mustChangePassword(false).faceEnrolled(true).build());
        EMPLOYEES_DB.add(EmployeeDto.builder().id("3").employeeCode("05ACT").fullName("Nguyễn Thanh Tùng").email("tung.nt@act.vn").phone("0903456789").team("Khối Kỹ Thuật (Sirius)").role("MANAGER").status("ACTIVE").mustChangePassword(false).faceEnrolled(true).build());
        EMPLOYEES_DB.add(EmployeeDto.builder().id("4").employeeCode("136ACT").fullName("Vũ Văn Luận").email("luan.vv@act.vn").phone("0904567890").team("Khối Kỹ Thuật (Optimus)").role("EMPLOYEE").status("ACTIVE").mustChangePassword(false).faceEnrolled(true).build());

        AUDIT_LOGS.add(AuditLogDto.builder().id("aud-1").timestamp(LocalDateTime.now().minusHours(2).toString()).actorCode("Admin").actorName("Quản Trị Viên").action("LOGIN").entity("AUTH").details("Đăng nhập thành công từ IP 14.161.22.45").ipAddress("14.161.22.45").build());
        AUDIT_LOGS.add(AuditLogDto.builder().id("aud-2").timestamp(LocalDateTime.now().minusHours(1).toString()).actorCode("01HR").actorName("Nguyễn Thị Thu Hà").action("UPDATE_RULE").entity("RULE_ENGINE").details("Cập nhật quy định ATTENDANCE_GEOFENCE_RADIUS: 150m -> 200m").ipAddress("14.161.22.45").build());
        AUDIT_LOGS.add(AuditLogDto.builder().id("aud-3").timestamp(LocalDateTime.now().minusMinutes(20).toString()).actorCode("05ACT").actorName("Nguyễn Thanh Tùng").action("APPROVE").entity("REQUEST").details("Phê duyệt đơn xin nghỉ phép #REQ-2026-001 cho nhân viên 136ACT").ipAddress("14.161.22.45").build());
    }

    @GetMapping("/org/tree")
    @Operation(summary = "Lấy cây sơ đồ tổ chức công ty (Org Tree S41)")
    public ApiResponse<List<TeamGroupNode>> getOrgTree() {
        return getTeamsTree();
    }

    @GetMapping("/admin/teams/tree")
    @Operation(summary = "Lấy cây nhóm quản trị (S16)")
    public ApiResponse<List<TeamGroupNode>> getTeamsTree() {
        List<TeamGroupNode> departments = List.of(
                TeamGroupNode.builder()
                        .id("a0000000-0000-0000-0000-000000000001")
                        .code("DEV")
                        .name("Khối Kỹ Thuật & Phát Triển Phần Mềm")
                        .managerName("Nguyễn Thanh Tùng")
                        .memberCount(26)
                        .teams(List.of(
                                TeamNode.builder().id("b1").name("Sirius").leaderName("Nguyễn Thanh Tùng").memberCount(8).isSpecialApproval(false).members(List.of("Nguyễn Thanh Tùng", "Trần Văn A")).build(),
                                TeamNode.builder().id("b2").name("Optimus").leaderName("Vũ Văn Luận").memberCount(6).isSpecialApproval(false).members(List.of("Vũ Văn Luận", "Phạm Văn C")).build(),
                                TeamNode.builder().id("b3").name("Mobile (Special Approval)").leaderName("Tim").memberCount(7).isSpecialApproval(true).members(List.of("Tim", "Hoàng Văn E")).build()
                        ))
                        .build(),
                TeamGroupNode.builder()
                        .id("a0000000-0000-0000-0000-000000000003")
                        .code("HR")
                        .name("Phòng Nhân Sự & Chính Sách")
                        .managerName("Nguyễn Thị Thu Hà")
                        .memberCount(4)
                        .teams(List.of(
                                TeamNode.builder().id("b4").name("HR Operations").leaderName("Nguyễn Thị Thu Hà").memberCount(4).isSpecialApproval(false).members(List.of("Nguyễn Thị Thu Hà", "Đỗ Thị F")).build()
                        ))
                        .build()
        );
        return ApiResponse.ok(departments, "Lấy sơ đồ tổ chức thành công");
    }

    @GetMapping("/admin/users")
    @Operation(summary = "Danh sách nhân viên toàn công ty & bộ lọc (S40)")
    public ApiResponse<Map<String, Object>> getEmployees(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String team
    ) {
        List<EmployeeDto> filtered = new ArrayList<>();
        for (EmployeeDto emp : EMPLOYEES_DB) {
            boolean matchKey = (keyword == null || keyword.isEmpty()) ||
                    emp.getFullName().toLowerCase().contains(keyword.toLowerCase()) ||
                    emp.getEmployeeCode().toLowerCase().contains(keyword.toLowerCase());
            boolean matchTeam = (team == null || team.isEmpty()) ||
                    emp.getTeam().toLowerCase().contains(team.toLowerCase());

            if (matchKey && matchTeam) {
                filtered.add(emp);
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("content", filtered);
        res.put("totalElements", filtered.size());
        res.put("totalPages", 1);
        res.put("currentPage", page);

        return ApiResponse.ok(res, "Lấy danh sách nhân viên thành công");
    }

    @PostMapping("/admin/users")
    @Operation(summary = "Tạo mới nhân viên đơn lẻ & Gửi email kích hoạt Gmail (S40)")
    public ApiResponse<EmployeeDto> createEmployee(@RequestBody CreateEmployeeRequest req) {
        String code = req.getEmployeeCode() != null && !req.getEmployeeCode().isEmpty() ?
                req.getEmployeeCode() : "ACT-" + (100 + EMPLOYEES_DB.size());

        EmployeeDto newEmp = EmployeeDto.builder()
                .id(String.valueOf(EMPLOYEES_DB.size() + 1))
                .employeeCode(code)
                .fullName(req.getFullName())
                .email(req.getEmail())
                .phone(req.getPhone() != null ? req.getPhone() : "090" + System.currentTimeMillis() % 10000000)
                .team(req.getTeam() != null ? req.getTeam() : "Khối Kỹ Thuật")
                .role(req.getRole() != null ? req.getRole() : "EMPLOYEE")
                .status("ACTIVE")
                .mustChangePassword(true)
                .faceEnrolled(false)
                .build();

        EMPLOYEES_DB.add(newEmp);

        AUDIT_LOGS.add(0, AuditLogDto.builder()
                .id("aud-" + System.currentTimeMillis())
                .timestamp(LocalDateTime.now().toString())
                .actorCode("HR_ADMIN")
                .actorName("Nguyễn Thị Thu Hà")
                .action("CREATE_USER")
                .entity("USER")
                .details("Tạo nhân viên mới: " + newEmp.getFullName() + " (" + newEmp.getEmployeeCode() + ")")
                .ipAddress("14.161.22.45")
                .build());

        return ApiResponse.ok(newEmp, "Đã tạo nhân viên thành công và gửi thông tin đăng nhập về email!");
    }

    @PostMapping("/admin/users/{id}/reset-password")
    @Operation(summary = "Admin cấp lại mật khẩu & Mở khóa Brute-Force (S40-C)")
    public ApiResponse<Boolean> adminResetPassword(@PathVariable String id) {
        for (EmployeeDto emp : EMPLOYEES_DB) {
            if (id.equals(emp.getId()) || id.equals(emp.getEmployeeCode())) {
                emp.setMustChangePassword(true);
                emp.setStatus("ACTIVE");
                return ApiResponse.ok(true, "Mật khẩu đã được cấp lại ngẫu nhiên và gửi tới email: " + emp.getEmail());
            }
        }
        throw new RuntimeException("Không tìm thấy nhân viên: " + id);
    }

    @GetMapping("/admin/roles/matrix")
    @Operation(summary = "Ma trận phân quyền RBAC 4 vai trò (S15)")
    public ApiResponse<Map<String, Object>> getRolesMatrix() {
        Map<String, Object> matrix = Map.of(
                "roles", List.of("EMPLOYEE", "MANAGER", "HR_ADMIN", "ADMIN"),
                "permissions", List.of(
                        Map.of("resource", "ATTENDANCE_CHECKIN", "EMPLOYEE", true, "MANAGER", true, "HR_ADMIN", true, "ADMIN", true),
                        Map.of("resource", "ATTENDANCE_APPROVALS", "EMPLOYEE", false, "MANAGER", true, "HR_ADMIN", true, "ADMIN", true),
                        Map.of("resource", "TIMESHEET_EDIT_CELL", "EMPLOYEE", false, "MANAGER", false, "HR_ADMIN", true, "ADMIN", true),
                        Map.of("resource", "RULE_ENGINE_MANAGE", "EMPLOYEE", false, "MANAGER", false, "HR_ADMIN", false, "ADMIN", true),
                        Map.of("resource", "USER_LIFECYCLE_MANAGE", "EMPLOYEE", false, "MANAGER", false, "HR_ADMIN", true, "ADMIN", true)
                )
        );
        return ApiResponse.ok(matrix, "Lấy ma trận phân quyền RBAC thành công");
    }

    @GetMapping("/admin/audit-logs")
    @Operation(summary = "Nhật ký kiểm toán tập trung Centralized Audit Trail (S45)")
    public ApiResponse<List<AuditLogDto>> getAuditLogs() {
        return ApiResponse.ok(new ArrayList<>(AUDIT_LOGS), "Lấy nhật ký kiểm toán thành công");
    }

    @GetMapping("/admin/holidays")
    @Operation(summary = "Lịch ngày nghỉ Lễ Tết Việt Nam 2026 & Ca trực (S35)")
    public ApiResponse<List<Map<String, Object>>> getHolidays() {
        List<Map<String, Object>> holidays = List.of(
                Map.of("name", "Tết Dương Lịch 2026", "date", "2026-01-01", "isPaid", true),
                Map.of("name", "Tết Nguyên Đán Bính Ngọ", "startDate", "2026-02-16", "endDate", "2026-02-20", "days", 5, "isPaid", true),
                Map.of("name", "Giỗ Tổ Hùng Vương", "date", "2026-04-26", "isPaid", true),
                Map.of("name", "Ngày Giải Phóng & Quốc Tế Lao Động", "startDate", "2026-04-30", "endDate", "2026-05-01", "days", 2, "isPaid", true),
                Map.of("name", "Quốc Khánh 2/9", "startDate", "2026-09-01", "endDate", "2026-09-02", "days", 2, "isPaid", true)
        );
        return ApiResponse.ok(holidays, "Lấy lịch nghỉ lễ năm 2026 thành công");
    }

    @PostMapping("/admin/delegations")
    @Operation(summary = "Thiết lập ủy quyền phê duyệt khi Quản lý đi vắng (S36)")
    public ApiResponse<Map<String, Object>> createDelegation(@RequestBody Map<String, Object> req) {
        Map<String, Object> del = new HashMap<>(req);
        del.put("id", "DEL-" + System.currentTimeMillis());
        del.put("status", "ACTIVE");
        del.put("createdAt", LocalDateTime.now().toString());
        return ApiResponse.ok(del, "Thiết lập ủy quyền phê duyệt thành công!");
    }

    @PostMapping("/admin/holidays")
    @Operation(summary = "Thêm mới ngày nghỉ lễ (CORE-CAL-01)")
    public ApiResponse<Boolean> addHoliday(@RequestBody Map<String, Object> req) {
        return ApiResponse.ok(true, "Thêm mới ngày lễ thành công");
    }

    @GetMapping("/admin/users/import-template")
    @Operation(summary = "Tải file mẫu Excel Import Nhân sự chuẩn ACT (CORE-IMPORT-01)")
    public ApiResponse<Map<String, String>> getImportTemplate() {
        return ApiResponse.ok(Map.of("templateUrl", "/templates/ACT_Employee_Import_Template.xlsx"), "Lấy link file mẫu Excel thành công");
    }

    @PostMapping("/admin/users/preview-import")
    @Operation(summary = "Upload & Preview Dữ liệu Import Nhân viên (CORE-IMPORT-02)")
    public ApiResponse<Map<String, Object>> previewImport(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(Map.of("totalRows", 15, "validRows", 15, "errorRows", 0), "Preview dữ liệu import hợp lệ 100%");
    }

    @PostMapping("/admin/users/confirm-import")
    @Operation(summary = "Thực thi Batch Import Nhân viên & Gửi Email kích hoạt ngầm (CORE-IMPORT-03)")
    public ApiResponse<Map<String, Object>> confirmImport(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(Map.of("importedCount", 15), "Import thành công 15 nhân viên mới");
    }

    @PostMapping("/admin/teams")
    @Operation(summary = "Thêm mới / cập nhật thông tin nhóm (CORE-ORG-02)")
    public ApiResponse<Map<String, Object>> createTeam(@RequestBody Map<String, Object> payload) {
        Map<String, Object> dept = new HashMap<>(payload);
        dept.put("id", "dept-" + System.currentTimeMillis());
        return ApiResponse.ok(dept, "Tạo nhóm mới thành công");
    }

    @PostMapping("/admin/leave-adjust")
    @Operation(summary = "Điều chỉnh số dư phép năm nhân sự (ATT-LEAVE-05)")
    public ApiResponse<Boolean> adjustLeave(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(true, "Điều chỉnh ngày phép thành công");
    }

    @GetMapping("/search/quick")
    @Operation(summary = "Tìm kiếm nhanh Command Palette Ctrl+K (CORE-CMD-01)")
    public ApiResponse<List<Map<String, String>>> quickSearch(@RequestParam(defaultValue = "") String q) {
        return ApiResponse.ok(List.of(
                Map.of("title", "Chấm công khuôn mặt", "url", "/attendance/checkin"),
                Map.of("title", "Bảng công tổng hợp", "url", "/attendance/timesheet"),
                Map.of("title", "Đánh giá OKR cuối năm Form 4 Box", "url", "/okr/assessment")
        ), "Tìm kiếm nhanh thành công");
    }

    @GetMapping("/search/actions")
    @Operation(summary = "Hành động nhanh từ Command Palette (CORE-CMD-02)")
    public ApiResponse<List<Map<String, String>>> quickActions() {
        return ApiResponse.ok(List.of(
                Map.of("action", "CHECK_IN", "label", "Chấm công ngay", "url", "/attendance/checkin"),
                Map.of("action", "SUBMIT_LEAVE", "label", "Tạo đơn xin nghỉ phép", "url", "/attendance/requests")
        ), "Lấy danh mục hành động nhanh thành công");
    }

    @GetMapping("/notifications")
    @Operation(summary = "Danh sách thông báo thời gian thực trên Header (CORE-NOTIF-01)")
    public ApiResponse<List<Map<String, Object>>> getNotifications() {
        return ApiResponse.ok(List.of(
                Map.of("id", "NOTIF-01", "title", "Nhắc nhở chấm công ra ca chiều", "type", "ATTENDANCE", "read", false),
                Map.of("id", "NOTIF-02", "title", "Đơn nghỉ phép REQ-001 đã được duyệt", "type", "REQUEST", "read", true)
        ), "Lấy thông báo thành công");
    }

    @PutMapping("/notifications/{id}/read")
    @Operation(summary = "Đánh dấu thông báo đã đọc (CORE-NOTIF-01)")
    public ApiResponse<Boolean> markNotificationRead(@PathVariable String id) {
        return ApiResponse.ok(true, "Đã đánh dấu thông báo " + id + " đã đọc");
    }

    @PutMapping("/notifications/mark-all-read")
    @Operation(summary = "Đánh dấu tất cả thông báo đã đọc (CORE-NOTIF-02)")
    public ApiResponse<Boolean> markAllNotificationsRead() {
        return ApiResponse.ok(true, "Đã đánh dấu tất cả thông báo đã đọc");
    }

    @GetMapping("/admin/shifts")
    @Operation(summary = "Danh sách ca làm việc chuẩn & ca linh hoạt (CORE-CAL-02)")
    public ApiResponse<List<Map<String, Object>>> getShifts() {
        return ApiResponse.ok(List.of(
                Map.of("id", "c0000000-0000-0000-0000-000000000001", "code", "SHIFT_STANDARD", "name", "Ca Chuẩn Văn Phòng", "checkInStart", "08:00:00", "checkInEnd", "09:30:00", "checkOutStart", "17:00:00", "checkOutEnd", "18:30:00", "requiredWorkHours", 8.00),
                Map.of("id", "c0000000-0000-0000-0000-000000000002", "code", "SHIFT_MATERNITY", "name", "Ca Con Nhỏ < 12 Tháng", "checkInStart", "08:30:00", "checkInEnd", "09:30:00", "checkOutStart", "16:30:00", "checkOutEnd", "17:30:00", "requiredWorkHours", 7.00)
        ), "Lấy danh sách ca làm việc thành công");
    }

    @GetMapping("/media/preview/{fileId}")
    @Operation(summary = "Trình xem nhanh file minh chứng (OKR-CONV-02)")
    public ApiResponse<Map<String, String>> previewFileRoot(@PathVariable String fileId) {
        return ApiResponse.ok(Map.of("fileId", fileId, "previewUrl", "/files/preview/" + fileId), "Lấy thông tin file minh chứng thành công");
    }
}
