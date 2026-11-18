-- =========================================================================
-- ACT PULSE 2026 - Flyway Migration V1: Database Schema & Seed Data
-- =========================================================================

-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TEAMS (Nhóm làm việc trực tiếp)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id),
    name VARCHAR(100) NOT NULL, -- Sirius, Minion, Optimus, Zeus, Avenger, CA, Mobile
    leader_id UUID,
    is_special_approval BOOLEAN DEFAULT FALSE, -- TRUE cho CA và Mobile (luồng 2 cấp)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SHIFTS (Ca làm việc)
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    check_in_start TIME NOT NULL,  -- 08:00
    check_in_end TIME NOT NULL,    -- 09:30
    check_out_start TIME NOT NULL, -- 17:00
    check_out_end TIME NOT NULL,   -- 18:30
    lunch_break_start TIME DEFAULT '12:00:00',
    lunch_break_end TIME DEFAULT '13:00:00',
    required_work_hours DECIMAL(4,2) DEFAULT 8.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. USERS (Nhân viên)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'EMPLOYEE', -- EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE
    department VARCHAR(100),
    team_id UUID REFERENCES teams(id),
    line_manager_id UUID REFERENCES users(id),
    shift_id UUID REFERENCES shifts(id),
    joined_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE', -- PENDING_ACTIVATION, ACTIVE, SUSPENDED, RESIGNED
    must_change_password BOOLEAN DEFAULT FALSE,
    face_enrolled BOOLEAN DEFAULT FALSE,
    keycloak_user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update teams leader FK
ALTER TABLE teams ADD CONSTRAINT fk_teams_leader FOREIGN KEY (leader_id) REFERENCES users(id);

-- 5. DEVICES (Khóa thiết bị phần cứng 1-1)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    is_approved BOOLEAN DEFAULT TRUE,
    approved_by UUID REFERENCES users(id),
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. DELEGATIONS (Ủy quyền phê duyệt khi đi vắng - S37)
CREATE TABLE IF NOT EXISTS delegations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delegator_id UUID NOT NULL REFERENCES users(id),
    delegatee_id UUID NOT NULL REFERENCES users(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    scope VARCHAR(50) DEFAULT 'ALL_REQUESTS',
    reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. AUDIT LOGS (Nhật ký kiểm toán tập trung - S35)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    user_id UUID REFERENCES users(id),
    user_code VARCHAR(50),
    user_name VARCHAR(150),
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. NOTIFICATIONS (Thông báo đa kênh)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- ATTENDANCE, REQUEST, OKR, SYSTEM
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    action_url VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. RULES & RULE VERSIONS (Trình cấu hình 19 quy định động - S16, S17, S18)
CREATE TABLE IF NOT EXISTS rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL, -- REQUESTS, ATTENDANCE, LEAVE, OKR
    data_type VARCHAR(30) NOT NULL,
    current_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rule_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES rules(id),
    version VARCHAR(20) NOT NULL,
    value TEXT NOT NULL,
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
    change_reason TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- SEED DATA BAN ĐẦU
-- =========================================================================

-- Departments
INSERT INTO departments (id, code, name, description) VALUES
('a0000000-0000-0000-0000-000000000001', 'DEV', 'Phát triển Phần mềm', 'Khối kỹ thuật và sản phẩm'),
('a0000000-0000-0000-0000-000000000002', 'QA', 'Kiểm thử Chất lượng', 'Đội ngũ đảm bảo chất lượng phần mềm'),
('a0000000-0000-0000-0000-000000000003', 'HR', 'Phòng Nhân sự', 'Quản trị nhân lực và chính sách');

-- Teams
INSERT INTO teams (id, department_id, name, is_special_approval) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sirius', FALSE),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Minion', FALSE),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Optimus', FALSE),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Zeus', FALSE),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Avenger', FALSE),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'CA', TRUE),      -- Special 2-step approval
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Mobile', TRUE);  -- Special 2-step approval

-- Shifts
INSERT INTO shifts (id, code, name, check_in_start, check_in_end, check_out_start, check_out_end, required_work_hours) VALUES
('c0000000-0000-0000-0000-000000000001', 'SHIFT_STANDARD', 'Ca Chuẩn Văn Phòng', '08:00:00', '09:30:00', '17:00:00', '18:30:00', 8.00),
('c0000000-0000-0000-0000-000000000002', 'SHIFT_MATERNITY', 'Ca Con Nhỏ < 12 Tháng', '08:30:00', '09:30:00', '16:30:00', '17:30:00', 7.00);

-- Initial Users (Pass: 'Act@2026')
INSERT INTO users (id, employee_code, full_name, email, password_hash, role, department, team_id, joined_date, status, must_change_password) VALUES
('d0000000-0000-0000-0000-000000000001', '01HR', 'Nguyễn Thị Thu Hà', 'ha.nguyen@act-corp.internal', '$2a$12$Nq9v7.d7qE7R5/B.6R9cqud8jK4wXp5vR7iM3t7Y6o7u3Z7q6i.G', 'HR_ADMIN', 'Phòng Nhân sự', NULL, '2020-01-15', 'ACTIVE', FALSE),
('d0000000-0000-0000-0000-000000000002', '05ACT', 'NGUYỄN THANH TÙNG', 'tung.nguyen@act-corp.internal', '$2a$12$Nq9v7.d7qE7R5/B.6R9cqud8jK4wXp5vR7iM3t7Y6o7u3Z7q6i.G', 'MANAGER', 'Phát triển Phần mềm', 'b0000000-0000-0000-0000-000000000001', '2021-03-01', 'ACTIVE', FALSE),
('d0000000-0000-0000-0000-000000000003', '136ACT', 'VŨ VĂN LUẬN', 'luan.vu@act-corp.internal', '$2a$12$Nq9v7.d7qE7R5/B.6R9cqud8jK4wXp5vR7iM3t7Y6o7u3Z7q6i.G', 'EMPLOYEE', 'Phát triển Phần mềm', 'b0000000-0000-0000-0000-000000000003', '2023-06-15', 'ACTIVE', FALSE);

