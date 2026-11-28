package com.act.pulse.modules.attendance.dto.response;

import com.act.pulse.modules.attendance.entity.DeviceRegistration;
import com.act.pulse.modules.attendance.entity.Team;
import com.act.pulse.modules.attendance.service.DeviceUserAgentParser;
import com.act.pulse.modules.auth.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Thiết bị trả về cho màn HR duyệt (S11/S28): kèm chủ sở hữu và loại thiết bị.
 * <p>Giữ đủ mọi key của entity để client / test cũ không bị vỡ khi chuyển từ entity sang DTO.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDeviceDto {

    private UUID id;
    private UUID userId;
    private String deviceFingerprint;
    private String deviceModel;
    private String osVersion;
    private Boolean isApproved;
    private UUID approvedBy;
    private Integer grantDays;
    private LocalDateTime expiresAt;
    private LocalDateTime revokedAt;
    private LocalDateTime lastActiveAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** Metadata V68 — loại thiết bị, UA gốc và lý do nhân viên nhập. */
    private String deviceType;
    private String userAgent;
    private String requestReason;

    /** Chủ sở hữu — để HR biết "thiết bị của ai". */
    private String ownerName;
    private String employeeCode;
    private String teamName;
    private String ownerStatus;

    public static AdminDeviceDto of(DeviceRegistration d, User owner, Team team) {
        return AdminDeviceDto.builder()
                .id(d.getId())
                .userId(d.getUserId())
                .deviceFingerprint(d.getDeviceFingerprint())
                .deviceModel(d.getDeviceModel())
                .osVersion(d.getOsVersion())
                .isApproved(d.getIsApproved())
                .approvedBy(d.getApprovedBy())
                .grantDays(d.getGrantDays())
                .expiresAt(d.getExpiresAt())
                .revokedAt(d.getRevokedAt())
                .lastActiveAt(d.getLastActiveAt())
                .createdAt(d.getCreatedAt())
                .updatedAt(d.getUpdatedAt())
                // Dữ liệu cũ chưa có device_type → suy lại từ UA / tên máy / OS.
                .deviceType(DeviceUserAgentParser.effectiveType(
                        d.getDeviceType(), d.getUserAgent(), d.getDeviceModel(), d.getOsVersion()))
                .userAgent(d.getUserAgent())
                .requestReason(d.getRequestReason())
                .ownerName(owner == null ? null : owner.getFullName())
                .employeeCode(owner == null ? null : owner.getEmployeeCode())
                .teamName(team == null ? null : team.getName())
                .ownerStatus(owner == null ? null : owner.getStatus())
                .build();
    }
}
