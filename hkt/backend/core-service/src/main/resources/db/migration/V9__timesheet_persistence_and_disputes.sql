-- Lưu trạng thái bảng công theo kỳ + ô sửa tay + khiếu nại trong DB (không dùng RAM).

CREATE TABLE IF NOT EXISTS timesheet_disputes (
    id VARCHAR(20) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    work_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    deadline TIMESTAMP WITH TIME ZONE,
    resolution_action VARCHAR(30),
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_status ON timesheet_disputes(status);

-- 2 khiếu nại mẫu để demo luồng xử lý (ON CONFLICT để chạy lại an toàn).
INSERT INTO timesheet_disputes (id, user_id, work_date, reason, status, deadline)
SELECT 'DC-01', id, DATE '2026-11-05', 'Có check-in 08:47 nhưng bảng ghi vắng', 'PENDING', NOW() + INTERVAL '2 days'
FROM users WHERE employee_code = '136ACT'
ON CONFLICT (id) DO NOTHING;

INSERT INTO timesheet_disputes (id, user_id, work_date, reason, status, deadline)
SELECT 'DC-02', id, DATE '2026-11-07', 'Nghỉ phép đã duyệt nhưng ghi UP', 'PENDING', NOW() + INTERVAL '1 day'
FROM users WHERE employee_code = '01HR'
ON CONFLICT (id) DO NOTHING;
