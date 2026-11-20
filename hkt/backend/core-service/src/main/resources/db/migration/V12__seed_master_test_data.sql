-- =========================================================================
-- ACT PULSE 2026 - V12: Seed Comprehensive Master & Sample Test Data
-- Provides rich master DB records for Teams, Users, Reporting Chains,
-- Leave Ledger, Requests, Notifications, Audit Logs, and OKRs.
-- =========================================================================

-- 1. Master Teams & Infinite Nested Org Hierarchy -------------------------
-- Sirius (Parent) -> Sirius Core (Sub-team) -> Sirius Backend (Sub-sub-team)
-- Sirius UI/UX (Leaderless team)
INSERT INTO teams (id, name, parent_id, is_special_approval) VALUES
('b0000000-0000-0000-0000-000000000010', 'Sirius Core', 'b0000000-0000-0000-0000-000000000001', FALSE),
('b0000000-0000-0000-0000-000000000011', 'Sirius Backend Architecture', 'b0000000-0000-0000-0000-000000000010', FALSE),
('b0000000-0000-0000-0000-000000000012', 'Sirius UI/UX Team', 'b0000000-0000-0000-0000-000000000001', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Update team leaders
UPDATE teams SET leader_id = 'd0000000-0000-0000-0000-000000000002' 
WHERE id IN ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000011');
-- Note: Sirius UI/UX Team deliberately has leader_id = NULL to test leaderless warning in Org Tree (S41)

-- 2. Master Users & Reporting Hierarchy -----------------------------------
-- Password hash: $2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm ('123456')
INSERT INTO users (id, employee_code, full_name, email, password_hash, role, position_name, team_id, manager_id, shift_id, joined_date, status, must_change_password, face_enrolled)
VALUES
('d0000000-0000-0000-0000-000000000005', 'ACT0042', 'Nguyễn Văn Minh', 'minh.nguyen@act.vn', '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm', 'EMPLOYEE', 'Kỹ sư Backend Senior', 'b0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '2022-04-01', 'ACTIVE', FALSE, TRUE),
('d0000000-0000-0000-0000-000000000006', 'ACT0089', 'Trần Thị Thu Thảo', 'thao.tran@act.vn', '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm', 'EMPLOYEE', 'Chuyên viên BA / PO', 'b0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '2023-01-10', 'ACTIVE', FALSE, TRUE),
('d0000000-0000-0000-0000-000000000007', 'ACT0055', 'Hoàng Anh Dũng', 'dung.hoang@act.vn', '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm', 'EMPLOYEE', 'Kỹ sư Hạ Tầng DevOps', 'b0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '2021-08-15', 'ACTIVE', FALSE, TRUE),
('d0000000-0000-0000-0000-000000000008', 'ACT0112', 'Vũ Quốc Toàn', 'toan.vu@act.vn', '$2y$12$u0TSCzNoCF8AEgSJEV6iNOZEq0Ngcvg72zhBKXarVanAi.IeCzCVm', 'EMPLOYEE', 'Kỹ sư Thiết kế UI/UX', 'b0000000-0000-0000-0000-000000000012', NULL, 'c0000000-0000-0000-0000-000000000001', '2024-02-01', 'ACTIVE', FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Ensure manager relationships and position names for seed users
UPDATE users SET position_name = 'Giám đốc Kỹ thuật', manager_id = NULL WHERE employee_code = 'Admin';
UPDATE users SET position_name = 'Trưởng phòng Nhân sự', manager_id = 'd0000000-0000-0000-0000-000000000000' WHERE employee_code = '01HR';
UPDATE users SET position_name = 'Trưởng nhóm Kỹ thuật (Lead)', manager_id = 'd0000000-0000-0000-0000-000000000001', team_id = 'b0000000-0000-0000-0000-000000000001' WHERE employee_code = '05ACT';
UPDATE users SET position_name = 'Kỹ sư Phần mềm Cao cấp', manager_id = 'd0000000-0000-0000-0000-000000000002', team_id = 'b0000000-0000-0000-0000-000000000011' WHERE employee_code = '136ACT';
UPDATE users SET position_name = 'Thực tập sinh Kỹ thuật', manager_id = 'd0000000-0000-0000-0000-000000000002', team_id = 'b0000000-0000-0000-0000-000000000012' WHERE employee_code = '2026NEW';

-- 3. Master Leave Ledger (Sổ phép append-only) ---------------------------
-- 136ACT: Grant 12 ngày phép 2026, Grant 3.5 ngày tồn 2025 bảo lưu, Used 5.0 ngày -> Còn lại 10.5 ngày (Phép 2026: 7.0, Tồn: 3.5)
INSERT INTO leave_ledger (id, user_id, leave_type, action, amount, balance_after, reason, performed_by, performed_by_system, created_at) VALUES
('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'ANNUAL', 'GRANT', 12.00, 12.00, 'Cấp phép năm định kỳ 2026 theo quy chế', 'd0000000-0000-0000-0000-000000000001', TRUE, '2026-01-01 00:00:00'),
('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'ANNUAL', 'GRANT', 3.50, 15.50, 'Phép tồn năm 2025 được bảo lưu tối đa đến 31/03/2027', 'd0000000-0000-0000-0000-000000000001', TRUE, '2026-01-01 00:01:00'),
('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'ANNUAL', 'USED', 5.00, 10.50, 'Đã sử dụng nghỉ phép năm theo đơn được duyệt', 'd0000000-0000-0000-0000-000000000002', FALSE, '2026-05-10 14:00:00'),
-- 05ACT: Grant 15 ngày (12 cơ bản + 3 ngày phép chức vụ Manager), Used 2.0 -> Còn lại 13.0
('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'ANNUAL', 'GRANT', 15.00, 15.00, 'Cấp phép năm 2026 (12 ngày tiêu chuẩn + 3 ngày phép Quản lý)', 'd0000000-0000-0000-0000-000000000001', TRUE, '2026-01-01 00:00:00'),
('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'ANNUAL', 'USED', 2.00, 13.00, 'Nghỉ phép cá nhân', 'd0000000-0000-0000-0000-000000000001', FALSE, '2026-06-20 10:00:00')
ON CONFLICT (id) DO NOTHING;

-- 4. Master Requests (Đơn từ chờ duyệt & đã xử lý) -------------------------
INSERT INTO requests (id, user_id, request_type, leave_type, payload, applied_parameters, work_date, minutes, reason, status, current_step, decided_by, decided_at, decision_comment, created_at) VALUES
-- Pending Request 1: 136ACT xin nghỉ phép năm 1.5 ngày -> Chờ 05ACT duyệt
('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'LEAVE', 'ANNUAL', '{"from_date":"2026-11-25","to_date":"2026-11-26","days":1.5}', '{"max_days":12}', '2026-11-25', NULL, 'Nghỉ phép giải quyết việc gia đình', 'PENDING_APPROVAL', 1, NULL, NULL, NULL, NOW() - INTERVAL '6 hours'),
-- Pending Request 2: ACT0042 xin làm việc từ xa WFH 1.0 ngày -> Chờ 05ACT duyệt
('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'WFH', NULL, '{"work_date":"2026-11-21","days":1.0}', '{"weekly_quota":2}', '2026-11-21', NULL, 'Làm việc từ xa hỗ trợ onsite khách hàng hạ tầng', 'PENDING_APPROVAL', 1, NULL, NULL, NULL, NOW() - INTERVAL '14 hours'),
-- Pending Request 3: ACT0089 giải trình đi muộn 30 phút -> Chờ 05ACT duyệt
('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000006', 'LATE_EARLY', NULL, '{"work_date":"2026-11-19","minutes":30}', '{"monthly_quota":2}', '2026-11-19', 30, 'Đi muộn 30 phút do sự cố kẹt xe đường Cầu Giấy', 'PENDING_APPROVAL', 1, NULL, NULL, NULL, NOW() - INTERVAL '20 hours'),
-- Pending Request 4: 136ACT bổ sung chấm công check-out -> Chờ 05ACT duyệt
('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'ADJUST', NULL, '{"work_date":"2026-11-18","check_out":"17:35"}', '{"monthly_quota":5}', '2026-11-18', NULL, 'Quên chấm công ra ca chiều do hỗ trợ deploy khẩn', 'PENDING_APPROVAL', 1, NULL, NULL, NULL, NOW() - INTERVAL '30 hours'),
-- Approved Request 5: 136ACT nghỉ ốm hưởng BHXH -> Đã được 05ACT duyệt
('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000003', 'LEAVE', 'SICK', '{"from_date":"2026-11-10","to_date":"2026-11-10","days":1.0}', '{}', '2026-11-10', NULL, 'Nghỉ ốm hưởng BHXH kèm giấy chứng nhận y tế', 'APPROVED', 1, 'd0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '5 days', 'Đồng ý duyệt theo giấy khám bệnh', NOW() - INTERVAL '6 days'),
-- Rejected Request 6: ACT0089 xin WFH ngày thứ 3 trong tuần -> Bị từ chối
('f0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000006', 'WFH', NULL, '{"work_date":"2026-11-14","days":1.0}', '{"weekly_quota":2}', '2026-11-14', NULL, 'Xin WFH ngày thứ 3 trong tuần để sửa nhà', 'REJECTED', 1, 'd0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '3 days', 'Từ chối: Vượt hạn ngạch tối đa 2 ngày WFH/tuần theo quy tắc số 06', NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;

-- 5. Master Notifications (Thông báo đa kênh) -----------------------------
INSERT INTO notifications (id, user_id, title, content, type, priority, action_url, is_read, created_at) VALUES
('50000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Nhắc nhở chấm công ra ca chiều', 'Đã 17:35, bạn đã làm đủ 8.0 giờ tiêu chuẩn hôm nay. Vui lòng chấm công ra ca để ghi nhận đủ công.', 'ATTENDANCE', 'HIGH', '/attendance/checkin', FALSE, NOW() - INTERVAL '15 minutes'),
('50000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'Đơn xin nghỉ ốm REQ-0005 đã được duyệt', 'Quản lý NGUYỄN THANH TÙNG đã phê duyệt đơn nghỉ ốm 1.0 ngày của bạn.', 'REQUEST', 'LOW', '/attendance/requests', FALSE, NOW() - INTERVAL '2 hours'),
('50000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'Hạn chót check-in OKR Quý 4/2026', 'Còn 2 ngày trước khi chốt số liệu định kỳ. Cập nhật tiến độ 2 Key Results nhóm Business & People.', 'OKR', 'MEDIUM', '/okr/my-okr', FALSE, NOW() - INTERVAL '8 hours'),
('50000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'Lưu ý phép tồn năm 2025 hết hạn vào 31/03/2027', '3.5 ngày phép tồn năm 2025 sẽ hết hạn sau ngày 31/03/2027 theo quy chế số 04.', 'SYSTEM', 'LOW', '/attendance/leaves', TRUE, NOW() - INTERVAL '1 day'),
('50000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'Có 4 đơn cấp dưới đang chờ bạn phê duyệt', 'Vũ Văn Luận, Nguyễn Văn Minh và Trần Thị Thu Thảo vừa gửi đơn xin phép/giải trình mới.', 'REQUEST', 'HIGH', '/todo', FALSE, NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- 6. Master Audit Logs (Nhật ký kiểm toán tập trung S35) ------------------
INSERT INTO audit_logs (id, action, entity_name, entity_id, user_id, user_code, user_name, old_value, new_value, reason, ip_address, created_at) VALUES
('70000000-0000-0000-0000-000000000001', 'UPDATE_USER_MANAGER', 'users', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000000', 'Admin', 'Quản Trị Viên Hệ Thống', 'Chưa có quản lý trực tiếp', 'NGUYỄN THANH TÙNG (05ACT)', 'Phân bổ nhân sự kỹ thuật vào dự án Sirius Core', '192.168.1.10', NOW() - INTERVAL '2 days'),
('70000000-0000-0000-0000-000000000002', 'UPDATE_RULE_PARAMETER', 'rules', 'ATTENDANCE_GEOFENCE_RADIUS', 'd0000000-0000-0000-0000-000000000000', 'Admin', 'Quản TrI Viên Hệ Thống', '100', '150', 'Mở rộng bán kính điểm danh hợp lệ sang khu vực sảnh tòa nhà', '192.168.1.10', NOW() - INTERVAL '1 day'),
('70000000-0000-0000-0000-000000000003', 'UPDATE_TIMESHEET_CELL', 'timesheet_cells', '2026-11-18', 'd0000000-0000-0000-0000-000000000001', '01HR', 'Nguyễn Thị Thu Hà', '0.00', '1.00', 'Cập nhật công đủ ca làm việc theo đơn giải trình được phê duyệt', '192.168.1.15', NOW() - INTERVAL '12 hours')
ON CONFLICT (id) DO NOTHING;

-- 7. Master OKR Cycles & Objectives ---------------------------------------
INSERT INTO okr_cycles (id, name, cycle_year, phases, checkin_interval, scale_min, scale_max, score_categories, status, created_at) VALUES
('80000000-0000-0000-0000-000000000001', 'OKR Năm 2026 / Quý 4 - Chuyển Đổi Số Toàn Diện', 2026, '{"phases":[{"name":"Thiết lập","deadline":"2026-10-15"},{"name":"Giữa kỳ","deadline":"2026-11-20"},{"name":"Đánh giá","deadline":"2026-12-31"}]}', 'MONTHLY', 1, 5, 2, 'active', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO okr_reviews (id, cycle_id, user_id, manager_id, cycle_year, business_score, people_score, average_score, status, created_at) VALUES
('80000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 2026, 4, 4, 4.00, 'submitted', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO okr_items (id, review_id, group_type, title, detail, weight, progress, created_at) VALUES
('80000000-0000-0000-0000-000000000021', '80000000-0000-0000-0000-000000000010', 'BUSINESS', 'Tối ưu hóa Core Engine giảm độ trễ P99 xuống < 80ms', 'Tối ưu chỉ mục PostgreSQL và cache phân tán Redis', 40, 75, NOW() - INTERVAL '10 days'),
('80000000-0000-0000-0000-000000000022', '80000000-0000-0000-0000-000000000010', 'BUSINESS', 'Hoàn tất kiểm thử tự động 100% các luồng Robot Framework', 'Đạt 71/71 ca kiểm thử nghiệm thu không có lỗi', 35, 90, NOW() - INTERVAL '10 days'),
('80000000-0000-0000-0000-000000000023', '80000000-0000-0000-0000-000000000010', 'PEOPLE', 'Kèm cặp và chuyển giao tài liệu kiến trúc cho thành viên mới', 'Biên soạn tài liệu onboarding và hướng dẫn dự án', 25, 60, NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;
