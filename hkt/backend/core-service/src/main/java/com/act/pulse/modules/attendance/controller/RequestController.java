package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.Notification;
import com.act.pulse.modules.attendance.entity.RequestAttachment;
import com.act.pulse.modules.attendance.repository.RequestAttachmentRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.NotificationRepository;
import com.act.pulse.modules.attendance.repository.LeaveTypeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.DayOfWeek;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 4 loại đơn từ — **duyệt 1 cấp bởi quản lý trực tiếp** (docs/02 §2.3, quyết định #25).
 * Nghỉ phép KHÔNG chuyển HR; chỉ đi muộn/bổ sung/WFH của CA+Mobile mới có bước HR (rule hr_approval).
 */
@RestController
@RequestMapping("/requests")
@RequiredArgsConstructor
@Tag(name = "6. Requests & Approval API", description = "Đơn từ 4 loại, quota, nháp/gửi, duyệt 1 cấp quản lý")
public class RequestController {

    private final RequestRepository requestRepository;
    private final UserRepository userRepository;
    private final RuleService ruleService;
    private final LeaveTypeRepository leaveTypeRepository;
    private final NotificationRepository notificationRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final RequestAttachmentRepository requestAttachmentRepository;
    private final ObjectMapper objectMapper;

    @PostMapping
    @Operation(summary = "Tạo đơn (nháp hoặc gửi) — S07/S30/S31/WFH")
    public ApiResponse<RequestEntity> create(@RequestBody CreateRequest body) {
        UUID userId = CurrentUser.userId();
        if (userId == null) throw new RuntimeException("Chưa đăng nhập");
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản"));

        // ── WFH: quota 2 lần/tuần · hạn ≥ 1 ngày làm việc · vị trí cấm ──
        if ("WFH".equals(body.getType())) {
            LocalDate workDate = body.getWorkDate() == null ? LocalDate.now() : body.getWorkDate();
            LocalDate weekStart = workDate.with(DayOfWeek.MONDAY);
            LocalDate weekEnd = weekStart.plusDays(6);
            long weekly = requestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                    .filter(r -> "WFH".equals(r.getRequestType()))
                    .filter(r -> !"REJECTED".equals(r.getStatus()) && !"WITHDRAWN".equals(r.getStatus()) && !"DRAFT".equals(r.getStatus()))
                    .filter(r -> r.getWorkDate() != null && !r.getWorkDate().isBefore(weekStart) && !r.getWorkDate().isAfter(weekEnd))
                    .count();
            if (weekly >= 2) throw new RuntimeException("Đã đăng ký đủ 2 ngày WFH trong tuần này — lần thứ 3 bị chặn");
            if (workDate.isBefore(LocalDate.now().plusDays(1)) && !Boolean.TRUE.equals(body.getUrgent())) {
                throw new RuntimeException("WFH phải đăng ký trước ít nhất 1 ngày làm việc");
            }
        }

        if ("LATE_EARLY".equals(body.getType())) {
            LocalDate workDate = body.getWorkDate() == null ? LocalDate.now() : body.getWorkDate();
            long monthly = requestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                    .filter(r -> "LATE_EARLY".equals(r.getRequestType()))
                    .filter(r -> !"REJECTED".equals(r.getStatus()) && !"WITHDRAWN".equals(r.getStatus()) && !"DRAFT".equals(r.getStatus()))
                    .filter(r -> r.getWorkDate() != null && r.getWorkDate().getMonth() == workDate.getMonth()
                            && r.getWorkDate().getYear() == workDate.getYear())
                    .count();
            int max = ruleService.getInt("late_early", "max_count", 2);
            if (monthly >= max) throw new RuntimeException("Đã dùng đủ " + max + " lần đi muộn/về sớm trong tháng");
            int maxMinutes = ruleService.getInt("late_early", "max_minutes", 60);
            if (!Boolean.TRUE.equals(body.getDraft()) && (body.getMinutes() == null || body.getMinutes() <= 0)) {
                throw new RuntimeException("Đơn đi muộn/về sớm phải có số phút > 0");
            }
            if (body.getMinutes() != null && body.getMinutes() > maxMinutes) {
                throw new RuntimeException("Đi muộn/về sớm tối đa " + maxMinutes + " phút mỗi lần");
            }
            int submitWithin = ruleService.getInt("late_early", "submit_within_days", 3);
            if (!Boolean.TRUE.equals(body.getDraft()) && workDate.isBefore(LocalDate.now().minusDays(submitWithin))) {
                throw new RuntimeException("Chỉ được tạo đơn đi muộn/về sớm trong vòng " + submitWithin + " ngày kể từ ngày xảy ra");
            }
        }

        // ── NGHỈ PHÉP: hạn gửi theo cấu hình loại nghỉ (mặc định 3 ngày) ──
        if ("LEAVE".equals(body.getType())) {
            LocalDate workDate = body.getWorkDate() == null ? LocalDate.now() : body.getWorkDate();
            int submitWithin = leaveTypeRepository.findByCode(body.getLeaveType() == null ? "AL" : body.getLeaveType())
                    .map(lt -> lt.getSubmitWithinDays() == null ? 3 : lt.getSubmitWithinDays())
                    .orElse(ruleService.getInt("leave_request", "submit_within_days", 3));
            if (!Boolean.TRUE.equals(body.getDraft()) && workDate.isBefore(LocalDate.now().minusDays(submitWithin))) {
                throw new RuntimeException("Loại nghỉ này chỉ được gửi trong vòng " + submitWithin + " ngày kể từ ngày nghỉ");
            }
        }

        boolean overdueFlag = false;
        if ("ADJUST".equals(body.getType())) {
            LocalDate workDate = body.getWorkDate() == null ? LocalDate.now() : body.getWorkDate();
            long monthly = requestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                    .filter(r -> "ADJUST".equals(r.getRequestType()))
                    .filter(r -> !"REJECTED".equals(r.getStatus()) && !"WITHDRAWN".equals(r.getStatus()) && !"DRAFT".equals(r.getStatus()))
                    .filter(r -> r.getWorkDate() != null && r.getWorkDate().getMonth() == workDate.getMonth()
                            && r.getWorkDate().getYear() == workDate.getYear())
                    .count();
            if (monthly >= 5) throw new RuntimeException("Đã dùng đủ 5 lần bổ sung công trong tháng");
            int deadlineDays = ruleService.getInt("makeup", "deadline_working_days", 3);
            if (!Boolean.TRUE.equals(body.getDraft()) && workDate.isBefore(LocalDate.now().minusDays(deadlineDays))) {
                throw new RuntimeException("Bổ sung chấm công chỉ được gửi trong vòng " + deadlineDays + " ngày kể từ ngày quên chấm");
            }
        }

        Map<String, Object> params = switch (body.getType()) {
            case "LATE_EARLY" -> ruleService.get("late_early");
            case "ADJUST" -> ruleService.get("makeup");
            case "WFH" -> ruleService.get("wfh");
            default -> ruleService.get("leave_type_defaults");
        };
        // 3 tầng kế thừa cho nghỉ phép: rule chung → cấu hình loại nghỉ → ghi đè của đơn
        Map<String, Object> applied = new java.util.HashMap<>(params);
        if ("LEAVE".equals(body.getType())) {
            if (body.getLeaveType() != null) {
                leaveTypeRepository.findByCode(body.getLeaveType()).ifPresent(lt -> {
                    applied.put("leave_type", lt.getCode());
                    applied.put("is_paid", lt.getIsPaid());
                    applied.put("deducts_annual_leave", lt.getDeductsAnnualLeave());
                    applied.put("unit", lt.getUnit());
                    applied.put("requires_attachment", lt.getRequiresAttachment());
                    applied.put("submit_within_days", lt.getSubmitWithinDays());
                    if (lt.getConfig() != null) {
                        try {
                            Map<String, Object> cfg = objectMapper.readValue(lt.getConfig(), Map.class);
                            applied.putAll(cfg);
                        } catch (Exception ignored) { }
                    }
                });
            }
            if (body.getPayload() != null) {
                try {
                    Map<String, Object> override = objectMapper.readValue(body.getPayload(), Map.class);
                    applied.putAll(override);
                } catch (Exception ignored) { }
            }
        }

        if (overdueFlag) applied.put("overdue_submitted", true);
        String appliedJson;
        try {
            appliedJson = objectMapper.writeValueAsString(applied);
        } catch (Exception e) {
            appliedJson = "{}";
        }

        RequestEntity entity = RequestEntity.builder()
                .userId(userId)
                .requestType(body.getType())
                .leaveType(body.getLeaveType())
                .payload(body.getPayload() == null ? "{}" : body.getPayload())
                .appliedParameters(appliedJson)
                .workDate(body.getWorkDate() == null ? LocalDate.now() : body.getWorkDate())
                .minutes(body.getMinutes())
                .reason(body.getReason() == null ? "" : body.getReason())
                .status(Boolean.TRUE.equals(body.getDraft()) ? "DRAFT" : "PENDING_APPROVAL")
                .build();
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        return ApiResponse.ok(requestRepository.save(entity),
                Boolean.TRUE.equals(body.getDraft()) ? "Đã lưu nháp — không trừ quota" : "Đã gửi đơn tới quản lý");
    }

    @GetMapping("/my-requests")
    @Operation(summary = "Đơn của tôi (S08)")
    public ApiResponse<List<RequestEntity>> myRequests() {
        return ApiResponse.ok(requestRepository.findByUserIdOrderByCreatedAtDesc(CurrentUser.userId()), "Đơn của tôi");
    }

    @GetMapping("/inbox")
    @Operation(summary = "Hộp thư duyệt của quản lý (S12)")
    public ApiResponse<List<Map<String, Object>>> inbox() {
        List<UUID> managed = userRepository.findAll().stream()
                .filter(u -> CurrentUser.userId().equals(u.getManagerId()))
                .map(User::getId)
                .collect(Collectors.toList());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (RequestEntity r : requestRepository.findByUserIdInAndStatusOrderByCreatedAtDesc(managed, "PENDING_APPROVAL")) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId());
            m.put("userId", r.getUserId());
            m.put("requestType", r.getRequestType());
            m.put("leaveType", r.getLeaveType());
            m.put("workDate", r.getWorkDate());
            m.put("minutes", r.getMinutes());
            m.put("reason", r.getReason());
            m.put("status", r.getStatus());
            m.put("createdAt", r.getCreatedAt());
            m.put("appliedParameters", r.getAppliedParameters());
            m.put("payload", r.getPayload());
            m.put("attachmentCount", requestAttachmentRepository.countByRequestId(r.getId()));
            userRepository.findById(r.getUserId()).ifPresent(u -> {
                m.put("employeeCode", u.getEmployeeCode());
                m.put("employeeName", u.getFullName());
                m.put("employeeEmail", u.getEmail());
                m.put("positionName", u.getPositionName());
            });
            rows.add(m);
        }
        return ApiResponse.ok(rows, "Đơn chờ duyệt");
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết đơn + timeline (S13)")
    public ApiResponse<Map<String, Object>> detail(@PathVariable UUID id) {
        RequestEntity r = requestRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy đơn"));
        java.util.List<Map<String, Object>> timeline = new java.util.ArrayList<>();
        timeline.add(Map.of("at", String.valueOf(r.getCreatedAt()), "actor", "Nhân viên", "action", "Gửi đơn"));
        if (r.getDecidedAt() != null) {
            timeline.add(Map.of("at", String.valueOf(r.getDecidedAt()), "actor", "Quản lý",
                    "action", "APPROVED".equals(r.getStatus()) ? "Đã duyệt" : "Đã từ chối"));
        }
        Map<String, Object> out = new HashMap<>();
        out.put("request", r);
        out.put("timeline", timeline);
        out.put("impact", r.getMinutes() != null ? "Trừ " + r.getMinutes() + " phút công" : "Không đổi bảng công");
        out.put("attachmentCount", requestAttachmentRepository.countByRequestId(id));
        userRepository.findById(r.getUserId()).ifPresent(u -> {
            out.put("employeeCode", u.getEmployeeCode());
            out.put("employeeName", u.getFullName());
        });
        return ApiResponse.ok(out, "Chi tiết đơn");
    }

    @PostMapping("/{id}/attachments")
    @Operation(summary = "Tải lên giấy tờ đính kèm cho đơn (nghỉ ốm, thai sản…)")
    public ApiResponse<Map<String, Object>> uploadAttachment(@PathVariable UUID id, @RequestParam("file") MultipartFile file) {
        RequestEntity r = requestRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy đơn"));
        UUID me = CurrentUser.userId();
        if (!r.getUserId().equals(me)) throw new RuntimeException("Chỉ người tạo đơn mới được đính kèm file");
        if (!"PENDING_APPROVAL".equals(r.getStatus()) && !"DRAFT".equals(r.getStatus())) {
            throw new RuntimeException("Chỉ đính kèm được khi đơn còn nháp hoặc chờ duyệt");
        }
        if (file == null || file.isEmpty()) throw new RuntimeException("File rỗng");
        if (file.getSize() > 10 * 1024 * 1024) throw new RuntimeException("File tối đa 10MB");
        String type = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        String originalName = file.getOriginalFilename();
        String name = originalName == null || originalName.isBlank() ? "file"
                : originalName.substring(Math.max(originalName.lastIndexOf('/'), originalName.lastIndexOf('\\')) + 1);
        String lowerName = name.toLowerCase();
        boolean extOk = lowerName.endsWith(".pdf") || lowerName.endsWith(".png") || lowerName.endsWith(".jpg")
                || lowerName.endsWith(".jpeg") || lowerName.endsWith(".webp");
        if (!(type.startsWith("image/") || type.equals("application/pdf")
                || (type.equals("application/octet-stream") && extOk))) {
            throw new RuntimeException("Chỉ nhận ảnh hoặc PDF");
        }
        RequestAttachment att;
        try {
            att = RequestAttachment.builder().requestId(id).fileName(name).contentType(type)
                    .sizeBytes(file.getSize()).data(file.getBytes()).uploadedBy(me).build();
        } catch (Exception e) {
            throw new RuntimeException("Không đọc được file tải lên");
        }
        requestAttachmentRepository.save(att);
        Map<String, Object> out = new HashMap<>();
        out.put("id", att.getId().toString());
        out.put("fileName", att.getFileName());
        out.put("contentType", att.getContentType());
        out.put("sizeBytes", att.getSizeBytes());
        return ApiResponse.ok(out, "Đã tải lên giấy tờ đính kèm");
    }

    @GetMapping("/{id}/attachments")
    @Operation(summary = "Danh sách giấy tờ đính kèm của đơn")
    public ApiResponse<List<Map<String, Object>>> listAttachments(@PathVariable UUID id) {
        RequestEntity r = canAccessRequest(id);
        List<Map<String, Object>> list = new ArrayList<>();
        for (RequestAttachment a : requestAttachmentRepository.findByRequestIdOrderByCreatedAtAsc(r.getId())) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", a.getId().toString());
            m.put("fileName", a.getFileName());
            m.put("contentType", a.getContentType());
            m.put("sizeBytes", a.getSizeBytes());
            m.put("createdAt", String.valueOf(a.getCreatedAt()));
            list.add(m);
        }
        return ApiResponse.ok(list, "Danh sách giấy tờ đính kèm");
    }

    @GetMapping("/{id}/attachments/{attachmentId}")
    @Operation(summary = "Tải file đính kèm")
    public ResponseEntity<byte[]> downloadAttachment(@PathVariable UUID id, @PathVariable UUID attachmentId) {
        canAccessRequest(id);
        RequestAttachment a = requestAttachmentRepository.findById(attachmentId)
                .filter(x -> id.equals(x.getRequestId()))
                .orElseThrow(() -> new RuntimeException("Không tìm thấy file đính kèm"));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.getContentType() == null ? "application/octet-stream" : a.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + a.getFileName() + "\"")
                .body(a.getData());
    }

    private RequestEntity canAccessRequest(UUID id) {
        RequestEntity r = requestRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy đơn"));
        UUID me = CurrentUser.userId();
        String role = CurrentUser.role();
        boolean allowed = me.equals(r.getUserId()) || me.equals(r.getDecidedBy())
                || "HR_ADMIN".equals(role) || "ADMIN".equals(role)
                || userRepository.findById(r.getUserId()).map(u -> me.equals(u.getManagerId())).orElse(false);
        if (!allowed) throw new RuntimeException("Không có quyền xem giấy tờ của đơn này");
        return r;
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Quản lý duyệt đơn (1 cấp)")
    public ApiResponse<RequestEntity> approve(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        String comment = body == null ? null : body.get("comment");
        return decide(id, true, comment);
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Quản lý từ chối — bắt buộc lý do")
    public ApiResponse<RequestEntity> reject(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        String comment = body == null ? null : body.get("comment");
        if (comment == null || comment.isBlank()) throw new RuntimeException("Từ chối phải nhập lý do");
        return decide(id, false, comment);
    }

    @PostMapping("/{id}/withdraw")
    @Operation(summary = "Nhân viên rút đơn khi chưa duyệt")
    public ApiResponse<RequestEntity> withdraw(@PathVariable UUID id) {
        RequestEntity r = requestRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy đơn"));
        if (!r.getUserId().equals(CurrentUser.userId())) throw new RuntimeException("Chỉ được rút đơn của mình");
        if (!"PENDING_APPROVAL".equals(r.getStatus()) && !"DRAFT".equals(r.getStatus())) {
            throw new RuntimeException("Chỉ rút/huỷ được đơn nháp hoặc đang chờ duyệt");
        }
        r.setStatus("WITHDRAWN");
        return ApiResponse.ok(requestRepository.save(r), "Đã rút đơn");
    }

    @PostMapping("/{id}/submit")
    @Operation(summary = "Gửi duyệt đơn đang lưu nháp")
    public ApiResponse<RequestEntity> submitDraft(@PathVariable UUID id) {
        RequestEntity r = requestRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy đơn"));
        if (!r.getUserId().equals(CurrentUser.userId())) throw new RuntimeException("Chỉ được gửi đơn của mình");
        if (!"DRAFT".equals(r.getStatus())) throw new RuntimeException("Chỉ gửi duyệt được đơn nháp");
        r.setStatus("PENDING_APPROVAL");
        r.setUpdatedAt(LocalDateTime.now());
        return ApiResponse.ok(requestRepository.save(r), "Đã gửi đơn tới quản lý");
    }

    @PostMapping("/bulk-approve")
    @Operation(summary = "Duyệt hàng loạt")
    public ApiResponse<List<RequestEntity>> bulkApprove(@RequestBody List<UUID> ids) {
        List<RequestEntity> result = new ArrayList<>();
        for (UUID id : ids) result.add(decide(id, true, null).getData());
        return ApiResponse.ok(result, "Đã duyệt " + result.size() + " đơn");
    }

    private ApiResponse<RequestEntity> decide(UUID id, boolean approve, String comment) {
        RequestEntity r = requestRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy đơn"));
        User owner = userRepository.findById(r.getUserId()).orElseThrow();
        UUID me = CurrentUser.userId();
        boolean isManager = me.equals(owner.getManagerId())
                || userRepository.findById(me).map(u -> "HR_ADMIN".equals(u.getRole()) || "ADMIN".equals(u.getRole())).orElse(false);
        if (!isManager) throw new RuntimeException("Chỉ quản lý trực tiếp (hoặc HR) được duyệt");
        if (approve && "LEAVE".equals(r.getRequestType())
                && leaveTypeRepository.findByCode(r.getLeaveType() == null ? "AL" : r.getLeaveType())
                    .map(lt -> Boolean.TRUE.equals(lt.getRequiresAttachment())).orElse(false)
                && requestAttachmentRepository.countByRequestId(id) == 0) {
            throw new RuntimeException("Loại nghỉ này bắt buộc có giấy tờ đính kèm — nhân viên cần tải file trước khi duyệt");
        }
        r.setStatus(approve ? "APPROVED" : "REJECTED");
        r.setDecidedBy(me);
        r.setDecidedAt(LocalDateTime.now());
        r.setDecisionComment(comment);
        RequestEntity saved = requestRepository.save(r);

        // Đơn đi muộn/về sớm được duyệt → cập nhật giờ vào/ra tương ứng trong bảng công.
        if (approve && "LATE_EARLY".equals(r.getRequestType()) && r.getWorkDate() != null && r.getPayload() != null) {
            try {
                Map<?, ?> payload = objectMapper.readValue(r.getPayload(), Map.class);
                String kind = String.valueOf(payload.get("late_early"));
                String time = payload.get("time") == null ? null : String.valueOf(payload.get("time"));
                if (time != null && time.matches("^\\d{2}:\\d{2}$")) {
                    LocalTime t = LocalTime.parse(time);
                    AttendanceLog log = attendanceLogRepository.findByUserIdAndWorkDate(owner.getId(), r.getWorkDate())
                            .orElseGet(() -> AttendanceLog.builder()
                                    .userId(owner.getId()).workDate(r.getWorkDate()).status("INCOMPLETE").build());
                    if ("EARLY".equals(kind)) log.setCheckOutAt(r.getWorkDate().atTime(t));
                    else log.setCheckInAt(r.getWorkDate().atTime(t));
                    log.setStatus(log.getCheckInAt() != null && log.getCheckOutAt() != null ? "VALID" : "INCOMPLETE");
                    attendanceLogRepository.save(log);
                }
            } catch (Exception ignored) { /* payload cũ/không hợp lệ: chỉ duyệt đơn, không sửa log */ }
        }

        // Nhân viên nhận thông báo kết quả duyệt/từ chối (từ chối luôn kèm lý do).
        notificationRepository.save(Notification.builder()
                .userId(owner.getId())
                .title(approve ? "Đơn đã được duyệt" : "Đơn bị từ chối")
                .content("Đơn " + r.getRequestType() + " ngày " + r.getWorkDate()
                        + (comment == null || comment.isBlank() ? "" : " — Lý do: " + comment))
                .type("REQUEST")
                .priority(approve ? "MEDIUM" : "HIGH")
                .actionUrl("/attendance/requests")
                .isRead(false)
                .build());

        return ApiResponse.ok(saved, approve ? "Đã duyệt đơn" : "Đã từ chối đơn");
    }

    @lombok.Data
    public static class CreateRequest {
        private String type;
        private String leaveType;
        private String payload;
        private LocalDate workDate;
        private Integer minutes;
        private String reason;
        private Boolean draft;
        private Boolean urgent;
        private Boolean locationAllowed;
    }
}
