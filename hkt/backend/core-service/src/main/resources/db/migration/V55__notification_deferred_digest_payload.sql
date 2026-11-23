-- Digest 08:00 cần nội dung của các mục bị dồn (giờ yên lặng / vượt hạn mức push).
-- Trước đây DEFERRED trỏ notification_id, nhưng khi người dùng tắt kênh WEB thì
-- không có dòng notifications nào → digest bỏ qua toàn bộ mục bị dồn.
-- Lưu thẳng nội dung trên delivery và đánh dấu đã gộp để không gửi lặp mỗi sáng.

ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS action_url VARCHAR(500);
ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notif_deliveries_deferred
    ON notification_deliveries (user_id, channel, delivered_at DESC)
    WHERE consumed_at IS NULL;
