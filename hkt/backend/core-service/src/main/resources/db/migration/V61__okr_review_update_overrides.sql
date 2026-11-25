-- Chu kỳ OKR 3 phase: quản lý có thể bật/tắt cho từng nhân viên cập nhật tiến độ trong cửa sổ review.
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS midyear_update_override BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS final_update_override BOOLEAN NOT NULL DEFAULT FALSE;
