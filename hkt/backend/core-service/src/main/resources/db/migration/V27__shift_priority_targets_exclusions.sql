-- Ca làm việc: thứ tự ưu tiên ghi đè + áp dụng theo nhân viên cụ thể + loại trừ thành viên.
-- Ca chuẩn SHIFT_STANDARD là base toàn công ty (không có target/loại trừ, luôn bật).
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS target_employees TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS exclude_employees TEXT;

-- Xếp thứ tự hiện có: ca tạo sớm ở trên, tạo muộn ở dưới (dưới cùng = ưu tiên cao nhất).
UPDATE shifts s
SET priority = sub.rn
FROM (
    SELECT id, row_number() OVER (ORDER BY created_at, code) AS rn
    FROM shifts
    WHERE code <> 'SHIFT_STANDARD'
) sub
WHERE s.id = sub.id;
