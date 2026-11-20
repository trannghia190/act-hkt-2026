package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AttendanceLog;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.Notification;
import com.act.pulse.modules.attendance.entity.RequestAttachment;
import com.act.pulse.modules.attendance.entity.LeaveLedgerEntry;
import com.act.pulse.modules.attendance.entity.Holiday;
import com.act.pulse.modules.attendance.repository.RequestAttachmentRepository;
import com.act.pulse.modules.attendance.repository.LeaveLedgerRepository;
import com.act.pulse.modules.attendance.repository.HolidayRepository;
import java.math.BigDecimal;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
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
import org.springframework.data.domain.*;
import org.springframework.format.annotation.DateTimeFormat;

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
    private final LeaveLedgerRepository leaveLedgerRepository;
    private final HolidayRepository holidayRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    private String leaveTypeName(String code) {
        if (code == null) return null;
        return leaveTypeRepository.findByCode(code).map(lt -> lt.getName()).orElse(code);
    }

    @PostMapping("/check-conflicts")
    @Operation(summary = "Kiểm tra trùng ngày với đơn nghỉ phép/WFH đang chờ hoặc đã duyệt")
    public ApiResponse<List<Map<String, Object>>> checkConflicts(@RequestBody CreateRequest body) {
        UUID userId = CurrentUser.userId();
        if (userId == null) throw new RuntimeException("Chưa đăng nhập");
        LocalDate start = body.getWorkDate();
        LocalDate end = body.getEndDate() == null ? start : body.getEndDate();
        UUID exclude = null;
        try { if (body.getExcludeId() != null) exclude = UUID.fromString(body.getExcludeId()); } catch (Exception ignored) { }
        return ApiResponse.ok(findDayConflicts(userId, body.getType(), start, end, body.getPayload(), exclude), "Kiểm tra trùng ngày");
    }

    @PostMapping
    @Operation(summary = "Tạo đơn (nháp hoặc gửi) — S07/S30/S31/WFH")
    public ApiResponse<RequestEntity> create(@RequestBody CreateRequest body) {
        UUID userId = CurrentUser.userId();
        if (userId == null) throw new RuntimeException("Chưa đăng nhập");
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản"));

        // ── WFH: quota 2 lần/tuần · cho phép đăng ký lùi tối đa submit_within_days ngày ──
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
            int backfillDays = ruleService.getInt("wfh", "submit_within_days", 3);
            if (workDate.isBefore(LocalDate.now().minusDays(backfillDays))) {
                throw new RuntimeException("WFH chỉ đăng ký được trong vòng " + backfillDays + " ngày trước (kể cả hôm nay)");
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
            if (!Boolean.TRUE.equals(body.getDraft()) && workDate.isAfter(LocalDate.now())) {
                throw new RuntimeException("Bổ sung chấm công chỉ áp dụng cho hôm nay hoặc ngày đã qua");
            }
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

        List<Map<String, Object>> conflicts = findDayConflicts(userId, body.getType(),
                body.getWorkDate() == null ? LocalDate.now() : body.getWorkDate(),
                body.getEndDate() == null ? (body.getWorkDate() == null ? LocalDate.now() : body.getWorkDate()) : body.getEndDate(),
                body.getPayload(), null);
        if (!conflicts.isEmpty()) {
            if (!Boolean.TRUE.equals(body.getReplaceConflicts())) {
                throw new RuntimeException("Đơn trùng ngày với " + conflicts.size() + " đơn đã có. Xác nhận hủy đơn cũ để tiếp tục.");
            }
            cancelConflicts(conflicts, (body.getType() == null ? "đơn mới" : body.getType())
                    + " " + (body.getWorkDate() == null ? "" : body.getWorkDate()));
        }

        RequestEntity entity = RequestEntity.builder()
                .userId(userId)
                .requestType(body.getType())
                .leaveType(body.getLeaveType())
                .payload(body.getPayload() == null ? "{}" : body.getPayload())
                .appliedParameters(appliedJson)
                .workDate(body.getWorkDate() == null ? LocalDate.now() : body.getWorkDate())
                .endDate(body.getEndDate() == null
                        ? (body.getWorkDate() == null ? LocalDate.now() : body.getWorkDate())
                        : body.getEndDate())
                .minutes(body.getMinutes())
                .reason(body.getReason() == null ? "" : body.getReason())
                .status(Boolean.TRUE.equals(body.getDraft()) ? "DRAFT" : "PENDING_APPROVAL")
                .build();
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        return ApiResponse.ok(requestRepository.save(entity),
                Boolean.TRUE.equals(body.getDraft()) ? "Đã lưu nháp — không trừ quota" : "Đã gửi đơn tới quản lý");
    }

    @GetMapping("/my-quota")
    @Operation(summary = "Quota đã dùng trong tháng/tuần của tôi (không tính đơn hủy/từ chối/nháp)")
    public ApiResponse<Map<String, Object>> myQuota() {
        UUID userId = CurrentUser.userId();
        if (userId == null) throw new RuntimeException("Chưa đăng nhập");
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);
        long lateUsed = 0, adjustUsed = 0, wfhWeekUsed = 0;
        for (RequestEntity r : requestRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            boolean counted = "PENDING_APPROVAL".equals(r.getStatus()) || "APPROVED".equals(r.getStatus());
            if (!counted || r.getWorkDate() == null) continue;
            boolean sameMonth = r.getWorkDate().getMonth() == today.getMonth() && r.getWorkDate().getYear() == today.getYear();
            if ("LATE_EARLY".equals(r.getRequestType()) && sameMonth) lateUsed++;
            if ("ADJUST".equals(r.getRequestType()) && sameMonth) adjustUsed++;
            if ("WFH".equals(r.getRequestType()) && !r.getWorkDate().isBefore(weekStart) && !r.getWorkDate().isAfter(weekEnd)) wfhWeekUsed++;
        }
        Map<String, Object> out = new HashMap<>();
        out.put("lateUsed", lateUsed);
        out.put("lateMax", ruleService.getInt("late_early", "max_count", 2));
        out.put("adjustUsed", adjustUsed);
        out.put("adjustMax", ruleService.getInt("makeup", "max_count", 5));
        out.put("wfhWeekUsed", wfhWeekUsed);
        out.put("wfhMax", ruleService.getInt("wfh", "max_count", 2));
        out.put("weekStart", weekStart.toString());
        return ApiResponse.ok(out, "Quota của tôi");
    }

    @GetMapping("/my-requests")
    @Operation(summary = "Đơn của tôi (S08)")
    public ApiResponse<Object> myRequests(
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword
    ) {
        UUID userId = CurrentUser.userId();
        if (userId == null) throw new RuntimeException("Chưa đăng nhập");
        if (page == null) {
            return ApiResponse.ok(requestRepository.findByUserIdOrderByCreatedAtDesc(userId), "Đơn của tôi");
        }
        int safeSize = Math.max(1, Math.min(size, 100));
        Pageable pageable = PageRequest.of(Math.max(0, page), safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        String dbStatus = "PENDING".equals(status) ? "PENDING_APPROVAL" : status;
        String kw = keyword == null ? "" : keyword.trim();
        String typeFilter = type == null || type.isBlank() || "ALL".equals(type) ? null : type;
        String statusFilter = dbStatus == null || dbStatus.isBlank() || "ALL".equals(dbStatus) ? null : dbStatus;
        org.springframework.data.jpa.domain.Specification<RequestEntity> spec =
                (root, query, cb) -> cb.equal(root.get("userId"), userId);
        if (from != null) spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("workDate"), from));
        if (to != null) spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("workDate"), to));
        if (typeFilter != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("requestType"), typeFilter));
        if (statusFilter != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), statusFilter));
        if (!kw.isBlank()) spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("reason")), "%" + kw.toLowerCase() + "%"));
        Page<RequestEntity> result = requestRepository.findAll(spec, pageable);
        Map<String, Object> out = new HashMap<>();
        List<Map<String, Object>> content = new ArrayList<>();
        for (RequestEntity r : result.getContent()) {
            Map<String, Object> m = objectMapper.convertValue(r, Map.class);
            m.put("leaveTypeName", leaveTypeName(r.getLeaveType()));
            if (r.getDecidedBy() != null) {
                m.put("approverName", userRepository.findById(r.getDecidedBy()).map(User::getFullName).orElse(null));
            }
            content.add(m);
        }
        out.put("content", content);
        out.put("page", result.getNumber());
        out.put("size", result.getSize());
        out.put("totalElements", result.getTotalElements());
        out.put("totalPages", result.getTotalPages());
        return ApiResponse.ok(out, "Đơn của tôi");
    }

    @GetMapping("/history")
    @Operation(summary = "Lịch sử đơn đã duyệt/từ chối của quản lý (tab Đã duyệt / Bị từ chối)")
    public ApiResponse<List<Map<String, Object>>> history() {
        UUID me = CurrentUser.userId();
        String role = CurrentUser.role() == null ? "EMPLOYEE" : CurrentUser.role();
        java.util.Set<UUID> managed = new java.util.HashSet<>();
        for (User u : userRepository.findAll()) if (me.equals(u.getManagerId())) managed.add(u.getId());
        boolean allCompany = "HR_ADMIN".equals(role) || "ADMIN".equals(role);
        List<RequestEntity> list = new ArrayList<>();
        for (RequestEntity r : requestRepository.findAll()) {
            boolean decidedStatus = "APPROVED".equals(r.getStatus()) || "REJECTED".equals(r.getStatus());
            if (!decidedStatus) continue;
            if (allCompany || managed.contains(r.getUserId()) || me.equals(r.getDecidedBy())) list.add(r);
        }
        list.sort((a, b) -> {
            java.time.LocalDateTime da = a.getDecidedAt() == null ? java.time.LocalDateTime.MIN : a.getDecidedAt();
            java.time.LocalDateTime db = b.getDecidedAt() == null ? java.time.LocalDateTime.MIN : b.getDecidedAt();
            return db.compareTo(da);
        });
        List<Map<String, Object>> rows = new ArrayList<>();
        for (RequestEntity r : list) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId());
            m.put("userId", r.getUserId());
            m.put("requestType", r.getRequestType());
            m.put("leaveType", r.getLeaveType());
            m.put("leaveTypeName", leaveTypeName(r.getLeaveType()));
            m.put("workDate", r.getWorkDate());
            m.put("endDate", r.getEndDate());
            m.put("minutes", r.getMinutes());
            m.put("reason", r.getReason());
            m.put("status", r.getStatus());
            m.put("createdAt", r.getCreatedAt());
            m.put("decidedAt", r.getDecidedAt());
            m.put("decisionComment", r.getDecisionComment());
            m.put("payload", r.getPayload());
            m.put("attachmentCount", requestAttachmentRepository.countByRequestId(r.getId()));
            userRepository.findById(r.getUserId()).ifPresent(u -> {
                m.put("employeeCode", u.getEmployeeCode());
                m.put("employeeName", u.getFullName());
                m.put("employeeEmail", u.getEmail());
            });
            if (r.getDecidedBy() != null) {
                userRepository.findById(r.getDecidedBy()).ifPresent(u -> m.put("approverName", u.getFullName()));
            }
            rows.add(m);
        }
        return ApiResponse.ok(rows, "Lịch sử duyệt đơn");
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
            m.put("endDate", r.getEndDate());
            m.put("minutes", r.getMinutes());
            m.put("reason", r.getReason());
            m.put("status", r.getStatus());
            m.put("createdAt", r.getCreatedAt());
            m.put("appliedParameters", r.getAppliedParameters());
            m.put("payload", r.getPayload());
            m.put("leaveTypeName", leaveTypeName(r.getLeaveType()));
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
        RequestEntity r = canAccessRequest(id);
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
        out.put("leaveTypeName", leaveTypeName(r.getLeaveType()));
        out.put("attachmentCount", requestAttachmentRepository.countByRequestId(id));
        userRepository.findById(r.getUserId()).ifPresent(u -> {
            out.put("employeeCode", u.getEmployeeCode());
            out.put("employeeName", u.getFullName());
        });
        if (r.getDecidedBy() != null) {
            userRepository.findById(r.getDecidedBy()).ifPresent(u -> out.put("approverName", u.getFullName()));
        }
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
        String type = file.getContentType();
        if (type == null || type.isBlank()) type = "application/octet-stream";
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

    @PutMapping("/{id}")
    @Operation(summary = "Nhân viên sửa đơn đang chờ duyệt hoặc đã bị từ chối rồi gửi lại")
    public ApiResponse<RequestEntity> updateRequest(@PathVariable UUID id, @RequestBody CreateRequest body) {
        RequestEntity r = requestRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy đơn"));
        if (!r.getUserId().equals(CurrentUser.userId())) throw new RuntimeException("Chỉ được sửa đơn của mình");
        if (!"PENDING_APPROVAL".equals(r.getStatus()) && !"REJECTED".equals(r.getStatus()) && !"DRAFT".equals(r.getStatus())) {
            throw new RuntimeException("Chỉ sửa được đơn nháp, đang chờ duyệt hoặc bị từ chối");
        }
        if (body.getType() != null) r.setRequestType(body.getType());
        if (body.getLeaveType() != null) r.setLeaveType(body.getLeaveType());
        if (body.getWorkDate() != null) r.setWorkDate(body.getWorkDate());
        r.setEndDate(body.getEndDate() == null ? r.getWorkDate() : body.getEndDate());
        if (body.getMinutes() != null) r.setMinutes(body.getMinutes());
        if (body.getReason() != null) r.setReason(body.getReason());
        if (body.getPayload() != null) r.setPayload(body.getPayload());
        if (r.getReason() == null || r.getReason().isBlank()) throw new RuntimeException("Đơn phải có lý do");

        if ("LEAVE".equals(r.getRequestType())
                && leaveTypeRepository.findByCode(r.getLeaveType() == null ? "AL" : r.getLeaveType())
                    .map(lt -> Boolean.TRUE.equals(lt.getRequiresAttachment())).orElse(false)
                && requestAttachmentRepository.countByRequestId(id) == 0) {
            throw new RuntimeException("Loại nghỉ này bắt buộc có giấy tờ đính kèm");
        }
        if ("LATE_EARLY".equals(r.getRequestType())) {
            int maxMinutes = ruleService.getInt("late_early", "max_minutes", 60);
            if (r.getMinutes() == null || r.getMinutes() <= 0) throw new RuntimeException("Đơn đi muộn/về sớm phải có số phút > 0");
            if (r.getMinutes() > maxMinutes) throw new RuntimeException("Đi muộn/về sớm tối đa " + maxMinutes + " phút mỗi lần");
        }

        List<Map<String, Object>> conflicts = findDayConflicts(r.getUserId(), r.getRequestType(),
                r.getWorkDate(), r.getEndDate(), r.getPayload(), r.getId());
        if (!conflicts.isEmpty()) {
            if (!Boolean.TRUE.equals(body.getReplaceConflicts())) {
                throw new RuntimeException("Đơn trùng ngày với " + conflicts.size() + " đơn đã có. Xác nhận hủy đơn cũ để tiếp tục.");
            }
            cancelConflicts(conflicts, (r.getRequestType() == null ? "đơn sửa" : r.getRequestType())
                    + " " + (r.getWorkDate() == null ? "" : r.getWorkDate()));
        }

        r.setStatus("PENDING_APPROVAL");
        r.setDecidedBy(null);
        r.setDecidedAt(null);
        r.setDecisionComment(null);
        r.setUpdatedAt(LocalDateTime.now());
        return ApiResponse.ok(requestRepository.save(r), "Đã cập nhật đơn và gửi lại quản lý");
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

    private java.util.Set<String> requestSlots(String payload, LocalDate day) {
        java.util.Set<String> slots = new java.util.HashSet<>();
        boolean half = payload != null && payload.contains("half_day_period");
        if (!half) {
            slots.add("MORNING"); slots.add("AFTERNOON");
        } else if (payload.contains("MORNING")) {
            slots.add("MORNING");
        } else {
            slots.add("AFTERNOON");
        }
        return slots;
    }

    private boolean dayInRange(RequestEntity r, LocalDate day) {
        if (r.getWorkDate() == null || day.isBefore(r.getWorkDate())) return false;
        LocalDate end = r.getEndDate() == null ? r.getWorkDate() : r.getEndDate();
        return !day.isAfter(end);
    }

    private List<Map<String, Object>> findDayConflicts(UUID userId, String type, LocalDate start, LocalDate end,
                                                       String payload, UUID excludeId) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (start == null) return result;
        if (!"LEAVE".equals(type) && !"WFH".equals(type)) return result;
        LocalDate to = end == null ? start : end;
        java.util.Set<String> newSlots = requestSlots(payload, start);
        for (RequestEntity old : requestRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            if (excludeId != null && excludeId.equals(old.getId())) continue;
            if (!("LEAVE".equals(old.getRequestType()) || "WFH".equals(old.getRequestType()))) continue;
            if (!("PENDING_APPROVAL".equals(old.getStatus()) || "APPROVED".equals(old.getStatus()))) continue;
            boolean overlaps = false;
            for (LocalDate day = start; !day.isAfter(to); day = day.plusDays(1)) {
                if (!dayInRange(old, day)) continue;
                java.util.Set<String> oldSlots = requestSlots(old.getPayload(), day);
                for (String slot : newSlots) if (oldSlots.contains(slot)) { overlaps = true; break; }
                if (overlaps) break;
            }
            if (overlaps) {
                Map<String, Object> m = new HashMap<>();
                m.put("id", old.getId().toString());
                m.put("type", old.getRequestType());
                m.put("typeName", "LEAVE".equals(old.getRequestType()) ? "Nghỉ phép" : "WFH");
                m.put("leaveTypeName", leaveTypeName(old.getLeaveType()));
                m.put("workDate", String.valueOf(old.getWorkDate()));
                m.put("endDate", String.valueOf(old.getEndDate() == null ? old.getWorkDate() : old.getEndDate()));
                m.put("status", old.getStatus());
                m.put("reason", old.getReason());
                result.add(m);
            }
        }
        return result;
    }

    private int cancelConflicts(List<Map<String, Object>> conflicts, String newDescription) {
        int canceled = 0;
        for (Map<String, Object> c : conflicts) {
            UUID id = UUID.fromString(String.valueOf(c.get("id")));
            RequestEntity old = requestRepository.findById(id).orElse(null);
            if (old == null || !("PENDING_APPROVAL".equals(old.getStatus()) || "APPROVED".equals(old.getStatus()))) continue;
            old.setStatus("WITHDRAWN");
            old.setDecisionComment("Tự động hủy do trùng ngày với đơn mới: " + newDescription);
            old.setDecidedBy(CurrentUser.userId());
            old.setDecidedAt(LocalDateTime.now());
            old.setUpdatedAt(LocalDateTime.now());
            requestRepository.save(old);
            AuditLog log = AuditLog.builder().action("AUTO_CANCEL_DUPLICATE").entityName("REQUEST")
                    .entityId(id.toString()).userId(CurrentUser.userId()).reason("Đơn mới: " + newDescription).build();
            log.setCreatedAt(LocalDateTime.now());
            auditLogRepository.save(log);
            canceled++;
        }
        return canceled;
    }

    private double leaveDayCount(RequestEntity r) {
        if (r.getPayload() != null && r.getPayload().contains("half_day_period")) return 0.5;
        LocalDate start = r.getWorkDate();
        LocalDate end = r.getEndDate() == null ? start : r.getEndDate();
        if (start == null) return 0;
        java.util.Set<LocalDate> holidays = new java.util.HashSet<>();
        for (Holiday h : holidayRepository.findAll()) holidays.add(h.getHolidayDate());
        double days = 0;
        for (LocalDate cur = start; !cur.isAfter(end); cur = cur.plusDays(1)) {
            if (cur.getDayOfWeek().getValue() < 6 && !holidays.contains(cur)) days += 1;
        }
        return days;
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
        boolean wasApproved = "APPROVED".equals(r.getStatus());
        r.setStatus(approve ? "APPROVED" : "REJECTED");
        r.setDecidedBy(me);
        r.setDecidedAt(LocalDateTime.now());
        r.setDecisionComment(comment);
        RequestEntity saved = requestRepository.save(r);

        if (approve && "LEAVE".equals(r.getRequestType()) && !wasApproved) {
            double days = leaveDayCount(r);
            if (days > 0) {
                BigDecimal prev = leaveLedgerRepository.findByUserIdOrderByCreatedAtDesc(owner.getId()).stream()
                        .map(LeaveLedgerEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal amount = BigDecimal.valueOf(-days);
                leaveLedgerRepository.save(LeaveLedgerEntry.builder()
                        .userId(owner.getId())
                        .leaveType(r.getLeaveType() == null ? "AL" : r.getLeaveType())
                        .action("USED")
                        .amount(amount)
                        .balanceAfter(prev.add(amount))
                        .reason("Duyệt đơn nghỉ " + (r.getLeaveType() == null ? "AL" : r.getLeaveType())
                                + " ngày " + r.getWorkDate()
                                + (r.getEndDate() != null && !r.getEndDate().equals(r.getWorkDate()) ? " → " + r.getEndDate() : "")
                                + (days == 0.5 ? " (nửa ngày)" : ""))
                        .performedBy(me)
                        .performedBySystem(false)
                        .build());
            }
        }

        // Đơn đi muộn/về sớm được duyệt → cập nhật giờ vào/ra tương ứng trong bảng công.
        if (approve && ("LATE_EARLY".equals(r.getRequestType()) || "ADJUST".equals(r.getRequestType()))
                && r.getWorkDate() != null && r.getPayload() != null) {
            try {
                Map<?, ?> payload = objectMapper.readValue(r.getPayload(), Map.class);
                String kind = "ADJUST".equals(r.getRequestType())
                        ? String.valueOf(payload.get("adjust_kind"))
                        : String.valueOf(payload.get("late_early"));
                String time = payload.get("time") == null ? null : String.valueOf(payload.get("time"));
                if (time != null && time.matches("^\\d{2}:\\d{2}$")) {
                    LocalTime t = LocalTime.parse(time);
                    AttendanceLog log = attendanceLogRepository.findByUserIdAndWorkDate(owner.getId(), r.getWorkDate())
                            .orElseGet(() -> AttendanceLog.builder()
                                    .userId(owner.getId()).workDate(r.getWorkDate()).status("INCOMPLETE").build());
                    boolean out = "EARLY".equals(kind) || "OUT".equals(kind);
                    if (out) log.setCheckOutAt(r.getWorkDate().atTime(t));
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
        private LocalDate endDate;
        private Integer minutes;
        private String reason;
        private Boolean draft;
        private Boolean urgent;
        private Boolean replaceConflicts;
        private String excludeId;
        private Boolean locationAllowed;
    }
}
