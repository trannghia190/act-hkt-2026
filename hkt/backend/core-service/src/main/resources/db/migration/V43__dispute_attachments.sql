-- Giấy tờ đính kèm khiếu nại bảng công (ốm/thai sản…) — lưu thật trong DB.
-- Loại nghỉ có requires_attachment=true thì khiếu nại "chuyển thành nghỉ" bắt buộc có giấy tờ.
CREATE TABLE IF NOT EXISTS dispute_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id VARCHAR(20) NOT NULL REFERENCES timesheet_disputes(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    size_bytes BIGINT NOT NULL DEFAULT 0,
    data BYTEA NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispute_attachment_dispute ON dispute_attachments(dispute_id);
