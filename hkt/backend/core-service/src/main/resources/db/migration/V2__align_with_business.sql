-- =========================================================================
-- ACT PULSE 2026 - Flyway Migration V2: Đồng bộ schema với nghiệp vụ đã chốt
-- (theo docs/01, docs/02, docs/05, docs/06 — nhóm business là nguồn sự thật)
--
-- Thay đổi chính:
--   1. Bỏ "phòng ban" (departments) và "ủy quyền" (delegations) — business đã bỏ cả 2
--   2. Thêm teams.parent_id  → nhóm lồng nhau, số tầng tự do
--   3. Thêm users.activated_at
--   4. Thêm bảng còn thiếu: face_profiles, attendance_logs, refresh_tokens,
--      login_attempts, timesheets, timesheet_cells, timesheet_audit_logs,
--      okr_cycles, okr_reviews, okr_items, requests, leave_ledger
--   5. rules: đổi sang 19 rule_id của business + current_value dạng JSON field
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Gỡ phần business đã bỏ -----------------------------------------------
DROP TABLE IF EXISTS delegations;
DROP TABLE IF EXISTS departments CASCADE;

ALTER TABLE teams DROP COLUMN IF EXISTS department_id;
ALTER TABLE users DROP COLUMN IF EXISTS department;
ALTER TABLE users DROP COLUMN IF EXISTS keycloak_user_id;

-- 2. Nhóm lồng nhau + kích hoạt tài khoản --------------------------------
ALTER TABLE teams ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES teams(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;

-- đổi tên line_manager_id -> manager_id (business dùng tên này)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users' AND column_name = 'line_manager_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'users' AND column_name = 'manager_id') THEN
        ALTER TABLE users RENAME COLUMN line_manager_id TO manager_id;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teams_parent ON teams(parent_id);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);

-- 3. Hồ sơ khuôn mặt (chỉ lưu vector, KHÔNG lưu ảnh thô) -----------------
CREATE TABLE IF NOT EXISTS face_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    embedding vector(512) NOT NULL,
    model_version VARCHAR(30) NOT NULL DEFAULT 'sface-512-v1',
    status VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | reset
    consent_at TIMESTAMP WITH TIME ZONE,
    enrolled_at TIMESTAMP WITH TIME ZONE,
    enrolled_by UUID REFERENCES users(id),
    reset_by UUID REFERENCES users(id),
    reset_reason TEXT,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bản ghi chấm công (1 dòng / người / ngày) -----------------------------
-- Business (docs/02 TimeEntry): một dòng lưu cả giờ vào & giờ ra của ngày,
-- unique (user_id, work_date) để chặn 2 bản ghi cùng ngày.
CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    shift_id UUID REFERENCES shifts(id),
    device_id UUID REFERENCES devices(id),
    work_date DATE NOT NULL,
    check_in_at TIMESTAMP WITH TIME ZONE,
    check_out_at TIMESTAMP WITH TIME ZONE,
    is_offline_sync BOOLEAN NOT NULL DEFAULT FALSE,
    wifi_bssid VARCHAR(100),
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    distance_meters NUMERIC(10,2),
    status VARCHAR(30) NOT NULL DEFAULT 'VALID',      -- VALID | INCOMPLETE
    -- xác thực khuôn mặt
    face_check_status VARCHAR(20),                    -- passed | failed | pending_sync | not_required
    face_match_score NUMERIC(5,2),
    face_liveness_passed BOOLEAN,
    face_checked_at TIMESTAMP WITH TIME ZONE,
    face_attempts INT NOT NULL DEFAULT 1,
    reject_reason VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_user_date ON attendance_logs(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_logs(user_id, work_date DESC);

-- 5. Phiên đăng nhập (refresh token) --------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    jti UUID NOT NULL UNIQUE,
    token_hash VARCHAR(128) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(50),
    ip_address VARCHAR(50),
    user_agent VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON refresh_tokens(user_id, revoked_at);

-- 6. Đếm lần đăng nhập sai (khoá 10 phút / khoá vĩnh viễn) -------------
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(150) NOT NULL,
    ip_address VARCHAR(50),
    failed_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    permanently_locked BOOLEAN NOT NULL DEFAULT FALSE,
    last_failed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_login_attempt_identifier ON login_attempts(identifier);

-- 7. Bảng công 53 cột ---------------------------------------------------
CREATE TABLE IF NOT EXISTS timesheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    period_month INT NOT NULL,                       -- 1..12
    period_year INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',    -- draft | published | reviewing | locked
    published_at TIMESTAMP WITH TIME ZONE,
    dispute_deadline TIMESTAMP WITH TIME ZONE,
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_timesheet_user_period UNIQUE (user_id, period_month, period_year)
);

CREATE TABLE IF NOT EXISTS timesheet_cells (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timesheet_id UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    symbol VARCHAR(20),                             -- 1.00 | 0.50 | R | AL | S | NL | RO | CL | UP | ML | PL | 0.5/AL ...
    work_minutes INT NOT NULL DEFAULT 0,
    is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_timesheet_cell UNIQUE (timesheet_id, work_date)
);

