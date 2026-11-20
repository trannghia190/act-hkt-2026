-- Tài khoản Trưởng nhóm demo (138ACT / 123456): role EMPLOYEE nhưng là leader_id của nhóm Optimus.

INSERT INTO users (employee_code, full_name, email, password_hash, role, team_id, shift_id, manager_id,
                   joined_date, position_name, status, must_change_password, face_enrolled)
SELECT '138ACT', 'Đỗ Minh Khôi (Team Lead)', 'lead138@act-corp.internal',
       '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm', 'EMPLOYEE',
       (SELECT id FROM teams WHERE name = 'Optimus'),
       (SELECT id FROM shifts WHERE code = 'SHIFT_STANDARD'),
       (SELECT id FROM users WHERE employee_code = '05ACT'),
       DATE '2022-09-01', 'Team Lead', 'ACTIVE', false, false
WHERE NOT EXISTS (SELECT 1 FROM users WHERE employee_code = '138ACT');

-- Gán làm trưởng nhóm Optimus (không ghi đè nếu đã có leader khác).
UPDATE teams
SET leader_id = (SELECT id FROM users WHERE employee_code = '138ACT'),
    updated_at = NOW()
WHERE name = 'Optimus' AND leader_id IS NULL;

-- Sổ phép mẫu: 11 kỳ cộng tháng 2026 + thâm niên + tồn, dùng 1 ngày.
INSERT INTO leave_ledger (user_id, leave_type, action, amount, balance_after, reason, performed_by_system, created_at, updated_at)
SELECT u.id, 'AL', 'GRANT', 2.0, 2.0, 'Bảo lưu phép năm 2025 (2 ngày)', true,
       TIMESTAMPTZ '2026-01-01 00:01:00+07', TIMESTAMPTZ '2026-01-01 00:01:00+07'
FROM users u WHERE u.employee_code = '138ACT'
  AND NOT EXISTS (SELECT 1 FROM leave_ledger l WHERE l.user_id = u.id);

INSERT INTO leave_ledger (user_id, leave_type, action, amount, balance_after, reason, performed_by_system, created_at, updated_at)
SELECT u.id, 'AL', 'GRANT', 1.0, 2.0 + extract(month from d)::int,
       'Cộng phép tháng ' || extract(month from d)::int || '/2026', true, d, d
FROM users u
CROSS JOIN generate_series(DATE '2026-01-15', DATE '2026-11-15', INTERVAL '1 month') d
WHERE u.employee_code = '138ACT'
  AND NOT EXISTS (SELECT 1 FROM leave_ledger l WHERE l.user_id = u.id AND l.reason LIKE 'Cộng phép tháng%');

INSERT INTO leave_ledger (user_id, leave_type, action, amount, balance_after, reason, performed_by_system, created_at, updated_at)
SELECT u.id, 'AL', 'USED', -1.0, 12.0, 'Nghỉ phép năm — đơn REQ-LEAD-0001', false,
       TIMESTAMPTZ '2026-07-10 14:00:00+07', TIMESTAMPTZ '2026-07-10 14:00:00+07'
FROM users u WHERE u.employee_code = '138ACT'
  AND NOT EXISTS (SELECT 1 FROM leave_ledger l WHERE l.user_id = u.id AND l.action = 'USED');

-- Log hôm qua có vào, thiếu ra để màn Đơn từ có gợi ý.
INSERT INTO attendance_logs (user_id, work_date, check_in_at, check_out_at, status, type)
SELECT u.id, CURRENT_DATE - 1, (CURRENT_DATE - 1) + TIME '08:05', NULL, 'INCOMPLETE', 'CHECK_IN'
FROM users u
WHERE u.employee_code = '138ACT'
  AND NOT EXISTS (SELECT 1 FROM attendance_logs a WHERE a.user_id = u.id AND a.work_date = CURRENT_DATE - 1);
