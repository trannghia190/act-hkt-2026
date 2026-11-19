INSERT INTO leave_types (code, name, default_days, requires_attachment, is_paid, deducts_annual_leave, unit, submit_within_days, config)
VALUES
('ML_NAM_5',  'Thai sản nam — 5 ngày',  5,  TRUE, TRUE, FALSE, 'DAY', 3, '{"male_maternity":true}'),
('ML_NAM_7',  'Thai sản nam — 7 ngày',  7,  TRUE, TRUE, FALSE, 'DAY', 3, '{"male_maternity":true}'),
('ML_NAM_10', 'Thai sản nam — 10 ngày', 10, TRUE, TRUE, FALSE, 'DAY', 3, '{"male_maternity":true}'),
('ML_NAM_14', 'Thai sản nam — 14 ngày', 14, TRUE, TRUE, FALSE, 'DAY', 3, '{"male_maternity":true}')
ON CONFLICT (code) DO NOTHING;
