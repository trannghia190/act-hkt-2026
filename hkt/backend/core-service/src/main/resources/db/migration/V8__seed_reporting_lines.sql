-- Nối tuyến quản lý trực tiếp cho dữ liệu seed để luồng duyệt 1 cấp hoạt động:
-- nhân viên 136ACT → quản lý 05ACT → HR 01HR.
UPDATE users
SET manager_id = (SELECT id FROM users WHERE employee_code = '05ACT')
WHERE employee_code = '136ACT' AND manager_id IS NULL;

UPDATE users
SET manager_id = (SELECT id FROM users WHERE employee_code = '01HR')
WHERE employee_code = '05ACT' AND manager_id IS NULL;
