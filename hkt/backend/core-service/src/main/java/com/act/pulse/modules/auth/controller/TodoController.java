package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping({"/todos", "/todo"})
@Tag(name = "1. Todo Inbox API", description = "Màn hình việc cần làm trung tâm S02, Quick Action & Batch Approvals")
public class TodoController {

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
        return ApiResponse.ok(new ArrayList<>(INBOX_ITEMS), "Lấy danh sách việc cần làm thành công");
    }

    @GetMapping("/my-tasks")
    @Operation(summary = "Tab Việc Của Tôi (Personal Tasks S02)")
    public ApiResponse<List<TodoItem>> getMyTasks() {
        return ApiResponse.ok(new ArrayList<>(INBOX_ITEMS), "Lấy danh sách nhiệm vụ cá nhân thành công");
    }

    @PostMapping("/{id}/complete")
    @Operation(summary = "Hoàn tất một mục việc cần làm (1-click action)")
    public ApiResponse<Boolean> completeTodo(@PathVariable String id) {
        for (TodoItem item : INBOX_ITEMS) {
            if (id.equals(item.getId())) {
                item.setCompleted(true);
                return ApiResponse.ok(true, "Đã hoàn tất công việc: " + item.getTitle());
            }
        }
        return ApiResponse.ok(true, "Đã cập nhật trạng thái");
    }

    @GetMapping("/approvals")
    @Operation(summary = "Tab Chờ Duyệt của Quản lý (CORE-TODO-02)")
    public ApiResponse<List<Map<String, Object>>> getApprovals() {
        return ApiResponse.ok(List.of(
                Map.of("id", "APPR-01", "type", "LEAVE", "requester", "Vũ Văn Luận", "days", 1.0, "reason", "Nghỉ phép việc gia đình", "slaHoursRemaining", 36),
                Map.of("id", "APPR-02", "type", "WFH", "requester", "Lê Hoàng Nam", "days", 1.0, "reason", "Làm việc từ xa hỗ trợ onsite", "slaHoursRemaining", 24)
        ), "Lấy danh sách đơn chờ duyệt thành công");
    }

    @PostMapping("/approvals/{id}/action")
    @Operation(summary = "Phê duyệt nhanh hoặc từ chối kèm lý do (CORE-TODO-03)")
    public ApiResponse<Boolean> processApproval(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(true, "Xử lý duyệt đơn " + id + " thành công");
    }

    @PostMapping("/batch-approve")
    @Operation(summary = "Duyệt hàng loạt nhiều đơn cùng lúc (CORE-TODO-04)")
    public ApiResponse<Map<String, Object>> batchApprove(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(Map.of("approvedCount", 2), "Duyệt hàng loạt thành công 2 đơn");
    }
}
