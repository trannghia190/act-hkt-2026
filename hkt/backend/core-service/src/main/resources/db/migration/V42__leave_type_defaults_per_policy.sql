-- V42: chỉnh lại thiết lập mặc định của các loại nghỉ seed sẵn cho đúng quy định
-- (docs/02-business-attendance-time-tracking.md §2.3). Các cột is_paid /
-- deducts_annual_leave được thêm ở V5 với default FALSE nên AL bị sai từ đầu:
-- Phép năm phải TRỪ quỹ phép năm; các loại nghỉ chế độ thì không trừ.
UPDATE leave_types SET deducts_annual_leave = TRUE WHERE code = 'AL';
UPDATE leave_types SET deducts_annual_leave = FALSE
WHERE code IN ('S', 'NL', 'RO', 'CL', 'ML', 'PL', 'UP', 'HIEU', 'TANG',
               'ML_NAM', 'ML_NU', 'ML_NAM_5', 'ML_NAM_7', 'ML_NAM_10', 'ML_NAM_14');

-- Nghỉ không lương / thai sản nam do BHXH chi trả: không hưởng lương từ công ty.
UPDATE leave_types SET is_paid = FALSE
WHERE code IN ('UP', 'PL', 'ML_NAM', 'ML_NAM_5', 'ML_NAM_7', 'ML_NAM_10', 'ML_NAM_14');

-- Tang gia được báo gấp ngay trong ngày (0 ngày); các loại còn lại giữ 3 ngày.
UPDATE leave_types SET submit_within_days = 0 WHERE code = 'TANG';
