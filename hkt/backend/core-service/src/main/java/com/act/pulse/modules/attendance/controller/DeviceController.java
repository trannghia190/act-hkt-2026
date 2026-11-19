package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
import com.act.pulse.modules.attendance.repository.DeviceRegistrationRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** S28 — HR duyệt đăng ký thiết bị mới / thu hồi thiết bị mất; mọi thao tác ghi audit log. */
@RestController
@RequestMapping("/admin/devices")
@RequiredArgsConstructor
@Tag(name = "7. Device Management API")
public class DeviceController {

    private final DeviceRegistrationRepository deviceRepository;
    private final AuditLogRepository auditLogRepository;

    @GetMapping
    @Operation(summary = "Danh sách toàn bộ thiết bị (S28)")
    public ApiResponse<List<DeviceRegistration>> list() {
        return ApiResponse.ok(deviceRepository.findAll(), "Danh sách thiết bị");
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Duyệt thiết bị đang chờ")
    public ApiResponse<DeviceRegistration> approve(@PathVariable UUID id) {
        DeviceRegistration d = deviceRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị"));
        d.setIsApproved(true);
        d.setApprovedBy(CurrentUser.userId());
        d.setUpdatedAt(LocalDateTime.now());
        audit("APPROVE_DEVICE", d, "Duyệt thiết bị " + d.getDeviceFingerprint());
        return ApiResponse.ok(deviceRepository.save(d), "Đã duyệt thiết bị");
    }

    @PostMapping("/{id}/revoke")
    @Operation(summary = "Thu hồi thiết bị mất / bị trộm")
    public ApiResponse<DeviceRegistration> revoke(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        DeviceRegistration d = deviceRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị"));
        d.setIsApproved(false);
        d.setUpdatedAt(LocalDateTime.now());
        audit("REVOKE_DEVICE", d, body != null ? body.getOrDefault("reason", "Thu hồi thiết bị") : "Thu hồi thiết bị");
        return ApiResponse.ok(deviceRepository.save(d), "Đã thu hồi thiết bị");
    }

    private void audit(String action, DeviceRegistration d, String reason) {
        AuditLog log = AuditLog.builder()
                .action(action).entityName("DEVICE").entityId(String.valueOf(d.getId()))
                .userId(CurrentUser.userId()).userCode(CurrentUser.employeeCode())
                .newValue(String.valueOf(d.getIsApproved())).reason(reason)
                .build();
        log.setCreatedAt(LocalDateTime.now());
        auditLogRepository.save(log);
    }
}
