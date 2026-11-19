# 07 — Checklist triển khai theo tính năng

> **Cách dùng:** mỗi tính năng là 1 mục. Mỗi mục có **màn hình mockup** để team nhìn thấy
> sản phẩm phải ra sao, **tiêu chí nghiệm thu** để biết xong chưa, và **phụ thuộc** để biết
> làm sau cái gì.
> **Không viết theo ngày, không viết theo file/framework** — tech stack chốt sau, danh sách này
> không đổi theo stack.
>
> **Ưu tiên:** 🔴 **P0** = bắt buộc có · 🟡 **P1** = có thì tốt · ⚪ **P2** = làm được thì làm.
> **Cắt theo thứ tự ngược lại: P2 → P1 → P0. Không bao giờ cắt P0.**

---

## 0. Bản đồ: tính năng ↔ màn hình ↔ tài liệu

| # | Tính năng | Vai trò | Màn hình | Tài liệu chi tiết |
|---|---|---|---|---|
| **A. Vào hệ thống & tổ chức** |
| A1 | Đăng nhập tài khoản nội bộ — vai trò tự xác định | Tất cả | S01 | `docs/01` §3 |
| A2 | Cấu trúc điều hướng, 3 biến thể menu | Tất cả | S00 | `PLAN.md` §1.1 |
| A3 | Quản lý nhân viên | HR | S40 | `docs/01` §2 |
| A4 | Cây nhóm lồng nhau, số tầng tự do | HR | S41 | `docs/01` §2 |
| A5 | Nhật ký thay đổi | HR | S35 | `docs/01` §2 |
| **B. Chấm công — nhân viên** |
| B0 | Đăng ký khuôn mặt (face enrollment) | NV | S27, S05m | `docs/07` §2.4 |
| B1 | Chấm công trên điện thoại (1 chạm + khuôn mặt) | NV | S05m | `docs/07` |
| B2 | Chấm công trên desktop | NV | S05 | `docs/02` §3 |
| B3 | Lịch công tháng | NV | S06 | `docs/02` §3 |
| B4 | Bảng công của tôi + chọn tháng + khiếu nại | NV | S11 | `docs/02` §5.1 |
| B5 | Thiết bị của tôi (đăng ký, thu hồi) | NV+HR | S27 | `docs/01` §2 |
| B6 | Thêm thiết bị (1 flow duy nhất) | NV+HR | S29 | `docs/01` §2.1 |
| **C. Đơn từ — nhân viên** |
| C1c | Tạo đơn đi muộn — prefill từ log chấm công | NV | S07 | `docs/02` §6 |
| C2c | Đơn bổ sung chấm công | NV | S31 | `docs/02` §6 |
| C3c | Đơn của tôi — lịch sử + trạng thái | NV | S08 | `docs/02` §5.1 |
| C4c | Xin nghỉ phép (8 loại) | NV | S30 | `docs/02` §2.3 |
| C5c | Đăng ký WFH | NV | S10 | `docs/02` §5.1 |
| C6c | Số dư phép | NV | S09 | `docs/02` §5.1 |
| **D. Đơn từ — quản lý & HR** |
| D1 | Duyệt đơn hàng loạt + chip lý do | QL | S12 | `docs/04` §C7 |
| D2 | Chi tiết đơn — timeline | QL | S13 | `docs/02` §5.2 |
| D3 | Lịch nhóm + cảnh báo xung đột + phân quyền xem | QL | S14 | `docs/02` §5.2 |
| D4 | Chi tiết 1 khiếu nại — 3 cột so sánh | HR | S33 | `docs/02` §5.3 |
| D5 | Sổ phép (ledger) | HR | S34 | `docs/02` §5.3 |
| **E. Bảng công & cấu hình — HR** |
| E1 | Bảng công & chốt — sửa tại chỗ, 53 cột | HR | S15 | `docs/04` §C4 · `docs/02` §2.1.3 |
| E2 | Bộ lọc + lưu view | HR | S15 | `docs/04` §C5 |
| E3 | Cấu hình quy định (19 luật, chỉ toàn công ty) | HR | S16 | `docs/06` |
| E4 | Cấu hình 1 luật (form sinh tự động + confirm khi lưu) | HR | S17 | `docs/06` |
| E5 | Trang quy định tra cứu | Tất cả | S19 | `docs/04` §C6 |
| E6 | Ca làm việc (linh hoạt) & lịch nghỉ lễ | HR | S26 | `docs/02` §5.3 |
| E7 | Quản lý loại nghỉ (hiếu hỉ · tang · thai sản nam/nữ) | HR | S32 | `docs/02` §2.3 |
| E8 | Quản lý thiết bị (duyệt/thu hồi, mặc định 2 máy) | HR | S28 | `docs/01` §2 |
| E9 | Danh sách khiếu nại — xử lý nhanh tại chỗ | HR | S45 | `docs/02` §5.3 |
| E10 | Bảng phép tất cả mọi người | HR | S46 | `docs/02` §5.3 |
| **F. OKR** |
| F1 | Dashboard OKR | NV | S20 | `docs/03` §2 |
| F2 | Tạo OKR — tự nhập, 2 nhóm cố định | NV | S21 | `docs/03` §3 · `docs/04` §C14 |
| F3 | Check-in tiến độ | NV | S22 | `docs/03` §4 |
| F4 | Duyệt OKR đầu năm | QL | S42 | `docs/03` §5 |
| F5 | Review giữa năm | QL | S43 | `docs/03` §5 |
| F6 | Đánh giá cuối năm (form 4 box) | QL | S23 | `docs/03` §5 |
| F7 | Review OKR cả nhóm | QL | S24 | `docs/04` §C8 |
| F8 | Báo cáo OKR + cột Trạng thái | HR | S25 | `docs/03` §6 |
| F9 | Quản lý chu kỳ OKR | HR | S44 | `docs/03` §5 |
| **G. Tiện lợi dùng chung** |
| G1 | Todo inbox — màn hình mặc định | NV+QL | S02 | `docs/04` §C1 |
| G2 | Command palette Ctrl+K | Tất cả | S03 | `docs/04` §C3 |
| G3 | Thông báo & nhắc việc | Tất cả | S04, S04m | `docs/04` §C2 |
| G4 | Tuỳ chỉnh thông báo | Tất cả | S36 | `docs/04` §C9 |

---

## A. Vào hệ thống & tổ chức

### A1 · Đăng nhập tài khoản nội bộ — vai trò tự xác định 🔴 · S01
**Cần có:** trang đăng nhập bằng **email công ty + mật khẩu** (không Google SSO); HR cấp tài khoản → email kích hoạt; lần đầu **bắt buộc đổi mật khẩu** → **đăng ký khuôn mặt** → vào thẳng "Cần làm"; **không có màn hình chọn vai trò**.
**Nghiệm thu:**
- [ ] Đăng nhập bằng email công ty + mật khẩu → vào thẳng "Cần làm" của vai trò được phân
- [ ] Không có bước/màn hình chọn vai trò; vai trò lấy từ phân quyền của tài khoản
- [ ] **Không dùng Google/Keycloak/OAuth** — hệ thống tự quản lý tài khoản
- [ ] HR tạo tài khoản → gửi email kích hoạt (mật khẩu tạm) qua Gmail
- [ ] Lần đăng nhập đầu: **bắt buộc đổi mật khẩu** (≥ 8 ký tự, có hoa/thường/số/ký tự đặc biệt) → **bắt buộc đăng ký khuôn mặt** → mới vào được "Cần làm"
- [ ] Sai 5 lần → khoá 10 phút; sai 10 lần → khoá vĩnh viễn, HR mở khóa
- [ ] Sai thông tin → báo lỗi rõ ràng, không vào được
- [ ] Phiên đăng nhập tự hết hạn → đưa về màn hình đăng nhập, **không mất dữ liệu đang làm dở**
**Phụ thuộc:** —

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §3, `docs/09-business-ba-po-guidelines.md` (quyết định Non-SSO) và mockup S01/S01-A/S01-B trong `mockups/index.html`; rà code `hkt/frontend/src/modules/auth/LoginPage.tsx`, `FirstLoginChangePasswordModal.tsx`, `FaceEnrollmentPage.tsx`, `hkt/backend/core-service/src/main/java/com/act/pulse/modules/auth/` (AuthController, AuthServiceImpl, JwtAuthenticationFilter) và bảng `users/login_attempts/refresh_tokens` trong V2. Hoàn thiện đủ: đăng nhập email/mật khẩu, khoá 5 lần/10 phút và 10 lần/vĩnh viễn, bắt đổi mật khẩu rồi đăng ký khuôn mặt lần đầu, refresh token, thu hồi phiên khi đổi mật khẩu. Test bằng `./run-local.sh` + Swagger/curl cho các nhánh login/lock/refresh/logout và chạy `tests/robot/suites/full_01_core_platform_suite.robot` + `01_auth_security_suite.robot` (sửa `tests/robot/resources/variables.robot` nếu mật khẩu seed khác); đối chiếu đủ tiêu chí nghiệm thu.

### A2 · Cấu trúc điều hướng 🔴 · S00
**Cần có:** 3 biến thể menu — Nhân viên ⊂ Quản lý ⊂ HR. Mọi mục của nhân viên phải có ở cả 2 bản còn lại.
**Nghiệm thu:**
- [ ] Menu đúng theo vai trò, không có mục "chết" (bấm vào phải tới màn hình thật)
- [ ] Trang mặc định sau đăng nhập = **"Cần làm"** (G1), không phải dashboard rỗng
- [ ] Trên điện thoại: 4 mục dưới cùng + menu cuộn được
- [ ] **2 module Chấm công / OKR tách nhóm riêng** trong menu, không trộn lẫn
- [ ] **Badge số việc chờ** trên menu luôn hiện và khớp số việc thật trong "Cần làm"
**Phụ thuộc:** A1

