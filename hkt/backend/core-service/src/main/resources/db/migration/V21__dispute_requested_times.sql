-- Khiếu nại ngày công có thể kèm đề xuất giờ vào/ra.
-- HR duyệt (FIX) sẽ áp giờ này vào attendance_logs để bảng công tự tính lại ngày hôm đó.

ALTER TABLE timesheet_disputes
    ADD COLUMN IF NOT EXISTS requested_check_in  TIME,
    ADD COLUMN IF NOT EXISTS requested_check_out TIME;

COMMENT ON COLUMN timesheet_disputes.requested_check_in  IS 'Giờ vào nhân viên đề xuất (HH:mm) — NULL nếu chỉ khiếu nại lý do';
COMMENT ON COLUMN timesheet_disputes.requested_check_out IS 'Giờ ra nhân viên đề xuất (HH:mm) — NULL nếu chỉ khiếu nại lý do';
