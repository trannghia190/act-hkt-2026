-- V22: Seed OKR Cycle 2026, Review, and Items for Demo Users
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
    'MONTHLY',
    1,
    5,
    2,
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Seed OKR Review for 136ACT (Vũ Văn Luận)
INSERT INTO okr_reviews (
    id, cycle_id, user_id, manager_id,
    business_score, people_score, average_score,
    box2_self_score, box2_manager_score, box2_business_text,
    box3_self_score, box3_manager_score, box3_people_text,
    box4_proposal_next_year,
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

-- Seed OKR Items for 136ACT
INSERT INTO okr_items (id, review_id, group_type, title, detail, weight, progress)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000136', 'BUSINESS', 'Giảm P99 API latency chấm công xuống dưới 80ms', 'Tối ưu chỉ mục PostgreSQL và Redis cache', 50, 75),
    ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000136', 'BUSINESS', 'Hoàn thiện bảng công 53 cột khớp file HR và rule engine', 'Đạt 100% test pass 53 cột', 50, 90),
    ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000136', 'PEOPLE', 'Tổ chức 3 buổi tech sharing về AI Face Recognition', 'Đã hoàn thành 2/3 buổi cho team', 50, 80),
    ('a0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000136', 'PEOPLE', 'Hoàn thành chứng chỉ AWS Solutions Architect', 'Đang ôn tập phần networking và security', 50, 90)
ON CONFLICT (id) DO NOTHING;

-- Seed OKR Review for 05ACT (Nguyễn Thanh Tùng - Manager)
INSERT INTO okr_reviews (
    id, cycle_id, user_id, manager_id,
    business_score, people_score, average_score,
    box2_self_score, box2_manager_score, box2_business_text,
    box3_self_score, box3_manager_score, box3_people_text,
    box4_proposal_next_year,
    status, cycle_year, current_step
) VALUES (
    'e0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000002026',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    5, 4, 4.50,
    5, 5, 'Dẫn dắt hoàn thành giai đoạn 1 dự án chuyển đổi số ACT và hạ tầng Core Service',
    4, 4, 'Xây dựng văn hóa kỹ thuật tự chủ, nâng cao năng lực cho 5 kỹ sư chính',
    'Phát triển đội ngũ Tech Lead kế cận và mở rộng hệ sinh thái sản phẩm B2B',
    'submitted', 2026, 3
) ON CONFLICT (id) DO NOTHING;

-- Seed OKR Items for 05ACT (Manager) - also serves as manager objectives for C14!
INSERT INTO okr_items (id, review_id, group_type, title, detail, weight, progress)
VALUES
    ('a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 'BUSINESS', 'Hoàn thành giai đoạn 1 dự án chuyển đổi số ACT', 'Triển khai thành công cho toàn bộ khối phát triển phần mềm', 50, 85),
    ('a0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000005', 'PEOPLE', 'Kèm cặp và phát triển 2 Senior Developer lên vị trí Tech Lead', 'Đã phân công phụ trách 2 module lớn', 50, 80)
ON CONFLICT (id) DO NOTHING;
