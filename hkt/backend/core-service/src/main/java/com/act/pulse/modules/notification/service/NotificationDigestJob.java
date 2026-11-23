package com.act.pulse.modules.notification.service;

import com.act.pulse.modules.auth.controller.TodoController;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Job digest 08:00 (S36) — gửi **1 email duy nhất** mỗi sáng gồm:
 * <ul>
 *   <li>các mục bị dồn vì giờ yên lặng / vượt hạn mức push mỗi ngày,</li>
 *   <li>việc thật đang chờ của người dùng (lấy từ Todo Inbox).</li>
 * </ul>
 * <p>Trước đây endpoint {@code POST /cron/send-daily-digest} chỉ chạy tay và gửi
 * danh sách 3 việc hard-code — không có lịch 08:00, không có dữ liệu thật.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationDigestJob {

    private final NotificationDispatcher dispatcher;
    private final TodoController todoController;
    private final UserRepository userRepository;
    private final NotificationEmailService emailService;

    @Scheduled(cron = "0 0 8 * * *")
    public void scheduledDigest() {
        int sent = sendDigestForAll();
        log.info("Digest 08:00 hoàn tất — đã gửi cho {} người dùng", sent);
    }

    /** Gửi digest cho toàn bộ người dùng đang hoạt động. */
    public int sendDigestForAll() {
        int sent = 0;
        for (User user : userRepository.findAll()) {
            if (!isActive(user)) continue;
            if (sendDigestFor(user)) sent++;
        }
        return sent;
    }

    /**
     * Gửi digest cho một user.
     *
     * @return true nếu đã gửi email.
     */
    public boolean sendDigestFor(User user) {
        if (user == null || !isActive(user)) return false;

        List<Map<String, Object>> tasks = new ArrayList<>();

        // 1. Các mục bị dồn (quiet hours / vượt hạn mức push). Nội dung ưu tiên lấy từ
        // chính delivery: kênh WEB có thể đang tắt nên không có dòng notifications nào.
        var deferred = dispatcher.deferredItems(user.getId());
        for (var delivery : deferred) {
            String title = delivery.getTitle();
            String content = delivery.getContent();
            if (title == null && delivery.getNotificationId() != null) {
                var notif = dispatcher.notificationContent(delivery.getNotificationId());
                if (notif.isPresent()) {
                    title = notif.get().getTitle();
                    content = notif.get().getContent();
                }
            }
            if (title == null) continue;
            tasks.add(task(title, content, "overdue"));
        }

        // 2. Việc thật đang chờ (todo inbox) — bỏ trùng tiêu đề.
        for (var todo : currentTodos(user)) {
            Object titleValue = todo.get("title");
            if (titleValue == null) continue;
            String title = String.valueOf(titleValue);
            boolean dup = tasks.stream().anyMatch(t -> title.equals(String.valueOf(t.get("title"))));
            if (!dup) tasks.add(task(title, String.valueOf(todo.getOrDefault("description", "")), urgency(todo)));
        }

        if (tasks.isEmpty()) return false;

        Map<String, Object> leave = new LinkedHashMap<>();
        leave.put("totalRemaining", 0);
        leave.put("carriedRemaining", 0);
        leave.put("annualRemaining", 0);

        boolean sent = emailService.sendDeferredDigest(user, tasks, leave) > 0;
        if (sent && !deferred.isEmpty()) {
            dispatcher.markDeferredConsumed(deferred);
        }
        return sent;
    }

    /**
     * Số việc cá nhân đang chờ (dùng cho thẻ "Việc của tôi" trên trang tuỳ chỉnh).
     * Loại mục chờ duyệt — chúng đã được {@link #pendingApprovalCount} đếm riêng,
     * nếu không với quản lý/HR một đơn chờ duyệt sẽ bị tính ở cả hai thẻ.
     */
    public long pendingTaskCount(UUID userId) {
        return currentTodosFor(userId).stream()
                .filter(t -> !"APPROVAL_PENDING".equals(t.get("kind")))
                .count();
    }

    /** Số việc duyệt đang chờ của user (quản lý/HR). */
    public long pendingApprovalCount(UUID userId) {
        return currentTodosFor(userId).stream()
                .filter(t -> "APPROVAL_PENDING".equals(t.get("kind")))
                .count();
    }

    // ── helper ──────────────────────────────────────────────────────────────
    private List<Map<String, Object>> currentTodos(User user) {
        return currentTodosFor(user.getId());
    }

    /** Việc chờ của user — dùng chung logic với Todo Inbox để số liệu luôn khớp. */
    private List<Map<String, Object>> currentTodosFor(UUID userId) {
        if (userId == null) return List.of();
        try {
            List<Map<String, Object>> out = new ArrayList<>();
            for (var item : todoController.itemsFor(userId)) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("todoId", item.getId());
                m.put("kind", item.getKind());
                m.put("title", item.getTitle());
                m.put("description", item.getDescription());
                m.put("urgency", item.getUrgency());
                m.put("category", item.getCategory());
                out.add(m);
            }
            return out;
        } catch (Exception ex) {
            log.warn("Không lấy được todo cho user {}: {}", userId, ex.getMessage());
            return List.of();
        }
    }

    private static Map<String, Object> task(String title, String description, String urgency) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", title == null ? "Thông báo" : title);
        m.put("description", description == null ? "" : description);
        m.put("urgency", urgency);
        return m;
    }

    private static String urgency(Map<String, Object> todo) {
        Object u = todo.get("urgency");
        return u == null ? "today" : String.valueOf(u);
    }

    private static boolean isActive(User user) {
        if (user == null) return false;
        String status = user.getStatus();
        return status == null || "ACTIVE".equalsIgnoreCase(status);
    }
}
