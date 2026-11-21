package com.act.pulse.modules.okr.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.okr.entity.*;
import com.act.pulse.modules.okr.repository.*;
import com.act.pulse.modules.okr.service.OKRManagementService;
import com.act.pulse.modules.okr.service.OKRPhaseService;
import com.act.pulse.modules.okr.service.OKRRuleException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** F3 — Check-in tiến độ theo từng đầu việc, prefill kỳ trước, file evidence. */
@RestController
@RequestMapping("/okr/check-ins")
@RequiredArgsConstructor
@Tag(name = "3.2 OKR Check-in", description = "Check-in định kỳ: chỉ nhập giá trị mới, prefill kỳ trước, đính kèm evidence")
public class OKRCheckInController {

    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXT = Set.of(
            ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".txt");

    private final OKRManagementService management;
    private final OKRPhaseService phaseService;
    private final OKRReviewRepository reviewRepository;
    private final OKRItemRepository itemRepository;
    private final OKRCheckInRepository checkInRepository;
    private final OKRCheckInAttachmentRepository attachmentRepository;

    private record CheckInInput(OKRItem item, double newValue, double previous) {}

    /** Lý do không check-in được (null = được phép). */
    private String blockReason(OKRReview review, OKRCycle cycle) {
        if (cycle == null) return "Chưa có chu kỳ OKR";
        if (review == null) return "Chưa có hồ sơ OKR để check-in";
        if (!management.isCurrentlyApproved(review)) {
            return "OKR chưa được duyệt hoặc đang mở sửa — chỉ check-in trên bộ mục tiêu đang ở trạng thái đã duyệt";
        }
        try {
            phaseService.requireOpen(cycle, OKRPhaseService.CHECKIN);
        } catch (OKRRuleException e) {
            return e.getMessage();
        }
        return null;
    }

    @GetMapping("/current")
    @Operation(summary = "Dữ liệu check-in kỳ hiện tại — prefill giá trị kỳ trước (S22)")
    public ApiResponse<Map<String, Object>> current(@RequestParam(required = false) Integer year) {
        User user = management.requireCurrentUser();
        int y = phaseService.resolveYear(year);
        OKRCycle cycle = phaseService.cycle(y).orElse(null);
        OKRReview review = reviewRepository.findByUserIdAndCycleYear(user.getId(), y).orElse(null);
        String period = phaseService.currentPeriod(cycle);
        LocalDate deadline = cycle == null ? null : phaseService.currentPeriodDeadline(cycle);
        long daysLeft = deadline == null ? 0 : Math.max(0, ChronoUnit.DAYS.between(LocalDate.now(), deadline));
        String blockReason = blockReason(review, cycle);

        List<OKRItem> items = review == null ? List.of() : management.activeItems(review.getId());
        List<Map<String, Object>> business = new ArrayList<>();
        List<Map<String, Object>> people = new ArrayList<>();
        int pending = 0;
        for (OKRItem item : items) {
            OKRCheckIn last = checkInRepository.findFirstByItemIdOrderByCreatedAtDesc(item.getId()).orElse(null);
            double previous = last != null && last.getNewValue() != null ? last.getNewValue() : item.getProgress().doubleValue();
            boolean doneThisPeriod = last != null && period.equals(last.getPeriod());
            if (!doneThisPeriod) pending++;

            Map<String, Object> row = new HashMap<>();
            row.put("itemId", item.getId().toString());
            row.put("title", item.getTitle());
            row.put("groupType", item.getGroupType());
            row.put("previousValue", previous);
            row.put("newValue", previous);
            row.put("progress", item.getProgress());
            row.put("unit", "%");
            row.put("dueDate", item.getDueDate());
            row.put("checkedInThisPeriod", doneThisPeriod);
            row.put("lastPeriod", last != null ? last.getPeriod() : null);
            row.put("lastCheckInAt", last != null ? last.getCreatedAt() : null);
            row.put("lastNote", last != null ? last.getNote() : null);
            if ("PEOPLE".equalsIgnoreCase(item.getGroupType())) people.add(row);
            else business.add(row);
        }

        boolean canCheckIn = blockReason == null && pending > 0;
        Map<String, Object> data = new HashMap<>();
        data.put("year", y);
        data.put("period", period);
        data.put("reviewStatus", review != null ? review.getStatus() : null);
        data.put("isLocked", review != null && ("submitted".equalsIgnoreCase(review.getStatus())
                || "locked".equalsIgnoreCase(review.getStatus())));
        data.put("deadline", deadline);
        data.put("daysLeft", daysLeft);
        data.put("canCheckIn", canCheckIn);
        data.put("blockReason", blockReason != null ? blockReason
                : (pending == 0 && !items.isEmpty() ? "Đã check-in đủ các đầu việc trong kỳ " + period : null));
        data.put("pendingCount", pending);
        data.put("reminder", blockReason == null && pending > 0 && daysLeft <= 3);
        data.put("reminderText", blockReason != null ? blockReason
                : "Kỳ " + period + " — còn " + daysLeft + " ngày đến hạn (" + deadline + ")");
        data.put("businessItems", business);
        data.put("peopleItems", people);
        data.put("totalItems", business.size() + people.size());
        return ApiResponse.ok(data, "Dữ liệu check-in kỳ " + period);
    }

