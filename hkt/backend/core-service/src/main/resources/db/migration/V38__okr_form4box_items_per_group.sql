-- V29: Form 4 Box theo mẫu HR
--   Box 1 = thông tin cá nhân (hệ thống tự điền từ hồ sơ nhân sự, không lưu ở đây)
--   Box 2 Business / Box 3 People = mỗi box 4 mục: kết quả · điều chỉnh · khó khăn · bài học + điểm 1–5
--   Box 4 = self proposal năm sau
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box2_results TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box2_adjustments TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box2_difficulties TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box2_lessons TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box3_results TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box3_adjustments TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box3_difficulties TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box3_lessons TEXT;

-- Dữ liệu cũ: 4 mục từng nằm chung ở box1_* và 1 ô giải trình box2/box3_*_text.
-- Chuyển sang cấu trúc mới (không xoá cột cũ để giữ lịch sử):
--   box1_* (chung cả năm)  → 4 mục của Box 2 Business
--   box3_people_text       → "Kết quả" của Box 3 People
UPDATE okr_reviews SET
    box2_results      = COALESCE(box2_results, NULLIF(TRIM(CONCAT_WS(E'\n', box1_results, box2_business_text)), '')),
    box2_adjustments  = COALESCE(box2_adjustments, box1_adjustments),
    box2_difficulties = COALESCE(box2_difficulties, box1_difficulties),
    box2_lessons      = COALESCE(box2_lessons, box1_lessons),
    box3_results      = COALESCE(box3_results, box3_people_text)
WHERE box1_results IS NOT NULL OR box1_adjustments IS NOT NULL OR box1_difficulties IS NOT NULL
   OR box1_lessons IS NOT NULL OR box2_business_text IS NOT NULL OR box3_people_text IS NOT NULL;
