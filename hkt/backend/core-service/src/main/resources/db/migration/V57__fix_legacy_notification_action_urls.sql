-- S36 (tiếp V56): các thông báo cũ chưa có event_key vẫn còn action_url sai.
-- Trang cá nhân nằm ở /account/profile (route /profile không tồn tại).
UPDATE notifications SET action_url = '/account/profile'
 WHERE action_url = '/profile';

-- Khiếu nại cũ không phân biệt được "gửi" (HR xem chi tiết) hay "kết quả"
-- (nhân viên xem). Trang chi tiết chỉ dành cho HR nên đưa về bảng công của
-- chính người nhận — hợp lệ cho cả hai vai trò.
UPDATE notifications SET action_url = '/attendance/my-timesheet'
 WHERE action_url LIKE '/attendance/disputes/%' AND event_key IS NULL;
