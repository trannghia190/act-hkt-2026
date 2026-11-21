-- V26: OKR management — audit trail, mid-year review, final 4-box fields, cycle config, item deadline
ALTER TABLE okr_items ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE okr_cycles ADD COLUMN IF NOT EXISTS alignment_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box1_results TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box1_adjustments TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box1_difficulties TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box1_lessons TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS manager_comment TEXT;

CREATE TABLE IF NOT EXISTS okr_midyear_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL UNIQUE REFERENCES okr_reviews(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES users(id),
    employee_feedback TEXT,
    manager_coaching TEXT,
    h2_commitment TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS okr_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID REFERENCES okr_reviews(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES okr_cycles(id) ON DELETE CASCADE,
    item_id UUID,
    actor_id UUID,
    actor_name VARCHAR(150),
    action VARCHAR(50) NOT NULL,
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okr_audit_review ON okr_audit_logs(review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_okr_audit_cycle ON okr_audit_logs(cycle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_okr_midyear_manager ON okr_midyear_reviews(manager_id);