-- Assign Shift to users
UPDATE users SET shift_id = 'c0000000-0000-0000-0000-000000000001';

-- Update team leaders
UPDATE teams SET leader_id = 'd0000000-0000-0000-0000-000000000002' WHERE id = 'b0000000-0000-0000-0000-000000000001';

-- Seed 19 Rules
INSERT INTO rules (rule_key, name, category, data_type, current_value, description) VALUES
('REQ_LATE_MONTHLY_QUOTA', 'Hạn mức đi muộn/về sớm', 'REQUESTS', 'INTEGER', '2', 'Số lần đi muộn/về sớm tối đa trong 1 tháng'),
('REQ_LATE_MAX_MINUTES', 'Số phút tối đa mỗi lần đi muộn', 'REQUESTS', 'INTEGER', '60', 'Số phút tối đa cho phép trong một lần đi muộn hoặc về sớm'),
('REQ_LATE_SUBMIT_MODE', 'Chế độ gửi đơn đi muộn', 'REQUESTS', 'STRING', 'FLEXIBLE_SAME_DAY', 'BEFORE_8AM hoặc FLEXIBLE_SAME_DAY'),
('REQ_ADJUST_MONTHLY_QUOTA', 'Hạn mức bổ sung chấm công', 'REQUESTS', 'INTEGER', '5', 'Số lần bổ sung chấm công tối đa mỗi tháng'),
('REQ_ADJUST_DEADLINE_DAYS', 'Hạn nộp bổ sung chấm công (ngày làm việc)', 'REQUESTS', 'INTEGER', '3', 'Số ngày làm việc tối đa để nộp đơn bổ sung công'),
('REQ_WFH_WEEKLY_QUOTA', 'Hạn mức làm việc từ xa (WFH)', 'REQUESTS', 'INTEGER', '2', 'Số ngày làm việc từ xa tối đa trong 1 tuần'),
('REQ_WFH_MIN_DURATION', 'Thời lượng tối thiểu đơn WFH', 'REQUESTS', 'DECIMAL', '0.5', 'Thời lượng tối thiểu cho 1 lần xin WFH (0.5 ngày)'),
('APPROVAL_SPECIAL_TEAMS', 'Nhóm có luồng duyệt 2 cấp đặc thù', 'REQUESTS', 'JSON', '["CA", "Mobile"]', 'Danh sách nhóm bắt buộc Leader duyệt rồi đến HR duyệt'),
('APPROVAL_SLA_HOURS', 'Thời hạn SLA quản lý phê duyệt', 'REQUESTS', 'INTEGER', '48', 'Thời hạn tối đa quản lý duyệt trước khi hệ thống Auto-escalate'),
('ATTENDANCE_GEOFENCE_RADIUS', 'Bán kính văn phòng hợp lệ (mét)', 'ATTENDANCE', 'INTEGER', '150', 'Bán kính hợp lệ quanh tọa độ văn phòng ACT'),
('ATTENDANCE_GEOFENCE_WARN', 'Bán kính gắn cờ cảnh báo (mét)', 'ATTENDANCE', 'INTEGER', '300', 'Bán kính 150m-300m cho chấm nhưng gắn cờ low_gps_accuracy'),
('ATTENDANCE_OFFLINE_WINDOW_H', 'Thời hạn đồng bộ ngoại tuyến (giờ)', 'ATTENDANCE', 'INTEGER', '24', 'Giới hạn thời gian tối đa cho phép đồng bộ log chấm công offline'),
('ATTENDANCE_DEVICE_LIMIT', 'Giới hạn thiết bị gán cho 1 nhân viên', 'ATTENDANCE', 'INTEGER', '1', 'Số lượng thiết bị di động được phép đăng ký chấm công'),
('TIMESHEET_DISPUTE_DAYS', 'Thời hạn nhân viên khiếu nại bảng công', 'ATTENDANCE', 'INTEGER', '2', 'Số ngày làm việc cho phép nhân viên gửi khiếu nại đầu tháng'),
('LEAVE_ACCRUAL_DAY_OF_MONTH', 'Ngày cộng phép năm hàng tháng', 'LEAVE', 'INTEGER', '15', 'Ngày tự động cộng +1 ngày phép năm định kỳ hàng tháng'),
('LEAVE_MANAGER_BONUS_DAYS', 'Phép chức vụ cộng thêm cho Quản lý', 'LEAVE', 'INTEGER', '3', 'Số ngày phép cộng thêm hàng năm cho cấp Quản lý'),
('LEAVE_SENIORITY_INTERVAL_Y', 'Chu kỳ cộng phép thâm niên (năm)', 'LEAVE', 'INTEGER', '2', 'Cứ mỗi 2 năm làm việc được cộng thêm +1 ngày phép'),
('LEAVE_CARRYOVER_CAP_JULY', 'Giới hạn phép tồn sau ngày 01/04', 'LEAVE', 'INTEGER', '5', 'Số ngày phép tồn tối đa được giữ lại từ 01/04 đến 30/06'),
('LEAVE_ADVANCE_ALLOWED_DAYS', 'Số ngày phép năm cho phép ứng trước', 'LEAVE', 'INTEGER', '3', 'Số ngày phép tối đa nhân viên được phép xin ứng trước');
