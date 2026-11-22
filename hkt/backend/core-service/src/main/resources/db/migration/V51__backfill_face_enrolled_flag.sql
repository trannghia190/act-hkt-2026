-- Backfill: đồng bộ cờ users.face_enrolled với hồ sơ khuôn mặt đang active.
-- Nguyên nhân lệch: AI Face Service ghi face_profiles, còn lần đồng bộ Core
-- (/auth/enroll-face) có thể thất bại khi bind vector pgvector → transaction rollback,
-- khiến users.face_enrolled vẫn = false dù hồ sơ đã active.
UPDATE users u
SET face_enrolled = TRUE
WHERE u.face_enrolled IS DISTINCT FROM TRUE
  AND EXISTS (
    SELECT 1 FROM face_profiles f
    WHERE f.user_id = u.id AND f.status = 'active'
  );
