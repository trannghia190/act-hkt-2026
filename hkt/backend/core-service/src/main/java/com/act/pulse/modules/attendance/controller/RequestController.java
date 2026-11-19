package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.service.RuleService;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
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

    @PostMapping
    @Operation(summary = "Tạo đơn (nháp hoặc gửi) — S07/S30/S31/WFH")
    public ApiResponse<RequestEntity> create(@RequestBody CreateRequest body) {
        UUID userId = CurrentUser.userId();
        if (userId == null) throw new RuntimeException("Chưa đăng nhập");
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản"));

        Map<String, Object> params = switch (body.getType()) {
            case "LATE_EARLY" -> ruleService.get("late_early");
            case "ADJUST" -> ruleService.get("makeup");
            case "WFH" -> ruleService.get("wfh");
            default -> ruleService.get("leave_type_defaults");
        };

        RequestEntity entity = RequestEntity.builder()
                .userId(userId)
                .requestType(body.getType())
                .leaveType(body.getLeaveType())
                .payload(body.getPayload() == null ? "{}" : body.getPayload())
                .appliedParameters(params.toString())
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
    public ApiResponse<RequestEntity> detail(@PathVariable UUID id) {
        return ApiResponse.ok(requestRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy đơn")), "Chi tiết đơn");
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
    }
}
