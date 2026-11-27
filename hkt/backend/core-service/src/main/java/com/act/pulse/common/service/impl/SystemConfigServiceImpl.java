package com.act.pulse.common.service.impl;

import com.act.pulse.common.entity.SystemConfig;
import com.act.pulse.common.repository.SystemConfigRepository;
import com.act.pulse.common.service.SystemConfigService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
@RequiredArgsConstructor
public class SystemConfigServiceImpl implements SystemConfigService {

    private final SystemConfigRepository systemConfigRepository;

    @Value("${app.domain-host:http://localhost:3000}")
    private String defaultPropertyHost;

    private final AtomicReference<String> cachedDomainHost = new AtomicReference<>(DEFAULT_DOMAIN_HOST);

    @PostConstruct
    public void init() {
        try {
            Optional<SystemConfig> opt = systemConfigRepository.findByConfigKey(CONFIG_KEY_DOMAIN_HOST);
            if (opt.isPresent() && opt.get().getConfigValue() != null && !opt.get().getConfigValue().isBlank()) {
                String clean = sanitize(opt.get().getConfigValue());
                cachedDomainHost.set(clean);
                log.info("Đã nạp Domain Host từ Database (table system_configs): {}", clean);
            } else {
                String fallback = sanitize(defaultPropertyHost != null && !defaultPropertyHost.isBlank() ? defaultPropertyHost : DEFAULT_DOMAIN_HOST);
                cachedDomainHost.set(fallback);
                // Tự động lưu cấu hình mặc định vào DB nếu chưa có
                SystemConfig initialConfig = SystemConfig.builder()
                        .configKey(CONFIG_KEY_DOMAIN_HOST)
                        .configValue(fallback)
                        .description("Domain Host / Base URL của hệ thống (dùng tạo liên kết chuyển hướng trong email, OTP, kích hoạt tài khoản)")
                        .updatedBy("SYSTEM")
                        .build();
                systemConfigRepository.save(initialConfig);
                log.info("Khởi tạo cấu hình Domain Host mặc định trong Database: {}", fallback);
            }
        } catch (Exception ex) {
            log.warn("Không thể nạp cấu hình Domain Host từ DB, sử dụng mặc định {}: {}", DEFAULT_DOMAIN_HOST, ex.getMessage());
            cachedDomainHost.set(DEFAULT_DOMAIN_HOST);
        }
    }

    @Override
    public String getDomainHost() {
        String current = cachedDomainHost.get();
        return (current != null && !current.isBlank()) ? current : DEFAULT_DOMAIN_HOST;
    }

    @Override
    public String buildAbsoluteUrl(String pathOrUrl) {
        if (pathOrUrl == null || pathOrUrl.isBlank()) {
            return getDomainHost();
        }
        String trimmed = pathOrUrl.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        String base = getDomainHost();
        if (!trimmed.startsWith("/")) {
            return base + "/" + trimmed;
        }
        return base + trimmed;
    }

    @Override
    @Transactional
    public SystemConfig updateDomainHost(String domainHost, String updatedBy) {
        if (domainHost == null || domainHost.trim().isBlank()) {
            throw new IllegalArgumentException("Domain host không được để trống");
        }
        String clean = sanitize(domainHost.trim());
        validateUrl(clean);

        SystemConfig config = systemConfigRepository.findByConfigKey(CONFIG_KEY_DOMAIN_HOST)
                .orElseGet(() -> SystemConfig.builder()
                        .configKey(CONFIG_KEY_DOMAIN_HOST)
                        .description("Domain Host / Base URL của hệ thống (dùng tạo liên kết chuyển hướng trong email, OTP, kích hoạt tài khoản)")
                        .build());

        config.setConfigValue(clean);
        config.setUpdatedBy(updatedBy != null && !updatedBy.isBlank() ? updatedBy : "ADMIN");

        SystemConfig saved = systemConfigRepository.save(config);
        cachedDomainHost.set(clean);
        log.info("Đã cập nhật Domain Host hệ thống thành công: {} (bởi {})", clean, config.getUpdatedBy());
        return saved;
    }

    @Override
    public SystemConfig getDomainHostConfig() {
        return systemConfigRepository.findByConfigKey(CONFIG_KEY_DOMAIN_HOST)
                .orElseGet(() -> SystemConfig.builder()
                        .configKey(CONFIG_KEY_DOMAIN_HOST)
                        .configValue(getDomainHost())
                        .description("Domain Host / Base URL của hệ thống")
                        .updatedBy("SYSTEM")
                        .build());
    }

    private String sanitize(String url) {
        if (url == null) return DEFAULT_DOMAIN_HOST;
        String s = url.trim();
        while (s.endsWith("/")) {
            s = s.substring(0, s.length() - 1);
        }
        return s;
    }

    private void validateUrl(String url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new IllegalArgumentException("Domain host phải bắt đầu bằng http:// hoặc https:// (ví dụ: https://hrm.ascendtech.vn)");
        }
        try {
            URI uri = URI.create(url);
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("Tên miền (Host) không hợp lệ");
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Định dạng URL Domain Host không hợp lệ: " + e.getMessage());
        }
    }
}
