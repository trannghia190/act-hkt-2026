-- S36: sửa action_url trỏ tới route không tồn tại ở frontend.
-- Những link này có từ trước khi route được chuẩn hoá; người dùng bấm vào
-- thông báo cũ sẽ rơi vào trang trắng/404. Chỉ vá dữ liệu đã ghi, không đụng
-- tới nội dung thông báo.

UPDATE notifications SET action_url = '/attendance/checkin'
 WHERE action_url = '/attendance';

UPDATE notifications SET action_url = '/attendance/requests'
 WHERE action_url = '/requests';

UPDATE notifications SET action_url = '/attendance/leaves'
 WHERE action_url = '/leaves';

UPDATE notifications SET action_url = '/attendance/disputes'
 WHERE action_url = '/disputes';

UPDATE notifications SET action_url = '/okr/cycles'
 WHERE action_url = '/admin/okr';

-- Kỳ công đã chốt: nhân viên xem bảng công của mình, HR xem trang chốt kỳ.
UPDATE notifications SET action_url = '/attendance/my-timesheet'
 WHERE action_url = '/timesheet' AND event_key = 'TIMESHEET_CLOSED';

UPDATE notifications SET action_url = '/attendance/timesheet'
 WHERE action_url = '/timesheet';

-- Kết quả khiếu nại gửi cho nhân viên: trang chi tiết chỉ dành cho HR.
UPDATE notifications SET action_url = '/attendance/my-timesheet'
 WHERE action_url LIKE '/attendance/disputes/%'
   AND event_key IN ('DISPUTE_RESOLVED', 'DISPUTE_REJECTED');
