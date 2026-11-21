-- V28: Gộp seed OKR giữa 2 nhánh.
-- V16__seed_master_test_data (nhánh main) seed thêm 1 chu kỳ 2026 (phases dạng object, không theo
-- cấu trúc 5 phase) và 1 review OKR thứ 2 cho 136ACT trong cùng năm → 1 người có 2 hồ sơ/năm,
-- API OKR không xác định được hồ sơ nào. Chu kỳ chuẩn là c0000000-...-2026 (V22).
DELETE FROM okr_reviews
WHERE id = '80000000-0000-0000-0000-000000000010'
  AND EXISTS (SELECT 1 FROM okr_reviews o
              WHERE o.id = 'e0000000-0000-0000-0000-000000000136');

DELETE FROM okr_cycles c
WHERE c.id = '80000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (SELECT 1 FROM okr_reviews r WHERE r.cycle_id = c.id);

-- Mỗi nhân viên chỉ có 1 hồ sơ OKR mỗi năm. Nếu DB còn dữ liệu trùng khác thì bỏ qua (không chặn khởi động),
-- ghi NOTICE để dọn tay rồi chạy lại câu CREATE INDEX.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM okr_reviews GROUP BY user_id, cycle_year HAVING COUNT(*) > 1) THEN
        RAISE NOTICE 'okr_reviews còn hồ sơ trùng (user_id, cycle_year) — chưa tạo uq_okr_reviews_user_year';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_okr_reviews_user_year ON okr_reviews(user_id, cycle_year);
    END IF;
END $$;
