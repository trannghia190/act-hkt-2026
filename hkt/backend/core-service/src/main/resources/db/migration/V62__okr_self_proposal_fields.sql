-- Self proposal thuộc kỳ hiện tại, khai báo cùng bộ mục tiêu (3 mục: Định hướng / Đề xuất / Cải thiện)
ALTER TABLE okr_reviews RENAME COLUMN box4_proposal_next_year TO box4_proposal;
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box4_direction TEXT;
