package com.act.pulse.modules.okr.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.okr.entity.OKRItem;
import com.act.pulse.modules.okr.entity.OKRMidYearReview;
import com.act.pulse.modules.okr.entity.OKRReview;
import com.act.pulse.modules.okr.repository.OKRItemRepository;
import com.act.pulse.modules.okr.repository.OKRMidYearReviewRepository;
import com.act.pulse.modules.okr.repository.OKRReviewRepository;
import com.act.pulse.modules.okr.service.OKRManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/** F5 — Review giữa năm: tiến độ check-in, coaching, điều chỉnh mục tiêu có audit. */
@RestController
@RequestMapping("/okr/midyear")
@RequiredArgsConstructor
@Tag(name = "3.1 OKR Mid-Year Review", description = "Review & coaching giữa năm, điều chỉnh mục tiêu có lý do + audit trail")
public class OKRMidYearController {

    private final OKRManagementService management;
    private final OKRReviewRepository reviewRepository;
    private final OKRItemRepository itemRepository;
    private final OKRMidYearReviewRepository midYearRepository;
    private final com.act.pulse.modules.okr.service.OKRPhaseService phaseService;

    /** Thao tác ghi của review giữa năm: chỉ khi phase giữa năm đang mở và OKR đã được duyệt. */
    private void requireMidYearWritable(OKRReview review) {
        phaseService.requireOpen(management.cycleOf(review), com.act.pulse.modules.okr.service.OKRPhaseService.MIDYEAR);
        if (!management.isApproved(review)) {
            throw com.act.pulse.modules.okr.service.OKRRuleException.conflict("OKR chưa được duyệt đầu năm — chưa review giữa năm được");
        }
    }

