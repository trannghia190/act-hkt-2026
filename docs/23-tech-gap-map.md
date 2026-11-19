# 23 — Bản đồ chênh lệch & Trạng thái xử lý (Tech ↔ Business)

> **Mục tiêu:** Theo dõi các điểm lệch giữa tài liệu kỹ thuật (11–22), mã nguồn `hkt/`
> và nghiệp vụ đã chốt (01–09). Mỗi mục có **trạng thái hiện tại** và **bằng chứng**.
>
> **Nguyên tắc:** Nhóm 01–09 (business) là nguồn sự thật. Code/tài liệu kỹ thuật phải sửa theo,
> không sửa ngược business.
>
> **Cập nhật gần nhất:** 19/11/2026 — sau khi áp dụng đợt sửa đồng bộ (xem lịch sử git).

---

## 0. Tổng quan trạng thái

| # | Hạng mục | Trạng thái |
|---|---|---|
| 1 | Đăng nhập Non-SSO + JWT + khoá + session (C-01, C-17, G-04b) | ✅ Docs + code + compose |
| 2 | Bảng công 53 cột (C-02) | ✅ Docs + lưới UI + CSV export 53 cột |
| 3 | Bỏ xếp loại A/B/C/D + Calibration (C-03) | ✅ Docs + xoá màn Calibration + báo cáo bỏ cột grade |
| 4 | Bỏ dry-run → xác nhận khi lưu (C-04) | ✅ Docs 11/18/20/21/22 + backend + UI rule |
| 5 | Bỏ ủy quyền (C-05) | ✅ Xoá route/menu/page/DDL |
| 6 | 2 thiết bị (C-06) | ✅ Docs + seed rule + code (máy đầu tự đăng ký, máy mới chờ HR) |
| 7 | GPS ngoài bán kính → CHẶN (C-07) | ✅ Docs 11/13 + code |
| 8 | Ngoài mạng → CHẶN (C-08) | ✅ Docs 13 + code |
| 9 | Ngưỡng khuôn mặt 85% + liveness thật (C-09, K-02, K-03) | ✅ AI service + rule |
| 10 | Nghỉ phép 1 cấp duyệt (C-10) | ✅ Docs + `RequestController` duyệt 1 cấp |
| 11 | Chấm công desktop (C-11) | ✅ Docs 13 + cùng trang CheckIn |
| 12 | Hạn nộp theo ngày (C-12) | ✅ Docs 14/18 |
| 13 | Loại nghỉ cấu hình được (C-13) | ✅ Docs + backend CRUD `leave-types` |
| 14 | Kỳ công công bố ngày 11 (C-14) | ✅ Docs 16 + rule `payroll_period` |
| 15 | Ô sửa màu đỏ (C-15) | ✅ Docs 16 + UI lưới công |
| 16 | Không cộng bù sau khóa kỳ (C-16) | ✅ Docs 16 |
| 17 | Web Push thay Mobile Push (C-18) | ✅ Docs 11/19; ⚠️ code chưa gửi Web Push |
| 18 | Bỏ cây phân tầng (C-19) | ✅ Docs 17 + OKR UI 2 nhóm Business/People |
| 19 | Rule catalog 19 rule/121 field (G-01) | ✅ Docs 18 + V2 seed JSON + RuleService/API |
| 20 | 25 endpoint + 9 bảng thiếu (G-02, G-03) | ✅ Docs + V2/V3 DDL + 102 endpoint (đủ 25 path business) |
| 21 | Link `/Users/sang` + phòng ban + EXECUTIVE (G-05→G-07) | ✅ Docs đã sửa; DDL bỏ `departments` |
| 22 | Chấm công hụt khuôn mặt vẫn VALID (K-01) | ✅ Đã bỏ fallback, chặn & lưu `face_*` |
| 23 | Face lưu file JSON (K-04) | ✅ Chuyển sang Postgres `face_profiles` (JSON chỉ fallback dev) |
| 24 | Thiếu unique `(user_id, work_date)` (K-08) | ✅ V2 + entity 1 dòng/ngày |
| 25 | Xoá ủy quyền / WFH 3→2 / nhãn 45→53 (K-13, K-14) | ✅ Đã sửa code frontend |
| 26 | **OKRController mới của remote** dùng `weight`, `targetGrade/finalGrade` A/B/C/D | ✅ Đã bỏ grade/weight/Calibration; giữ 2 nhóm + điểm 1–5 |
| 27 | **OrgStructureController mới** dựng cây `departments` | ✅ Đổi sang `TeamGroupNode` / `/admin/teams/tree`, UI nhãn "Nhóm" |
| 28 | **FaceController mới** trả mock, ghi ngưỡng 0.82 | ✅ Đã xoá — dùng `/api/v1/face/*` của AI service thật |
| 29 | **CronController mới** trả số liệu giả (77 người…) | ✅ Cộng phép thật vào `leave_ledger` |
| 30 | **`hkt/face-recognition` mới** là dịch vụ face thứ 2 | ⚠️ `run.sh` đã trỏ lại `ai-face-service`; thư mục mới vẫn còn nhưng không được dùng |
| 31 | **Màn mockup chưa có UI code** | ✅ Đủ 45 màn (S04m, S10, S13, S24, S27–S29, S32, S36, S44–S46 đã thêm) |
| 32 | **`docs/12-system-changelog...md` trùng** với `docs/22-system...md` sau pull | ✅ Đã xoá bản trùng |

