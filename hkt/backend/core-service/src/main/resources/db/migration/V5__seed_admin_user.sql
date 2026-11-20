-- =========================================================================
-- ACT PULSE 2026 - V5: Seed admin user and ensure face profiles
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
    false,
    true,
    'c0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (employee_code) DO UPDATE SET
    password_hash = excluded.password_hash,
    status = 'ACTIVE',
    role = 'ADMIN';

INSERT INTO face_profiles (user_id, embedding, model_version, status, enrolled_at)
SELECT id, array_fill(0.0::real, ARRAY[512])::vector, 'sface-512-v1', 'active', NOW()
FROM users
ON CONFLICT (user_id) DO UPDATE SET status = 'active';
