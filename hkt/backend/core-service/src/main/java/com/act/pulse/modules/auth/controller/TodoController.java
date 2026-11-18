package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.Data;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/todos")
@Tag(name = "1. Todo Inbox API", description = "Màn hình việc cần làm trung tâm S02")
public class TodoController {

    @Data
    @Builder
    public static class TodoItem {
        private String id;
        private String priority; // HIGH (Đỏ), MEDIUM (Vàng), LOW (Xanh)
        private String category; // ATTENDANCE, REQUEST, OKR, SYSTEM
        private String title;
        private String description;
        private String actionLabel;
        private String actionUrl;
        private String dueDate;
    }

    @GetMapping("/my-inbox")
    @Operation(summary = "Lấy danh sách việc cần làm của người dùng (S02)")
    public ApiResponse<List<TodoItem>> getMyInbox() {
        List<TodoItem> items = List.of(
            TodoItem.builder()
                .id("todo-01")
                .priority("HIGH")
                .category("ATTENDANCE")
                .title("Chưa check-in ca hôm nay (Ca 08:00 - 17:30)")
                .description("Vui lòng check-in trước 09:30 để không bị tính đi muộn.")
                .actionLabel("Chấm Công Ngay")
                .actionUrl("/attendance/checkin")
                .dueDate("Hôm nay 09:30")
                .build(),
            TodoItem.builder()
                .id("todo-02")
                .priority("MEDIUM")
                .category("REQUEST")
                .title("Có 3 đơn từ của nhóm đang chờ duyệt")
                .description("2 đơn WFH và 1 đơn xin nghỉ phép năm của thành viên nhóm Optimus.")
                .actionLabel("Duyệt Nhanh")
                .actionUrl("/attendance/approvals")
                .dueDate("Trong 24h")
                .build(),
            TodoItem.builder()
                .id("todo-03")
                .priority("MEDIUM")
                .category("OKR")
                .title("Đóng link tự đánh giá OKR cuối năm sau 2 ngày")
                .description("Hoàn thành tự chấm điểm 4 Box (Business & People) trước hạn.")
                .actionLabel("Vào Form Đánh Giá")
                .actionUrl("/okr/assessment")
                .dueDate("Còn 2 ngày")
                .build(),
            TodoItem.builder()
                .id("todo-04")
                .priority("LOW")
                .category("SYSTEM")
                .title("Số dư phép năm 2026 của bạn còn 8.5 ngày")
                .description("Lưu ý mốc 01/04 chỉ được giữ lại tối đa 5 ngày phép tồn.")
                .actionLabel("Xem Sổ Phép")
                .actionUrl("/attendance/leaves")
                .dueDate("Thông tin")
                .build()
        );

        return ApiResponse.ok(items, "Lấy danh sách việc cần làm thành công");
    }
}
