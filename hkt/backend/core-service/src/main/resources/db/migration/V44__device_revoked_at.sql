-- Phân biệt thiết bị "chờ duyệt" với "đã bị thu hồi" để nhân viên chỉ hủy được yêu cầu đang chờ.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITHOUT TIME ZONE;
