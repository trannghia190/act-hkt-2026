-- =========================================================================
-- ACT PULSE 2026 - Flyway Migration V67: System Configurations Table
-- =========================================================================

-- Bảng lưu trữ cấu hình hệ thống tập trung (System Configurations)
-- Thay thế hoàn toàn file local, hỗ trợ clustering / multi-instance và backup đồng bộ với DB.
CREATE TABLE IF NOT EXISTS system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description VARCHAR(255),
    updated_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_configs_key ON system_configs(config_key);