CREATE TABLE IF NOT EXISTS timesheet_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timesheet_cell_id UUID NOT NULL REFERENCES timesheet_cells(id) ON DELETE CASCADE,
    old_value VARCHAR(20),
    new_value VARCHAR(20),
    reason TEXT NOT NULL,
    changed_by UUID REFERENCES users(id),
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. OKR ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS okr_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    cycle_year INT NOT NULL,
    phases JSONB NOT NULL,                          -- 5 phase: tên + mốc + hạn chót
    checkin_interval VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    scale_min INT NOT NULL DEFAULT 1,
    scale_max INT NOT NULL DEFAULT 5,
    score_categories INT NOT NULL DEFAULT 2,       -- cố định 2: Business + People
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS okr_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID NOT NULL REFERENCES okr_cycles(id),
    user_id UUID NOT NULL REFERENCES users(id),
    manager_id UUID REFERENCES users(id),
    business_score INT,
    people_score INT,
    average_score NUMERIC(3,2),
    self_assessment JSONB,
    manager_assessment JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',    -- draft | submitted | locked | reopened
    locked_at TIMESTAMP WITH TIME ZONE,
    reopened_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS okr_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES okr_reviews(id) ON DELETE CASCADE,
    group_type VARCHAR(20) NOT NULL,                -- BUSINESS | PEOPLE
    title TEXT NOT NULL,
    detail TEXT,
    weight INT,
    progress INT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP WITH TIME ZONE,
    delete_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Đơn từ --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    request_type VARCHAR(20) NOT NULL,              -- LATE_EARLY | ADJUST | LEAVE | WFH
    leave_type VARCHAR(20),
    payload JSONB NOT NULL,
    applied_parameters JSONB,                      -- snapshot tham số lúc gửi
    work_date DATE,
    minutes INT,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',   -- DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | WITHDRAWN | CANCELLED
    current_step INT NOT NULL DEFAULT 0,
    decided_by UUID REFERENCES users(id),
    decided_at TIMESTAMP WITH TIME ZONE,
    decision_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, work_date);

-- 10. Sổ phép (append-only) ----------------------------------------------
CREATE TABLE IF NOT EXISTS leave_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    leave_type VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL,                   -- GRANT | USED | EXPIRED | ADJUST
    amount NUMERIC(6,2) NOT NULL,
    balance_after NUMERIC(6,2) NOT NULL,
    reason TEXT,
    performed_by UUID REFERENCES users(id),
    performed_by_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_ledger_user ON leave_ledger(user_id, created_at DESC);

-- 11. Rule catalog: đổi sang 19 rule_id của business ----------------------
-- current_value = JSON object chứa các field của rule (giống docs/06 §3.1)
DELETE FROM rule_versions WHERE rule_id IN (SELECT id FROM rules);
DELETE FROM rules;

INSERT INTO rules (rule_key, name, category, data_type, current_value, description) VALUES
('late_early', 'Đi muộn / về sớm', 'REQUESTS', 'JSON',
 '{"max_count":2,"max_minutes":60,"submit_within_days":3,"allow_late_request":true}',
 'Số lần/tháng, số phút tối đa, hạn nộp theo ngày — không yêu cầu giờ'),
('makeup', 'Bổ sung chấm công', 'REQUESTS', 'JSON',
 '{"max_count":5,"deadline_working_days":3,"allow_overdue_with_approval":false}',
 'Số lần/tháng, hạn nộp theo ngày làm việc, có cho phép nộp quá hạn không'),
('wfh', 'Làm việc từ xa (WFH)', 'REQUESTS', 'JSON',
 '{"max_count":2,"min_duration_days":0.5,"block_third_day":true}',
 'Số ngày/tuần, đơn tối thiểu 0.5 ngày, chặn cứng ngày thứ 3'),
('hr_approval', 'Nhóm có bước HR duyệt thêm', 'REQUESTS', 'JSON',
 '{"teams":["CA","Mobile"],"request_types":["LATE_EARLY","ADJUST","WFH"]}',
 'Chỉ đơn đi muộn / bổ sung công / WFH của nhóm CA + Mobile mới qua HR — nghỉ phép KHÔNG chuyển HR'),
('approval_flow', 'Luồng duyệt đơn', 'REQUESTS', 'JSON',
 '{"default_steps":[{"step":1,"approver":"line_manager"}],"sla_hours":48,"allow_withdraw":true}',
 'Mặc định 1 bước duyệt bởi quản lý trực tiếp; SLA nhắc quá hạn'),
('attendance_security', 'Kiểm tra khi chấm công', 'ATTENDANCE', 'JSON',
 '{"require_internal_network":true,"require_geofence":true,"geofence_radius_m":150,"gps_accuracy_tolerance_m":100,"allow_offline_punch":true,"offline_max_hours":24,"max_devices":2,"require_face_verification":true,"face_match_threshold":85,"require_liveness":true,"face_max_attempts":3,"grace_minutes":0}',
 '5 lớp xác thực song song: mạng nội bộ · geofence · thiết bị · ca · khuôn mặt — không đạt là CHẶN'),