**Prompt AI:** Đọc `PLAN.md` §1.1, mockup S00 (`<section id="s00">`) và code `hkt/frontend/src/components/layout/Sidebar.tsx`, `MobileBottomNav.tsx`, `AppRoutes.tsx`, `ProtectedRoute.tsx`. Sinh 3 biến thể nav Employee ⊂ Manager ⊂ HR từ MỘT nguồn cấu hình duy nhất (không chép tay 3 bản), badge số việc chờ lấy từ API todo/notification, mobile có 4 mục dưới cùng và menu cuộn. Test: đăng nhập 4 tài khoản seed (Admin, 01HR, 05ACT, 136ACT) để kiểm tra đúng menu, không có link chết, badge khớp số việc trong `/todo`, và responsive ở 390px; bổ sung test cho các mục nav.

### A3 · Quản lý nhân viên 🔴 · S40
**Cần có:** danh sách nhân viên, ai ở nhóm nào, ai duyệt cho ai, chuyển nhóm/quản lý.
**Nghiệm thu:**
- [ ] Lọc theo nhóm / chức danh / trạng thái
- [ ] Đổi quản lý của 1 nhân viên → **đơn đang chờ giao cho người mới**, không mất
- [ ] Thêm nhân viên mới → tự gán nhóm mặc định theo bộ gán ca
- [ ] Đổi quản lý trực tiếp → **bắt buộc lý do**, ghi nhật ký thay đổi
- [ ] Hiện **chuỗi cấp trên (ai duyệt cho ai)** ngay trên dòng nhân viên
**Phụ thuộc:** A1

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S40, code `hkt/frontend/src/modules/shared/admin/EmployeeManagementPage.tsx` và `hkt/backend/.../auth/controller/OrgStructureController.java` (`/admin/users`, import Excel). Hoàn thiện lọc theo nhóm/chức danh/trạng thái, hiện chuỗi cấp trên (ai duyệt cho ai), đổi quản lý bắt buộc lý do + ghi audit log, và chuyển các đơn đang chờ sang quản lý mới (không làm mất đơn). Test API `/admin/users` bằng curl/Swagger + UI; kiểm tra một nhân viên đổi quản lý thì đơn cũ vẫn còn và đơn mới giao đúng người; chạy `tests/robot/suites/full_01_core_platform_suite.robot`.

### A4 · Cây nhóm lồng nhau 🔴 · S41
**Cần có:** tạo nhóm, nhóm lồng nhau **không fix cứng số tầng** (có thể chỉ 2 tầng: công ty → nhóm).
**Nghiệm thu:**
- [ ] Tạo nhóm trong nhóm → hiển thị đúng cây, không giới hạn số tầng
- [ ] Nhóm không có trưởng → **vẫn hoạt động bình thường, không cảnh báo**
- [ ] Đổi trưởng nhóm → **đơn mới tự giao cho người mới** (đơn cũ giữ nguyên)
- [ ] Mỗi node hiện **số người + số đơn đang chờ** trong nhánh
- [ ] **Tô đậm người/nhóm chưa có quản lý** — biết ngay đơn sẽ bị kẹt
- [ ] Click 1 node → xem danh sách người bên dưới, lọc theo đơn đang chờ
**Phụ thuộc:** A3

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S41, code `hkt/frontend/src/modules/shared/admin/OrgTreePage.tsx` và `OrgStructureController.java` (`/org/tree`, `/admin/teams`), bảng `teams.parent_id` trong V2. Hoàn thiện cây nhóm lồng nhau KHÔNG giới hạn số tầng, mỗi node hiện số người + số đơn chờ, tô đậm node/nhân viên chưa có quản lý (không cảnh báo chặn), click node xem danh sách. Test: tạo nhóm 3 tầng và nhóm không trưởng bằng API, kiểm tra cây + số liệu; đổi trưởng nhóm và xác nhận đơn mới giao đúng người.

### A5 · Nhật ký thay đổi 🔴 · S35
**Cần có:** ai sửa gì, trường nào, giá trị cũ → mới, lý do, lúc nào.
**Nghiệm thu:**
- [ ] Mọi thao tác sửa dữ liệu công / điểm đều có dòng nhật ký
- [ ] Lọc theo người, theo đối tượng, theo khoảng thời gian
- [ ] Không sửa được dòng nhật ký (append-only)
- [ ] Hiện **giá trị cũ → giá trị mới** cho từng thay đổi
- [ ] Lọc được **theo nhân viên bị tác động** (để trả lời khiếu nại)
- [ ] Ghi **IP + thiết bị** của thao tác để truy vết
**Phụ thuộc:** —

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S35, code `hkt/frontend/src/modules/shared/admin/AuditLogPage.tsx` và endpoint `/admin/audit-logs` (OrgStructureController/BusinessGapController). Đảm bảo nhật ký append-only: ai, đối tượng, trường, giá trị cũ → mới, lý do, IP/thiết bị, thời điểm; ghi log tại MỌI service sửa dữ liệu công/điểm/rule; lọc theo người, đối tượng, khoảng thời gian và nhân viên bị tác động. Test: sửa 1 ô bảng công và 1 rule → thấy đủ 2 dòng; thử gọi API sửa/xoá log phải bị chặn; chạy Robot suite admin.
## B. Chấm công — nhân viên

### B0 · Đăng ký khuôn mặt (face enrollment) 🔴 · S27, S05m
**Cần có:** luồng chụp 3 góc + liveness, lưu vector đặc trưng (không lưu ảnh thô), HR reset kèm lý do.
**Nghiệm thu:**
- [ ] Chưa đăng ký → màn hình chấm công **chặn** và hiện nút "Đăng ký khuôn mặt"
- [ ] Chụp 3 góc + liveness, chỉ trong mạng công ty; lưu **vector đặc trưng**, không lưu ảnh thô
- [ ] HR xem trạng thái hồ sơ + reset kèm lý do → nhân viên đăng ký lại; có audit log
- [ ] Mọi lần đăng ký/reset đều gắn với người dùng, thời điểm, người thực hiện
**Phụ thuộc:** A1

**Prompt AI:** Đọc `docs/07-business-mobile-punch.md` §2.4, mockup S27 + S05m, code `hkt/frontend/src/modules/auth/FaceEnrollmentPage.tsx`, `AuthController` (`/auth/enroll-face`), `FaceProfile.java`/`FaceProfileRepository.java`, AI service `hkt/backend/ai-face-service/app/main.py` (`/api/v1/face/enroll-json`) và bảng `face_profiles` (V2). Hoàn thiện chụp 3 góc + liveness, chỉ lưu vector 512 chiều (tuyệt đối không lưu ảnh thô), chặn ngoài mạng công ty, HR reset kèm lý do + audit. Test qua UI và API: enroll → kiểm tra DB chỉ có embedding; reset → nhân viên phải đăng ký lại; kiểm tra AI `/health` và log audit.

### B1 · Chấm công trên điện thoại (web responsive + khuôn mặt) 🔴 · S05m
> Chi tiết đầy đủ: **`docs/07-business-mobile-punch.md`**. Đây là thao tác lặp lại nhiều nhất — và là thao tác người dùng ghét nhất nếu làm chậm. **Mở bằng trình duyệt điện thoại, không có app riêng.**
**Nghiệm thu:**
- [ ] Mở web trên điện thoại → màn hình chấm công hiện ngay, không qua menu
- [ ] **Camera trước hiển thị ngay** trên màn hình + khung oval hướng dẫn khuôn mặt
- [ ] Bấm 1 lần → kết quả trong **< 4 giây**, có phản hồi rung
- [ ] **5 bước kiểm tra chạy song song** (thiết bị · mạng · GPS · ca · **khuôn mặt**), hiện **ngay khi bắt đầu**
- [ ] **Khuôn mặt khớp hồ sơ ≥ 85% + liveness đạt** → chấm công được; trạng thái hiện ngay ("✓ Khớp 98%")
- [ ] **Khuôn mặt không khớp/không đạt liveness → BỊ CHẶN**, hiện điểm khớp + số lần thử còn lại; hết 3 lần → hướng dẫn liên hệ HR
- [ ] **Chưa đăng ký khuôn mặt → BỊ CHẶN**, hiện nút đăng ký (B0)
- [ ] **Ngoài mạng công ty → BỊ CHẶN**, có gợi ý nối Wi-Fi công ty (trừ ngày WFH đã duyệt)
- [ ] **Ngoài bán kính GPS → BỊ CHẶN**, hiện khoảng cách thật + bản đồ + 2 lối ra (WFH / Thử lại)
- [ ] **GPS không lấy được hoặc độ chính xác > 100m → BỊ CHẶN**, kèm hướng dẫn đứng gần cửa sổ
- [ ] Mất mạng → vẫn chấm được offline, đồng bộ lại sau, **có cờ cho HR**; quá hạn offline (mặc định 24h) → bị từ chối khi đồng bộ
- [ ] Bấm 2 lần liên tiếp → nút đổi trạng thái, **không tạo 2 entry**
- [ ] Màn hình chỉ có **camera + 2 thông tin + 1 nút**, không có form nào
- [ ] **Không cần cài app**: cùng URL web responsive, mở trên iPhone Safari + Android Chrome; giao diện không bị notch che
**Phụ thuộc:** A1, B0, B5

