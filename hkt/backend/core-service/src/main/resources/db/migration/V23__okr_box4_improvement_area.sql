-- V23: Box 4 self proposal — bổ sung "điểm cần cải thiện" tách riêng khỏi nội dung đề xuất
ALTER TABLE okr_reviews
    ADD COLUMN IF NOT EXISTS box4_improvement_area TEXT;
