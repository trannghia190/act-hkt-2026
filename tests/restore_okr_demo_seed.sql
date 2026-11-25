-- Khôi phục dữ liệu demo OKR (chu kỳ 2026 + hồ sơ + đầu việc) đúng theo seed gốc
-- V31 + các bước chuẩn hoá của V33/V36. Dùng khi chu kỳ OKR demo bị xoá nhầm
-- (VD khi thử tính năng "Xoá chu kỳ" trên chu kỳ đang active).
--
-- Chạy:  psql -h 127.0.0.1 -d pulse_db -f scripts/restore_okr_demo_seed.sql

BEGIN;

-- 1. Chu kỳ 2026 — cấu hình 5 phase như seed gốc.
-- 0. Dọn chu kỳ 2026 tạm (job provisioning sinh ra sau khi chu kỳ bị xoá) để dựng
--    lại đúng bản seed gốc. Nếu bản seed đã có thì giữ nguyên.
DO $$
DECLARE
    seeded CONSTANT uuid := 'c0000000-0000-0000-0000-000000002026';
BEGIN
    IF EXISTS (SELECT 1 FROM okr_cycles WHERE cycle_year = 2026 AND id <> seeded) THEN
        -- Xoá hồ sơ của các chu kỳ tạm trước (items/checkin/audit con cascade).
        DELETE FROM okr_reviews
        WHERE cycle_id IN (SELECT id FROM okr_cycles WHERE cycle_year = 2026 AND id <> seeded);
        DELETE FROM okr_cycles WHERE cycle_year = 2026 AND id <> seeded;
    END IF;
END $$;

-- 1. Chu kỳ 2026 — cấu hình 5 phase như seed gốc.
INSERT INTO okr_cycles (id, name, cycle_year, phases, checkin_interval, scale_min, scale_max, score_categories, status)
VALUES (
    'c0000000-0000-0000-0000-000000002026',
    'Chu kỳ OKR & Đánh giá Hiệu suất 2026',
    2026,
    '[
      {"key": "setup", "name": "Thiết lập OKR", "months": "Jan–Mar", "start_date": "2026-01-01", "due_date": "2026-03-31", "status": "closed"},
      {"key": "checkin", "name": "Check-in định kỳ", "months": "Mar–Apr / Nov", "start_date": "2026-04-01", "due_date": "2026-11-30", "status": "active"},
      {"key": "midyear", "name": "Review giữa năm", "months": "Jun–Jul", "start_date": "2026-06-01", "due_date": "2026-07-31", "status": "closed"},
      {"key": "final", "name": "Đánh giá cuối năm", "months": "Nov–Dec", "start_date": "2026-11-15", "due_date": "2026-12-15", "status": "upcoming"},
      {"key": "summary", "name": "Tổng hợp & Báo cáo", "months": "Dec", "start_date": "2026-12-16", "due_date": "2026-12-31", "status": "upcoming"}
    ]'::jsonb,
    'MONTHLY', 1, 5, 2, 'active'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phases = EXCLUDED.phases,
    checkin_interval = EXCLUDED.checkin_interval,
    scale_min = EXCLUDED.scale_min,
    scale_max = EXCLUDED.scale_max,
    score_categories = EXCLUDED.score_categories,
    status = 'active';

-- 2. Hồ sơ OKR của 136ACT (nhân viên demo) và 05ACT (quản lý demo — nguồn gợi ý C14).
INSERT INTO okr_reviews (
    id, cycle_id, user_id, manager_id,
    business_score, people_score, average_score,
    box2_self_score, box2_manager_score, box2_business_text,
    box3_self_score, box3_manager_score, box3_people_text,
    box4_proposal,
    status, cycle_year, current_step
) VALUES (
    'e0000000-0000-0000-0000-000000000136',
    'c0000000-0000-0000-0000-000000002026',
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000002',
    4, 4, 4.00,
    4, 4, 'Hoàn thành các mục tiêu tối ưu hiệu năng và hạ tầng chấm công ActPulse',
    4, 4, 'Tổ chức tech sharing chia sẻ kiến thức nội bộ cho nhóm Sirius',
    'Định hướng nâng cao năng lực System Architecture và kèm cặp 1 Junior Dev năm 2027',
    'draft', 2026, 2
) ON CONFLICT (id) DO NOTHING;

