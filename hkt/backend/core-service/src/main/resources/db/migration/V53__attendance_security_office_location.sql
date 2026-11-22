-- Thêm toạ độ văn phòng vào rule attendance_security để HR chỉnh được trên
-- màn "Cấu hình quy định" (trước đây chỉ có fallback hard-code OFFICE_LAT/OFFICE_LNG).
UPDATE rules
SET current_value = (
      current_value::jsonb
      || jsonb_build_object(
           'office_lat', COALESCE((current_value::jsonb ->> 'office_lat')::numeric, 21.0285),
           'office_lng', COALESCE((current_value::jsonb ->> 'office_lng')::numeric, 105.8542)
         )
    )::text,
    updated_at = now()
WHERE rule_key = 'attendance_security'
  AND (
    NOT (current_value::jsonb ? 'office_lat')
    OR NOT (current_value::jsonb ? 'office_lng')
  );