**Prompt AI:** Đọc toàn bộ `docs/07-business-mobile-punch.md`, mockup S05m (`id="s05m"`), code `hkt/frontend/src/modules/attendance/checkin/CheckInPage.tsx`, `AttendanceController.java`/`AttendanceServiceImpl.java`, AI `/verify-json` và `DeviceRegistration`. Hoàn thiện màn chấm công mobile web: camera trước + khung oval, 1 chạm <4 giây, 5 lớp chạy song song (thiết bị · mạng · GPS · ca · khuôn mặt ≥85% + liveness), mọi lớp không đạt là CHẶN và hiện lý do + số lần thử, offline IndexedDB tối đa 24h, chống double entry. Test bằng `./run-local.sh`, curl/Swagger cho từng nhánh pass/fail, mở trên Safari/Chrome điện thoại (HTTPS qua `./share-local.sh`) và chạy `full_02_attendance_requests_suite.robot` (cập nhật assert 4 lớp → 5 lớp nếu còn cũ).

### B2 · Chấm công trên desktop 🔴 · S05
**Nghiệm thu:**
- [ ] Cùng bộ kiểm tra như B1 (gồm **khuôn mặt qua webcam**), hiển thị trên desktop
- [ ] Nhân viên chưa chấm công ra hôm qua → hiện việc "Bổ sung công" với nút bấm 1 chạm
- [ ] Check-in/check-out **1 nút, không form** trên desktop
- [ ] **Camera/webcam + khuôn mặt** chạy song song với 4 kiểm tra còn lại
- [ ] **Hiện rõ lý do bị chặn** + cách khắc phục (mạng/GPS/khuôn mặt/thiết bị)
**Phụ thuộc:** B0, B1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §3, mockup S05, code `CheckInPage.tsx` (dùng chung responsive) và `AttendanceServiceImpl`. Hoàn thiện bản desktop dùng webcam nhưng giữ đúng 5 lớp như mobile, 1 nút không form, hiện rõ lý do bị chặn và cách khắc phục; hiện việc "Bổ sung công" 1 chạm nếu hôm qua thiếu check-out. Test trên Chrome desktop có webcam, đối chiếu kết quả API với B1; kiểm tra trường hợp thiếu quyền camera và trường hợp ngoài mạng/GPS.

### B3 · Lịch công tháng 🔴 · S06
**Nghiệm thu:**
- [ ] Xem cả tháng trên 1 màn hình, màu theo trạng thái (đủ / muộn / WFH / phép / vắng)
- [ ] Chạm 1 ngày → xem chi tiết giờ vào/ra
- [ ] Có nút chuyển tháng (‹ ›)
**Phụ thuộc:** B1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §3, mockup S06, code `hkt/frontend/src/modules/attendance/calendar/CalendarPage.tsx` và API dữ liệu công tháng (bổ sung endpoint nếu chưa có, dùng `attendance_logs` + requests). Hoàn thiện lịch tháng dạng ô: đủ số ngày của tháng, màu theo trạng thái đủ/muộn/WFH/phép/vắng, nút chuyển tháng ‹ ›, click ngày xem giờ vào/ra. Test: seed log nhiều trạng thái, kiểm tra số ô/màu/URL `?month=YYYY-MM`; chạy Robot TC07 trong `02_attendance_requests_suite.robot`.

### B4 · Bảng công của tôi 🔴 · S11
**Nghiệm thu:**
- [ ] **Có chọn tháng, mặc định = tháng hiện tại**; đổi tháng bằng dropdown hoặc nút ‹ ›; URL đổi theo `?month=YYYY-MM`
- [ ] **Lịch tháng dạng ô vuông** — mỗi ngày 1 ô, xếp theo tuần (T2 → CN); nhìn 1 cái thấy ngay ngày nào có vấn đề
- [ ] Đủ **11 cột** số liệu, khớp với bảng điều khiển
- [ ] **Chỉ khiếu nại được sau khi HR công bố** (ngày 11 hàng tháng) — trước đó xem số tạm tính nhưng khoá nút khiếu nại
- [ ] Trong 2 ngày → khiếu nại được; quá 2 ngày → nút bị disable + giải thích
- [ ] Khiếu nại đã gửi → hiện trạng thái "HR đang xử lý"
- [ ] Chọn kỳ đã chốt → xem được nhưng chỉ đọc
- [ ] Lịch sử 12 tháng — kỳ đã chốt xem được, không khiếu nại được
**Phụ thuộc:** B1, D4

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.1, mockup S11, code `hkt/frontend/src/modules/attendance/timesheet/MyTimesheetPage.tsx` và `BusinessGapController` (`/attendance/my-timesheet`). Hoàn thiện: chọn tháng `?month=YYYY-MM`, lịch tháng dạng ô vuông, đủ 11 cột số liệu, quy trình công bố ngày 11 → khiếu nại 2 ngày → khoá, kỳ đã chốt chỉ đọc, lịch sử 12 tháng. Test bằng dữ liệu giả lập các mốc 10/11, 12/11, 14/11 và kỳ locked; kiểm tra cả API lẫn UI, kèm trường hợp chưa công bố thì nút khiếu nại bị disable.

### B5 · Thiết bị của tôi 🔴 · S27
**Cần có:** đăng ký thiết bị, xem thiết bị đang đăng ký, thu hồi.
**Nghiệm thu:**
- [ ] **Mặc định 2 thiết bị** — thiết bị thứ 3 mới phải được HR duyệt
- [ ] Nhân viên **tự thấy** mình đang chấm công trên bao nhiêu máy, ở đâu, lúc nào
- [ ] Nhân viên **không tự xoá được** thiết bị đang chờ duyệt
- [ ] Mỗi ngày tối đa **1 check-in + 1 check-out/account**; unique `(user_id, work_date)` ở tầng dữ liệu
- [ ] Quota tính **theo người**, không theo thiết bị
**Phụ thuộc:** A1

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S27, code `hkt/frontend/src/modules/attendance/devices/MyDevicesPage.tsx`, `BusinessGapController` (`/devices`), `DeviceRegistration.java` và unique index `uq_attendance_user_date` (V2). Hoàn thiện danh sách thiết bị đang hoạt động, mặc định 2 máy, nhân viên không tự xoá máy đang chờ duyệt, hiện lần dùng gần nhất, chặn 2 check-in hoặc 2 check-out cùng ngày ở tầng DB. Test: thêm 3 thiết bị qua API → máy thứ 3 vào hàng chờ; chấm 2 lần cùng ngày bị chặn; xác nhận quota tính theo người.

### B6 · Thêm thiết bị 🔴 · S29
**Nghiệm thu:**
- [ ] **Một flow duy nhất** cho cả "đăng ký lần đầu" và "thêm máy thứ 3" — không có 2 màn hình riêng
- [ ] Mặc định 2 máy; muốn thêm máy phải có lý do
- [ ] Yêu cầu vào hàng chờ HR duyệt, có thời hạn hết hiệu lực
- [ ] **Bắt buộc nhập lý do** — thiếu lý do thì không gửi được
- [ ] Yêu cầu thêm thiết bị **chỉ nhận từ mạng nội bộ công ty**
**Phụ thuộc:** B5, E8

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2.1, mockup S29, code `hkt/frontend/src/modules/attendance/devices/AddDevicePage.tsx` và `BusinessGapController` (`/devices/request`, `/admin/devices`). Hoàn thiện MỘT flow duy nhất cho đăng ký lần đầu và máy thứ 3: lý do bắt buộc, chỉ nhận yêu cầu từ mạng nội bộ, yêu cầu có thời hạn, HR duyệt ở S28. Test: thiếu lý do → 400; ngoài mạng → 403; tạo yêu cầu → thấy trong danh sách HR; duyệt → thiết bị hoạt động và chấm công được.

---

## C. Đơn từ — nhân viên

> **Nguyên tắc chung cho mọi đơn từ:** gửi được **từ bất kỳ đâu** — **không cần GPS, không cần mạng công ty**.
> Chỉ **chấm công** mới cần vị trí + mạng nội bộ.
> Mọi đơn đều có **quota** hiển thị sẵn, **validate tức thì**, và **bắt buộc lý do khi bị từ chối**.

### C1c · Tạo đơn đi muộn — prefill 🔴 · S07
**Nghiệm thu:**
- [ ] Mở form → **ngày và giờ đã điền sẵn từ log chấm công thật** (nhân viên không gõ)
- [ ] Quota 2 lần/tháng → lần 3 **bị chặn ngay lúc tạo**, kèm số đã dùng
- [ ] "Lưu nháp" → **không trừ quota, không hiện cho quản lý**
- [ ] Nhân viên hỏi "vì sao bị chặn" → hiện đúng lý do theo rule
- [ ] Chọn lý do bằng **chip 1 chạm** (kẹt xe, họp, sự cố máy…)
**Phụ thuộc:** B1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §6, mockup S07, code `hkt/frontend/src/modules/attendance/requests/RequestsPage.tsx` (đã có phần prefill từ log) và `RequestController` (`POST /requests`). Hoàn thiện prefill ngày/giờ từ log đi muộn thật, quota 2 lần/tháng chặn ở server, lưu nháp không trừ quota và không hiện cho quản lý, chip lý do 1 chạm, thông báo lý do bị chặn theo rule. Test: tạo log trễ → mở form thấy prefill; tạo 3 đơn → đơn thứ 3 bị 400; nháp không vào inbox; kiểm tra validate.

