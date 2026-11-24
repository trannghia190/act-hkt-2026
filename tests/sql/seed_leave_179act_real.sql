-- Nạp dữ liệu test NGÀY PHÉP cho tài khoản thật "Hoàng Quyên" (id 0cdd573e-…),
-- giả định nhân viên vào công ty 01/06/2025 (tồn 2025 + cộng phép tháng + 2 đơn đã dùng).
-- Idempotent: xoá sổ phép AL hiện có của user này rồi ghi lại từ đầu → chạy lại nhiều lần vẫn ra 9.00.
--
-- Chạy: psql -h127.0.0.1 -p5432 -d pulse_db -f tests/sql/seed_leave_179act_real.sql

\set uid '0cdd573e-47ee-484c-a5bf-ff7df12fe548'
\set accrual_on 15

BEGIN;

\echo '=== Trước khi nạp: sổ phép hiện có của user ==='
SELECT created_at::date AS ngay, action, leave_type, amount, balance_after, reason
FROM leave_ledger
WHERE user_id = :'uid'
ORDER BY created_at;

\echo '=== Ngày vào làm: đặt về 01/06/2025 (ngày cộng phép tháng 15) ==='
UPDATE users
SET joined_date = DATE '2025-06-01'
WHERE id = :'uid';

-- Reset sổ phép năm (AL) của riêng user này để số dư bắt đầu lại từ 0.
DELETE FROM leave_ledger
WHERE user_id = :'uid'
  AND (leave_type IS NULL OR leave_type = 'AL');

INSERT INTO leave_ledger
    (user_id, leave_type, action, amount, balance_after, reason, performed_by_system, created_at)
VALUES
    -- Phép tồn 2025: vào 01/06/2025 → 7 tháng × 1 ngày = 7, đã nghỉ 4 → còn 3.
    (:'uid', 'AL', 'GRANT',  3.00,  3.00, 'Bảo lưu phép năm 2025 (3 ngày)',                        TRUE, TIMESTAMPTZ '2026-01-01 08:00:00+07'),
    -- Cộng phép tháng 01→11/2026 (đúng chuỗi "Cộng phép tháng M/YYYY" để cron không cộng trùng).
    (:'uid', 'AL', 'GRANT',  1.00,  4.00, 'Cộng phép tháng 1/2026',   TRUE, TIMESTAMPTZ '2026-01-15 02:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00,  5.00, 'Cộng phép tháng 2/2026',   TRUE, TIMESTAMPTZ '2026-02-15 02:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00,  6.00, 'Cộng phép tháng 3/2026',   TRUE, TIMESTAMPTZ '2026-03-15 02:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00,  7.00, 'Cộng phép tháng 4/2026',   TRUE, TIMESTAMPTZ '2026-04-15 02:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00,  8.00, 'Cộng phép tháng 5/2026',   TRUE, TIMESTAMPTZ '2026-05-15 02:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00,  9.00, 'Cộng phép tháng 6/2026',   TRUE, TIMESTAMPTZ '2026-06-15 02:00:00+07'),
    -- Đơn nghỉ đã duyệt: dùng 3 ngày phép tồn + 2 ngày phép năm.
    (:'uid', 'AL', 'USED',  -3.00,  6.00, 'Nghỉ phép năm — đơn REQ-179-0001 (dùng phép tồn 2025)', TRUE, TIMESTAMPTZ '2026-06-20 10:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00, 10.00, 'Cộng phép tháng 7/2026',   TRUE, TIMESTAMPTZ '2026-07-15 02:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00, 11.00, 'Cộng phép tháng 8/2026',   TRUE, TIMESTAMPTZ '2026-08-15 02:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00, 12.00, 'Cộng phép tháng 9/2026',   TRUE, TIMESTAMPTZ '2026-09-15 02:00:00+07'),
    (:'uid', 'AL', 'USED',  -2.00,  7.00, 'Nghỉ phép năm — đơn REQ-179-0002', TRUE, TIMESTAMPTZ '2026-09-21 10:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00, 13.00, 'Cộng phép tháng 10/2026',  TRUE, TIMESTAMPTZ '2026-10-15 02:00:00+07'),
    (:'uid', 'AL', 'GRANT',  1.00, 14.00, 'Cộng phép tháng 11/2026',  TRUE, TIMESTAMPTZ '2026-11-15 02:00:00+07');

COMMIT;

\echo '=== Sau khi nạp: sổ phép ==='
SELECT created_at::date AS ngay, action, amount, balance_after, reason
FROM leave_ledger
WHERE user_id = :'uid'
ORDER BY created_at;

\echo '=== Tổng hợp: mong đợi 14 dòng, cộng 14, dùng -5, còn 9.00 ==='
SELECT count(*) AS so_dong,
       sum(amount) FILTER (WHERE action = 'GRANT') AS tong_cong,
       sum(amount) FILTER (WHERE action = 'USED')  AS tong_dung,
       coalesce(sum(amount), 0)                    AS con_lai
FROM leave_ledger
WHERE user_id = :'uid';

\echo '=== Cảnh báo: mã nhân viên trùng (không phân biệt hoa/thường) ==='
SELECT employee_code, full_name, email, joined_date
FROM users
WHERE upper(employee_code) = '179ACT';
