-- Lưu người tạo cấu hình ngày lễ để hiển thị "thêm bởi ai" trên lịch nghỉ lễ.
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(150);