### C2c · Đơn bổ sung chấm công 🔴 · S31
**Nghiệm thu:**
- [ ] Hạn nộp tính theo **ngày làm việc**, hiện rõ hạn là ngày nào
- [ ] Quota 5 lần/tháng
- [ ] Bắt buộc lý do
- [ ] Quá hạn → nộp được nếu quy định cho phép, **bắt buộc lý do + gắn cờ**
**Phụ thuộc:** B1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §6, mockup S31, code `RequestsPage.tsx` và `RequestController`. Hoàn thiện đơn bổ sung công: hạn tính theo NGÀY làm việc (mặc định 3), quota 5 lần/tháng, lý do bắt buộc, cho phép quá hạn nếu rule bật và gắn cờ cho HR. Test các mốc trước/đúng/quá hạn và vượt quota qua API; kiểm tra cờ hiển thị ở màn duyệt và bảng công.

### C3c · Đơn của tôi 🔴 · S08
**Nghiệm thu:**
- [ ] Lịch sử đơn + trạng thái rõ ràng (chờ duyệt / được duyệt / bị từ chối + lý do)
- [ ] Badge quota còn lại luôn hiển thị
- [ ] Nhân viên **không thấy đơn của đồng nghiệp** (trừ khi được cấu hình)
- [ ] **Tab theo loại đơn + Tất cả**
- [ ] Đơn bị trả lại → nút **"Sửa & gửi lại"** ngay trong danh sách
**Phụ thuộc:** C1c

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.1, mockup S08, code `RequestsPage.tsx`, `RequestDetailPage.tsx` và `RequestController` (`/my-requests`, `/{id}`). Hoàn thiện lịch sử đơn + trạng thái + lý do từ chối, badge quota còn lại, tab theo loại đơn + Tất cả, nút "Sửa & gửi lại" khi bị trả, và chỉ thấy đơn của mình (trừ khi được cấu hình). Test: 2 tài khoản không thấy chéo đơn; trả lại → sửa → gửi lại; kiểm tra badge khớp server.

### C4c · Xin nghỉ phép 🔴 · S30
**Nghiệm thu:**
- [ ] **8 loại nghỉ** hiện đúng, lấy từ cấu hình của HR (không hard-code)
- [ ] Đơn vị **ngày / nửa ngày**
- [ ] Hạn gửi + giấy tờ đều cấu hình được theo từng loại
- [ ] Số dư phép còn lại hiện ngay trong form
- [ ] Đủ **8 loại nghỉ khớp cột bảng công**
- [ ] Chọn ngày → **tự tính số ngày làm việc** (trừ cuối tuần + lễ)
- [ ] Gửi đơn **từ bất kỳ đâu** — không cần GPS/mạng công ty
**Phụ thuộc:** E8, C6c

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §2.3, mockup S30, code `RequestsPage.tsx`, `LeaveController.java` (`/leave-types`), `LeaveType.java` và bảng `leave_ledger`. Hoàn thiện form xin nghỉ đủ 8 loại lấy từ cấu hình DB (không hard-code), đơn vị ngày/nửa ngày, tự tính ngày làm việc trừ cuối tuần + lễ, hiện số dư ngay trong form, lưu snapshot `applied_parameters`, gửi từ bất kỳ đâu (không GPS/mạng công ty). Test: tạo đơn từng loại, đổi cấu hình loại nghỉ rồi kiểm tra đơn cũ vẫn giữ snapshot; chạy Robot TC10.

### C5c · Đăng ký WFH 🔴 · S10
**Nghiệm thu:**
- [ ] Đăng ký lẻ hoặc **lịch cố định** (thứ Sáu hằng tuần) tạo được nhiều tuần
- [ ] Quota 2 lần/tuần → lần 3 bị chặn
- [ ] Hạn đăng ký ≥ 1 ngày làm việc → báo rõ lý do khi vi phạm
- [ ] Vị trí cấm WFH → không tạo được đơn
- [ ] Ngày WFH đã duyệt → **chấm công được ngoài mạng và ngoài bán kính GPS** (ngoại lệ duy nhất)
**Phụ thuộc:** E7

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.1 (WFH), mockup S10, code `RequestsPage.tsx` và `RequestController`. Hoàn thiện WFH lẻ và lịch lặp tuần, quota 2 lần/tuần, hạn đăng ký ≥1 ngày làm việc, chặn vị trí cấm WFH, và ngoại lệ cho phép chấm công ngoài mạng/GPS khi ngày WFH đã được duyệt. Test: tạo 3 WFH trong tuần → lần 3 bị chặn; đăng ký sát ngày; chấm công đúng ngày WFH từ ngoài văn phòng và kiểm tra các lớp còn lại.

### C6c · Số dư phép 🔴 · S09
**Nghiệm thu:**
- [ ] Card từng loại nghỉ, progress bar phép năm
- [ ] Thẻ **Tổng phép còn lại** = phép năm còn + phép tồn còn — tự cộng, đổi số dư thì tự cập nhật
- [ ] **Phép ốm** và **phép thâm niên** có card riêng
- [ ] **Cộng phép hàng tháng vào ngày 15**, chỉ người vào làm từ **ngày 15 trở về trước** mới cộng trong tháng đó (vào 20/11 → tháng 11 không cộng, kỳ đầu tiên là 15/12)
- [ ] **Phép thâm niên cộng đúng ngày tròn thâm niên**, không gộp vào lần cộng ngày 15
- [ ] Cảnh báo **phép tồn** theo luật (toàn bộ → 01/04; còn 5 ngày → 01/07; tồn = 0 từ 01/07)
- [ ] Phép tồn là **thẻ riêng** cạnh phép năm (không ẩn vào dòng phụ)
- [ ] **Lịch sử phép có filter**: theo loại phép (phép năm · tồn · chức vụ · thâm niên · ốm · bù) và theo năm; lọc xong danh sách chỉ còn dòng khớp
**Phụ thuộc:** E8

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.1, mockup S09, code `hkt/frontend/src/modules/attendance/leaves/LeavesPage.tsx`, `LeaveController` (`/leaves/my-balance`), `CronController` (`/monthly-leave-accrual`, `/yearly-seniority-accrual`). Hoàn thiện card từng loại nghỉ, thẻ Tổng phép còn lại tự cộng, cộng phép ngày 15 với cutoff (vào sau 15 → hoãn kỳ sau), thâm niên đúng ngày tròn, cảnh báo tồn theo 01/04 và 01/07, filter lịch sử theo loại + năm. Test: seed nhân viên vào 20/11 → tháng 11 không cộng; chạy cron; đối chiếu số dư với sổ phép D5.

---

## D. Đơn từ — quản lý & HR

### D1 · Duyệt đơn 🔴 · S12
**Nghiệm thu:**
- [ ] Hộp thư duyệt liệt kê đơn chờ duyệt, lọc theo loại/ngày, badge "quá hạn"
- [ ] Mỗi đơn hiện **chip ✅/❌ điều kiện** ngay trên dòng, không phải mở mới thấy
- [ ] Từ chối mà bỏ trống lý do → **nút bị disable**
- [ ] Duyệt **12 đơn trong 3 phút**
- 🟡 *(C7)* Chip lý do để từ chối nhanh cùng loại
**Phụ thuộc:** C3c

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C7, mockup S12, code `hkt/frontend/src/modules/attendance/approvals/ApprovalsPage.tsx` và `RequestController` (`/inbox`, `/approve`, `/reject`, `/bulk-approve`). Hoàn thiện hộp thư duyệt: chip điều kiện ✅/❌ ngay trên dòng, từ chối bắt buộc lý do (disable nút), lọc loại/ngày, badge quá hạn, duyệt hàng loạt và CHỈ 1 audit log cho cả lô. Test API duyệt/từ chối (thiếu lý do → 400) và đo thao tác duyệt 12 đơn trên UI; chạy Robot suite attendance.

### D2 · Chi tiết đơn 🔴 · S13
**Nghiệm thu:**
- [ ] Timeline đầy đủ: gửi → duyệt → kết quả, ai làm gì lúc nào
- [ ] Hiện chip điều kiện quyết định kết quả
- [ ] Có lịch sử chỉnh sửa
- [ ] Hiện **ảnh hưởng tới bảng công** (cộng/trừ bao nhiêu phút công)
- [ ] Có link tới **bảng công bị tác động**
**Phụ thuộc:** D1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.2, mockup S13, code `RequestDetailPage.tsx` và `RequestController` (`GET /requests/{id}`). Hoàn thiện timeline gửi → duyệt → kết quả (ai, lúc nào), chip điều kiện quyết định, lịch sử chỉnh sửa, ảnh hưởng tới bảng công (cộng/trừ bao nhiêu phút) và link tới bảng công bị tác động. Test đi qua 1 đơn được duyệt và 1 đơn bị từ chối, kiểm tra timeline/audit; mở link bảng công đúng kỳ.

