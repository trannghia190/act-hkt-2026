-- Khiếu nại không chỉ sửa giờ: nhân viên chọn luôn chế độ đúng cho ngày đó.
--   TIME_FIX = sửa giờ vào/ra (mặc định, giữ nguyên hành vi cũ)
--   WFH      = công nhận làm việc từ xa
--   LEAVE    = chuyển thành nghỉ theo danh mục loại nghỉ (requested_leave_type)
alter table timesheet_disputes
    add column if not exists requested_kind varchar(20) not null default 'TIME_FIX',
    add column if not exists requested_leave_type varchar(20);