    @PostMapping
    @Transactional
    @Operation(summary = "Nộp check-in định kỳ — chỉ nhập giá trị mới, tiến độ tự tính (S22)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkIn(@RequestBody(required = false) Map<String, Object> payload) {
        User user = management.requireCurrentUser();
        Map<String, Object> body = payload == null ? Map.of() : payload;
        int year = phaseService.resolveYear(body.get("year") == null ? null : Integer.valueOf(body.get("year").toString()));
        OKRCycle cycle = phaseService.cycle(year).orElse(null);
        OKRReview review = reviewRepository.findByUserIdAndCycleYear(user.getId(), year).orElse(null);
        String reason = blockReason(review, cycle);
        if (reason != null) throw OKRRuleException.conflict(reason);

        // Kỳ do server quyết định — không cho check-in hộ kỳ khác.
        String period = phaseService.currentPeriod(cycle);
        Object requested = body.get("period");
        if (requested != null && !requested.toString().isBlank() && !period.equals(requested.toString().trim())) {
            throw OKRRuleException.badRequest("Chỉ được check-in cho kỳ hiện tại (" + period + ")");
        }
        String note = body.get("note") == null ? "" : body.get("note").toString().trim();
        if (!(body.get("items") instanceof List<?> entries) || entries.isEmpty()) {
            throw OKRRuleException.badRequest("Cần nhập giá trị mới cho ít nhất 1 đầu việc");
        }

        // Validate toàn bộ trước khi ghi để tránh lưu dở dang
        List<CheckInInput> inputs = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (Object entryObj : entries) {
            if (!(entryObj instanceof Map<?, ?> entry)) continue;
            Object itemIdObj = entry.get("itemId");
            Object valueObj = entry.get("newValue");
            if (itemIdObj == null || valueObj == null || valueObj.toString().isBlank()) continue;

            UUID itemId;
            double newValue;
            try {
                itemId = UUID.fromString(itemIdObj.toString());
                newValue = Double.parseDouble(valueObj.toString());
            } catch (Exception e) {
                throw OKRRuleException.badRequest("Giá trị mới không hợp lệ");
            }
            if (!Double.isFinite(newValue) || newValue < 0 || newValue > 100) {
                throw OKRRuleException.badRequest("Giá trị mới phải trong khoảng 0–100");
            }
            if (!seen.add(itemId)) throw OKRRuleException.badRequest("Một đầu việc chỉ nhập 1 giá trị mỗi lần check-in");

            OKRItem item = itemRepository.findById(itemId).orElse(null);
            if (item == null || !review.getId().equals(item.getReviewId()) || item.getDeletedAt() != null) {
                throw OKRRuleException.badRequest("Đầu việc không thuộc OKR của bạn");
            }
            OKRCheckIn last = checkInRepository.findFirstByItemIdOrderByCreatedAtDesc(itemId).orElse(null);
            if (last != null && period.equals(last.getPeriod())) {
                throw OKRRuleException.conflict("Đầu việc \"" + item.getTitle() + "\" đã check-in kỳ " + period
                        + " — mỗi kỳ chỉ check-in 1 lần");
            }
            double previous = last != null ? last.getNewValue() : item.getProgress().doubleValue();
            inputs.add(new CheckInInput(item, newValue, previous));
        }
        if (inputs.isEmpty()) throw OKRRuleException.badRequest("Chưa có giá trị mới nào được nhập");

        UUID batchId = UUID.randomUUID();
        List<Map<String, Object>> saved = new ArrayList<>();
        for (CheckInInput input : inputs) {
            OKRItem item = input.item();
            int progress = (int) Math.round(input.newValue());
            OKRCheckIn checkin = checkInRepository.save(OKRCheckIn.builder()
                    .batchId(batchId)
                    .reviewId(review.getId())
                    .itemId(item.getId())
                    .userId(user.getId())
                    .period(period)
                    .previousValue(input.previous())
                    .newValue(input.newValue())
                    .progressSnapshot(progress)
                    .note(note)
                    .build());
            item.setProgress(progress);
            itemRepository.save(item);

            Map<String, Object> row = new HashMap<>();
            row.put("checkinId", checkin.getId().toString());
            row.put("itemId", item.getId().toString());
            row.put("title", item.getTitle());
            row.put("groupType", item.getGroupType());
            row.put("previousValue", input.previous());
            row.put("newValue", input.newValue());
            row.put("progress", progress);
            saved.add(row);
        }

        Map<String, Object> data = new HashMap<>();
        data.put("batchId", batchId.toString());
        data.put("period", period);
        data.put("note", note);
        data.put("savedCount", saved.size());
        data.put("checkins", saved);
        data.put("businessProgress", Math.round(management.groupProgress(review.getId(), "BUSINESS") * 10.0) / 10.0);
        data.put("peopleProgress", Math.round(management.groupProgress(review.getId(), "PEOPLE") * 10.0) / 10.0);
        data.put("attachmentCount", 0);
        return ResponseEntity.ok(ApiResponse.ok(data, "Đã lưu check-in tiến độ kỳ " + period));
    }

