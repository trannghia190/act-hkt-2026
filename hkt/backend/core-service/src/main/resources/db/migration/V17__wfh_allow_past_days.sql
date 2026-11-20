-- WFH: bỏ yêu cầu đăng ký trước 1 ngày, cho phép đăng ký cho tối đa 3 ngày trước.
UPDATE rules
SET current_value = current_value::jsonb || '{"submit_within_days": 3}'::jsonb,
    updated_at = NOW()
WHERE rule_key = 'wfh';
