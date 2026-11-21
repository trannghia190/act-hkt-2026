-- Mô hình kỳ công MỞ: kỳ đang chạy cho khiếu nại ngay; đầu tháng sau chốt kỳ trước.
-- close_day = ngày chốt bảng công tháng trước (1..28); dispute_window_days = số ngày còn khiếu nại sau chốt;
-- lock_delay_days = ân hạn thêm sau hạn khiếu nại trước khi tự khoá (0 = khoá ngay);
-- allow_adjust_after_lock = HR vẫn được điều chỉnh sau khoá (luôn bắt buộc lý do + audit).
UPDATE rules
SET current_value = jsonb_build_object(
        'close_day', 1,
        'dispute_window_days', COALESCE((current_value::jsonb->>'dispute_window_days')::int, 2),
        'lock_delay_days', 0,
        'allow_adjust_after_lock', true
    )::text,
    updated_at = NOW()
WHERE rule_key = 'payroll_period';

UPDATE rules
SET description = 'Ngày chốt bảng công tháng trước (close_day), số ngày còn khiếu nại sau chốt (dispute_window_days), ân hạn trước khi tự khoá (lock_delay_days) và cho phép HR điều chỉnh sau khoá (allow_adjust_after_lock). Kỳ đang chạy luôn mở để nhân viên khiếu nại.'
WHERE rule_key = 'payroll_period';