### D3 · Lịch nhóm 🔴 · S14
**Nghiệm thu:**
- [ ] Biết ai vắng mà **không phải hỏi ai**
- [ ] Cảnh báo xung đột lịch: *"thứ Sáu này 3/5 người đều WFH, đội sẽ thiếu người"*
- 🟡 *(C7)* Nhóm của tôi có cấu hình riêng: ai trong nhóm thấy được lịch của ai
- [ ] **Phân quyền xem 4 tầng**: HR cả công ty · Manager cấp dưới trực tiếp · Team lead nhóm mình · Member team mình — không thấy nhóm khác
- [ ] Xem **tuần/tháng**, chuyển tuần trước/sau, lọc theo nhóm
- [ ] Hiện đồng thời **WFH · nghỉ phép · đi muộn · công đủ** + đếm người có mặt mỗi ngày
- [ ] Cảnh báo **xung đột lịch** khi vượt ngưỡng vắng (mặc định 60% nhóm)
**Phụ thuộc:** C5c

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.2, mockup S14, code `hkt/frontend/src/modules/attendance/calendar/TeamSchedulePage.tsx` và `BusinessGapController` (`/attendance/team-schedule`). Hoàn thiện lịch nhóm tuần/tháng với phân quyền xem 4 tầng (HR cả công ty · Manager cấp dưới · Team lead nhóm mình · Member team mình), hiện WFH/nghỉ/đi muộn/công đủ, đếm người có mặt mỗi ngày, cảnh báo khi vắng vượt ngưỡng (mặc định 60%). Test với 4 tài khoản vai trò khác nhau để xác nhận phạm vi; tạo 3 WFH cùng ngày → cảnh báo; chuyển tuần/tháng.

### D4 · Chi tiết 1 khiếu nại 🔴 · S33
> Đây là màn hình **chi tiết** — vào từ danh sách khiếu nại (E9) khi cần đối chiếu.
> Phần xử lý nhanh đã nằm ngay trên danh sách, không phải mỗi khiếu nại đều vào đây.
**Nghiệm thu:**
- [ ] Đặt **3 cột cạnh nhau**: log chấm công gốc (không sửa được) · đơn từ liên quan · bảng công HR đang sửa
- [ ] **Gợi ý nguyên nhân theo rule** — ví dụ *"thiếu check-out và chưa tạo đơn bổ sung công"*
- [ ] 3 cách xử lý: sửa ô · tạo đơn bổ sung công · từ chối (bắt buộc lý do)
- [ ] Từ chối → nhân viên **nhận được thông báo**
- [ ] Nút quay lại → về **danh sách khiếu nại** (E9)
- [ ] Mọi thao tác xử lý khiếu nại **ghi audit log**
**Phụ thuộc:** E9, E1, B4

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S33, code `hkt/frontend/src/modules/attendance/timesheet/DisputesPage.tsx`, `BusinessGapController` (`/disputes/{id}`) và `TimesheetPage.tsx`. Hoàn thiện màn chi tiết khiếu nại 3 cột (log gốc không sửa · đơn từ liên quan · bảng công HR đang sửa), gợi ý nguyên nhân theo rule, 3 cách xử lý, từ chối bắt buộc lý do + gửi thông báo, audit mọi thao tác, nút quay lại danh sách. Test: tạo khiếu nại thiếu check-out rồi xử lý bằng từng cách; kiểm tra notification và audit log.

### D5 · Sổ phép 🔴 · S34
**Nghiệm thu:**
- [ ] Mọi thay đổi số dư đều **truy vết được** — ai, lúc nào, vì lý do gì
- [ ] Lọc theo người, theo thời gian, theo loại nghỉ
- [ ] Xem sổ **theo nhân viên hoặc theo tháng**; lọc theo loại nghỉ/loại giao dịch
- [ ] Hiện **số dư sau mỗi giao dịch** — cộng dồn khớp số dư hiển thị
- [ ] HR **điều chỉnh tay** → tạo dòng `adjust` có lý do, **không sửa/xoá lịch sử**
- [ ] **Export sổ ra Excel**
**Phụ thuộc:** C4c

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S34, code `hkt/frontend/src/modules/attendance/leaves/AdminLeaveLedgerPage.tsx`, `LeaveController` (`/leaves/ledger/{userId}`), `LeaveLedgerEntry.java`. Hoàn thiện sổ phép append-only, hiện số dư SAU mỗi giao dịch, lọc theo người/thời gian/loại, HR điều chỉnh tay tạo dòng `adjust` kèm lý do (không sửa/xoá lịch sử), export Excel. Test: cộng/trừ/nghỉ liên tiếp → số dư chạy đúng; thử sửa/xoá dòng cũ bị chặn; mở file export.

---

## E. Bảng công & cấu hình — HR

### E1 · Bảng công & chốt 🔴 · S15
**Nghiệm thu:**
- [ ] Đủ **53 cột** (5 thông tin + 31 cột ngày + 17 cột tổng hợp) theo mẫu `doc/Rule chấm công.xlsx`
- [ ] Ô ngày dùng **ký hiệu gốc** của công ty (R · AL · S · 1.00 · R/0.50) — export ra khớp file HR 100%
- [ ] **Click vào ô ngày để sửa tại chỗ** — sửa đúng ký hiệu công của ô đó, **không chọn trường**; **bắt buộc lý do**; **ô đã sửa hiện màu đỏ**
- [ ] Sửa hàng loạt — tick nhiều dòng, 1 audit log cho cả lô
- [ ] **Chốt & khóa** có bước xác nhận; sau khi khóa thì **không sửa được nữa**
- [ ] Xuất Excel ra đúng 53 cột + ký hiệu gốc, đúng kỳ 01 → cuối tháng — khớp file `Pine team_T10.2026_Timekeeping Report.xlsx`
**Phụ thuộc:** B1, C1c, C2c

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C4 + `docs/02-business-attendance-time-tracking.md` §2.1.3, mockup S15, code `hkt/frontend/src/modules/attendance/timesheet/TimesheetPage.tsx`, bảng `timesheets/timesheet_cells/timesheet_audit_logs` (V2 ở `hkt/backend/core-service/src/main/resources/db/migration/`) và 2 file thật `doc/Rule chấm công.xlsx`, `doc/Pine team_T10.2026_Timekeeping Report.xlsx`. Hoàn thiện lưới đúng 53 cột (A–E + 31 ngày F–AJ + 17 tổng AK–BA), ký hiệu gốc, sửa ô tại chỗ bắt buộc lý do và tô đỏ ô đã sửa, sửa hàng loạt 1 audit log, chốt/khoá, export đúng 53 cột. Test: đếm cột và so ký hiệu với file Excel; sửa ô → reload thấy đỏ; export rồi so từng cột; cập nhật Robot TC08/TC09 (đang assert số cột theo mẫu cũ).

### E2 · Bộ lọc + lưu view 🔴 · S15
**Nghiệm thu:**
- [ ] Lọc "Mobile · 11/2026 · đi muộn > 0" → **lưu lại, mở lại bằng 1 click**
- [ ] View đã lưu có thể chia sẻ bằng link
- [ ] Nhiều bộ lọc cùng lúc, hiện dạng chip để gỡ
**Phụ thuộc:** E1

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C5, mockup S15, code `TimesheetPage.tsx` và API bảng công. Hoàn thiện bộ lọc nhiều điều kiện hiển thị dạng chip, lưu view (tên + query), mở lại 1 click, chia sẻ bằng URL, xoá view. Test: lọc "Mobile · 11/2026 · đi muộn > 0" → lưu → reload URL vẫn đúng; kiểm tra view chỉ chứa dữ liệu người dùng có quyền xem; gỡ từng chip.

### E3 · Cấu hình quy định 🔴 · S16
> Chi tiết: **`docs/06-business-rule-builder.md`**. 19 luật — **mọi luật đều có mặt trong đây**, không có luật nào chỉ nằm trong tài liệu.
**Nghiệm thu:**
- [ ] Thấy đủ **19 quy định** với giá trị đúng theo "Quyết định của HR" ở Mục 7
- [ ] Mọi thay đổi có **ngày hiệu lực** và **lịch sử phiên bản**
- [ ] **Rollback được** về phiên bản cũ, có lý do
- [ ] **Chỉ áp dụng cho toàn công ty** — không có lựa chọn ghi đè theo nhóm / chức danh ở màn hình này
- [ ] Màn hình **không hiện** "Đang áp dụng / Sắp áp dụng / Đã hết hiệu lực" — chỉ có **nút "Lịch sử thay đổi"**
**Phụ thuộc:** —

**Prompt AI:** Đọc `docs/06-business-rule-builder.md`, mockup S16, code `hkt/frontend/src/modules/attendance/rules/RuleEnginePage.tsx`, `RuleEngineController.java` (`GET /rules`, `PUT /rules/{key}`, versions/rollback) và bảng `rules/rule_versions` (V1/V2). Hoàn thiện đủ 19 rule, mọi thay đổi có ngày hiệu lực + version, rollback kèm lý do, chỉ scope toàn công ty, bỏ 3 badge trạng thái và chỉ giữ nút "Lịch sử thay đổi". Test: so 19 rule với V2; sửa 1 rule → có version mới; rollback; kiểm tra `/public-policy-doc` trả giá trị mới.

### E4 · Cấu hình 1 luật 🔴 · S17
**Nghiệm thu:**
- [ ] Form **sinh tự động từ catalog** — thêm 1 luật mới không phải sửa form
- [ ] Chỉ hiện trường liên quan (ví dụ chỉ hiện "hạn offline" khi bật "cho phép offline")
- [ ] Nhân viên thấy **cùng nội dung** ở trang tra cứu → không có chuyện tài liệu lệch phần mềm
- [ ] Bấm **Lưu** → hiện **hộp xác nhận** nội dung sắp lưu (thay đổi gì · ngày hiệu lực · ai bị ảnh hưởng) rồi mới lưu thật
- [ ] Nút **"Lịch sử thay đổi"** mở ra lịch sử phiên bản của luật đó, kèm nút rollback
**Phụ thuộc:** E3

