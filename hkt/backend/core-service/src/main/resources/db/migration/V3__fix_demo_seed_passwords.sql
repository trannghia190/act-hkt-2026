-- =========================================================================
-- ACT PULSE 2026 - V2: Fix demo account password hashes
--
-- V1 seeded a placeholder bcrypt string that does not match any password,
-- so /auth/login always failed for the demo users. Replace it with a real
-- bcrypt (cost 12) hash of "123456" for the three seeded accounts.
-- =========================================================================

UPDATE users
SET password_hash = '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm'
WHERE employee_code IN ('01HR', '05ACT', '136ACT');
