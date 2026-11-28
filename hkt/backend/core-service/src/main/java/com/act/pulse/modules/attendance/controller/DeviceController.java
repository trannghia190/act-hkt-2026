package com.act.pulse.modules.attendance.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.dto.response.AdminDeviceDto;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import com.act.pulse.modules.attendance.entity.Team;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
import com.act.pulse.modules.attendance.repository.DeviceRegistrationRepository;
import com.act.pulse.modules.attendance.repository.TeamRepository;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** S28 — HR duyệt đăng ký thiết bị mới / thu hồi thiết bị mất; mọi thao tác ghi audit log. */
@RestController
@RequestMapping("/admin/devices")
@RequiredArgsConstructor
@Tag(name = "7. Device Management API")
public class DeviceController {

    private final DeviceRegistrationRepository deviceRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;

    @GetMapping
    @Operation(summary = "Danh sách toàn bộ thiết bị kèm chủ sở hữu (S28)")
    public ApiResponse<List<AdminDeviceDto>> list() {
        List<DeviceRegistration> devices = deviceRepository.findAll();

        // 3 query tổng cộng (devices + users + teams), không N+1.
        Set<UUID> userIds = devices.stream()
                .map(DeviceRegistration::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        Set<UUID> teamIds = users.values().stream()
                .map(User::getTeamId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, Team> teams = teamRepository.findAllById(teamIds).stream()
                .collect(Collectors.toMap(Team::getId, t -> t, (a, b) -> a));

        Comparator<DeviceRegistration> order = (a, b) -> {
            int rank = Integer.compare(rank(a), rank(b));
            if (rank != 0) return rank;
            LocalDateTime ca = a.getCreatedAt();
            LocalDateTime cb = b.getCreatedAt();
            if (ca == null || cb == null) return 0;
            // Chờ duyệt: cũ nhất trước (FIFO); còn lại: mới nhất trước.
            return rank(a) == 0 ? ca.compareTo(cb) : cb.compareTo(ca);
        };

        List<AdminDeviceDto> out = devices.stream()
                .sorted(order)
                .map(d -> {
                    User u = users.get(d.getUserId());
                    Team t = u == null || u.getTeamId() == null ? null : teams.get(u.getTeamId());
                    return AdminDeviceDto.of(d, u, t);
                })
                .toList();

        return ApiResponse.ok(out, "Danh sách thiết bị");
    }

    /** 0 = chờ duyệt, 1 = đang hoạt động, 2 = đã thu hồi. */
    private static int rank(DeviceRegistration d) {
        if (d.getRevokedAt() != null) return 2;
        return Boolean.TRUE.equals(d.getIsApproved()) ? 1 : 0;
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Duyệt thiết bị đang chờ")
    public ApiResponse<DeviceRegistration> approve(@PathVariable UUID id) {
        DeviceRegistration d = deviceRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị"));
        d.setIsApproved(true);
        d.setApprovedBy(CurrentUser.userId());
        d.setRevokedAt(null);
        d.setUpdatedAt(LocalDateTime.now());
        audit("APPROVE_DEVICE", d, "Duyệt thiết bị " + d.getDeviceFingerprint());
        return ApiResponse.ok(deviceRepository.save(d), "Đã duyệt thiết bị");
    }

    @PostMapping("/{id}/revoke")
    @Operation(summary = "Thu hồi thiết bị mất / bị trộm")
    public ApiResponse<DeviceRegistration> revoke(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        DeviceRegistration d = deviceRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị"));
        d.setIsApproved(false);
        d.setRevokedAt(LocalDateTime.now());
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