**Prompt AI:** Đọc `docs/06-business-rule-builder.md` §3 và catalog 19 rule, mockup S17, code `RuleEnginePage.tsx` (modal sửa rule) + `RuleEngineController` (`PUT /rules/{key}`). Hoàn thiện form SINH TỰ ĐỘNG từ catalog (không hard-code field), field phụ thuộc (bật offline mới hiện hạn offline), modal xác nhận thay đổi/ngày hiệu lực/ai bị ảnh hưởng trước khi lưu, lịch sử + rollback. Test: thêm/sửa field trong catalog → form tự đổi; lưu → modal → DB + version; nội dung khớp trang S19.

### E5 · Trang quy định tra cứu 🔴 · S19
**Nghiệm thu:**
- [ ] Nhân viên mở ra thấy **quy định đang áp dụng với mình**, bằng ngôn ngữ tự nhiên
- [ ] Nội dung **tự sinh từ cùng nguồn** với form cấu hình của HR
- [ ] Đổi quota xong, nhân viên **thấy ngay** quy định mới
- [ ] Mỗi quy định hiện **phiên bản + ngày hiệu lực**
- [ ] Có **mục lục + tìm kiếm + lọc theo nhóm**, kèm ví dụ thực tế
**Phụ thuộc:** E3

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C6, mockup S19, code `hkt/frontend/src/modules/attendance/rules/PolicyDocPage.tsx` và `RuleEngineController` (`/public-policy-doc`). Hoàn thiện trang tra cứu sinh từ CÙNG catalog với form HR: ngôn ngữ tự nhiên, mục lục + tìm kiếm + lọc nhóm, phiên bản + ngày hiệu lực, ví dụ thực tế; đổi rule xong nhân viên thấy ngay. Test: đổi quota → reload S19 thấy số mới; tìm "phép"/"đi muộn" ra đúng mục; kiểm tra không lệch với S16/S17.

### E6 · Ca làm việc & lịch nghỉ lễ 🔴 · S26
**Nghiệm thu:**
- [ ] Giờ vào/ra, giờ nghỉ trưa, đủ 8h/ngày · 4h/nửa ngày — đều cấu hình được
- [ ] **Ca linh hoạt**: cấu hình được khung giờ (ví dụ check-in 8h–10h · check-out 17h–19h) — làm đủ 8h trong khung thì **tính đủ 1 ngày công**, không bắt buộc đúng giờ
- [ ] **Bộ gán ca**: nhóm + chức danh → ca
- [ ] Ca ngoại lệ (7h30–16h30 · 7h00–16h00 · 10h00–19h00) gán cho nhóm, cần HR duyệt
- [ ] Lịch nghỉ lễ theo năm — thêm ngày lễ không cần sửa code
- [ ] Cấu hình **geofence bán kính + dải IP mạng nội bộ** cho văn phòng
**Phụ thuộc:** —

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S26, code `hkt/frontend/src/modules/shared/admin/ShiftHolidayPage.tsx`, `OrgStructureController.java` (`/admin/shifts`, `/admin/holidays`) và bảng `shifts`. Hoàn thiện ca thường + ca linh hoạt (4 mốc giờ, tổng ≥8h vẫn đủ công), bộ gán ca theo nhóm + chức danh, ca ngoại lệ, lịch lễ theo năm, cấu hình geofence bán kính + dải IP. Test: tạo ca linh hoạt 8–10h/17–19h, chấm đủ 8h trong khung → 1 công; thêm ngày lễ → số ngày làm việc giảm; validate API.

### E7 · Quản lý loại nghỉ 🔴 · S32
**Nghiệm thu:**
- [ ] **Thêm loại nghỉ mới không cần sửa code**
- [ ] Mỗi loại tự cấu hình: hưởng lương, trừ phép năm, đơn vị ngày/nửa ngày, cần giấy tờ, hạn gửi
- [ ] Loại nghỉ có **3 tầng kế thừa** (nhóm → loại → trường hợp riêng)
- [ ] **Đơn nghỉ phép chỉ 1 bước duyệt: quản lý trực tiếp** — không chuyển HR, kể cả nghỉ dài ngày / thai sản
- [ ] Có **hiếu hỉ** (không trừ phép năm) và **tang gia** (không cần giấy tờ) — cả 2 đều cấu hình được như loại khác
- [ ] **Hạn nộp tính theo ngày, không theo giờ**: đi muộn/về sớm + đơn nghỉ đều mặc định **nộp trong vòng 3 ngày** sau ngày phát sinh (cấu hình 0–15)
- [ ] **Thai sản tách nam / nữ**: nam 5 · 7 · 10 · 14 ngày theo chế độ · nữ 6 hoặc 7 tháng (BHXH chi trả · chỉ quản lý duyệt)
- [ ] Đơn lưu **snapshot tham số** lúc gửi — đổi cấu hình sau không sai lịch sử
**Phụ thuộc:** —

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §2.3, mockup S32, code `hkt/frontend/src/modules/attendance/leaves/LeaveTypesPage.tsx`, `LeaveController.java` (`GET/POST/PUT /admin/leave-types`), `LeaveType.java` và rule `leave_type_defaults`/`leave_request`. Hoàn thiện thêm loại nghỉ mới KHÔNG sửa code, 3 tầng kế thừa (mặc định → loại → đơn), đơn nghỉ chỉ 1 bước duyệt quản lý, hiếu hỉ/tang gia/thai sản nam-nữ, hạn nộp theo ngày, snapshot tham số vào request. Test: tạo loại mới qua UI rồi tạo đơn; đổi tham số → đơn cũ giữ snapshot; kiểm tra chỉ 1 bước duyệt.

### E8 · Quản lý thiết bị 🔴 · S28
**Nghiệm thu:**
- [ ] Duyệt đăng ký mới / thu hồi thiết bị mất
- [ ] **Mặc định 2 thiết bị** — máy thứ 3 mới phải xin HR duyệt (kèm lý do)
- [ ] Mọi thao tác đều vào nhật ký thay đổi
**Phụ thuộc:** B5

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S28, code `hkt/frontend/src/modules/attendance/devices/AdminDevicesPage.tsx`, `BusinessGapController` (`/admin/devices`), `DeviceRegistration.java`. Hoàn thiện duyệt/từ chối yêu cầu máy thứ 3, thu hồi thiết bị mất, hiện hạn mức 2 máy theo người, ghi audit mọi thao tác. Test: tạo yêu cầu từ S29 → duyệt → nhân viên chấm được trên máy 3; thu hồi → bị chặn; kiểm tra audit log và hạn mức tự về 2.

### E9 · Danh sách khiếu nại 🔴 · S45
**Nghiệm thu:**
- [ ] Danh sách khiếu nại đang mở, **đếm ngược hạn** cho từng dòng
- [ ] **Xử lý nhanh ngay trên dòng**: Sửa ô · Tạo đơn bổ sung công · Từ chối (bắt buộc chọn lý do)
- [ ] Sửa ô trên dòng → có lý do bắt buộc + ghi vào nhật ký thay đổi
- [ ] Từ chối → nhân viên **nhận được thông báo**
- [ ] Click vào 1 dòng → mở **màn hình chi tiết** (D4) để đối chiếu 3 nguồn dữ liệu
- [ ] Quá hạn 2 ngày → hiện "đã quá hạn" và tự đóng
- [ ] Nút **Chốt & khóa** của HR **bị chặn** khi còn khiếu nại chưa xử lý
**Phụ thuộc:** D4, E1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S45, code `hkt/frontend/src/modules/attendance/timesheet/DisputesPage.tsx` và `BusinessGapController` (`/disputes`). Hoàn thiện danh sách khiếu nại đang mở + đếm ngược hạn từng dòng, xử lý nhanh inline (sửa ô · tạo đơn bổ sung · từ chối kèm lý do), click mở chi tiết S33, quá hạn 2 ngày tự đóng, chặn "Chốt & khoá" khi còn khiếu nại. Test: tạo khiếu nại và xử lý từng cách; kiểm tra notification + audit; thử chốt kỳ khi còn khiếu nại → bị chặn.

### E10 · Bảng phép tất cả mọi người 🔴 · S46
**Nghiệm thu:**
- [ ] Bảng **1 dòng = 1 người**: phép năm còn · phép tồn 2025 · phép ốm đã dùng · thâm niên · tổng đã dùng
- [ ] Lọc theo **nhóm** / **sắp hết phép** / **đã hết phép**
- [ ] Click vào 1 người → mở **sổ phép chi tiết** của người đó (D5)
- [ ] Số ở chân bảng = tổng của **những dòng đang lọc**
- [ ] Người sắp hết phép được **đánh dấu riêng**, không phải tìm trong bảng
**Phụ thuộc:** D5

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S46, code `hkt/frontend/src/modules/attendance/leaves/LeaveTablePage.tsx` và `LeaveController` (`/leaves/table`). Hoàn thiện bảng 1 dòng/người (phép năm còn, tồn 2025, ốm đã dùng, thâm niên, tổng đã dùng), lọc nhóm/sắp hết/hết, footer tổng theo ĐÚNG các dòng đang lọc, click mở sổ phép D5, đánh dấu người sắp hết. Test: đối chiếu số với ledger từng người; lọc → footer đúng; click mở đúng người.

