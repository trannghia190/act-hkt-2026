package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.entity.SystemConfig;
import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.common.service.SystemConfigService;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/admin/system-config")
@RequiredArgsConstructor
@Tag(name = "System Configuration", description = "Quản lý cấu hình hệ thống tập trung (Domain Host, Base URL)")
public class SystemConfigController {

    private final SystemConfigService systemConfigService;
    private final AuditLogRepository auditLogRepository;

    @Data
    public static class UpdateDomainRequest {
        private String domainHost;
        private String reason;
    }

    @GetMapping("/domain")
    @Operation(summary = "Lấy thông tin cấu hình Domain Host hiện tại của hệ thống (Chỉ dành cho Admin & HR)")
    public ApiResponse<Map<String, Object>> getDomainHostConfig() {
        checkAdminOrHr();
        SystemConfig config = systemConfigService.getDomainHostConfig();
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("domainHost", systemConfigService.getDomainHost());
        res.put("defaultHost", SystemConfigService.DEFAULT_DOMAIN_HOST);
        res.put("configKey", config.getConfigKey());
        res.put("description", config.getDescription());
        res.put("updatedBy", config.getUpdatedBy());
        res.put("updatedAt", config.getUpdatedAt());
        return ApiResponse.ok(res, "Thông tin cấu hình Domain Host");
    }

    @PostMapping("/domain")
    @Operation(summary = "Cập nhật Domain Host mới của hệ thống (Chỉ dành cho Admin & HR)")
    public ApiResponse<Map<String, Object>> updateDomainHost(@RequestBody UpdateDomainRequest request) {
        checkAdminOrHr();
        if (request == null || request.getDomainHost() == null || request.getDomainHost().trim().isBlank()) {
            throw new IllegalArgumentException("Vui lòng cung cấp URL Domain Host hợp lệ (ví dụ: https://hrm.ascendtech.vn)");
        }

        String oldHost = systemConfigService.getDomainHost();
        String actor = CurrentUser.employeeCode() != null ? CurrentUser.employeeCode()
                : (CurrentUser.role() != null ? CurrentUser.role() : "HR_ADMIN");

        SystemConfig saved = systemConfigService.updateDomainHost(request.getDomainHost(), actor);

        try {
            AuditLog audit = AuditLog.builder()
                    .action("UPDATE_DOMAIN_HOST")
                    .entityName("SYSTEM_CONFIG")
                    .entityId("SYSTEM_DOMAIN_HOST")
                    .userId(CurrentUser.userId())
                    .userCode(actor)
                    .userName(actor)
                    .oldValue("Domain cũ: " + oldHost)
                    .newValue("Domain mới: " + saved.getConfigValue())
                    .reason(request.getReason() != null && !request.getReason().isBlank()
                            ? request.getReason().trim()
                            : "Cập nhật domain host điều hướng hệ thống (Admin/HR)")
                    .ipAddress("127.0.0.1")
                    .build();
            auditLogRepository.save(audit);
        } catch (Exception ex) {
            log.warn("Không thể ghi audit log cập nhật domain: {}", ex.getMessage());
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("domainHost", saved.getConfigValue());
        res.put("previousHost", oldHost);
        res.put("updatedBy", saved.getUpdatedBy());
        res.put("updatedAt", saved.getUpdatedAt());

        return ApiResponse.ok(res, "Đã cập nhật Domain Host hệ thống thành công: " + saved.getConfigValue());
    }

    @GetMapping("/public-domain")
    @Operation(summary = "Lấy Domain Host công khai hiện tại để các màn hình hiển thị liên kết chính xác")
    public ApiResponse<Map<String, String>> getPublicDomain() {
        return ApiResponse.ok(
                Map.of("domainHost", systemConfigService.getDomainHost()),
                "Domain host hiện tại"
        );
    }

    private void checkAdminOrHr() {
        String role = CurrentUser.role();
        boolean isHrOrAdmin = "ADMIN".equalsIgnoreCase(role) || "HR_ADMIN".equalsIgnoreCase(role);
        if (!isHrOrAdmin) {
            throw new AccessDeniedException("Chỉ HR hoặc Quản trị viên mới có quyền xem và cấu hình Domain Host hệ thống.");
        }
    }
}
