-- V21: Đảm bảo đủ cột OKR mà entity + seed sử dụng.
-- Trước đây các cột này chỉ được Hibernate (ddl-auto) tạo sau khi Flyway chạy,
-- nên trên DB mới tinh migration seed OKR sẽ lỗi "column does not exist".
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS cycle_year INTEGER;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS manager_feedback TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box2_business_text TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box2_attachment_url VARCHAR(255);
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box2_self_score INTEGER;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box2_manager_score INTEGER;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box3_people_text TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box3_attachment_url VARCHAR(255);
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box3_self_score INTEGER;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box3_manager_score INTEGER;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box4_proposal_next_year TEXT;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS final_average_score NUMERIC(3,2);
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS final_ranking VARCHAR(10);

UPDATE okr_reviews r SET cycle_year = c.cycle_year
FROM okr_cycles c
WHERE r.cycle_id = c.id AND r.cycle_year IS NULL;