---

## F. OKR

> **Nguyên tắc chung cho OKR:** **2 nhóm cố định** (Business · People) · nhân viên **tự nhập** ·
> **không có template** · chấm điểm **1–5 mỗi nhóm** · **điểm TB tự tính** (không có ô nhập tay) ·
> **không dùng cây phân tầng** — chỉ cần biết *ai duyệt mình*.

### F1 · Dashboard OKR 🔴 · S20
**Nghiệm thu:**
- [ ] Thấy rõ **việc cần làm** với OKR (chấm, cập nhật, chờ duyệt)
- [ ] Hiện điểm hiện tại của 2 nhóm
- [ ] Phần **20% mục tiêu công ty** hiện rõ nhưng **không tính vào điểm TB**
- [ ] Có card **Self proposal năm sau** — hiện trạng thái (chưa viết / đang viết / đã nộp) + nút xem
- [ ] Hiện **phase hiện tại + đếm ngược hạn chót** theo timeline cấu hình
- [ ] Nút **Check-in nổi bật** khi đến kỳ
**Phụ thuộc:** A1

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §2, mockup S20, code `hkt/frontend/src/modules/okr/dashboard/OKRDashboardPage.tsx` và `BusinessGapController` (`/okr/dashboard`). Hoàn thiện việc cần làm với OKR, điểm 2 nhóm + TB, card 20% mục tiêu công ty (không tính vào TB), card Self proposal năm sau + trạng thái, phase hiện tại + đếm ngược, nút Check-in nổi bật. Test: seed OKR ở nhiều trạng thái; xác nhận TB chỉ từ Business/People; phase theo cycle; chạy `full_03_okr_performance_suite.robot`.

### F2 · Tạo OKR 🔴 · S21
**Nghiệm thu:**
- [ ] **2 nhóm cố định** Business / People, **tự nhập** từng đầu việc
- [ ] **Gợi ý kế thừa từ OKR quản lý** — bấm 1 chạm để chép mục tiêu đã duyệt (C14)
- [ ] **Không có ô đính kèm** ở bước tạo — file làm evidence chỉ đính kèm lúc check-in / đánh giá
- [ ] Gửi → quản lý **duyệt / trả lại kèm góp ý**
- [ ] **Sau khi gửi → khoá sửa.** Nhân viên không sửa được nữa cho tới khi được mở lại ở review giữa kỳ
- [ ] Muốn **xoá 1 mục** → bắt buộc nhập lý do, mục đó **vẫn còn trong lịch sử** (không mất vết)
- [ ] Có **Box 4 — Self proposal năm sau** (đề xuất + điểm cần cải thiện, tuỳ chọn)
**Phụ thuộc:** F1

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §3 + `docs/04-business-convenience-features.md` §C14, mockup S21, code `hkt/frontend/src/modules/okr/my-okr/MyOKRPage.tsx` và API OKR. Hoàn thiện 2 nhóm cố định Business/People, tự nhập đầu việc, gợi ý kế thừa từ OKR quản lý (bấm 1 chạm chép), không đính kèm ở bước tạo, gửi → khoá sửa, xoá mục bắt buộc lý do + vẫn lưu lịch sử, có Box 4 self proposal. Test: tạo OKR 2 nhóm rồi gửi → không sửa được; xoá mục → có lý do + còn vết; kiểm tra gợi ý lấy từ manager.

### F3 · Check-in tiến độ 🔴 · S22
**Nghiệm thu:**
- [ ] Check-in **hàng tháng** theo từng đầu việc: **chỉ nhập giá trị mới** — không có cột tiến độ / mức độ tin cậy (tiến độ tự tính)
- [ ] **Prefill giá trị lần trước**
- [ ] Có mốc hạn, tự nhắc trước hạn
- [ ] **Đính kèm file làm evidence** — ảnh chụp kết quả, báo cáo, tài liệu liên quan
- [ ] Ở giai đoạn **review giữa kỳ** → nhân viên được sửa bổ sung OKR rồi nộp lại; nộp xong **khoá sửa lại**
**Phụ thuộc:** F2

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §4, mockup S22, code `MyOKRPage.tsx` (phần check-in) và `BusinessGapController` (`/okr/check-ins`). Hoàn thiện check-in hàng tháng CHỈ nhập giá trị mới (không cột tiến độ/độ tin cậy; tiến độ tự tính), prefill giá trị kỳ trước, hạn + nhắc trước hạn, đính kèm evidence, giai đoạn giữa kỳ cho sửa rồi nộp và khoá lại. Test: check-in 2 kỳ liên tiếp, kiểm tra tiến độ tự tính; upload file; manager mở/đóng và NV nộp lại.

### F4 · Duyệt OKR đầu năm 🔴 · S42
**Nghiệm thu:**
- [ ] Quản lý duyệt hoặc trả lại **2 nhóm**
- [ ] Trả lại → có góp ý, nhân viên thấy và sửa
- [ ] Nút **"Mở cho nhân viên sửa"** → nhân viên sửa bổ sung được trong lúc quản lý đang review
- [ ] Hiện **2 nhóm Business/People cạnh nhau** kèm đầu việc
- [ ] Chỉ thấy objective **trong phạm vi quản lý**; Duyệt/Trả lại bắt buộc góp ý
**Phụ thuộc:** F2

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §5, mockup S42, code `hkt/frontend/src/modules/okr/reports/OKRApprovalsPage.tsx` và `BusinessGapController` (`/okr/objectives/{id}/approve`). Hoàn thiện duyệt/trả lại 2 nhóm, trả lại bắt buộc góp ý, nút "Mở cho nhân viên sửa", chỉ thấy objective cấp dưới, hiện 2 nhóm cạnh nhau. Test với manager + nhân viên: duyệt, trả lại, mở sửa → NV sửa → gửi lại; kiểm tra phạm vi dữ liệu trả về.

### F5 · Review giữa năm 🔴 · S43
**Nghiệm thu:**
- [ ] Nhận xét, điều chỉnh mục tiêu
- [ ] **Audit trail** — thay đổi gì, lúc nào, ai
- [ ] Xem **tiến độ check-in từng người** theo 2 nhóm + lịch sử để thấy xu hướng
- [ ] **Nhận xét riêng từng người** (coaching)
- [ ] Điều chỉnh mục tiêu/thêm/bớt/kéo hạn → **bắt buộc lý do + audit trail**
- [ ] Nút **"Mở cho nhân viên sửa"** → NV sửa bổ sung, nộp lại thì khoá
- [ ] Hiện **chênh lệch điểm tự chấm dự kiến vs tiến độ thực tế**
**Phụ thuộc:** F2

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §5, mockup S43, code `hkt/frontend/src/modules/okr/assessment/MidYearReviewPage.tsx` và `BusinessGapController` (`/okr/mid-year-reviews`). Hoàn thiện nhận xét/coaching từng người, tiến độ check-in theo 2 nhóm + lịch sử, điều chỉnh mục tiêu bắt buộc lý do + audit, mở cho NV sửa bổ sung, hiện chênh lệch điểm tự chấm dự kiến vs thực tế. Test: tạo chênh lệch, điều chỉnh mục tiêu, kiểm tra audit; mở cho NV và nộp lại.

### F6 · Đánh giá cuối năm 🔴 · S23
**Nghiệm thu:**
- [ ] Form **4 box** (kết quả · điều chỉnh · khó khăn · bài học)
- [ ] **Chấm 1–5 mỗi nhóm**; **điểm TB tự tính** — không có ô nhập tay
- [ ] Lưu **cả điểm tự chấm và điểm quản lý** để đối chiếu
**Phụ thuộc:** F3, F4

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §5, mockup S23, code `hkt/frontend/src/modules/okr/assessment/OKRAssessmentPage.tsx` và `BusinessGapController` (`/okr/reviews/{id}/self-assessment`). Hoàn thiện form 4 box (kết quả · điều chỉnh · khó khăn · bài học), chấm 1–5 mỗi nhóm, điểm TB TỰ TÍNH (không ô nhập tay), lưu cả điểm tự chấm và điểm quản lý, KHÔNG xếp loại A/B/C/D. Test: nhập điểm biên 1/5/3.5; API lưu 2 bộ điểm; UI không có ô TB; cập nhật Robot TC16 nếu còn assert model cũ.

### F7 · Review OKR cả nhóm 🟡 · S24
**Nghiệm thu:**
- [ ] **1 bảng** thay vì mở từng objective
- [ ] Có **cột điểm đề xuất** theo rule
- [ ] **Cảnh báo rule** trên dòng: tiến độ đứng yên ≥ 3 kỳ · lệch điểm tự chấm vs đề xuất > 0.2
- [ ] **Sắp xếp theo rủi ro** — việc cần xem trước lên trên
- [ ] Lọc **chưa đánh giá / có cảnh báo / theo nhóm**
- [ ] **Chấm hàng loạt** nhiều objective đã chọn; click 1 dòng → mở form đánh giá đầy đủ
**Phụ thuộc:** F3

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C8, mockup S24, code `hkt/frontend/src/modules/okr/reports/TeamReviewPage.tsx` và `BusinessGapController` (`/okr/team-review`). Hoàn thiện 1 bảng cho cả nhóm, cột điểm đề xuất theo rule, cảnh báo (tiến độ đứng yên ≥3 kỳ, lệch tự chấm >0.2), sắp xếp theo rủi ro, lọc chưa đánh giá/có cảnh báo/nhóm, chấm hàng loạt, click dòng mở form đầy đủ. Test: seed dữ liệu có cảnh báo, kiểm tra thứ tự + lọc; bulk score 3 dòng; mở 1 dòng.

