-- Xoá tài khoản TRÙNG do seed nhầm tạo: mã '179ACT' (hoangquyen179@act-corp.internal).
-- GIỮ LẠI tài khoản thật: mã '179act' (thuquyen.hoangthi@ascendcorp.com).
--
-- Dọn theo đúng thứ tự FK: xoá mọi dòng con trỏ tới user trùng (tra tự động từ
-- information_schema, nên không bỏ sót bảng nào), gỡ manager_id, rồi xoá user.
-- Sau cùng xoá 2 dòng Flyway của V48/V49 (file migration đã xoá → nếu để lại,
-- lần khởi động backend sau sẽ fail validate).
--
-- Chạy: psql -h127.0.0.1 -p5432 -d pulse_db -f tests/sql/delete_dup_179ACT.sql

\echo '=== TRƯỚC: hai tài khoản cùng mã nhân viên ==='
SELECT id, employee_code, full_name, email, joined_date
FROM users
WHERE upper(employee_code) = '179ACT'
ORDER BY employee_code;

DO $$
DECLARE
    dup_id UUID;
    r      RECORD;
    n      BIGINT;
BEGIN
    SELECT id INTO dup_id
    FROM users
    WHERE employee_code = '179ACT'
      AND email = 'hoangquyen179@act-corp.internal';

    IF dup_id IS NULL THEN
        RAISE NOTICE 'Không tìm thấy tài khoản trùng — bỏ qua.';
        RETURN;
    END IF;

    RAISE NOTICE 'Xoá user trùng %', dup_id;

    FOR r IN
        SELECT tc.table_schema AS sch, tc.table_name AS tbl, kcu.column_name AS col
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.table_schema    = tc.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema    = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = 'public'
          AND ccu.table_name   = 'users'
          AND ccu.column_name  = 'id'
          AND tc.table_name   <> 'users'   -- tự tham chiếu xử lý riêng bên dưới
    LOOP
        EXECUTE format('DELETE FROM %I.%I WHERE %I = $1', r.sch, r.tbl, r.col) USING dup_id;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN
            RAISE NOTICE '  xoá % dòng ở %.%', n, r.tbl, r.col;
        END IF;
    END LOOP;

    -- users.manager_id là tự tham chiếu: gỡ liên kết thay vì xoá nhân viên khác.
    UPDATE users SET manager_id = NULL WHERE manager_id = dup_id;

    DELETE FROM users WHERE id = dup_id;
    RAISE NOTICE 'Đã xoá user trùng.';
END $$;

\echo '=== Dọn lịch sử Flyway của V48/V49 (file migration đã xoá) ==='
DELETE FROM flyway_schema_history WHERE version IN ('48', '49');

\echo '=== SAU: chỉ còn tài khoản thật ==='
SELECT id, employee_code, full_name, email, joined_date
FROM users
WHERE upper(employee_code) = '179ACT';

\echo '=== Sổ phép của tài khoản thật (mong đợi 14 dòng, còn 9.00) ==='
SELECT count(*) AS so_dong, coalesce(sum(amount), 0) AS con_lai
FROM leave_ledger
WHERE user_id = '0cdd573e-47ee-484c-a5bf-ff7df12fe548';
