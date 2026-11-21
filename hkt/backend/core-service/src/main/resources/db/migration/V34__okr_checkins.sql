-- V25: Check-in tiến độ OKR theo từng đầu việc + file minh chứng
CREATE TABLE IF NOT EXISTS okr_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL,
    review_id UUID NOT NULL REFERENCES okr_reviews(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES okr_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    period VARCHAR(10) NOT NULL,                 -- 2026-11 (monthly)
    previous_value NUMERIC(6,2),
    new_value NUMERIC(6,2) NOT NULL,
    progress_snapshot INT NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_okr_checkins_item ON okr_checkins(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_batch ON okr_checkins(batch_id);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_review_period ON okr_checkins(review_id, period);

CREATE TABLE IF NOT EXISTS okr_checkin_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    size_bytes BIGINT NOT NULL,
    data BYTEA NOT NULL,
    uploaded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okr_checkin_attachments_batch ON okr_checkin_attachments(batch_id);
