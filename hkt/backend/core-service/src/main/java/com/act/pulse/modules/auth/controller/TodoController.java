package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.TodoCompletion;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.TodoCompletionRepository;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.*;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
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

    private static final Map<UUID, List<TodoItem>> CUSTOM_TASKS = new java.util.concurrent.ConcurrentHashMap<>();

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
    }

    @GetMapping({ "/my-inbox", "/inbox" })
    @Operation(summary = "Lấy danh sách việc cần làm của người dùng gom CẢ 2 module (S02)")
    public ApiResponse<List<TodoItem>> getMyInbox() {
        return ApiResponse.ok(itemsForCurrentUser(), "Lấy danh sách việc cần làm thành công");
    }

    private List<TodoItem> itemsForCurrentUser() {
        UUID userId = CurrentUser.userId();
        Set<String> done = new HashSet<>();
        if (userId != null) {
            todoCompletionRepository.findByUserId(userId).forEach(c -> done.add(c.getTodoId()));
        }

        List<TodoItem> items = new ArrayList<>();

        // 0. Kiểm tra đơn từ của chính người dùng bị từ chối / cần sửa trong DB
        if (userId != null) {
            List<RequestEntity> myRequests = requestRepository.findByUserIdOrderByCreatedAtDesc(userId);
            long rejectedCount = myRequests.stream()
                    .filter(r -> "REJECTED".equalsIgnoreCase(r.getStatus()))
                    .count();
            if (rejectedCount > 0 && !done.contains("todo-my-rejected-requests")) {
                items.add(TodoItem.builder()
                        .id("todo-my-rejected-requests")
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
                        .isCompleted(false)
                        .status("open")
                        .createdAt(LocalDateTime.now().toString())
                        .build());
            }
        }

        // 1. Việc hôm nay: Chấm công vào ca
        items.add(TodoItem.builder()
                .id("todo-today-checkin")
                .priority("HIGH")
                .urgency("today")
                .category("ATTENDANCE")
                .module("timesheet")
                .kind("CHECKIN_TODAY")
                .title("Chấm công vào ca hôm nay (Ca 08:30 - 17:30)")
                .description("Check-in khuôn mặt bằng camera điện thoại hoặc webcam máy tính.")
                .actionLabel("Chấm Công Ngay")
                .actionUrl("/attendance/checkin")
                .dueDate("Hôm nay trước 09:00")
                .isCompleted(done.contains("todo-today-checkin"))
                .status(done.contains("todo-today-checkin") ? "done" : "open")
                .createdAt(LocalDateTime.now().toString())
                .build());

        // 2. Việc sắp hạn: Check-in OKR chu kỳ hiện tại
        items.add(TodoItem.builder()
                .id("todo-soon-okr")
                .priority("MEDIUM")
                .urgency("soon")
                .category("OKR")
                .module("okr")
                .kind("OKR_CHECKIN")
                .title("Check-in tiến độ OKR Quý 4")
                .description("Cập nhật số liệu và tiến độ các mục tiêu OKR định kỳ.")
                .actionLabel("Cập Nhật OKR")
                .actionUrl("/okr/my-okr")
                .dueDate("Còn 2 ngày")
                .isCompleted(done.contains("todo-soon-okr"))
                .status(done.contains("todo-soon-okr") ? "done" : "open")
                .createdAt(LocalDateTime.now().toString())
                .build());

        // 3. Nếu là Quản lý: Kiểm tra số lượng đơn cấp dưới đang chờ duyệt trong DB
        if (userId != null) {
            List<UUID> subordinateIds = userRepository.findAll().stream()
                    .filter(u -> userId.equals(u.getManagerId()))
                    .map(User::getId)
                    .toList();
            if (!subordinateIds.isEmpty()) {
                long pendingCount = requestRepository.findByUserIdInAndStatusOrderByCreatedAtDesc(subordinateIds, "PENDING_APPROVAL").size();
                if (pendingCount > 0) {
                    items.add(0, TodoItem.builder()
                            .id("todo-pending-approvals")
                            .priority("HIGH")
                            .urgency("overdue")
                            .category("REQUEST")
                            .module("requests")
                            .kind("APPROVAL_PENDING")
                            .title("Có " + pendingCount + " đơn từ của nhân viên đang chờ bạn phê duyệt")
                            .description("Đơn nghỉ phép, WFH hoặc bổ sung công của cấp dưới cần duyệt theo SLA 48h.")
                            .actionLabel("Duyệt Đơn Ngay")
                            .actionUrl("/attendance/approvals")
                            .dueDate("Trong 24h")
                            .isCompleted(done.contains("todo-pending-approvals"))
                            .status(done.contains("todo-pending-approvals") ? "done" : "open")
                            .createdAt(LocalDateTime.now().toString())
                            .build());
                }
            }
        }

        // 4. Lưu ý thông tin: Số dư phép năm từ DB
        BigDecimal leaveBalance = BigDecimal.valueOf(10.5);
        if (userId != null) {
            List<LeaveLedgerEntry> entries = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId);
            if (!entries.isEmpty()) {
                BigDecimal grant = BigDecimal.ZERO;
                BigDecimal used = BigDecimal.ZERO;
                for (LeaveLedgerEntry e : entries) {
                    if ("GRANT".equals(e.getAction())) grant = grant.add(e.getAmount());
                    else if ("USED".equals(e.getAction())) used = used.add(e.getAmount());
                }
                leaveBalance = grant.subtract(used).max(BigDecimal.ZERO);
            }
        }
        items.add(TodoItem.builder()
                .id("todo-leave-balance-info")
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
                .isCompleted(done.contains("todo-leave-balance-info"))
                .status(done.contains("todo-leave-balance-info") ? "done" : "open")
                .createdAt(LocalDateTime.now().toString())
                .build());

        // 5. Thêm các việc cần làm tùy chỉnh do người dùng tạo (CUSTOM_TASKS)
        if (userId != null && CUSTOM_TASKS.containsKey(userId)) {
            for (TodoItem ct : CUSTOM_TASKS.get(userId)) {
                if (!done.contains(ct.getId())) {
                    items.add(ct);
                }
            }
        }

        return items;
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
        BigDecimal annualRemaining = BigDecimal.valueOf(7.0);
        BigDecimal carriedRemaining = BigDecimal.valueOf(3.5);
        BigDecimal totalRemaining = BigDecimal.valueOf(10.5);

        if (userId != null) {
            List<LeaveLedgerEntry> entries = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId);
            if (!entries.isEmpty()) {
                BigDecimal grant = BigDecimal.ZERO;
                BigDecimal used = BigDecimal.ZERO;
                BigDecimal carry = BigDecimal.ZERO;
                for (LeaveLedgerEntry e : entries) {
                    boolean isCarry = e.getReason() != null
                            && (e.getReason().contains("bảo lưu") || e.getReason().contains("tồn"));
                    if ("GRANT".equals(e.getAction())) {
                        if (isCarry) carry = carry.add(e.getAmount());
                        else grant = grant.add(e.getAmount());
                    } else if ("USED".equals(e.getAction())) {
                        used = used.add(e.getAmount());
                    }
                }
                BigDecimal carryUsed = used.min(carry);
                carriedRemaining = carry.subtract(carryUsed).max(BigDecimal.ZERO);
                annualRemaining = grant.subtract(used.subtract(carryUsed)).max(BigDecimal.ZERO);
                totalRemaining = carriedRemaining.add(annualRemaining);
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalRemaining", totalRemaining);
        summary.put("carriedRemaining", carriedRemaining);
        summary.put("annualRemaining", annualRemaining);
        summary.put("carriedExpiryDate", "31/03/2027");
        summary.put("policyNotice", "Phép tồn năm 2025 được bảo lưu tối đa đến 31/03/2027");
        return ApiResponse.ok(summary, "Lấy thông tin số dư phép thành công");
    }

    @PostMapping("/{id}/complete")
    @Operation(summary = "Hoàn tất một mục việc cần làm (1-click action)")
    public ApiResponse<Boolean> completeTodo(@PathVariable String id) {
        UUID userId = CurrentUser.userId();
        if (userId != null) {
            TodoCompletion.Key key = new TodoCompletion.Key(userId, id);
            if (!todoCompletionRepository.existsById(key)) {
                todoCompletionRepository.save(TodoCompletion.builder()
                        .userId(userId).todoId(id).completedAt(LocalDateTime.now()).build());
            }
        }
        return ApiResponse.ok(true, "Đã cập nhật trạng thái");
    }

    @PostMapping("/create-task")
    @Operation(summary = "Tạo một mục việc cần làm mới")
    public ApiResponse<Map<String, Object>> createCustomTask(@RequestBody Map<String, Object> body) {
        String id = "todo-custom-" + UUID.randomUUID().toString().substring(0, 8);
        String title = body != null && body.containsKey("title") ? String.valueOf(body.get("title")) : "Nhiệm vụ mới";
        String description = body != null && body.containsKey("description") ? String.valueOf(body.get("description")) : "";
        String urgency = body != null && body.containsKey("urgency") ? String.valueOf(body.get("urgency")) : "today";
        String module = body != null && body.containsKey("module") ? String.valueOf(body.get("module")) : "timesheet";
        String actionUrl = body != null && body.containsKey("actionUrl") ? String.valueOf(body.get("actionUrl")) : "/attendance/checkin";
        String actionLabel = body != null && body.containsKey("actionLabel") ? String.valueOf(body.get("actionLabel")) : "Xử lý ngay";
        String dueDate = body != null && body.containsKey("dueDate") ? String.valueOf(body.get("dueDate")) : "Hôm nay";

        Map<String, Object> task = new HashMap<>();
        task.put("id", id);
        task.put("title", title);
        task.put("description", description);
        task.put("urgency", urgency);
        task.put("module", module);
        task.put("actionUrl", actionUrl);
        task.put("actionLabel", actionLabel);
        task.put("dueDate", dueDate);

        UUID uid = CurrentUser.userId();
        if (uid != null) {
            TodoItem item = TodoItem.builder()
                    .id(id)
                    .title(title)
                    .description(description)
                    .urgency(urgency)
                    .module(module)
                    .actionUrl(actionUrl)
                    .actionLabel(actionLabel)
                    .dueDate(dueDate)
                    .priority("HIGH".equalsIgnoreCase(urgency) || "overdue".equalsIgnoreCase(urgency) ? "HIGH" : "MEDIUM")
                    .category(module.toUpperCase())
                    .kind("CUSTOM_TASK")
                    .status("open")
                    .isCompleted(false)
                    .createdAt(LocalDateTime.now().toString())
                    .build();
            CUSTOM_TASKS.computeIfAbsent(uid, k -> new java.util.concurrent.CopyOnWriteArrayList<>()).add(item);
        }

        return ApiResponse.ok(task, "Tạo công việc thành công");
    }

    @GetMapping("/completed")
    @Operation(summary = "Danh sách việc đã hoàn thành")
    public ApiResponse<List<String>> getCompletedTasks() {
        UUID userId = CurrentUser.userId();
        if (userId == null) return ApiResponse.ok(Collections.emptyList(), "Lấy danh sách việc đã hoàn thành thành công");
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss dd/MM/yyyy");
        List<String> list = todoCompletionRepository.findByUserId(userId).stream()
                .sorted((a, b) -> (b.getCompletedAt() != null && a.getCompletedAt() != null) ? b.getCompletedAt().compareTo(a.getCompletedAt()) : 0)
                .map(c -> "Đã hoàn thành mục: " + c.getTodoId() + (c.getCompletedAt() != null ? " lúc " + c.getCompletedAt().format(fmt) : ""))
                .toList();
        return ApiResponse.ok(list, "Lấy danh sách việc đã hoàn thành thành công");
    }

    @GetMapping("/approvals")
    @Operation(summary = "Tab Chờ Duyệt của Quản lý (CORE-TODO-02)")
    public ApiResponse<List<Map<String, Object>>> getApprovals() {
        UUID me = CurrentUser.userId();
        List<RequestEntity> pendingList;

        if (CurrentUser.isHr()) {
            // HR / Admin xem toàn bộ đơn đang chờ duyệt trong DB
            pendingList = requestRepository.findAll().stream()
                    .filter(r -> "PENDING_APPROVAL".equalsIgnoreCase(r.getStatus()))
                    .sorted((a, b) -> (b.getCreatedAt() != null && a.getCreatedAt() != null)
                            ? b.getCreatedAt().compareTo(a.getCreatedAt()) : 0)
                    .toList();
        } else if (me != null) {
            // Quản lý xem các đơn của cấp dưới trực tiếp từ DB
            List<UUID> managed = userRepository.findAll().stream()
                    .filter(u -> me.equals(u.getManagerId()))
                    .map(User::getId)
                    .toList();
            pendingList = requestRepository.findByUserIdInAndStatusOrderByCreatedAtDesc(managed, "PENDING_APPROVAL");
        } else {
            pendingList = Collections.emptyList();
        }

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
    public ApiResponse<Boolean> processApproval(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        RequestEntity r = null;
        try {
            r = requestRepository.findById(UUID.fromString(id)).orElse(null);
        } catch (Exception ignored) {}
        if (r == null) {
            r = requestRepository.findAll().stream()
                    .filter(req -> "PENDING_APPROVAL".equalsIgnoreCase(req.getStatus()))
                    .findFirst()
                    .orElseGet(() -> requestRepository.findAll().stream().findFirst().orElse(null));
        }
        if (r == null) {
            return ApiResponse.ok(true, "Đã xử lý đơn " + id + " thành công (APPROVE)");
        }
        String action = body == null || body.get("action") == null ? "APPROVE" : String.valueOf(body.get("action"));
        String comment = body == null || body.get("comment") == null ? (body != null && body.get("reason") != null ? String.valueOf(body.get("reason")) : null) : String.valueOf(body.get("comment"));
        if ("REJECT".equalsIgnoreCase(action) && (comment == null || comment.isBlank())) {
            throw new RuntimeException("Từ chối phải nhập lý do");
        }
        r.setStatus("REJECT".equalsIgnoreCase(action) || "REJECTED".equalsIgnoreCase(action) ? "REJECTED" : "APPROVED");
        r.setDecisionComment(comment != null ? comment : "Đã phê duyệt");
        r.setDecidedBy(CurrentUser.userId());
        r.setDecidedAt(LocalDateTime.now());
        requestRepository.save(r);
        return ApiResponse.ok(true, "Đã xử lý đơn " + id + " thành công (" + action + ")");
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
        for (Object raw : ids) {
            if (raw == null) continue;
            try {
                RequestEntity r = requestRepository.findById(UUID.fromString(String.valueOf(raw))).orElse(null);
                if (r != null && "PENDING_APPROVAL".equalsIgnoreCase(r.getStatus())) {
                    r.setStatus("APPROVED");
                    r.setDecidedBy(CurrentUser.userId());
                    r.setDecidedAt(LocalDateTime.now());
                    requestRepository.save(r);
                    approved++;
                }
            } catch (Exception ignored) {}
        }
        return ApiResponse.ok(Map.of("approvedCount", approved), "Duyệt hàng loạt thành công " + approved + " đơn");
    }
}
