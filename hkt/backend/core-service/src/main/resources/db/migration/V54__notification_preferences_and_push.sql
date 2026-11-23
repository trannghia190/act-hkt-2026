-- Hệ thống thông báo đa kênh thật (S36): lưu cấu hình tùy chỉnh của người dùng vào DB,
-- ghi lại từng lần gửi theo kênh (để áp dụng dedupe / giới hạn push mỗi ngày),
-- và lưu subscription Web Push.
--
-- Trước đây cấu hình nằm trong ConcurrentHashMap của controller → mất khi restart
-- và KHÔNG có code nào đọc → mọi lựa chọn trên UI là mô phỏng.
--
-- Giá trị mặc định của `events` KHÔNG seed ở đây: registry (nhãn, category,
-- mặc định web/email/push) thuộc về code (NotificationEventCatalog) để một nguồn
-- sự thật duy nhất; hàng được tạo lúc người dùng đọc/ghi cấu hình lần đầu.

-- 1. Cấu hình tùy chỉnh thông báo cá nhân (1 dòng / người dùng)
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start TIME NOT NULL DEFAULT '21:00',
    quiet_hours_end TIME NOT NULL DEFAULT '07:00',
    max_push_per_day INTEGER NOT NULL DEFAULT 3,
    dedupe_hours INTEGER NOT NULL DEFAULT 12,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    -- 17 event key × 3 kênh (web/email/push): {"MISSING_CHECKIN": {"web":true,...}}
    events JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Lịch sử gửi từng kênh — nền tảng cho dedupe window và giới hạn push/ngày
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_key VARCHAR(50) NOT NULL,
    channel VARCHAR(10) NOT NULL,          -- WEB | EMAIL | PUSH
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    dedupe_key VARCHAR(255),
    delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_deliveries_dedupe
    ON notification_deliveries (user_id, event_key, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_daily
    ON notification_deliveries (user_id, channel, delivered_at DESC);

-- 3. Subscription Web Push (mỗi thiết bị 1 dòng)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

-- 4. Event key chuẩn hóa cho từng thông báo (type cũ đang bị dùng quá tải:
--    "REQUEST" cho cả duyệt/từ chối, "OKR_DEADLINE_FINAL" cho cả NV và quản lý)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_notifications_event_key
    ON notifications (user_id, event_key, created_at DESC);