> Ký hiệu: ✅ xong · ⚠️ docs xong nhưng code còn phần · ❌ chưa xử lý.

---

## 1. Chi tiết theo nhóm

### 1.1. Đăng nhập — Non-SSO nội bộ

| Hạng mục | Trước | Hiện tại |
|---|---|---|
| Cách đăng nhập | Keycloak/OIDC trong tài liệu 12/21 | **Tài khoản nội bộ**: email + mật khẩu bcrypt(12) |
| Token | Chuỗi giả `"pulse-jwt-" + UUID` | **JWT thật HS512** (`JwtService`), access 15′ / refresh 7 ngày |
| Xác thực request | `.anyRequest().permitAll()` | `JwtAuthenticationFilter` + `authenticated()`; public chỉ login/refresh |
| Khoá sai | Chỉ đọc `status=LOCKED`, không có code set | Bảng `login_attempts`: sai 5 → khoá 10′; sai 10 → khoá vĩnh viễn |
| Phiên | Không lưu | Bảng `refresh_tokens` (hash + jti); refresh xoay vòng; đổi mật khẩu thu hồi toàn bộ |
| Keycloak | Container + mô tả kiến trúc | **Đã gỡ container**, docs 21 viết lại Non-SSO |

**Còn lại:** cần chạy migration V2 trên DB thật; kiểm thử refresh/logout.

### 1.2. Chấm công — 5 lớp chặn

| Lớp | Trước | Hiện tại |
|---|---|---|
| Thiết bị | Không kiểm tra | Máy đầu tự đăng ký; máy mới tạo yêu cầu chờ HR; đủ hạn mức → chặn |
| Mạng | Gắn cờ `OUTSIDE_OFFICE_NETWORK` | **CHẶN** (trừ ngày WFH) |
| GPS | 150–300m vẫn cho chấm | **CHẶN** khi > bán kính hoặc sai số > 100m |
| Ca | Không kiểm tra | Kiểm tra rule `shift`/`shift_times` |
| Khuôn mặt | Thiếu ảnh → vẫn `VALID` | Bắt buộc: chưa đăng ký/không khớp/không liveness → **CHẶN**, lưu `face_check_status/score/liveness/attempts` |

Bản ghi chấm công đổi sang **1 dòng/người/ngày** (`check_in_at`, `check_out_at`, unique `user_id+work_date`).
Không còn nhánh `Fallback standard punch`.

### 1.3. AI Face Service

| Hạng mục | Trước | Hiện tại |
|---|---|---|
| Ngưỡng khớp | `0.65` hard-code | `FACE_SIMILARITY_THRESHOLD` mặc định **0.85** |
| Liveness | `is_liveness_verified=True` gán cứng | So sánh chuyển động giữa ≥ 2 frame; không đạt → `LIVENESS_FAILED` |
| Lưu trữ | `face_db.json` | **`face_profiles` (pgvector 512D)**; JSON chỉ fallback khi DB không sẵn |
| Seed | 4 vector ngẫu nhiên giả | **Đã bỏ** — không sinh dữ liệu sinh trắc học giả |

### 1.4. Rule Engine

* Docs 18 viết lại: **19 `rule_id`** (`late_early`, `attendance_security`, `okr_evaluation`…),
  `current_value` là **JSON object** chứa 121 field.
* Migration V2 seed đúng 19 rule này; `RuleService` đọc từ DB — không hard-code.
* API: `GET /rules`, `PUT /rules/{key}` (bắt buộc lý do + ngày hiệu lực),
  `GET /rules/{key}/versions`, `POST /rules/{key}/rollback/{versionId}`,
  `GET /rules/public-policy-doc`.
* **Đã bỏ** `/rules/dry-run` và màn S18; UI hiện hộp thoại xác nhận trước khi lưu.

### 1.5. Frontend đã dọn

* `CheckInPage`: gửi **ảnh đầy đủ** + 3 frame liveness; so `matched_employee.employee_code`
  với tài khoản đang đăng nhập; chỉ thành công khi Core trả `status=VALID`; proxy `/api` → 8080.
* `FaceEnrollmentPage`: **3 góc**, khoá theo tài khoản đang đăng nhập (không nhập tay mã NV),
  gửi vector cho AI + Core.
