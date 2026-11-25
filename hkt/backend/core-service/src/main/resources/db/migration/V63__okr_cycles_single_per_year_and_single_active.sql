-- Quy tắc nghiệp vụ OKR:
--   (1) mỗi năm chỉ có đúng 1 chu kỳ OKR (cycle_year unique)
--   (2) toàn hệ thống tối đa 1 chu kỳ ở trạng thái active tại một thời điểm
-- Nếu DB legacy đang vi phạm, không chặn khởi động: ghi NOTICE để dọn tay rồi chạy lại
-- câu CREATE INDEX (cùng cách xử lý với V37__okr_dedupe_seed_and_unique_review.sql).
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
