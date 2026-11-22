-- Thêm 2 khoá cấu hình mạng công ty vào rule attendance_security để HR sửa được trên
-- màn "Cấu hình quy định" (/admin/rules). Trước đây form chỉ render các key đang có
-- trong current_value nên 2 khoá này luôn bị ẩn (dù backend vẫn dùng default trong code).
UPDATE rules
SET current_value = (
      current_value::jsonb
      || jsonb_build_object(
           'office_ip_prefixes',
           COALESCE(current_value::jsonb ->> 'office_ip_prefixes',
                    '10.0.,192.168.,172.16.,127.0.,0:0:0:0:0:0:0:1,::1'),
           'office_wifi_keywords',
           COALESCE(current_value::jsonb ->> 'office_wifi_keywords',
                    'act_office,act-office,act_office_5g')
         )
    )::text,
    updated_at = now()
WHERE rule_key = 'attendance_security'
  AND (
    NOT (current_value::jsonb ? 'office_ip_prefixes')
    OR NOT (current_value::jsonb ? 'office_wifi_keywords')
  );
