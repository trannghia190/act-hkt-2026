-- V30: Báo cáo tổng hợp OKR (F8) theo doc/OKR_doc.md Bước 5
-- 1. "Thời gian công tác tính từ ngày vào tới 31/12/2026 hoặc 2027 tùy chỉnh" → HR cấu hình mốc theo chu kỳ.
--    NULL = mặc định 31/12 của năm chu kỳ.
ALTER TABLE okr_cycles ADD COLUMN IF NOT EXISTS seniority_cutoff_date DATE;
-- 2. Cột "Note" của bảng tổng hợp: HR (Bước 3) / Giám đốc (Bước 4) ghi chú — tách khỏi nhận xét của Quản lý.
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS hr_note TEXT;
