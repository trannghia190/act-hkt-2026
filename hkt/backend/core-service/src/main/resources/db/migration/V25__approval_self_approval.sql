-- Luồng duyệt đơn: cấu hình cho cấp quản lý tự duyệt đơn của chính mình.
--  · allow_self_approval     — bật/tắt tính năng (mặc định bật);
--  · self_approval_min_role  — vai trò tối thiểu được tự duyệt (MANAGER = cấp manager trở lên);
--  · self_approval_scope     — NO_MANAGER: chỉ khi không có quản lý trực tiếp hợp lệ (đơn sẽ
--                              không có ai duyệt), ALWAYS: mọi lúc.
-- Giá trị đã có (nếu HR từng sửa) được giữ nguyên — defaults chỉ điền field còn thiếu.

UPDATE rules
SET current_value = (
        '{"allow_self_approval": true, "self_approval_min_role": "MANAGER", "self_approval_scope": "NO_MANAGER"}'::jsonb
        || current_value::jsonb
    )::text
WHERE rule_key = 'approval_flow';
