-- Email chỉ phải duy nhất trong nhóm NHÂN VIÊN ĐANG HOẠT ĐỘNG.
-- Nhân viên đã nghỉ việc (INACTIVE) giải phóng email để cấp cho nhân viên mới;
-- mã nhân viên vẫn unique tuyệt đối (người đã nghỉ vẫn giữ mã, không cấp lại được).
--
-- users_email_key là UNIQUE CONSTRAINT nên Postgres chặn cả khi email đã bị giải phóng.
-- Bỏ constraint, thay bằng unique index PARTIAL chỉ áp cho status <> 'INACTIVE'.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_active
    ON users (lower(email))
    WHERE status IS DISTINCT FROM 'INACTIVE';

-- Dữ liệu cũ: nếu còn trùng email giữa người đang hoạt động và người đã nghỉ thì chỉ giữ
-- bản ghi đang hoạt động, các bản ghi INACTIVE đổi email thành dạng "cũ" để không đụng.
UPDATE users SET email = lower(email) || '+inactive@reserved.local'
WHERE status = 'INACTIVE'
  AND email IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM users a
      WHERE lower(a.email) = lower(users.email)
        AND a.status IS DISTINCT FROM 'INACTIVE'
  );

-- Chuẩn hoá email nhân viên đang hoạt động về chữ thường để index partial so khớp tuyệt đối.
UPDATE users SET email = lower(email)
WHERE status IS DISTINCT FROM 'INACTIVE'
  AND email IS NOT NULL
  AND email <> lower(email);
