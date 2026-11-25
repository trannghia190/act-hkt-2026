-- V64: Xoá trắng dữ liệu OKR khởi tạo.
--
-- Yêu cầu: hệ thống OKR phải khởi động TRỐNG — không có chu kỳ, hồ sơ, đầu việc
-- hay check-in nào được seed sẵn. Dữ liệu OKR chỉ tồn tại sau khi người dùng thật
-- tạo chu kỳ (HR) và nhân viên tạo mục tiêu.
--
-- Vì sao là migration MỚI chứ không sửa V16/V31: các file migration cũ đã được
-- apply vào DB, mà Flyway validate so checksum từng file → sửa nội dung file cũ
-- sẽ khiến app không boot. Thay vào đó migration này dọn dữ liệu đã seed.
--
-- CÁCH DÙNG: file này dọn toàn bộ dữ liệu OKR. Chạy 1 lần lúc nâng cấp DB.

-- 1. Dữ liệu con trước (check-in kèm file đính kèm, review giữa năm, audit).
DELETE FROM okr_checkin_attachments;
DELETE FROM okr_checkins;
DELETE FROM okr_midyear_reviews;
DELETE FROM okr_audit_logs;

-- 2. Đầu việc + hồ sơ OKR.
DELETE FROM okr_items;
DELETE FROM okr_reviews;

-- 3. Chu kỳ OKR. company_objectives (mục tiêu công ty 20%) là cấu hình của HR
--    gắn với chu kỳ → xoá luôn để chu kỳ mới tạo ra không thừa hưởng seed.
DELETE FROM okr_cycles;

-- 4. Bỏ index "mỗi năm 1 chu kỳ" + "tối đa 1 chu kỳ active" (V63). Index này
--    chặn việc HR tạo lại chu kỳ cho cùng năm sau khi dữ liệu seed bị dọn.
--    Vẫn giữ quy tắc nghiệp vụ 1 chu kỳ active ở tầng service.
DROP INDEX IF EXISTS uq_okr_cycles_year;
DROP INDEX IF EXISTS uq_okr_cycles_one_active;
