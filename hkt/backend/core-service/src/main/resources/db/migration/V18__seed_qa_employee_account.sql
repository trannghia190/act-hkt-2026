-- Tài khoản QA độc lập (137ACT / 123456), cùng nhóm/quản lý/ca với 136ACT,
-- có sẵn dữ liệu phép thực tế để QA test mà không ảnh hưởng 136ACT.

INSERT INTO users (employee_code, full_name, email, password_hash, role, team_id, shift_id, manager_id,
                   joined_date, position_name, status, must_change_password, face_enrolled)
SELECT '137ACT', 'Lê Thị Quỳnh Anh (QA)', 'qa137@act-corp.internal',
       '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm', 'EMPLOYEE',
       (SELECT id FROM teams WHERE name = 'Sirius Backend Architecture'),
       (SELECT id FROM shifts WHERE code = 'SHIFT_STANDARD'),
       (SELECT id FROM users WHERE employee_code = '05ACT'),
       DATE '2024-03-01', 'QA Engineer', 'ACTIVE', false, false
WHERE NOT EXISTS (SELECT 1 FROM users WHERE employee_code = '137ACT');

-- Sổ phép: 11 kỳ cộng tháng 1–11/2026 + tồn 2025 + thâm niên; dùng 2 ngày, tồn còn lại hết hạn 01/07.
INSERT INTO leave_ledger (user_id, leave_type, action, amount, balance_after, reason, performed_by_system, created_at, updated_at)
SELECT u.id, v.leave_type, v.action, v.amount, v.balance_after, v.reason, v.performed_by_system,
       v.created_at, v.created_at
FROM users u
CROSS JOIN (VALUES
    ('AL','GRANT',2.5, 2.5,'Bảo lưu phép năm 2025 (2.5 ngày)',true,TIMESTAMPTZ '2026-01-01 00:01:00+07'),
    ('AL','GRANT',1.0, 3.5,'Phép thâm niên 2026 (+1 ngày)',true,TIMESTAMPTZ '2026-03-01 00:00:00+07'),
    ('AL','USED', -2.0,1.5,'Nghỉ phép năm — đơn REQ-QA-0001',false,TIMESTAMPTZ '2026-06-10 14:00:00+07'),
    ('AL','EXPIRED',-0.5,1.0,'Cắt toàn bộ phép tồn còn lại từ 07-01',true,TIMESTAMPTZ '2026-07-01 02:15:00+07')
) AS v(leave_type, action, amount, balance_after, reason, performed_by_system, created_at)
WHERE u.employee_code = '137ACT'
  AND NOT EXISTS (SELECT 1 FROM leave_ledger l WHERE l.user_id = u.id);

INSERT INTO leave_ledger (user_id, leave_type, action, amount, balance_after, reason, performed_by_system, created_at, updated_at)
SELECT u.id, 'AL', 'GRANT', 1.0, 3.5 + extract(month from d)::int,
       'Cộng phép tháng ' || extract(month from d)::int || '/2026', true, d, d
FROM users u
CROSS JOIN generate_series(DATE '2026-01-15', DATE '2026-11-15', INTERVAL '1 month') d
WHERE u.employee_code = '137ACT'
  AND NOT EXISTS (SELECT 1 FROM leave_ledger l WHERE l.user_id = u.id AND l.reason LIKE 'Cộng phép tháng%');

-- Log chấm công hôm qua: có vào, thiếu ra để QA thấy gợi ý tạo đơn (S07).
INSERT INTO attendance_logs (user_id, work_date, check_in_at, check_out_at, status, type)
SELECT u.id, CURRENT_DATE - 1, (CURRENT_DATE - 1) + TIME '08:10', NULL, 'INCOMPLETE', 'CHECK_IN'
FROM users u
WHERE u.employee_code = '137ACT'
  AND NOT EXISTS (SELECT 1 FROM attendance_logs a WHERE a.user_id = u.id AND a.work_date = CURRENT_DATE - 1);
