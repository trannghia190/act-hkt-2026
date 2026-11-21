-- Mặc định chính sách: cấp manager trở lên được tự duyệt đơn của chính mình (scope ALWAYS).
-- Chỉ đổi giá trị seed mặc định của V25 (bật + min_role MANAGER + NO_MANAGER);
-- nếu HR đã chỉnh tay cấu hình thì giữ nguyên.

UPDATE rules
SET current_value = (current_value::jsonb || '{"self_approval_scope": "ALWAYS"}'::jsonb)::text
WHERE rule_key = 'approval_flow'
  AND current_value::jsonb ->> 'allow_self_approval' = 'true'
  AND current_value::jsonb ->> 'self_approval_min_role' = 'MANAGER'
  AND current_value::jsonb ->> 'self_approval_scope' = 'NO_MANAGER';