### F8 · Báo cáo OKR 🔴 · S25
**Nghiệm thu:**
- [ ] Bảng tổng hợp đủ **9 trường**, cột thời gian công tác **tự tính**
- [ ] Có **cột Trạng thái** — đủ theo dõi ai chấm/chưa chấm/chờ QL (**không cần màn hình kanban riêng**)
- [ ] Có **tóm tắt báo cáo** dựng từ số liệu đã tính (C15)
- [ ] Xuất Excel
- [ ] Có **4 widget**: tiến độ nộp theo nhóm · danh sách chưa nộp · phân bố điểm · điểm TB theo nhóm
- [ ] **HR chốt & khoá chu kỳ** sau khi Giám đốc đánh giá; tóm tắt có link tới widget nguồn
- [ ] Danh sách **OKR rủi ro theo rule** kèm lý do
**Phụ thuộc:** F6

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §6, mockup S25, code `hkt/frontend/src/modules/okr/reports/OKRReportsPage.tsx` và API báo cáo OKR. Hoàn thiện bảng 9 trường + thời gian công tác tự tính, cột Trạng thái (đã chấm/chờ QL/chưa tự đánh giá), tóm tắt báo cáo từ số liệu, export Excel, 4 widget, HR chốt & khoá chu kỳ, danh sách OKR rủi ro theo rule. Test: tạo 3 nhân viên ở 3 trạng thái → bảng đúng; export mở được; chốt → không sửa; widget khớp số bảng.

### F9 · Quản lý chu kỳ OKR 🔴 · S44
**Nghiệm thu:**
- [ ] **Timeline 5 phase** theo mốc tháng thật
- [ ] HR set hạn chót theo ngày, tự nhắc trước hạn
- [ ] Cấu hình thang điểm (1–5)
- [ ] Sau hạn chót → tự khóa, chỉ HR mở lại được
**Phụ thuộc:** —

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §5, mockup S44, code `hkt/frontend/src/modules/okr/cycles/OKRCyclesPage.tsx` và `BusinessGapController` (`/okr/cycles`). Hoàn thiện timeline 5 phase theo mốc tháng thật, set hạn chót theo ngày + nhắc trước hạn, cấu hình thang 1–5, auto-lock sau hạn và chỉ HR mở lại. Test: tạo cycle, đổi ngày → phase đổi; qua hạn → API chặn sửa; HR mở lại; kiểm tra thang điểm áp vào F6.

---

## G. Tiện lợi dùng chung

### G1 · Todo inbox 🔴 · S02
**Cần có:** 1 màn hình gom **việc của CẢ 2 module** (chấm công + OKR).
**Nghiệm thu:**
- [ ] **Trang mặc định sau khi đăng nhập**
- [ ] Phân loại mức độ: **overdue / sắp đến hạn / hôm nay / lưu ý**
- [ ] Mỗi việc có **1 nút hành động** — không phải menu
- [ ] **Số phép còn lại hiện ngay** trên trang này
- [ ] Nhân viên **không cần nhớ** việc đang chờ nằm ở module nào
- [ ] **Deep-link**: bấm việc → thẳng màn hình cần xử lý
- [ ] Trạng thái rỗng → **empty state có CTA**, không màn hình trắng
**Phụ thuộc:** A2

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C1, mockup S02, code `hkt/frontend/src/modules/shared/todo/TodoInboxPage.tsx` và `TodoController.java`. Hoàn thiện todo inbox gom việc CẢ 2 module, phân loại overdue/sắp hạn/hôm nay/lưu ý, mỗi việc 1 nút hành động, hiện số phép còn lại, deep-link tới màn xử lý, empty state có CTA, là trang mặc định sau login. Test: tạo việc từ đơn/OKR/duyệt → kiểm tra phân loại + deep link; empty state; badge khớp.

### G2 · Command palette 🔴 · S03
**Nghiệm thu:**
- [ ] `Ctrl+K` → tìm **nhân viên / đơn / quy định / cấu hình**
- [ ] Gõ tiếp là ra kết quả, không phải bấm "tìm"
- [ ] Từ kết quả → đi thẳng tới màn hình đích
- [ ] **Lọc theo phạm vi quyền** — manager không thấy kết quả ngoài nhóm mình
- [ ] Tìm **tiếng Việt không dấu** (`phep` → "phép", `dieu` → "đi muộn")
**Phụ thuộc:** A2

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C3, mockup S03, code `hkt/frontend/src/components/layout/CommandPalette.tsx` và `OrgStructureController` (`/search/quick`, `/search/actions`). Hoàn thiện Ctrl+K tìm nhân viên/đơn/quy định/cấu hình, kết quả live khi gõ, điều hướng thẳng, lọc theo phạm vi quyền, tìm tiếng Việt không dấu. Test: gõ `phep`/`dieu` ra kết quả đúng; manager không thấy ngoài nhóm; Enter đi đúng route; Esc đóng.

### G3 · Thông báo & nhắc việc 🔴 · S04, S04m
**Nghiệm thu:**
- [ ] **3 kênh**: trong web · email · thông báo đẩy trình duyệt (Web Push)
- [ ] **Đúng người, đúng lúc** — ma trận 17 sự kiện × 3 vai trò
- [ ] **Chống spam**: gộp thông báo cùng loại, có quiet hours
- [ ] Tắt thông báo **không làm mất việc** khỏi trang "Cần làm"
- [ ] Tối đa **3 push/ngày/người**, quiet hours **21:00–07:00**, dedupe **12 giờ**
- [ ] Việc quá hạn **> 3 ngày** → báo thêm cho quản lý; nhân viên vẫn thấy việc
- [ ] **Badge số** trên menu luôn hiện và khớp việc đang chờ
**Phụ thuộc:** G1

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C2, mockup S04/S04m, code `hkt/frontend/src/components/layout/NotificationDropdown.tsx`, `hkt/frontend/src/modules/shared/notifications/MobileNotificationsPage.tsx`, `OrgStructureController` (`/notifications`) và `CronController`. Hoàn thiện 3 kênh (web/email/Web Push), đúng người theo ma trận 17 sự kiện × 3 vai trò, dedupe 12h + quiet hours 21:00–07:00 + tối đa 3 push/ngày, escalate quá hạn >3 ngày, badge khớp Todo; tắt thông báo không làm mất việc. Test: tạo sự kiện đơn/OKR, kiểm tra người nhận + kênh; chạy cron; đo số push; badge.

### G4 · Tuỳ chỉnh thông báo 🔴 · S36
**Nghiệm thu:**
- [ ] **Tắt/bật được TẤT CẢ loại** thông báo
- [ ] Chọn kênh nhận (trong web / email / thông báo đẩy) cho từng loại
- [ ] Đặt **giờ yên lặng**
- [ ] Nhân viên **tự cấu hình được phần của chính mình** — không cấu hình được gì khác
- ⚪ *(C9)* Onboarding tour + trạng thái rỗng có CTA
- [ ] Tắt **giờ yên lặng** được; việc quá hạn vẫn nổi badge
- [ ] Hiển thị **số việc chờ theo nhóm**: việc của tôi · việc tôi phụ trách
- [ ] Thay đổi **lưu ngay**, có hiệu lực từ thông báo kế tiếp; có thể hoàn tác 1 click
**Phụ thuộc:** G3

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C9, mockup S36, code `hkt/frontend/src/modules/shared/notifications/NotificationPrefsPage.tsx` và `BusinessGapController` (`/notifications/preferences`). Hoàn thiện bật/tắt TẤT CẢ loại thông báo, chọn kênh cho từng loại, đặt quiet hours, chỉ cấu hình phần của chính mình, lưu ngay + hoàn tác 1 click, hiện số việc chờ theo nhóm. Test: tắt 1 loại → sự kiện không push nhưng vẫn còn trong Todo; bật lại; thử sửa prefs người khác phải bị chặn.
## Điều kiện cắt (nếu trượt tiến độ)

**Cắt theo thứ tự, không đụng danh sách trước:**

1. ⚪ F7 Review OKR cả nhóm → ⚪ B6 Thêm thiết bị → ⚪ E11 Bảng phép tổng hợp (giữ S34 sổ phép 1 NV)
3. ❌ Rollback trong E5 (giữ lịch sử chỉ để xem) → ❌ multi-select động trong E3 (dùng select 1 giá trị)
4. ❌ Lịch cố định WFH (giữ đăng ký lẻ) → ❌ Phụ lục nghỉ chi tiết trong D5

**Không bao giờ cắt:**
- ❌ **E1 Bảng công 53 cột + chốt + khóa + export Excel** (khớp file HR)
- ❌ **B1 Chấm công điện thoại 1 chạm < 4s**
- ❌ **G1 Todo inbox** · **G2 Command palette** · **G3 Thông báo**
- ❌ **E3 + E4 + E6 Cấu hình quy định + trang tra cứu** (cùng một catalog)
- ❌ **F6 Đánh giá cuối năm** + lưu cả điểm tự chấm lẫn điểm quản lý
- ❌ **Quota chặn server-side** (không chặn ở UI)
- ❌ **A5 Nhật ký thay đổi** cho mọi thao tác sửa dữ liệu
- ❌ **Rule cấu hình được trong DB** — không hard-code
