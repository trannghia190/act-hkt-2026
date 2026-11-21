-- Ca chuẩn (SHIFT_STANDARD) là BASE mặc định áp dụng cho toàn công ty:
--  · luôn tồn tại, luôn active, không phải ca ngoại lệ;
--  · mọi ca khác được gán cho nhóm/chức danh/cá nhân là ngoại lệ — đè ca chuẩn;
--  · nhân sự chưa gán ca → dùng ca chuẩn (resolver cũng fallback về ca chuẩn).

INSERT INTO shifts (id, code, name, check_in_start, check_in_end, check_out_start, check_out_end,
                    lunch_break_start, lunch_break_end, required_work_hours,
                    is_active, is_flexible, is_exception, requires_hr_approval)
SELECT 'c0000000-0000-0000-0000-000000000001', 'SHIFT_STANDARD', 'Ca Chuẩn Văn Phòng',
       '08:00:00', '09:30:00', '17:00:00', '18:30:00', '12:00:00', '13:00:00', 8.00,
       TRUE, FALSE, FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE code = 'SHIFT_STANDARD');

UPDATE shifts SET is_active = TRUE, is_exception = FALSE WHERE code = 'SHIFT_STANDARD';

-- Nhân sự chưa gán ca về ca chuẩn để dữ liệu nhất quán (resolver vẫn fallback nếu có null mới).
UPDATE users
SET shift_id = (SELECT id FROM shifts WHERE code = 'SHIFT_STANDARD')
WHERE shift_id IS NULL
  AND EXISTS (SELECT 1 FROM shifts WHERE code = 'SHIFT_STANDARD');
