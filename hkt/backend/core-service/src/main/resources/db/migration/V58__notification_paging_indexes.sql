-- Phân trang hộp thư: truy vấn chính lọc user_id + đọc/chưa đọc, sắp xếp created_at DESC.
-- Index cũ (user_id, event_key, created_at) không dùng được khi lọc event_key = null
-- vì event_key đứng giữa, nên bổ sung index theo đúng thứ tự truy vấn.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);

-- Badge/đếm unread và nút "Đọc tất cả" chỉ chạm các dòng is_read = false.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id, created_at DESC)
    WHERE is_read = false;
