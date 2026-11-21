-- V31: Bước 4 quy trình đánh giá — Giám đốc đánh giá chung trước khi HR chốt chu kỳ
ALTER TABLE okr_cycles ADD COLUMN IF NOT EXISTS director_reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE okr_cycles ADD COLUMN IF NOT EXISTS director_reviewed_by UUID REFERENCES users(id);
ALTER TABLE okr_cycles ADD COLUMN IF NOT EXISTS director_review_comment TEXT;