    @GetMapping("/reviews")
    @Operation(summary = "Danh sách nhân viên cần review giữa năm kèm tiến độ & cảnh báo")
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(name = "year", required = false) Integer yearParam) {
        int year = phaseService.resolveYear(yearParam);
        User actor = management.currentUser();
        if (actor == null) throw com.act.pulse.modules.okr.service.OKRRuleException.forbidden("Chưa đăng nhập");

        List<OKRReview> reviews = management.isHrOrAdmin()
                ? reviewRepository.findByCycleYear(year)
                : reviewRepository.findByManagerIdAndCycleYear(actor.getId(), year);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (OKRReview review : reviews) {
            if (!management.reachedManager(review)) continue;
            rows.add(management.teamRow(review));
        }
        rows.sort((a, b) -> Integer.compare(
                ((Number) b.getOrDefault("riskScore", 0)).intValue(),
                ((Number) a.getOrDefault("riskScore", 0)).intValue()));
        return ApiResponse.ok(rows, "Danh sách review giữa năm");
    }

    @GetMapping("/reviews/{id}")
    @Operation(summary = "Chi tiết review giữa năm: 2 nhóm, xu hướng check-in, coaching, audit trail")
    public ApiResponse<Map<String, Object>> detail(@PathVariable UUID id) {
        OKRReview review = reviewRepository.findById(id).orElse(null);
        if (review == null) throw com.act.pulse.modules.okr.service.OKRRuleException.notFound("Không tìm thấy hồ sơ OKR");
        User actor = management.currentUser();
        if (!management.canManage(review, actor)) {
            throw com.act.pulse.modules.okr.service.OKRRuleException.forbidden("Bạn không có quyền review OKR này");
        }
        Map<String, Object> detail = new HashMap<>(management.midYearDetail(review));
        String lockReason = null;
        try {
            requireMidYearWritable(review);
        } catch (com.act.pulse.modules.okr.service.OKRRuleException e) {
            lockReason = e.getMessage();
        }
        detail.put("midYearWritable", lockReason == null);
        detail.put("midYearLockReason", lockReason);
        return ApiResponse.ok(detail, "Chi tiết review giữa năm");
    }

    @PostMapping("/reviews/{id}")
    @Operation(summary = "Lưu biên bản coaching giữa năm cho nhân viên")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveNotes(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body
    ) {
        OKRReview review = reviewRepository.findById(id).orElse(null);
        if (review == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy hồ sơ OKR"));
        User actor = management.currentUser();
        if (!management.canManage(review, actor)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Bạn không có quyền review OKR này"));
        }
        requireMidYearWritable(review);

        OKRMidYearReview mid = midYearRepository.findByReviewId(id)
                .orElseGet(() -> OKRMidYearReview.builder()
                        .reviewId(id)
                        .managerId(review.getManagerId() != null ? review.getManagerId() : actor.getId())
                        .build());
        mid.setEmployeeFeedback(str(body.get("employeeFeedback")));
        mid.setManagerCoaching(str(body.get("managerCoaching")));
        mid.setH2Commitment(str(body.get("h2Commitment")));
        mid.setStatus(body.get("status") == null ? "saved" : str(body.get("status")));
        midYearRepository.save(mid);

        management.audit(id, review.getCycleId(), null, "MIDYEAR_NOTE", "coaching",
                null, "Đã lưu biên bản coaching giữa năm", "Cập nhật nhận xét/coaching giữa năm");
        management.notify(review.getUserId(), "Quản lý đã cập nhật review giữa năm",
                "Biên bản coaching giữa năm của bạn đã được cập nhật.", "OKR_MIDYEAR", "/okr/my-okr");

        Map<String, Object> data = new HashMap<>();
        data.put("reviewId", id.toString());
        data.put("status", mid.getStatus());
        return ResponseEntity.ok(ApiResponse.ok(data, "Đã lưu biên bản review giữa năm"));
    }

    @PutMapping("/reviews/{id}/items/{itemId}")
    @Operation(summary = "Điều chỉnh mục tiêu giữa năm — bắt buộc lý do, ghi audit từng trường")
    public ResponseEntity<ApiResponse<Boolean>> adjustItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @RequestBody Map<String, Object> body
    ) {
        OKRReview review = reviewRepository.findById(id).orElse(null);
        OKRItem item = itemRepository.findById(itemId).orElse(null);
        if (review == null || item == null || !review.getId().equals(item.getReviewId()) || item.getDeletedAt() != null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy mục tiêu"));
        }
        User actor = management.currentUser();
        if (!management.canManage(review, actor)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Bạn không có quyền điều chỉnh OKR này"));
        }
        requireMidYearWritable(review);
        String reason = str(body.get("reason")).trim();
        if (reason.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Lý do điều chỉnh là bắt buộc"));
        }

        List<Map<String, Object>> changes = new ArrayList<>();
        if (body.containsKey("title")) {
            String newTitle = str(body.get("title")).trim();
            if (!newTitle.isEmpty() && !newTitle.equals(item.getTitle())) {
                changes.add(change("title", item.getTitle(), newTitle));
                item.setTitle(newTitle);
            }
        }
        if (body.containsKey("detail")) {
            String newDetail = str(body.get("detail")).trim();
            if (!Objects.equals(newDetail, item.getDetail() == null ? "" : item.getDetail())) {
                changes.add(change("detail", item.getDetail(), newDetail));
                item.setDetail(newDetail);
            }
        }
        if (body.containsKey("dueDate")) {
            Object rawDue = body.get("dueDate");
            LocalDate newDue = null;
            if (rawDue != null && !rawDue.toString().isBlank()) {
                newDue = parseDate(rawDue);
                if (newDue == null) {
                    return ResponseEntity.badRequest().body(ApiResponse.error("Hạn chót mục tiêu không hợp lệ (yyyy-mm-dd)"));
                }
            }
            if (!Objects.equals(newDue, item.getDueDate())) {
                changes.add(change("dueDate",
                        item.getDueDate() == null ? null : item.getDueDate().toString(),
                        newDue == null ? null : newDue.toString()));
                item.setDueDate(newDue);
            }
        }
        if (changes.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Không có thay đổi nào để lưu"));
        }
        itemRepository.save(item);
        for (Map<String, Object> change : changes) {
            management.audit(id, review.getCycleId(), itemId, "ADJUST_ITEM",
                    (String) change.get("field"), (String) change.get("oldValue"),
                    (String) change.get("newValue"), reason);
        }
        management.notify(review.getUserId(), "OKR được điều chỉnh giữa năm",
                "Quản lý đã điều chỉnh mục tiêu OKR. Lý do: " + reason, "OKR_ADJUSTED", "/okr/my-okr");
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã điều chỉnh mục tiêu và ghi audit"));
    }

    @PostMapping("/reviews/{id}/items")
    @Operation(summary = "Thêm mục tiêu giữa năm — bắt buộc lý do, ghi audit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addItem(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body
    ) {
        OKRReview review = reviewRepository.findById(id).orElse(null);
        if (review == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy hồ sơ OKR"));
        User actor = management.currentUser();
        if (!management.canManage(review, actor)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Bạn không có quyền điều chỉnh OKR này"));
        }
        requireMidYearWritable(review);
        String reason = str(body.get("reason")).trim();
        String title = str(body.get("title")).trim();
        if (reason.isEmpty()) return ResponseEntity.badRequest().body(ApiResponse.error("Lý do thêm mục tiêu là bắt buộc"));
        if (title.isEmpty()) return ResponseEntity.badRequest().body(ApiResponse.error("Tên mục tiêu không được để trống"));

        LocalDate dueDate = null;
        if (body.get("dueDate") != null && !body.get("dueDate").toString().isBlank()) {
            dueDate = parseDate(body.get("dueDate"));
            if (dueDate == null) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Hạn chót mục tiêu không hợp lệ (yyyy-mm-dd)"));
            }
        }
        String group = "PEOPLE".equalsIgnoreCase(str(body.get("groupType"))) ? "PEOPLE" : "BUSINESS";
        OKRItem item = OKRItem.builder()
                .reviewId(id)
                .groupType(group)
                .title(title)
                .detail(str(body.get("detail")))
                .dueDate(dueDate)
                .progress(0)
                .build();
        itemRepository.save(item);

        management.audit(id, review.getCycleId(), item.getId(), "ADD_ITEM", "title", null, title, reason);
        management.notify(review.getUserId(), "OKR có mục tiêu mới",
                "Quản lý đã thêm mục tiêu \"" + title + "\". Lý do: " + reason, "OKR_ADJUSTED", "/okr/my-okr");

        Map<String, Object> data = new HashMap<>();
        data.put("id", item.getId().toString());
        data.put("groupType", item.getGroupType());
        data.put("title", item.getTitle());
        return ResponseEntity.ok(ApiResponse.ok(data, "Đã thêm mục tiêu giữa năm"));
    }

    @DeleteMapping("/reviews/{id}/items/{itemId}")
    @Operation(summary = "Bớt mục tiêu giữa năm — xoá mềm, bắt buộc lý do, ghi audit")
    public ResponseEntity<ApiResponse<Boolean>> removeItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @RequestParam(required = false) String reason
    ) {
        OKRReview review = reviewRepository.findById(id).orElse(null);
        OKRItem item = itemRepository.findById(itemId).orElse(null);
        if (review == null || item == null || !review.getId().equals(item.getReviewId()) || item.getDeletedAt() != null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy mục tiêu"));
        }
        User actor = management.currentUser();
        if (!management.canManage(review, actor)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Bạn không có quyền điều chỉnh OKR này"));
        }
        requireMidYearWritable(review);
        if (reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Lý do bớt mục tiêu là bắt buộc"));
        }
        item.setDeletedAt(LocalDateTime.now());
        item.setDeleteReason(reason.trim());
        itemRepository.save(item);
        management.audit(id, review.getCycleId(), itemId, "REMOVE_ITEM", "title", item.getTitle(), null, reason.trim());
        management.notify(review.getUserId(), "OKR bớt mục tiêu",
                "Quản lý đã bớt mục tiêu \"" + item.getTitle() + "\". Lý do: " + reason.trim(), "OKR_ADJUSTED", "/okr/my-okr");
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã bớt mục tiêu (lưu vết lịch sử)"));
    }

    @PostMapping("/reviews/{id}/reopen")
    @Operation(summary = "Mở cho nhân viên sửa bổ sung — nộp lại sẽ khoá")
    public ResponseEntity<ApiResponse<Boolean>> reopen(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        OKRReview review = reviewRepository.findById(id).orElse(null);
        if (review == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Không tìm thấy hồ sơ OKR"));
        User actor = management.currentUser();
        if (!management.canManage(review, actor)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Bạn không có quyền mở lại OKR này"));
        }
        requireMidYearWritable(review);
        String reason = body == null ? "" : str(body.get("reason")).trim();
        if (reason.isEmpty()) reason = "Quản lý mở lại để nhân viên bổ sung trong review giữa kỳ";
        String old = review.getStatus();
        if ("reopened".equalsIgnoreCase(old) || "returned".equalsIgnoreCase(old)) {
            return ResponseEntity.ok(ApiResponse.ok(true, "OKR đang mở cho nhân viên sửa"));
        }
        review.setStatus("reopened");
        review.setReopenedAt(LocalDateTime.now());
        review.setManagerFeedback(reason);
        reviewRepository.save(review);
        management.audit(id, review.getCycleId(), null, "REOPEN", "status", old, "reopened", reason);
        management.notify(review.getUserId(), "OKR được mở lại để bổ sung",
                reason, "OKR_REOPENED", "/okr/my-okr");
        return ResponseEntity.ok(ApiResponse.ok(true, "Đã mở lại quyền sửa cho nhân viên"));
    }

    private Map<String, Object> change(String field, String oldValue, String newValue) {
        Map<String, Object> m = new HashMap<>();
        m.put("field", field);
        m.put("oldValue", oldValue);
        m.put("newValue", newValue);
        return m;
    }

    private String str(Object value) {
        return value == null ? "" : value.toString();
    }

    private LocalDate parseDate(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            return LocalDate.parse(value.toString().substring(0, 10));
        } catch (Exception e) {
            return null;
        }
    }
}
