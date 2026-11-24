-- Kiểm tra dữ liệu test của tài khoản 179ACT (Hoàng Quyên) đã nạp chưa.
-- Chạy: psql -h 127.0.0.1 -p 5432 -d pulse_db -f tests/sql/check_179act.sql

\echo '=== 1. Tài khoản ==='
SELECT employee_code,
       full_name,
       email,
       joined_date,
       (team_id    IS NOT NULL) AS has_team,
       (shift_id   IS NOT NULL) AS has_shift,
       (manager_id IS NOT NULL) AS has_manager,
       role,
       status
FROM users
WHERE employee_code = '179ACT';

\echo '=== 2. Sổ phép (từng dòng) ==='
SELECT l.created_at::date AS ngay_ghi,
       l.action,
       l.amount,
       l.balance_after,
       l.reason
FROM leave_ledger l
JOIN users u ON u.id = l.user_id
WHERE u.employee_code = '179ACT'
ORDER BY l.created_at;

\echo '=== 3. Tổng hợp sổ phép ==='
SELECT count(*)                                        AS so_dong,
       sum(amount) FILTER (WHERE action = 'GRANT')     AS tong_cong,
       sum(amount) FILTER (WHERE action = 'USED')      AS tong_dung,
       coalesce(sum(amount), 0)                        AS con_lai
FROM leave_ledger l
JOIN users u ON u.id = l.user_id
WHERE u.employee_code = '179ACT';

\echo '=== 4. Dòng Flyway còn sót của V48/V49 (phải rỗng) ==='
SELECT version, description, success
FROM flyway_schema_history
WHERE version IN ('48', '49');
