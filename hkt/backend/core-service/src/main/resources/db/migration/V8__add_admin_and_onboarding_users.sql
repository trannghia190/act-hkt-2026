-- =========================================================================
-- ACT PULSE 2026 - V8: Seed Admin and Onboarding Demo Users
-- =========================================================================

INSERT INTO users (id, employee_code, full_name, email, password_hash, role, team_id, joined_date, status, must_change_password)
VALUES
('d0000000-0000-0000-0000-000000000000', 'Admin', 'Quản Trị Viên Hệ Thống', 'admin@act.vn', '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm', 'ADMIN', NULL, '2020-01-01', 'ACTIVE', FALSE),
('d0000000-0000-0000-0000-000000000004', '2026NEW', 'Trần Nhân Viên Mới', 'newbie@act.vn', '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm', 'EMPLOYEE', 'b0000000-0000-0000-0000-000000000003', '2026-11-01', 'PENDING_ACTIVATION', TRUE)
ON CONFLICT (employee_code) DO NOTHING;