INSERT INTO okr_reviews (
    id, cycle_id, user_id, manager_id,
    business_score, people_score, average_score,
    box2_self_score, box2_manager_score, box2_business_text,
    box3_self_score, box3_manager_score, box3_people_text,
    box4_proposal,
    status, cycle_year, current_step
) VALUES (
    'e0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000002026',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    5, 4, 4.50,
    5, 5, 'Dẫn dắt hoàn thành giai đoạn 1 dự án chuyển đổi số ACT và hạ tầng Core Service',
    4, 4, 'Xây dựng văn hoá kỹ thuật tự chủ, nâng cao năng lực cho 5 kỹ sư chính',
    'Phát triển đội ngũ Tech Lead kế cận và mở rộng hệ sinh thái sản phẩm B2B',
    'submitted', 2026, 3
) ON CONFLICT (id) DO NOTHING;

-- 3. Đầu việc OKR.
INSERT INTO okr_items (id, review_id, group_type, title, detail, weight, progress)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000136', 'BUSINESS', 'Giảm P99 API latency chấm công xuống dưới 80ms', 'Tối ưu chỉ mục PostgreSQL và Redis cache', 50, 75),
    ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000136', 'BUSINESS', 'Hoàn thiện bảng công 53 cột khớp file HR và rule engine', 'Đạt 100% test pass 53 cột', 50, 90),
    ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000136', 'PEOPLE', 'Tổ chức 3 buổi tech sharing về AI Face Recognition', 'Đã hoàn thành 2/3 buổi cho team', 50, 80),
    ('a0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000136', 'PEOPLE', 'Hoàn thành chứng chỉ AWS Solutions Architect', 'Đang ôn tập phần networking và security', 50, 90),
    ('a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 'BUSINESS', 'Hoàn thành giai đoạn 1 dự án chuyển đổi số ACT', 'Triển khai thành công cho toàn bộ khối phát triển phần mềm', 50, 85),
    ('a0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000005', 'PEOPLE', 'Kèm cặp và phát triển 2 Senior Developer lên vị trí Tech Lead', 'Đã phân công phụ trách 2 module lớn', 50, 80)
ON CONFLICT (id) DO NOTHING;

-- 4. Mục tiêu công ty (20%) do HR cấu hình — V36.
UPDATE okr_cycles
SET company_objectives = '[
  {"id": "comp-01", "title": "Đạt mốc 10,000 người dùng hoạt động hàng ngày (DAU)", "category": "BUSINESS", "progress": 82},
  {"id": "comp-02", "title": "Xây dựng văn hóa học tập liên tục và chuyển đổi số nội bộ", "category": "PEOPLE", "progress": 90}
]'::jsonb
WHERE id = 'c0000000-0000-0000-0000-000000002026'
  AND company_objectives = '[]'::jsonb;

-- 5. OKR 136ACT ở kỳ check-in → phải là bản ĐÃ DUYỆT (check-in chỉ cho OKR đã duyệt) — V36.
UPDATE okr_reviews
SET status = 'locked',
    locked_at = COALESCE(locked_at, NOW()),
    current_step = GREATEST(COALESCE(current_step, 0), 2)
WHERE id = 'e0000000-0000-0000-0000-000000000136'
  AND status IN ('draft', 'submitted')
  AND locked_at IS NULL;

-- 6. OKR quản lý 05ACT là nguồn gợi ý C14 → phải ĐÃ DUYỆT — V33.
UPDATE okr_reviews
SET status = 'locked',
    locked_at = COALESCE(locked_at, NOW())
WHERE id = 'e0000000-0000-0000-0000-000000000005'
  AND status = 'submitted';

-- 7. Điểm business/people seed sẵn là điểm bịa → xoá (hiển thị lấy từ Box 2/3) — V36.
UPDATE okr_reviews SET business_score = NULL, people_score = NULL, average_score = NULL
WHERE id IN ('e0000000-0000-0000-0000-000000000136', 'e0000000-0000-0000-0000-000000000005');

-- 8. Điểm tự chấm / quản lý seed sẵn trong khi chưa tới phase cuối năm → điểm bịa — V36.
UPDATE okr_reviews
SET box2_self_score = NULL, box3_self_score = NULL,
    box2_manager_score = NULL, box3_manager_score = NULL,
    final_average_score = NULL
WHERE id IN ('e0000000-0000-0000-0000-000000000136', 'e0000000-0000-0000-0000-000000000005')
  AND manager_comment IS NULL;

COMMIT;