    @GetMapping("/history")
    @Operation(summary = "Lịch sử check-in của một đầu việc — không ghi đè giá trị cũ (S22)")
    public ApiResponse<List<Map<String, Object>>> history(@RequestParam UUID itemId) {
        User user = management.requireCurrentUser();
        OKRItem item = itemRepository.findById(itemId).orElseThrow(() -> OKRRuleException.notFound("Không tìm thấy đầu việc"));
        OKRReview review = management.requireReview(item.getReviewId());
        if (!user.getId().equals(review.getUserId()) && !management.canManage(review, user)) {
            throw OKRRuleException.forbidden("Bạn không có quyền xem lịch sử check-in này");
        }

        List<Map<String, Object>> list = new ArrayList<>();
        for (OKRCheckIn ci : checkInRepository.findByItemIdOrderByCreatedAtDesc(itemId)) {
            List<Map<String, Object>> attachments = new ArrayList<>();
            for (OKRCheckInAttachment att : attachmentRepository.findByBatchIdOrderByCreatedAtAsc(ci.getBatchId())) {
                attachments.add(attachmentMap(att));
            }
            Map<String, Object> row = new HashMap<>();
            row.put("id", ci.getId().toString());
            row.put("batchId", ci.getBatchId().toString());
            row.put("period", ci.getPeriod());
            row.put("previousValue", ci.getPreviousValue());
            row.put("newValue", ci.getNewValue());
            row.put("progressSnapshot", ci.getProgressSnapshot());
            row.put("note", ci.getNote());
            row.put("createdAt", ci.getCreatedAt());
            row.put("attachments", attachments);
            list.add(row);
        }
        return ApiResponse.ok(list, "Lịch sử check-in của đầu việc");
    }

