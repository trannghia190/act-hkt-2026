package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.LeaveTypeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
            if (Boolean.FALSE.equals(body.getLocationAllowed())) {
                throw new RuntimeException("Vị trí đăng ký WFH không được phép");
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
        }

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
            boolean allowOverdue = ruleService.getBoolean("makeup", "allow_overdue_with_approval", false);
            if (workDate.isBefore(LocalDate.now().minusDays(deadlineDays)) && !allowOverdue) {
                throw new RuntimeException("Đã quá hạn " + deadlineDays + " ngày để bổ sung chấm công");
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
    public ApiResponse<List<RequestEntity>> inbox() {
        List<UUID> managed = userRepository.findAll().stream()
                .filter(u -> CurrentUser.userId().equals(u.getManagerId()))
                .map(User::getId)
                .collect(Collectors.toList());
        return ApiResponse.ok(requestRepository.findByUserIdInAndStatusOrderByCreatedAtDesc(managed, "PENDING_APPROVAL"), "Đơn chờ duyệt");
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
        return ApiResponse.ok(Map.of("request", r, "timeline", timeline,
                "impact", r.getMinutes() != null ? "Trừ " + r.getMinutes() + " phút công" : "Không đổi bảng công"),
                "Chi tiết đơn");
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Quản lý duyệt đơn (1 cấp)")
    public ApiResponse<RequestEntity> approve(@PathVariable UUID id) {
        return decide(id, true, null);
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
        if (!"PENDING_APPROVAL".equals(r.getStatus())) throw new RuntimeException("Chỉ rút được đơn đang chờ duyệt");
        r.setStatus("WITHDRAWN");
        return ApiResponse.ok(requestRepository.save(r), "Đã rút đơn");
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
        r.setStatus(approve ? "APPROVED" : "REJECTED");
        r.setDecidedBy(me);
        r.setDecidedAt(LocalDateTime.now());
        r.setDecisionComment(comment);
        return ApiResponse.ok(requestRepository.save(r), approve ? "Đã duyệt đơn" : "Đã từ chối đơn");
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
