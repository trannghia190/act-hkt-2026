-- V3: Loại nghỉ cấu hình được + sổ phép append-only
CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    default_days NUMERIC(6,2),
    requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO leave_types (code, name, default_days, requires_attachment, config) VALUES
('AL', 'Phép năm', 12, FALSE, '{"accrual":"monthly","day_of_month":15}'),
('S', 'Nghỉ ốm', NULL, TRUE, '{"bhxh":true}'),
('NL', 'Nghỉ lễ tết', NULL, FALSE, '{}'),
('RO', 'Nghỉ bù', NULL, FALSE, '{}'),
('CL', 'Nghỉ việc riêng có lương', 3, FALSE, '{}'),
('ML', 'Thai sản', NULL, TRUE, '{"bhxh":true}'),
('PL', 'Nghỉ khi có vợ sinh', 5, TRUE, '{}'),
('UP', 'Nghỉ không lương', NULL, FALSE, '{}'),
('HIEU', 'Hiếu hỉ', 3, FALSE, '{}'),
('TANG', 'Tang gia', 3, FALSE, '{}'),
('ML_NAM', 'Thai sản nam', 5, TRUE, '{"bhxh":true}'),
('ML_NU', 'Thai sản nữ', 180, TRUE, '{"bhxh":true}')
ON CONFLICT (code) DO NOTHING;
