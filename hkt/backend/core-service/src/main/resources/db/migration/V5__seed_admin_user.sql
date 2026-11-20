-- =========================================================================
-- ACT PULSE 2026 - V5: Seed initial admin user safely without overwriting
-- =========================================================================

INSERT INTO users (id, employee_code, full_name, email, password_hash, role, joined_date, status, must_change_password, face_enrolled, shift_id)
VALUES (
    'd0000000-0000-0000-0000-000000000000',
    'Admin',
    'Quản Trị Viên Hệ Thống (Admin)',
    'admin@act-corp.internal',
    '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm',
    'ADMIN',
    '2020-01-01',
    'ACTIVE',
    true,
    false,
    'c0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (employee_code) DO NOTHING;
