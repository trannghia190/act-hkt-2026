package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.controller.RequestController;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.Shift;
import com.act.pulse.modules.attendance.entity.TodoCompletion;
import com.act.pulse.modules.attendance.entity.TodoCustomTask;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.HolidayRepository;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.TodoCompletionRepository;
import com.act.pulse.modules.attendance.repository.TodoCustomTaskRepository;
import com.act.pulse.modules.attendance.service.LeaveBalanceService;
import com.act.pulse.modules.attendance.service.ShiftResolver;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping({ "/todos", "/todo" })
@Tag(name = "1. Todo Inbox API", description = "Màn hình việc cần làm trung tâm S02, Quick Action & Batch Approvals")
@RequiredArgsConstructor
public class TodoController {

    private final UserRepository userRepository;
    private final RequestRepository requestRepository;
    private final LeaveLedgerRepository leaveLedgerRepository;
    private final TodoCompletionRepository todoCompletionRepository;
    private final TodoCustomTaskRepository todoCustomTaskRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final HolidayRepository holidayRepository;
    private final ShiftResolver shiftResolver;
    private final RequestController requestController;
    private final LeaveBalanceService leaveBalanceService;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TodoItem {
        private String id;
        private String priority; // HIGH, MEDIUM, LOW
        private String urgency;  // overdue, soon, today, info
        private String category; // ATTENDANCE, REQUEST, OKR, SYSTEM
        private String module;   // timesheet, okr, leave, requests, system
        private String kind;
        private String title;
        private String description;
        private String actionLabel;
        private String actionUrl;
        private String dueDate;
        private boolean isCompleted;
        private String status;   // open, done, dismissed
        private String createdAt;
        private String entityType;
        private String entityId;
        /** Việc tổng hợp (số đơn chờ, số dư phép) chỉ đổi khi dữ liệu thật đổi — không tick tay được. */
        private boolean completable;
        /** Chỉ việc do người dùng tự tạo mới được xoá khỏi danh sách. */
        private boolean deletable;
    }

    @GetMapping({ "/my-inbox", "/inbox" })
    @Operation(summary = "Lấy danh sách việc cần làm của người dùng gom CẢ 2 module (S02)")
    public ApiResponse<List<TodoItem>> getMyInbox() {
        return ApiResponse.ok(itemsForCurrentUser(), "Lấy danh sách việc cần làm thành công");
    }

    private List<TodoItem> itemsForCurrentUser() {
        return itemsFor(CurrentUser.userId());
    }

    /**
     * Việc chờ của một user cụ thể — dùng chung cho Todo Inbox, thẻ "việc chờ" trên
     * trang Tuỳ chỉnh thông báo và job digest 08:00 để số liệu luôn khớp.
     */
    public List<TodoItem> itemsFor(UUID userId) {
        return buildItems(userId, false);
    }

