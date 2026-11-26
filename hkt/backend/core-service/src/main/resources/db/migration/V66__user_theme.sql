-- Template giao diện người dùng chọn (3 mẫu: Ascend Clean / Midnight Rail / Bento Studio).
--
-- Nguồn sự thật lưu lâu dài — frontend chỉ cache trong localStorage để áp ngay
-- lúc boot (chống nháy trắng), còn giá trị này đồng bộ qua máy.
--
-- Mặc định 'midnight-rail' (rail tối + nội dung sáng) — theo yêu cầu.
-- Giá trị hợp lệ được kiểm tra ở tầng service (AuthServiceImpl), không ràng buộc
-- bằng CHECK để sau này thêm template mới không cần migration.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'midnight-rail';

-- Cột có thể đã tồn tại với giá trị NULL từ lần chạy Flyway trước — chuẩn hoá lại.
UPDATE users SET theme = 'midnight-rail' WHERE theme IS NULL OR theme = '';