    @PostMapping("/{batchId}/attachments")
    @Operation(summary = "Đính kèm file evidence cho một lần check-in (S22)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> upload(@PathVariable UUID batchId,
                                                                    @RequestParam("file") MultipartFile file) {
        User user = management.requireCurrentUser();
        List<OKRCheckIn> batch = checkInRepository.findByBatchId(batchId);
        if (batch.isEmpty() || batch.stream().noneMatch(c -> user.getId().equals(c.getUserId()))) {
            throw OKRRuleException.forbidden("Không có quyền đính kèm cho lần check-in này");
        }
        if (file == null || file.isEmpty()) throw OKRRuleException.badRequest("File rỗng");
        if (file.getSize() > MAX_FILE_BYTES) throw OKRRuleException.badRequest("File tối đa 10MB");

        String originalName = file.getOriginalFilename();
        String name = originalName == null || originalName.isBlank() ? "file"
                : originalName.substring(Math.max(originalName.lastIndexOf('/'), originalName.lastIndexOf('\\')) + 1);
        String lower = name.toLowerCase();
        if (ALLOWED_EXT.stream().noneMatch(lower::endsWith)) {
            throw OKRRuleException.badRequest("Chỉ nhận ảnh, PDF, Word, Excel hoặc TXT");
        }
        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) contentType = "application/octet-stream";

        OKRCheckInAttachment att;
        try {
            att = OKRCheckInAttachment.builder()
                    .batchId(batchId)
                    .fileName(name)
                    .contentType(contentType)
                    .sizeBytes(file.getSize())
                    .data(file.getBytes())
                    .uploadedBy(user.getId())
                    .build();
        } catch (Exception e) {
            throw OKRRuleException.badRequest("Không đọc được file tải lên");
        }
        attachmentRepository.save(att);
        Map<String, Object> out = attachmentMap(att);
        out.put("batchId", batchId.toString());
        return ResponseEntity.ok(ApiResponse.ok(out, "Đã đính kèm file evidence"));
    }

    @GetMapping("/{batchId}/attachments")
    @Operation(summary = "Danh sách file evidence của một lần check-in (S22)")
    public ApiResponse<List<Map<String, Object>>> listAttachments(@PathVariable UUID batchId) {
        requireBatchAccess(batchId);
        List<Map<String, Object>> list = new ArrayList<>();
        for (OKRCheckInAttachment att : attachmentRepository.findByBatchIdOrderByCreatedAtAsc(batchId)) {
            list.add(attachmentMap(att));
        }
        return ApiResponse.ok(list, "Danh sách file evidence");
    }

    @GetMapping("/attachments/{attachmentId}")
    @Operation(summary = "Xem/tải file evidence check-in (S22)")
    public ResponseEntity<byte[]> download(@PathVariable UUID attachmentId) {
        OKRCheckInAttachment att = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> OKRRuleException.notFound("Không tìm thấy file"));
        requireBatchAccess(att.getBatchId());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + att.getFileName().replace("\"", "") + "\"")
                .contentType(att.getContentType() == null ? MediaType.APPLICATION_OCTET_STREAM
                        : MediaType.parseMediaType(att.getContentType()))
                .body(att.getData());
    }

    private void requireBatchAccess(UUID batchId) {
        User user = management.requireCurrentUser();
        List<OKRCheckIn> batch = checkInRepository.findByBatchId(batchId);
        if (batch.isEmpty()) throw OKRRuleException.notFound("Không tìm thấy lần check-in");
        if (batch.stream().anyMatch(c -> user.getId().equals(c.getUserId())) || CurrentUser.isHr()) return;
        OKRReview review = reviewRepository.findById(batch.get(0).getReviewId()).orElse(null);
        if (review == null || !user.getId().equals(review.getManagerId())) {
            throw OKRRuleException.forbidden("Không có quyền xem file của lần check-in này");
        }
    }

    private Map<String, Object> attachmentMap(OKRCheckInAttachment att) {
        Map<String, Object> a = new HashMap<>();
        a.put("id", att.getId().toString());
        a.put("fileName", att.getFileName());
        a.put("contentType", att.getContentType());
        a.put("sizeBytes", att.getSizeBytes());
        a.put("createdAt", att.getCreatedAt());
        return a;
    }
}
