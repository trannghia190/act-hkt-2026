package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.TodoCompletion;
import com.act.pulse.modules.attendance.repository.TodoCompletionRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.auth.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import java.time.LocalDateTime;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping({"/todos", "/todo"})
@Tag(name = "1. Todo Inbox API", description = "Màn hình việc cần làm trung tâm S02, Quick Action & Batch Approvals")
public class TodoController {

    @Autowired
    private TodoCompletionRepository todoCompletionRepository;

    @Autowired
    private RequestRepository requestRepository;

    @Autowired
    private UserRepository userRepository;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TodoItem {
        private String id;
        private String priority; // HIGH, MEDIUM, LOW
        private String category; // ATTENDANCE, REQUEST, OKR, SYSTEM
        private String title;
        private String description;
        private String actionLabel;
        private String actionUrl;
        private String dueDate;
        private boolean isCompleted;
    }

    private static final List<TodoItem> INBOX_ITEMS = Collections.synchronizedList(new ArrayList<>());

    static {
        INBOX_ITEMS.add(TodoItem.builder()
                .id("todo-01")
                .priority("HIGH")
                .category("ATTENDANCE")
                .title("Chưa check-in ca hôm nay (Ca 08:30 - 17:30)")
                .description("Vui lòng check-in bằng camera nhận diện khuôn mặt.")
                .actionLabel("Chấm Công Ngay")
                .actionUrl("/attendance/checkin")
                .dueDate("Hôm nay 09:30")
                .isCompleted(false)
                .build());

        INBOX_ITEMS.add(TodoItem.builder()
                .id("todo-02")
                .priority("MEDIUM")
                .category("REQUEST")
                .title("Có 3 đơn từ của nhóm đang chờ duyệt")
                .description("Đơn xin nghỉ phép và WFH của thành viên nhóm Optimus.")
                .actionLabel("Duyệt Nhanh")
                .actionUrl("/attendance/approvals")
                .dueDate("Trong 24h")
                .isCompleted(false)
                .build());

        INBOX_ITEMS.add(TodoItem.builder()
                .id("todo-03")
                .priority("MEDIUM")
                .category("OKR")
                .title("Đóng link tự đánh giá OKR cuối năm sau 2 ngày")
                .description("Hoàn thành tự chấm điểm Form 4 Box (Business & People) trước hạn.")
                .actionLabel("Vào Form Đánh Giá")
                .actionUrl("/okr/assessment")
                .dueDate("Còn 2 ngày")
                .isCompleted(false)
                .build());

        INBOX_ITEMS.add(TodoItem.builder()
                .id("todo-04")
                .priority("LOW")
                .category("SYSTEM")
                .title("Số dư phép năm 2026 của bạn còn 6.5 ngày")
                .description("Lưu ý mốc 01/04 hết hạn dọn phép tồn năm cũ.")
                .actionLabel("Xem Sổ Phép")
                .actionUrl("/attendance/leaves")
                .dueDate("Thông tin")
                .isCompleted(false)
                .build());
    }

    @GetMapping("/my-inbox")
    @Operation(summary = "Lấy danh sách việc cần làm của người dùng (S02)")
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
        for (TodoItem item : INBOX_ITEMS) {
            items.add(TodoItem.builder().id(item.getId()).priority(item.getPriority()).category(item.getCategory())
                    .title(item.getTitle()).description(item.getDescription()).actionLabel(item.getActionLabel())
                    .actionUrl(item.getActionUrl()).dueDate(item.getDueDate()).isCompleted(done.contains(item.getId())).build());
        }
        return items;
    }

    @GetMapping("/my-tasks")
    @Operation(summary = "Tab Việc Của Tôi (Personal Tasks S02)")
    public ApiResponse<List<TodoItem>> getMyTasks() {
        return ApiResponse.ok(itemsForCurrentUser(), "Lấy danh sách nhiệm vụ cá nhân thành công");
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

    @GetMapping("/approvals")
    @Operation(summary = "Tab Chờ Duyệt của Quản lý (CORE-TODO-02)")
    public ApiResponse<List<Map<String, Object>>> getApprovals() {
        UUID me = CurrentUser.userId();
        List<UUID> managed = userRepository.findAll().stream()
                .filter(u -> me.equals(u.getManagerId())).map(User::getId).toList();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (RequestEntity r : requestRepository.findByUserIdInAndStatusOrderByCreatedAtDesc(managed, "PENDING_APPROVAL")) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId().toString());
            m.put("type", r.getRequestType());
            m.put("requester", userRepository.findById(r.getUserId()).map(User::getFullName).orElse("—"));
            m.put("days", r.getMinutes() != null ? r.getMinutes() / 60.0 : 1.0);
            m.put("reason", r.getReason());
            m.put("slaHoursRemaining", 48);
            rows.add(m);
        }
        return ApiResponse.ok(rows, "Lấy danh sách đơn chờ duyệt thành công");
    }

    @PostMapping("/approvals/{id}/action")
    @Operation(summary = "Phê duyệt nhanh hoặc từ chối kèm lý do (CORE-TODO-03)")
    public ApiResponse<Boolean> processApproval(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        RequestEntity r = requestRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn: " + id));
        String action = body == null || body.get("action") == null ? "APPROVE" : String.valueOf(body.get("action"));
        String comment = body == null || body.get("comment") == null ? null : String.valueOf(body.get("comment"));
        if ("REJECT".equalsIgnoreCase(action) && (comment == null || comment.isBlank())) {
            throw new RuntimeException("Từ chối phải nhập lý do");
        }
        r.setStatus("REJECT".equalsIgnoreCase(action) ? "REJECTED" : "APPROVED");
        r.setDecisionComment(comment);
        r.setDecidedBy(CurrentUser.userId());
        r.setDecidedAt(LocalDateTime.now());
        requestRepository.save(r);
        return ApiResponse.ok(true, "Đã xử lý đơn " + id);
    }

    @PostMapping("/batch-approve")
    @Operation(summary = "Duyệt hàng loạt nhiều đơn cùng lúc (CORE-TODO-04)")
    public ApiResponse<Map<String, Object>> batchApprove(@RequestBody(required = false) Map<String, Object> body) {
        List<?> ids = body == null ? List.of() : (List<?>) body.getOrDefault("ids", List.of());
        int approved = 0;
        for (Object raw : ids) {
            RequestEntity r = requestRepository.findById(UUID.fromString(String.valueOf(raw))).orElse(null);
            if (r != null && "PENDING_APPROVAL".equals(r.getStatus())) {
                r.setStatus("APPROVED");
                r.setDecidedBy(CurrentUser.userId());
                r.setDecidedAt(LocalDateTime.now());
                requestRepository.save(r);
                approved++;
            }
        }
        return ApiResponse.ok(Map.of("approvedCount", approved), "Duyệt hàng loạt thành công " + approved + " đơn");
    }
}
