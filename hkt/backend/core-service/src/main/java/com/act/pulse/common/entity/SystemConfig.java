package com.act.pulse.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

/**
 * Bảng lưu trữ cấu hình hệ thống tập trung (System Configuration)
 * Ví dụ: SMTP, chính sách hệ thống chung,...
 */
@Entity
@Table(name = "system_configs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemConfig extends BaseEntity {

    @Column(name = "config_key", nullable = false, unique = true, length = 100)
    private String configKey;

    @Column(name = "config_value", columnDefinition = "text")
    private String configValue;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;
}