* Xoá `CalibrationPage`, `TeamBoardPage`, `DelegationPage` + route/menu tương ứng.
* Bảng công: lưới **53 cột** (5 thông tin + 31 ngày + 17 tổng hợp), sửa ô ngày tại chỗ,
  ô đã sửa màu đỏ.
* `MyOKRPage`: bỏ `weight`/`confidence`; check-in chỉ nhập giá trị.
* WFH 3 ngày/tháng → **2 ngày/tuần**; nhãn “45 cột” → “53 cột”.

---

## 2. Việc còn lại (⚠️)

| # | Việc | Ưu tiên | Ghi chú |
|---|---|---|---|
| 1 | ~~CSV export 53 cột~~ | ✅ | Đã xuất đủ 5+31+17 cột |
| 2 | ~~Bỏ grade/OKRReports~~ | ✅ | Đã bỏ cột, filter và form grade |
| 3 | ~~OKR UI 2 nhóm~~ | ✅ | `MyOKRPage` đã là 2 nhóm Business/People, đầu việc tự do |
| 4 | ~~CRUD loại nghỉ~~ | ✅ | Backend `LeaveController` + V3 seed 12 loại |
| 5 | **Web Push thực tế** (VAPID/service worker) | P2 | Endpoint preferences đã có; chưa gửi push thật |
| 6 | ~~25 endpoint business~~ | ✅ | Đã có 102 endpoint, đủ path business |
| 7 | ~~types OKR còn weight/confidence/grade~~ | ✅ | Đã dọn |
| 8 | ~~Chạy migration + test~~ | ✅ | V1–V4 apply OK trên PostgreSQL16; app start; login 200; `/rules,/leave-types,/devices,/okr/cycles,/disputes` 200 |
| 9 | ~~Chọn 1 dịch vụ face~~ | ✅ | `run.sh` đã trỏ `ai-face-service`; `hkt/face-recognition` không dùng |
| 10 | ~~Bỏ grade/weight khỏi OKRController~~ | ✅ | Đã xoá grade/Calibration/weight |
| 11 | ~~Bỏ departments~~ | ✅ | Backend đổi TeamGroupNode; UI nhãn "Nhóm" |
| 12 | ~~FaceController mock~~ | ✅ | Đã xoá file |
| 13 | ~~Cron accrual~~ | ✅ | Đã ghi `leave_ledger` (GRANT 1.0 ngày) |
| 14 | ~~S04m~~ | ✅ | Đã thêm `MobileNotificationsPage` |
| 15 | ~~Xoá docs/12 trùng~~ | ✅ | Đã xoá |
| 16 | **Nối nốt page còn mock** (S36/S44) với API | P2 | S45/S46/S27/S32/S24 đã gọi API |
| 17 | ~~Approval engine đơn từ~~ | ✅ | `RequestController`: tạo/nháp/gửi/duyệt/từ chối/rút/bulk, 1 cấp quản lý |
| 18 | **Web Push** (VAPID + service worker) | P2 | Chỉ mới có endpoint preferences |
| 19 | **RequestsPage/ApprovalsPage vẫn localStorage** — chưa gọi `/requests` API | P1 | Backend `RequestController` đã có |
| 20 | **Face service chưa chạy trong test** (cần cài requirements/opencv) | P2 | Core gọi sẽ fallback chặn nếu không có AI |

---

## 3. Bảng tra nhanh — nguồn sự thật

| Chủ đề | Nguồn sự thật | Ghi chú |
|---|---|---|
| Đăng nhập & tài khoản | `docs/01-business-shared-core.md` §2, §3 | Non-SSO, vai trò tự xác định |
| Chấm công 5 lớp | `docs/02` §2.1.1 · `docs/06` `attendance_security` | Không đạt là CHẶN |
| Khuôn mặt | `docs/01` Hồ sơ khuôn mặt · `docs/07` §2.4 | 3 góc, 85%, liveness, không lưu ảnh thô |
| Bảng công 53 cột | `docs/02` §2.1.3 | Đối chiếu `doc/Pine team_T10.2026_Timekeeping Report.xlsx` |
| Rule Engine | `docs/06` §3.1 | 19 `rule_id`, 121 field, versioning, không dry-run |
| OKR | `docs/03` §2.2, §2.9 | Điểm 1–5, 2 nhóm, không xếp loại, khoá/mở lại |
| Nghỉ phép | `docs/02` §2.3 | 8 cột + loại mở rộng, 1 cấp duyệt |
| Kỳ công | `docs/06` `payroll_period` | Công bố ngày 11, khiếu nại 2 ngày, khoá sau 3 ngày |

---

> **Khi sửa tiếp:** cập nhật bảng trạng thái §0 và §2; chạy `bash scripts/check-consistency.sh`
> và `mvn -DskipTests compile` trước khi commit.
