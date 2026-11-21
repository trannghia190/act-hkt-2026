-- V24: OKR của quản lý 05ACT trong seed là dữ liệu nguồn cho gợi ý C14.
-- Chỉ OKR đã duyệt mới được dùng làm gợi ý, nên chuyển bản seed từ submitted -> locked.
UPDATE okr_reviews
SET status = 'locked',
    locked_at = COALESCE(locked_at, NOW())
WHERE id = 'e0000000-0000-0000-0000-000000000005'
  AND status = 'submitted';
