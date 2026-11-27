package com.act.pulse.common.service;

import com.act.pulse.common.entity.SystemConfig;

public interface SystemConfigService {

    String CONFIG_KEY_DOMAIN_HOST = "SYSTEM_DOMAIN_HOST";
    String DEFAULT_DOMAIN_HOST = "http://localhost:3000";

    /**
     * Lấy Domain Host hiện tại của hệ thống (đã bỏ trailing slash).
     * Ví dụ: "http://localhost:3000" hoặc "https://pulse.ascendtech.vn"
     */
    String getDomainHost();

    /**
     * Tạo đường dẫn tuyệt đối dựa trên Domain Host cấu hình trong hệ thống.
     * @param pathOrUrl Đường dẫn tương đối (vd "/login") hoặc URL tuyệt đối
     */
    String buildAbsoluteUrl(String pathOrUrl);

    /**
     * Cập nhật Domain Host mới và lưu bền vững vào bảng system_configs.
     */
    SystemConfig updateDomainHost(String domainHost, String updatedBy);

    /**
     * Lấy thông tin bản ghi cấu hình Domain Host đầy đủ.
     */
    SystemConfig getDomainHostConfig();
}