('share_account', 'Chống dùng chung tài khoản', 'ATTENDANCE', 'JSON',
 '{"max_checkin_per_day":1,"require_password_change":true,"require_2fa":false,"device_confirm_required":true,"alert_on_new_device":true,"max_additional_devices":1,"device_request_need_reason":true,"device_grant_days":0,"device_request_from_office_only":true,"device_expiry_days":90}',
 'Chặn ở gốc + quản lý thiết bị + bắt buộc đổi mật khẩu + minh bạch'),
('shift_times', 'Giờ làm việc', 'ATTENDANCE', 'JSON',
 '{"check_in_start":"08:00","check_in_end":"09:30","check_out_start":"17:00","check_out_end":"18:30","lunch_break_start":"12:00","lunch_break_end":"13:00","required_work_hours":8,"is_flexible":false,"flexible_checkin_from":"08:00","flexible_checkin_to":"10:00","flexible_checkout_from":"17:00","flexible_checkout_to":"19:00","full_day_hours":8,"half_day_hours":4,"allow_exception_shift":false}',
 'Khung giờ làm; ca linh hoạt cho phép trong khung nếu tổng ≥ 8h thì vẫn tính đủ 1 ngày công'),
('shift', 'Ca & bộ gán ca', 'ATTENDANCE', 'JSON',
 '{"default_shift_start":"08:30","default_shift_end":"17:30","default_lunch_start":"12:00","default_lunch_end":"13:30"}',
 'Ca mặc định + ca ngoại lệ gán theo nhóm/chức vụ'),
('late_without_request', 'Đi muộn không có đơn', 'TIMESHEET', 'JSON',
 '{"deduct_actual_minutes":true,"count_as_absent":false}',
 'Đi muộn không có đơn → trừ đúng số phút thực tế, không tự ý trừ công'),
('payroll_period', 'Kỳ công & khiếu nại', 'TIMESHEET', 'JSON',
 '{"publish_day":11,"dispute_window_days":2,"lock_delay_days":3,"allow_adjust_after_lock":false}',
 'Công bố giữa kỳ ngày 11 → khiếu nại 2 ngày → khóa sau 3 ngày; khóa rồi thì không điều chỉnh được'),
('leave_type_defaults', 'Mặc định chung cho mọi loại nghỉ', 'LEAVE', 'JSON',
 '{"submit_within_days":3,"require_attachment":false,"allow_negative_balance":false}',
 'Tầng 1 — áp dụng chung; loại nghỉ ghi đè ở tầng 2; đơn ghi đè ở tầng 3'),
('leave_request', 'Thời hạn & điều kiện xin nghỉ', 'LEAVE', 'JSON',
 '{"submit_within_days":3,"allow_overdue_with_approval":false,"min_lead_days":0}',
 'Hạn nộp theo ngày, không dựa vào giờ'),
('leave_accrual', 'Cách cộng phép', 'LEAVE', 'JSON',
 '{"base_days_per_year":12,"accrual_on":15,"probation_days":2,"on_confirmation":true,"advance_max_days":3}',
 '12 ngày/năm cộng ngày 15 hàng tháng; ứng trước tối đa 3 ngày'),
('leave_seniority', 'Phép thâm niên', 'LEAVE', 'JSON',
 '{"interval_years":2,"days_per_interval":1,"accrual_on_anniversary":true}',
 '+1 ngày mỗi 2 năm, cộng đúng ngày tròn thâm niên'),
('leave_position_bonus', 'Phép theo chức vụ', 'LEAVE', 'JSON',
 '{"manager_bonus_days":3,"position_bonus_days":0}',
 'Manager +3 ngày/năm; có thể gán thêm theo chức vụ'),
('leave_carryover', 'Phép tồn', 'LEAVE', 'JSON',
 '{"keep_all_until":"04-01","max_keep_from":"04-01","max_keep_days":5,"expire_from":"07-01","prioritize_carryover":true}',
 'Trước 01/04 giữ toàn bộ; 01/04–01/07 chỉ giữ 5 ngày; từ 01/07 xoá về 0'),
('okr_evaluation', 'Cách đánh giá', 'OKR', 'JSON',
 '{"scale_min":1,"scale_max":5,"score_categories":2,"checkin_interval":"MONTHLY","alignment_enabled":false,"weight_sum":100}',
 'Thang 1–5, 2 nhóm Business/People; KHÔNG xếp loại A/B/C/D'),
('notification', 'Chính sách nhắc việc', 'SHARED', 'JSON',
 '{"max_push_per_day":3,"quiet_hours_start":"21:00","quiet_hours_end":"07:00","dedupe_window_hours":12,"escalate_after_days":3,"digest_email_at":"08:00"}',
 'Chống spam: 3 push/ngày, giờ yên lặng, dedupe 12h, escalate quá 3 ngày');