    /**
     * Nguồn duy nhất cho danh sách việc chờ: badge sidebar, Todo Inbox, thẻ "việc chờ"
     * trên trang Tuỳ chỉnh thông báo và digest 08:00 đều gọi method này.
     *
     * @param includeCompleted true khi cần kiểm tra một mục đã tick trước khi hoàn tất lại.
     */
    public List<TodoItem> buildItems(UUID userId, boolean includeCompleted) {
        Set<String> done = new HashSet<>();
        if (userId != null) {
            todoCompletionRepository.findByUserId(userId).forEach(c -> done.add(c.getTodoId()));
        }

        List<TodoItem> items = new ArrayList<>();
        LocalDate today = LocalDate.now();
        String now = LocalDateTime.now().toString();

        // 0. Đơn của chính người dùng bị từ chối — id kèm số đơn để đơn mới bị từ chối lại nổi lên.
        if (userId != null) {
            long rejectedCount = requestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                    .filter(r -> "REJECTED".equalsIgnoreCase(r.getStatus()))
                    .count();
            if (rejectedCount > 0) {
                String id = "todo-my-rejected-requests-" + rejectedCount;
                items.add(TodoItem.builder()
                        .id(id)
                        .priority("HIGH")
                        .urgency("overdue")
                        .category("REQUEST")
                        .module("requests")
                        .kind("REQUEST_REJECTED")
                        .title("Bạn có " + rejectedCount + " đơn bị từ chối cần xem phản hồi & gửi lại")
                        .description("Xem chi tiết lý do từ chối từ người phê duyệt và nộp lại nếu cần.")
                        .actionLabel("Xem Đơn Của Tôi")
                        .actionUrl("/attendance/requests")
                        .dueDate("Hôm nay")
                        .completable(true)
                        .deletable(false)
                        .isCompleted(done.contains(id))
                        .status(done.contains(id) ? "done" : "open")
                        .createdAt(now)
                        .build());
            }
        }

        // 1. Việc hôm nay: chỉ nhắc khi ngày làm việc, không nghỉ/WFH và chưa chấm công thật.
        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                boolean workday = today.getDayOfWeek().getValue() <= 5
                        && !holidayRepository.existsByHolidayDate(today);
                boolean absent = requestRepository.findApprovedAbsencesOn(today).stream()
                        .anyMatch(r -> userId.equals(r.getUserId()));
                AttendanceLog log = attendanceLogRepository.findByUserIdAndWorkDate(userId, today).orElse(null);
                Shift shift = shiftResolver.resolveFor(user, log);
                String shiftWindow = shift != null
                        ? shift.getCheckInStart() + " - " + shift.getCheckOutStart()
                        : "08:30 - 17:30";
                String checkInDue = shift != null ? shift.getCheckInEnd().toString() : "09:00";

                if (workday && !absent && (log == null || log.getCheckInAt() == null)) {
                    String id = "todo-today-checkin-" + today;
                    items.add(TodoItem.builder()
                            .id(id)
                            .priority("HIGH")
                            .urgency("today")
                            .category("ATTENDANCE")
                            .module("timesheet")
                            .kind("CHECKIN_TODAY")
                            .title("Chấm công vào ca hôm nay (Ca " + shiftWindow + ")")
                            .description("Check-in khuôn mặt bằng camera điện thoại hoặc webcam máy tính.")
                            .actionLabel("Chấm Công Ngay")
                            .actionUrl("/attendance/checkin")
                            .dueDate("Hôm nay trước " + checkInDue)
                            .completable(true)
                            .deletable(false)
                            .isCompleted(done.contains(id))
                            .status(done.contains(id) ? "done" : "open")
                            .createdAt(now)
                            .build());
                } else if (workday && !absent && log != null
                        && log.getCheckInAt() != null && log.getCheckOutAt() == null) {
                    String id = "todo-today-checkout-" + today;
                    items.add(TodoItem.builder()
                            .id(id)
                            .priority("MEDIUM")
                            .urgency("today")
                            .category("ATTENDANCE")
                            .module("timesheet")
                            .kind("CHECKOUT_TODAY")
                            .title("Chấm công ra ca hôm nay (Ca " + shiftWindow + ")")
                            .description("Bạn đã check-in lúc " + log.getCheckInAt().toLocalTime().withNano(0) + " — đừng quên check-out.")
                            .actionLabel("Chấm Công Ra")
                            .actionUrl("/attendance/checkin")
                            .dueDate("Hôm nay")
                            .completable(true)
                            .deletable(false)
                            .isCompleted(done.contains(id))
                            .status(done.contains(id) ? "done" : "open")
                            .createdAt(now)
                            .build());
                }
            }
        }

        // 2. Việc sắp hạn: Check-in OKR chu kỳ hiện tại.
        int quarter = (today.getMonthValue() - 1) / 3 + 1;
        String okrId = "todo-okr-checkin-" + today.getYear() + "-Q" + quarter;
        items.add(TodoItem.builder()
                .id(okrId)
                .priority("MEDIUM")
                .urgency("soon")
                .category("OKR")
                .module("okr")
                .kind("OKR_CHECKIN")
                .title("Check-in tiến độ OKR Quý " + quarter + "/" + today.getYear())
                .description("Cập nhật số liệu và tiến độ các mục tiêu OKR định kỳ.")
                .actionLabel("Cập Nhật OKR")
                .actionUrl("/okr/my-okr")
                .dueDate("Còn 2 ngày")
                .completable(true)
                .deletable(false)
                .isCompleted(done.contains(okrId))
                .status(done.contains(okrId) ? "done" : "open")
                .createdAt(now)
                .build());

        // 3. Số đơn đang chờ CHÍNH người này duyệt — quản lý trực tiếp hoặc HR/Admin toàn bộ.
        if (userId != null) {
            long pendingCount = pendingApprovalsFor(userId).size();
            if (pendingCount > 0) {
                String id = "todo-pending-approvals";
                items.add(0, TodoItem.builder()
                        .id(id)
                        .priority("HIGH")
                        .urgency("overdue")
                        .category("REQUEST")
                        .module("requests")
                        .kind("APPROVAL_PENDING")
                        .title("Có " + pendingCount + " đơn từ đang chờ bạn phê duyệt")
                        .description("Đơn nghỉ phép, WFH hoặc bổ sung công cần duyệt theo SLA 48h.")
                        .actionLabel("Duyệt Đơn Ngay")
                        .actionUrl("/attendance/approvals")
                        .dueDate("Trong 24h")
                        .completable(false)
                        .deletable(false)
                        .isCompleted(false)
                        .status("open")
                        .createdAt(now)
                        .build());
            }
        }

        // 4. Lưu ý thông tin: Số dư phép năm từ DB.
        BigDecimal leaveBalance = leaveBalanceOf(userId);
        String leaveId = "todo-leave-balance-info";
        items.add(TodoItem.builder()
                .id(leaveId)
                .priority("LOW")
                .urgency("info")
                .category("SYSTEM")
                .module("leave")
                .kind("LEAVE_NOTICE")
                .title("Số dư phép năm hiện tại của bạn còn " + leaveBalance + " ngày")
                .description("Bảo lưu phép năm cũ được sử dụng tối đa đến ngày 31/03 hàng năm.")
                .actionLabel("Xem Sổ Phép")
                .actionUrl("/attendance/leaves")
                .dueDate("Thông tin")
                .completable(false)
                .deletable(false)
                .isCompleted(false)
                .status("open")
                .createdAt(now)
                .build());

        // 5. Việc tự tạo — lưu DB, sống qua restart.
        if (userId != null) {
            for (TodoCustomTask ct : todoCustomTaskRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
                items.add(TodoItem.builder()
                        .id(ct.getId())
                        .priority("overdue".equalsIgnoreCase(ct.getUrgency()) || "HIGH".equalsIgnoreCase(ct.getUrgency())
                                ? "HIGH" : "MEDIUM")
                        .urgency(ct.getUrgency())
                        .category(ct.getModule() == null ? "SYSTEM" : ct.getModule().toUpperCase())
                        .module(ct.getModule())
                        .kind("CUSTOM_TASK")
                        .title(ct.getTitle())
                        .description(ct.getDescription())
                        .actionLabel(ct.getActionLabel())
                        .actionUrl(ct.getActionUrl())
                        .dueDate(ct.getDueDate())
                        .completable(true)
                        .deletable(true)
                        .isCompleted(done.contains(ct.getId()))
                        .status(done.contains(ct.getId()) ? "done" : "open")
                        .createdAt(ct.getCreatedAt() == null ? now : ct.getCreatedAt().toString())
                        .build());
            }
        }

        if (!includeCompleted) {
            items.removeIf(i -> done.contains(i.getId()));
        }
        return items;
    }

    /** Đơn đang chờ chính {@code approverId} duyệt — dùng chung cho Todo Inbox và /todos/approvals. */
    private List<RequestEntity> pendingApprovalsFor(UUID approverId) {
        User me = userRepository.findById(approverId).orElse(null);
        if (me == null) return List.of();
        boolean hr = "HR_ADMIN".equals(me.getRole()) || "ADMIN".equals(me.getRole());
        if (hr) {
            return requestRepository.findAll().stream()
                    .filter(r -> "PENDING_APPROVAL".equalsIgnoreCase(r.getStatus()))
                    .sorted(Comparator.comparing(RequestEntity::getCreatedAt,
                            Comparator.nullsLast(Comparator.reverseOrder())))
                    .toList();
        }
        List<UUID> managed = userRepository.findAll().stream()
                .filter(u -> approverId.equals(u.getManagerId()))
                .map(User::getId)
                .toList();
        if (managed.isEmpty()) return List.of();
        return requestRepository.findByUserIdInAndStatusOrderByCreatedAtDesc(managed, "PENDING_APPROVAL");
    }

    private BigDecimal leaveBalanceOf(UUID userId) {
        if (userId == null) return BigDecimal.valueOf(10.5);
        List<LeaveLedgerEntry> entries = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (entries.isEmpty()) return BigDecimal.valueOf(10.5);
        BigDecimal grant = BigDecimal.ZERO;
        BigDecimal used = BigDecimal.ZERO;
        for (LeaveLedgerEntry e : entries) {
            if ("GRANT".equals(e.getAction())) grant = grant.add(e.getAmount());
            else if ("USED".equals(e.getAction())) used = used.add(e.getAmount());
        }
        return grant.subtract(used).max(BigDecimal.ZERO);
    }

    @GetMapping("/my-tasks")
    @Operation(summary = "Tab Việc Của Tôi (Personal Tasks S02)")
    public ApiResponse<List<TodoItem>> getMyTasks() {
        return getMyInbox();
    }

    @GetMapping("/leave-summary")
    @Operation(summary = "Tổng hợp số phép còn lại hiển thị trên Todo Inbox (S02 - C1)")
    public ApiResponse<Map<String, Object>> getLeaveSummary() {
        UUID userId = CurrentUser.userId();
        // Dùng chung LeaveBalanceService với S09 — tránh mỗi màn hình tính một kiểu
        // (trước đây chỗ này hard-code 10,5 ngày nên lệch với sổ phép thật).
        Map<String, Object> balance = leaveBalanceService.balanceOf(userId);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalRemaining", balance.getOrDefault("remaining", BigDecimal.ZERO));
        summary.put("carriedRemaining", balance.getOrDefault("carriedRemaining", BigDecimal.ZERO));
        summary.put("annualRemaining", balance.getOrDefault("annualRemaining", BigDecimal.ZERO));
        summary.put("carriedExpiryDate", balance.get("carriedExpiryDate"));
        summary.put("policyNotice", balance.get("policyNotice"));
        summary.put("carryStatus", balance.get("carryStatus"));
        summary.put("carriedYear", balance.get("carriedYear"));
        summary.put("annualYear", balance.get("annualYear"));
        return ApiResponse.ok(summary, "Lấy thông tin số dư phép thành công");
    }

    @PostMapping("/{id}/complete")
    @Operation(summary = "Hoàn tất một mục việc cần làm (1-click action)")
    public ResponseEntity<ApiResponse<Boolean>> completeTodo(@PathVariable String id) {
        UUID userId = CurrentUser.userId();
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Vui lòng đăng nhập để hoàn tất công việc."));
        }
        TodoItem item = buildItems(userId, true).stream()
                .filter(i -> i.getId().equals(id))
                .findFirst()
                .orElse(null);
        if (item == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("Không tìm thấy việc cần làm này."));
        }
        if (!item.isCompletable()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Mục này là thông tin tổng hợp — hoàn tất khi dữ liệu thật thay đổi, không tick tay được."));
        }
        TodoCompletion.Key key = new TodoCompletion.Key(userId, id);
        if (!todoCompletionRepository.existsById(key)) {
            todoCompletionRepository.save(TodoCompletion.builder()
                    .userId(userId).todoId(id).completedAt(LocalDateTime.now()).build());
        }
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã cập nhật trạng thái"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá một việc tự tạo khỏi Todo Inbox")
    @Transactional
    public ResponseEntity<ApiResponse<Boolean>> deleteTodo(@PathVariable String id) {
        UUID userId = CurrentUser.userId();
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Vui lòng đăng nhập để xoá công việc."));
        }
        long removed = todoCustomTaskRepository.deleteByIdAndUserId(id, userId);
        if (removed == 0) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("Chỉ xoá được việc do bạn tự tạo — việc do hệ thống sinh ra dựa trên dữ liệu thật."));
        }
        todoCompletionRepository.deleteById(new TodoCompletion.Key(userId, id));
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã xoá công việc khỏi danh sách"));
    }

    @PostMapping("/create-task")
    @Operation(summary = "Tạo một mục việc cần làm mới")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createCustomTask(@RequestBody(required = false) Map<String, Object> body) {
        UUID uid = CurrentUser.userId();
        if (uid == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Vui lòng đăng nhập để tạo công việc."));
        }
        String title = body != null && body.get("title") != null ? String.valueOf(body.get("title")).trim() : "";
        if (title.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Tiêu đề công việc không được để trống."));
        }
        if (title.length() > 255) title = title.substring(0, 255);

        String description = body != null && body.get("description") != null ? String.valueOf(body.get("description")) : "";
        String urgency = normalizeChoice(body, "urgency", Set.of("overdue", "soon", "today", "info"), "today");
        String module = normalizeChoice(body, "module", Set.of("timesheet", "okr", "leave", "requests", "system"), "system");
        String actionUrl = body != null && body.get("actionUrl") != null ? String.valueOf(body.get("actionUrl")).trim() : "/attendance/checkin";
        if (!actionUrl.startsWith("/") || actionUrl.startsWith("//") || actionUrl.contains("\\")) {
            actionUrl = "/attendance/checkin"; // chặn URL tuyệt đối / javascript:
        }
        String actionLabel = body != null && body.get("actionLabel") != null ? String.valueOf(body.get("actionLabel")) : "Xử lý ngay";
        String dueDate = body != null && body.get("dueDate") != null ? String.valueOf(body.get("dueDate")) : "Hôm nay";

        String id = "todo-custom-" + UUID.randomUUID().toString().substring(0, 8);
        TodoCustomTask entity = TodoCustomTask.builder()
                .id(id)
                .userId(uid)
                .title(title)
                .description(description)
                .urgency(urgency)
                .module(module)
                .actionUrl(actionUrl)
                .actionLabel(actionLabel)
                .dueDate(dueDate)
                .createdAt(LocalDateTime.now())
                .build();
        todoCustomTaskRepository.save(entity);

        Map<String, Object> task = new LinkedHashMap<>();
        task.put("id", id);
        task.put("title", title);
        task.put("description", description);
        task.put("urgency", urgency);
        task.put("module", module);
        task.put("actionUrl", actionUrl);
        task.put("actionLabel", actionLabel);
        task.put("dueDate", dueDate);
        task.put("completable", true);
        task.put("deletable", true);
        return ResponseEntity.ok(ApiResponse.ok(task, "Tạo công việc thành công"));
    }

    private static String normalizeChoice(Map<String, Object> body, String key, Set<String> allowed, String fallback) {
        if (body == null || body.get(key) == null) return fallback;
        String value = String.valueOf(body.get(key)).trim().toLowerCase(Locale.ROOT);
        return allowed.contains(value) ? value : fallback;
    }

    @GetMapping("/completed")
    @Operation(summary = "Danh sách việc đã hoàn thành")
    public ApiResponse<List<Map<String, Object>>> getCompletedTasks() {
        UUID userId = CurrentUser.userId();
        if (userId == null) return ApiResponse.ok(Collections.emptyList(), "Lấy danh sách việc đã hoàn thành thành công");

        List<TodoCompletion> completions = todoCompletionRepository.findTop50ByUserIdOrderByCompletedAtDesc(userId);
        if (completions.isEmpty()) {
            return ApiResponse.ok(Collections.emptyList(), "Lấy danh sách việc đã hoàn thành thành công");
        }

        // Ưu tiên tiêu đề thật của việc còn dựng được; việc đã biến mất khỏi Inbox
        // (hết ngày, đổi dữ liệu) dùng nhãn thân thiện thay cho mã nội bộ.
        Map<String, String> currentTitles = buildItems(userId, true).stream()
                .collect(Collectors.toMap(TodoItem::getId, TodoItem::getTitle, (a, b) -> a));

        List<Map<String, Object>> list = completions.stream()
                .sorted((a, b) -> (b.getCompletedAt() != null && a.getCompletedAt() != null) ? b.getCompletedAt().compareTo(a.getCompletedAt()) : 0)
                .map(c -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", c.getTodoId());
                    row.put("title", currentTitles.getOrDefault(c.getTodoId(), completedFallbackTitle(c.getTodoId())));
                    row.put("completedAt", c.getCompletedAt() == null ? null : c.getCompletedAt().toString());
                    return row;
                })
                .toList();
        return ApiResponse.ok(list, "Lấy danh sách việc đã hoàn thành thành công");
    }

    /** Nhãn cho việc đã hoàn tất mà dữ liệu nguồn không còn dựng lại được. */
    private static String completedFallbackTitle(String todoId) {
        if (todoId == null) return "Việc đã hoàn tất";
        if (todoId.startsWith("todo-today-checkin")) return "Chấm công vào hôm nay";
        if (todoId.startsWith("todo-today-checkout")) return "Chấm công ra hôm nay";
        if (todoId.startsWith("todo-my-rejected-requests")) return "Đơn bị từ chối cần xử lý";
        if (todoId.startsWith("todo-okr-checkin")) return "Check-in tiến độ OKR";
        if (todoId.startsWith("todo-custom-")) return "Việc tự tạo";
        if ("todo-pending-approvals".equals(todoId)) return "Đơn chờ bạn phê duyệt";
        if ("todo-leave-balance-info".equals(todoId)) return "Thông tin số dư phép năm";
        return "Việc đã hoàn tất";
    }

    @GetMapping("/approvals")
    @Operation(summary = "Tab Chờ Duyệt của Quản lý (CORE-TODO-02)")
    public ApiResponse<List<Map<String, Object>>> getApprovals() {
        UUID me = CurrentUser.userId();
        List<RequestEntity> pendingList = me == null ? Collections.emptyList() : pendingApprovalsFor(me);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (RequestEntity r : pendingList) {
            String requesterName = "Nhân viên";
            if (r.getUserId() != null) {
                requesterName = userRepository.findById(r.getUserId())
                        .map(u -> u.getFullName() + " (" + u.getEmployeeCode() + ")")
                        .orElse("—");
            }

            long elapsedHours = Duration.between(
                    r.getCreatedAt() != null ? r.getCreatedAt() : LocalDateTime.now(),
                    LocalDateTime.now()
            ).toHours();
            long slaHoursRemaining = Math.max(0, 48 - elapsedHours);

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId().toString());
            m.put("type", r.getRequestType());
            m.put("requester", requesterName);
            m.put("days", r.getMinutes() != null ? r.getMinutes() / 60.0 : 1.0);
            m.put("reason", r.getReason() != null ? r.getReason() : "Đề xuất phê duyệt");
            m.put("slaHoursRemaining", slaHoursRemaining);
            m.put("priority", slaHoursRemaining < 12 ? "red" : slaHoursRemaining < 36 ? "yellow" : "green");
            m.put("badgeText", slaHoursRemaining <= 0 ? "Quá hạn SLA" : "Còn " + slaHoursRemaining + "h");
            m.put("submittedAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : "Hôm nay");
            rows.add(m);
        }

        return ApiResponse.ok(rows, "Lấy danh sách đơn chờ duyệt thành công");
    }

    @PostMapping("/approvals/{id}/action")
    @Operation(summary = "Phê duyệt nhanh hoặc từ chối kèm lý do (CORE-TODO-03)")
    public ResponseEntity<ApiResponse<Boolean>> processApproval(
            @PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        if (CurrentUser.userId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Vui lòng đăng nhập để xử lý đơn."));
        }
        UUID requestId;
        try {
            requestId = UUID.fromString(id);
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("Mã đơn không hợp lệ."));
        }
        RequestEntity r = requestRepository.findById(requestId).orElse(null);
        if (r == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy đơn cần xử lý."));
        }
        if (!"PENDING_APPROVAL".equalsIgnoreCase(r.getStatus())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Đơn này đã được xử lý (" + r.getStatus() + ")."));
        }
        String action = body == null || body.get("action") == null ? "APPROVE" : String.valueOf(body.get("action"));
        String comment = body == null || body.get("comment") == null
                ? (body != null && body.get("reason") != null ? String.valueOf(body.get("reason")) : null)
                : String.valueOf(body.get("comment"));
        boolean approve = !("REJECT".equalsIgnoreCase(action) || "REJECTED".equalsIgnoreCase(action));
        if (!approve && (comment == null || comment.isBlank())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("Từ chối phải nhập lý do."));
        }
        try {
            requestController.decide(requestId, approve, comment);
        } catch (RuntimeException ex) {
            String msg = ex.getMessage() == null ? "Không xử lý được đơn." : ex.getMessage();
            HttpStatus status = msg.startsWith("Chỉ quản lý") ? HttpStatus.FORBIDDEN : HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status).body(ApiResponse.error(msg));
        }
        return ResponseEntity.ok(ApiResponse.ok(true,
                "Đã xử lý đơn " + id + " thành công (" + (approve ? "APPROVE" : "REJECT") + ")"));
    }

    @PostMapping("/batch-approve")
    @Operation(summary = "Duyệt hàng loạt nhiều đơn cùng lúc (CORE-TODO-04)")
    public ApiResponse<Map<String, Object>> batchApprove(@RequestBody(required = false) Map<String, Object> body) {
        List<?> ids = null;
        if (body != null) {
            if (body.containsKey("ids")) ids = (List<?>) body.get("ids");
            else if (body.containsKey("requestIds")) ids = (List<?>) body.get("requestIds");
        }
        if (ids == null) ids = Collections.emptyList();

        int approved = 0;
        int skipped = 0;
        for (Object raw : ids) {
            if (raw == null) { skipped++; continue; }
            try {
                UUID requestId = UUID.fromString(String.valueOf(raw));
                RequestEntity r = requestRepository.findById(requestId).orElse(null);
                if (r == null || !"PENDING_APPROVAL".equalsIgnoreCase(r.getStatus())) {
                    skipped++;
                    continue;
                }
                // Đi qua đúng luồng duyệt chuẩn để kiểm tra thẩm quyền + trừ phép + phát thông báo.
                requestController.decide(requestId, true, "Duyệt hàng loạt theo kế hoạch xanh");
                approved++;
            } catch (Exception ignored) {
                skipped++;
            }
        }
        return ApiResponse.ok(Map.of("approvedCount", approved, "skippedCount", skipped),
                "Duyệt hàng loạt thành công " + approved + " đơn, bỏ qua " + skipped);
    }
}
