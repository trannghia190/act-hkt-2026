-- V27: Chuẩn hoá rule OKR
-- 1. Mục tiêu công ty (20%) do HR cấu hình theo chu kỳ — thay cho dữ liệu hard-code trong code.
ALTER TABLE okr_cycles ADD COLUMN IF NOT EXISTS company_objectives JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE okr_cycles
SET company_objectives = '[
  {"id": "comp-01", "title": "Đạt mốc 10,000 người dùng hoạt động hàng ngày (DAU)", "category": "BUSINESS", "progress": 82},
  {"id": "comp-02", "title": "Xây dựng văn hóa học tập liên tục và chuyển đổi số nội bộ", "category": "PEOPLE", "progress": 90}
]'::jsonb
WHERE id = 'c0000000-0000-0000-0000-000000002026'
  AND company_objectives = '[]'::jsonb;

-- 2. Self proposal năm sau có trạng thái nộp riêng, tách khỏi trạng thái duyệt OKR đầu năm.
ALTER TABLE okr_reviews ADD COLUMN IF NOT EXISTS box4_submitted_at TIMESTAMP WITH TIME ZONE;

-- 3. Trạng thái phase giờ tính theo ngày. Bỏ các trạng thái cứng "active/upcoming" của seed,
--    chỉ giữ lại "locked" cho phase đã khoá thật.
UPDATE okr_cycles
SET phases = (
    SELECT jsonb_agg(
        CASE WHEN lower(p->>'status') IN ('locked', 'closed')
             THEN jsonb_set(p, '{status}', '"locked"')
             ELSE jsonb_set(p, '{status}', '"scheduled"') END
        ORDER BY ord)
    FROM jsonb_array_elements(phases) WITH ORDINALITY AS t(p, ord)
)
WHERE jsonb_typeof(phases) = 'array';

-- 4. Seed demo: OKR của 136ACT đang ở kỳ check-in nên phải là bản ĐÃ DUYỆT (check-in chỉ cho OKR đã duyệt).
--    Điểm business/people seed sẵn là điểm bịa, xoá đi; điểm hiển thị lấy từ Box 2/3.
UPDATE okr_reviews
SET status = 'locked',
    locked_at = COALESCE(locked_at, NOW()),
    current_step = GREATEST(COALESCE(current_step, 0), 2)
WHERE id = 'e0000000-0000-0000-0000-000000000136'
  AND status IN ('draft', 'submitted')
  AND locked_at IS NULL;

UPDATE okr_reviews SET business_score = NULL, people_score = NULL, average_score = NULL
WHERE id IN ('e0000000-0000-0000-0000-000000000136', 'e0000000-0000-0000-0000-000000000005');

-- 5. Seed demo có sẵn điểm tự chấm + điểm quản lý trong khi chưa tới phase đánh giá cuối năm → điểm bịa.
--    Chỉ xoá khi chưa từng được chấm thật qua API (chấm thật bắt buộc có manager_comment).
UPDATE okr_reviews
SET box2_self_score = NULL, box3_self_score = NULL,
    box2_manager_score = NULL, box3_manager_score = NULL,
    final_average_score = NULL
WHERE id IN ('e0000000-0000-0000-0000-000000000136', 'e0000000-0000-0000-0000-000000000005')
  AND manager_comment IS NULL;
