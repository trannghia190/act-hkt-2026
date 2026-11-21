-- V41: phân biệt loại nghỉ khởi tạo sẵn (master data) với loại nghỉ HR tự thêm.
-- Chỉ loại tự thêm mới được xóa; loại master data chỉ được tắt (is_active = false)
-- để không làm gãy lịch sử đơn từ/bảng công đang tham chiếu mã.
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE leave_types SET is_system = TRUE
WHERE code IN (
  'AL', 'S', 'NL', 'RO', 'CL', 'ML', 'PL', 'UP', 'HIEU', 'TANG', 'ML_NAM', 'ML_NU',
  'ML_NAM_5', 'ML_NAM_7', 'ML_NAM_10', 'ML_NAM_14'
);

-- Giữ nguyên năng lực nghỉ nửa ngày đang có cho mọi loại master data
-- (bảng ký hiệu ô công hỗ trợ X/0.50 cho mọi loại). Loại HR tự thêm mặc định
-- unit = DAY — HR chủ động bật HALF_DAY nếu muốn cho phép nửa ngày.
UPDATE leave_types SET unit = 'HALF_DAY' WHERE is_system = TRUE;
