-- V65: Khôi phục ràng buộc "mỗi năm 1 chu kỳ" + "tối đa 1 chu kỳ active".
--
-- V64 dọn seed OKR đồng thời DROP hai unique index của V63 (với lý do "index chặn
-- tạo lại chu kỳ cho cùng năm"). Thực tế sau khi xoá sạch dữ liệu, unique index
-- KHÔNG chặn việc tạo lại: bảng rỗng thì năm nào cũng chèn được. Việc drop chỉ làm
-- mất lớp bảo vệ ở tầng DB, nên migration này tạo lại chúng.
--
-- Dùng cùng kiểu guard với V63: nếu DB legacy đang vi phạm (dữ liệu bẩn) thì ghi
-- NOTICE thay vì làm app không boot được. Chạy lại nhiều lần vẫn an toàn
-- (IF NOT EXISTS).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM okr_cycles GROUP BY cycle_year HAVING COUNT(*) > 1) THEN
        RAISE NOTICE 'okr_cycles còn nhiều chu kỳ cùng năm — chưa tạo uq_okr_cycles_year';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_okr_cycles_year ON okr_cycles(cycle_year);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM okr_cycles WHERE status = 'active' GROUP BY status HAVING COUNT(*) > 1) THEN
        RAISE NOTICE 'okr_cycles còn nhiều chu kỳ active — chưa tạo uq_okr_cycles_one_active';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_okr_cycles_one_active ON okr_cycles(status) WHERE status = 'active';
    END IF;
END $$;
