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

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §3, `docs/09-business-ba-po-guidelines.md` (quyết định Non-SSO) và mockup S01/S01-A/S01-B trong `mockups/index.html`; rà code `hkt/frontend/src/modules/auth/LoginPage.tsx`, `FirstLoginChangePasswordModal.tsx`, `FaceEnrollmentPage.tsx`, `hkt/backend/core-service/src/main/java/com/act/pulse/modules/auth/` (AuthController, AuthServiceImpl, JwtAuthenticationFilter) và bảng `users/login_attempts/refresh_tokens` trong V2. Hoàn thiện đủ: đăng nhập email/mật khẩu, khoá 5 lần/10 phút và 10 lần/vĩnh viễn, bắt đổi mật khẩu rồi đăng ký khuôn mặt lần đầu, refresh token, thu hồi phiên khi đổi mật khẩu. **TEST SERVICE (bắt buộc — gọi API thật, không mock):** dựng stack bằng `./run-local.sh`; lấy token qua `POST /api/v1/auth/login` bằng tài khoản seed trong DB (xem `db/migration/V3__fix_demo_seed_passwords.sql`) rồi gọi kèm header `Authorization: Bearer <token>`. Cần đạt: `POST /api/v1/auth/login` với tài khoản seed hợp lệ → 200 + `data.accessToken`; sai mật khẩu → 401 kèm message rõ ràng, KHÔNG lộ thông tin tài khoản có tồn tại; `POST /api/v1/auth/change-password` (oldPassword sai) → 400, (đúng) → 200 và mật khẩu mới dùng được; `POST /api/v1/auth/reset-password-request` với email không tồn tại → không phản hồi lộ trạng thái tài khoản; gọi login sai 5 lần liên tiếp → 401 kèm thông báo khoá tạm thời. **TEST GIAO DIỆN (bắt buộc — UI thật):** dùng Playwright mở đúng route, đăng nhập thật, assert dữ liệu hiện ra khớp với API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. Cần đạt: ở route `/` → sau khi đăng nhập phải vào thẳng `/todo`, KHÔNG qua màn chọn vai trò; nhập sai 5 lần → hiện thông báo khoá tạm thời; lần đăng nhập đầu → hiện modal bắt buộc đổi mật khẩu, sau đó tới màn đăng ký khuôn mặt; reload trang vẫn giữ phiên (localStorage `pulse_auth_user`), hết hạn thì đưa về màn đăng nhập mà không mất dữ liệu đang làm dở. **ĐIỀU KIỆN DONE:** phải có (1) lệnh curl + HTTP status + response thật, (2) script Playwright exit 0 với 0 lỗi console và 0 request 4xx/5xx, (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `POST /api/v1/auth/login` với tài khoản seed hợp lệ → 200 + `data.accessToken`; sai mật khẩu → 401 kèm message rõ ràng, KHÔNG lộ thông tin tài khoản có tồn tại; `POST /api/v1/auth/change-password` (oldPassword sai) → 400; (đúng) → 200 và mật khẩu mới dùng được; `POST /api/v1/auth/reset-password-request` với email không tồn tại → không phản hồi lộ trạng thái tài khoản; gọi login sai 5 lần liên tiếp → 401 kèm thông báo khoá tạm thời. **TEST GIAO DIỆN (bắt buộc):** cần đạt: ở route `/` → sau khi đăng nhập phải vào thẳng `/todo`, KHÔNG qua màn chọn vai trò; nhập sai 5 lần → hiện thông báo khoá tạm thời; lần đăng nhập đầu → hiện modal bắt buộc đổi mật khẩu, sau đó tới màn đăng ký khuôn mặt; reload trang vẫn giữ phiên (localStorage `pulse_auth_user`); hết hạn thì đưa về màn đăng nhập mà không mất dữ liệu đang làm dở. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### A2 · Cấu trúc điều hướng 🔴 · S00
**Cần có:** 3 biến thể menu — Nhân viên ⊂ Quản lý ⊂ HR. Mọi mục của nhân viên phải có ở cả 2 bản còn lại.
**Nghiệm thu:**
- [ ] Menu đúng theo vai trò, không có mục "chết" (bấm vào phải tới màn hình thật)
- [ ] Trang mặc định sau đăng nhập = **"Cần làm"** (G1), không phải dashboard rỗng
- [ ] Trên điện thoại: 4 mục dưới cùng + menu cuộn được
- [ ] **2 module Chấm công / OKR tách nhóm riêng** trong menu, không trộn lẫn
- [ ] **Badge số việc chờ** trên menu luôn hiện và khớp số việc thật trong "Cần làm"
**Phụ thuộc:** A1

**Prompt AI:** Đọc `PLAN.md` §1.1, mockup S00 (`<section id="s00">`) và code `hkt/frontend/src/components/layout/Sidebar.tsx`, `MobileBottomNav.tsx`, `AppRoutes.tsx`, `ProtectedRoute.tsx`. Sinh 3 biến thể nav Employee ⊂ Manager ⊂ HR từ MỘT nguồn cấu hình duy nhất (không chép tay 3 bản), badge số việc chờ lấy từ API todo/notification, mobile có 4 mục dưới cùng và menu cuộn. **TEST SERVICE (bắt buộc — gọi API thật, không mock):** dựng stack bằng `./run-local.sh`; lấy token qua `POST /api/v1/auth/login` bằng tài khoản seed trong DB (xem `db/migration/V3__fix_demo_seed_passwords.sql`) rồi gọi kèm header `Authorization: Bearer <token>`. Cần đạt: `GET /api/v1/todos/my-inbox` → 200; số việc chờ trả về là số badge phải hiện trên menu (đối chiếu bằng script, không ước lượng). **TEST GIAO DIỆN (bắt buộc — UI thật):** dùng Playwright mở đúng route, đăng nhập thật, assert dữ liệu hiện ra khớp với API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. Cần đạt: đăng nhập lần lượt 4 tài khoản → số mục menu theo vai trò phải lồng đúng (mọi mục của nhân viên có ở cả 2 bản còn lại); bấm vào TỪNG mục menu → assert URL đổi đúng và màn hình không trắng (không có link chết); badge khớp số việc thật trong `/todo`; viewport 390px → có 4 mục dưới cùng và menu cuộn được. **ĐIỀU KIỆN DONE:** phải có (1) lệnh curl + HTTP status + response thật, (2) script Playwright exit 0 với 0 lỗi console và 0 request 4xx/5xx, (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/todos/my-inbox` → 200; số việc chờ trả về là số badge phải hiện trên menu (đối chiếu bằng script, không ước lượng). **TEST GIAO DIỆN (bắt buộc):** cần đạt: đăng nhập lần lượt 4 tài khoản → số mục menu theo vai trò phải lồng đúng (mọi mục của nhân viên có ở cả 2 bản còn lại); bấm vào TỪNG mục menu → assert URL đổi đúng và màn hình không trắng (không có link chết); badge khớp số việc thật trong `/todo`; viewport 390px → có 4 mục dưới cùng và menu cuộn được. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### A3 · Quản lý nhân viên 🔴 · S40
**Cần có:** danh sách nhân viên, ai ở nhóm nào, ai duyệt cho ai, chuyển nhóm/quản lý.
**Nghiệm thu:**
- [ ] Lọc theo nhóm / chức danh / trạng thái
- [ ] Đổi quản lý của 1 nhân viên → **đơn đang chờ giao cho người mới**, không mất
- [ ] Thêm nhân viên mới → tự gán nhóm mặc định theo bộ gán ca
- [ ] Đổi quản lý trực tiếp → **bắt buộc lý do**, ghi nhật ký thay đổi
- [ ] Hiện **chuỗi cấp trên (ai duyệt cho ai)** ngay trên dòng nhân viên
**Phụ thuộc:** A1

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S40, code `hkt/frontend/src/modules/shared/admin/EmployeeManagementPage.tsx` và `hkt/backend/.../auth/controller/OrgStructureController.java` (`/admin/users`, import Excel). Hoàn thiện lọc theo nhóm/chức danh/trạng thái, hiện chuỗi cấp trên (ai duyệt cho ai), đổi quản lý bắt buộc lý do + ghi audit log, và chuyển các đơn đang chờ sang quản lý mới (không làm mất đơn). **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/admin/users` → 200 + danh sách; đổi quản lý 1 nhân viên → đọc lại `/admin/users` phải đổi người duyệt, và `GET /api/v1/admin/audit-logs` phải có thêm 1 dòng ghi lý do; thêm nhân viên mà không kèm lý do → 400. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/admin/employees`: lọc theo nhóm/chức danh/trạng thái lọc đúng số dòng; cột hiển thị chuỗi cấp trên (ai duyệt cho ai) đúng; bấm đổi quản lý → có modal BẮT BUỘC nhập lý do; bấm lưu khi trống thì nút phải disable; sau khi lưu, dòng đó cập nhật và có dòng audit tương ứng. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S41, code `hkt/frontend/src/modules/shared/admin/OrgTreePage.tsx` và `OrgStructureController.java` (`/org/tree`, `/admin/teams`), bảng `teams.parent_id` trong V2. Hoàn thiện cây nhóm lồng nhau KHÔNG giới hạn số tầng, mỗi node hiện số người + số đơn chờ, tô đậm node/nhân viên chưa có quản lý (không cảnh báo chặn), click node xem danh sách. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/admin/org-tree` → 200 và cây chứa node cấp 3 (tạo trước 3 tầng); `GET /api/v1/admin/teams` → 200; nhóm không có trưởng vẫn trả về bình thường, không lỗi 500. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/admin/org-tree`: cây hiển thị đúng 3 tầng (đếm node theo cấp bằng script); số người + số đơn chờ ở mỗi node khớp API; node/nhân viên chưa có quản lý được tô đậm nhưng KHÔNG chặn thao tác; click 1 node → danh sách người hiện ra, lọc theo đơn đang chờ hoạt động. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S35, code `hkt/frontend/src/modules/shared/admin/AuditLogPage.tsx` và endpoint `/admin/audit-logs` (OrgStructureController/BusinessGapController). Đảm bảo nhật ký append-only: ai, đối tượng, trường, giá trị cũ → mới, lý do, IP/thiết bị, thời điểm; ghi log tại MỌI service sửa dữ liệu công/điểm/rule; lọc theo người, đối tượng, khoảng thời gian và nhân viên bị tác động. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: sửa 1 rule (`PUT /api/v1/rules/{key}`) rồi `GET /api/v1/admin/audit-logs` → phải có dòng mới ghi đúng giá trị cũ → mới; sửa 1 ô bảng công → có dòng log tương ứng; thử sửa/xoá một dòng log (PUT/DELETE lên endpoint log) → phải bị từ chối (append-only). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/admin/audit-logs`: lọc theo người/đối tượng/khoảng thời gian lọc đúng số dòng; mỗi dòng hiện GIÁ TRỊ CŨ và GIÁ TRỊ MỚI; trên bảng không có bất kỳ nút sửa/xoá nào; số dòng hiển thị khớp `GET /api/v1/admin/audit-logs`. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.
## B. Chấm công — nhân viên

### B0 · Đăng ký khuôn mặt (face enrollment) 🔴 · S27, S05m
**Cần có:** luồng chụp 3 góc + liveness, lưu vector đặc trưng (không lưu ảnh thô), HR reset kèm lý do.
**Nghiệm thu:**
- [ ] Chưa đăng ký → màn hình chấm công **chặn** và hiện nút "Đăng ký khuôn mặt"
- [ ] Chụp 3 góc + liveness, chỉ trong mạng công ty; lưu **vector đặc trưng**, không lưu ảnh thô
- [ ] HR xem trạng thái hồ sơ + reset kèm lý do → nhân viên đăng ký lại; có audit log
- [ ] Mọi lần đăng ký/reset đều gắn với người dùng, thời điểm, người thực hiện
**Phụ thuộc:** A1

**Prompt AI:** Đọc `docs/07-business-mobile-punch.md` §2.4, mockup S27 + S05m, code `hkt/frontend/src/modules/auth/FaceEnrollmentPage.tsx`, `AuthController` (`/auth/enroll-face`), `FaceProfile.java`/`FaceProfileRepository.java`, AI service `hkt/backend/ai-face-service/app/main.py` (`/api/v1/face/enroll-json`) và bảng `face_profiles` (V2). Hoàn thiện chụp 3 góc + liveness, chỉ lưu vector 512 chiều (tuyệt đối không lưu ảnh thô), chặn ngoài mạng công ty, HR reset kèm lý do + audit. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `POST /api/v1/face/enroll-json` (AI service) với ảnh thật → 200 + vector 512 chiều; `POST /api/v1/auth/enroll-face` → 200; query DB `SELECT count(*) FROM face_profiles` tăng 1; cột `embedding` có 512 phần tử; KHÔNG cột nào chứa ảnh thô; chưa đăng ký mặt mà gọi `POST /api/v1/attendance/check-in` → phải bị CHẶN kèm lý do 'chưa đăng ký khuôn mặt'. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/auth/enroll-face`: camera bật, chụp đủ 3 góc thì mới cho đăng ký (thiếu góc → nút disable); đăng ký xong → quay lại màn chấm công được chấm; chưa đăng ký → màn chấm công hiện NÚT 'Đăng ký khuôn mặt' chứ không phải lỗi chung chung. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc toàn bộ `docs/07-business-mobile-punch.md`, mockup S05m (`id="s05m"`), code `hkt/frontend/src/modules/attendance/checkin/CheckInPage.tsx`, `AttendanceController.java`/`AttendanceServiceImpl.java`, AI `/verify-json` và `DeviceRegistration`. Hoàn thiện màn chấm công mobile web: camera trước + khung oval, 1 chạm <4 giây, 5 lớp chạy song song (thiết bị · mạng · GPS · ca · khuôn mặt ≥85% + liveness), mọi lớp không đạt là CHẶN và hiện lý do + số lần thử, offline IndexedDB tối đa 24h, chống double entry. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `POST /api/v1/attendance/check-in` với thiết bị chưa duyệt → REJECTED + `rejectReason=DEVICE_NOT_APPROVED`; wifiBssid ngoài mạng nội bộ → `OUTSIDE_NETWORK`; GPS lệch >150m → `OUTSIDE_GEOFENCE`; thiếu `faceImageBase64` → phải CHẶN và tuyệt đối KHÔNG ghi log `status=VALID` (kiểm tra trực tiếp bảng `attendance_logs`); chấm 2 lần cùng ngày → lần 2 bị chặn. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/checkin` ở viewport 390x844: camera hiện ngay, 5 lớp hiện trạng thái ngay khi bắt đầu; bấm 1 lần có phản hồi trong <4s (đo bằng `performance.now()` trong script); thiếu quyền camera / ngoài mạng / GPS lệch → hiện đúng lý do chặn KÈM cách khắc phục; bấm 2 lần liên tiếp không tạo 2 entry. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### B2 · Chấm công trên desktop 🔴 · S05
**Nghiệm thu:**
- [ ] Cùng bộ kiểm tra như B1 (gồm **khuôn mặt qua webcam**), hiển thị trên desktop
- [ ] Nhân viên chưa chấm công ra hôm qua → hiện việc "Bổ sung công" với nút bấm 1 chạm
- [ ] Check-in/check-out **1 nút, không form** trên desktop
- [ ] **Camera/webcam + khuôn mặt** chạy song song với 4 kiểm tra còn lại
- [ ] **Hiện rõ lý do bị chặn** + cách khắc phục (mạng/GPS/khuôn mặt/thiết bị)
**Phụ thuộc:** B0, B1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §3, mockup S05, code `CheckInPage.tsx` (dùng chung responsive) và `AttendanceServiceImpl`. Hoàn thiện bản desktop dùng webcam nhưng giữ đúng 5 lớp như mobile, 1 nút không form, hiện rõ lý do bị chặn và cách khắc phục; hiện việc "Bổ sung công" 1 chạm nếu hôm qua thiếu check-out. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: chạy lại đủ bộ case của B1 để xác nhận desktop và mobile dùng CHUNG payload `CheckInRequest` (employeeCode, faceImageBase64, wifiBssid, latitude, longitude, deviceFingerprint, livenessFrames, isOffline) — so 2 request thật. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/checkin` ở viewport 1440x900: webcam bật (dùng `--use-fake-device-for-media-stream` của Chromium để có ảnh); chạy đủ 5 nhánh pass/fail và so kết quả hiển thị với response API; màn hình không có form nhập tay; hiện việc 'Bổ sung công' 1 chạm khi hôm nay thiếu check-out. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### B3 · Lịch công tháng 🔴 · S06
**Nghiệm thu:**
- [ ] Xem cả tháng trên 1 màn hình, màu theo trạng thái (đủ / muộn / WFH / phép / vắng)
- [ ] Chạm 1 ngày → xem chi tiết giờ vào/ra
- [ ] Có nút chuyển tháng (‹ ›)
**Phụ thuộc:** B1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §3, mockup S06, code `hkt/frontend/src/modules/attendance/calendar/CalendarPage.tsx` và API dữ liệu công tháng (bổ sung endpoint nếu chưa có, dùng `attendance_logs` + requests). Hoàn thiện lịch tháng dạng ô: đủ số ngày của tháng, màu theo trạng thái đủ/muộn/WFH/phép/vắng, nút chuyển tháng ‹ ›, click ngày xem giờ vào/ra. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/attendance/my-timesheet?month=YYYY-MM` → 200 + dữ liệu đúng tháng; số ngày trả về phải bằng số ngày thực của tháng (28/29/30/31) — kiểm bằng script. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/calendar`: ô trong tháng đủ số ngày, đúng thứ tự T2→CN; bấm ‹ › đổi tháng và URL phải đổi theo; click 1 ngày ra panel chi tiết giờ vào/ra; màu từng ô khớp trạng thái trả về từ API. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.1, mockup S11, code `hkt/frontend/src/modules/attendance/timesheet/MyTimesheetPage.tsx` và `BusinessGapController` (`/attendance/my-timesheet`). Hoàn thiện: chọn tháng `?month=YYYY-MM`, lịch tháng dạng ô vuông, đủ 11 cột số liệu, quy trình công bố ngày 11 → khiếu nại 2 ngày → khoá, kỳ đã chốt chỉ đọc, lịch sử 12 tháng. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/attendance/my-timesheet` với các tháng khác nhau → dữ liệu đúng tháng; response phải có đủ 11 trường số liệu; ở các mốc 10/11, 12/11, 14/11 và kỳ đã khoá, response phải phản ánh đúng trạng thái (chưa công bố / được khiếu nại / quá hạn / đã khoá). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/my-timesheet`: chuyển tháng phải đổi URL `?month=YYYY-MM` và dữ liệu; lịch dạng ô vuông, ô có vấn đề nổi bật; đếm số cột hiển thị = 11; tháng chưa công bố → nút khiếu nại disable kèm giải thích; trong 2 ngày → nút hoạt động; quá 2 ngày → disable; kỳ đã chốt → chỉ đọc, không sửa được. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### B5 · Thiết bị của tôi 🔴 · S27
**Cần có:** đăng ký thiết bị, xem thiết bị đang đăng ký, thu hồi.
**Nghiệm thu:**
- [ ] **Mặc định 2 thiết bị** — thiết bị thứ 3 mới phải được HR duyệt
- [ ] Nhân viên **tự thấy** mình đang chấm công trên bao nhiêu máy, ở đâu, lúc nào
- [ ] Nhân viên **không tự xoá được** thiết bị đang chờ duyệt
- [ ] Mỗi ngày tối đa **1 check-in + 1 check-out/account**; unique `(user_id, work_date)` ở tầng dữ liệu
- [ ] Quota tính **theo người**, không theo thiết bị
**Phụ thuộc:** A1

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S27, code `hkt/frontend/src/modules/attendance/devices/MyDevicesPage.tsx`, `BusinessGapController` (`/devices`), `DeviceRegistration.java` và unique index `uq_attendance_user_date` (V2). Hoàn thiện danh sách thiết bị đang hoạt động, mặc định 2 máy, nhân viên không tự xoá máy đang chờ duyệt, hiện lần dùng gần nhất, chặn 2 check-in hoặc 2 check-out cùng ngày ở tầng DB. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/devices` → 200; đăng ký 3 thiết bị cho 1 người → máy thứ 3 phải ở trạng thái chờ duyệt (isApproved=false); gọi `POST /api/v1/attendance/check-in` 2 lần cùng ngày → lần 2 bị chặn bởi unique constraint; quota tính theo NGƯỜI không theo thiết bị. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/devices`: danh sách hiện đúng số máy + trạng thái; KHÔNG có nút xoá cho máy đang chờ duyệt; nhân viên thấy được mình đang chấm công trên bao nhiêu máy, ở đâu, lúc nào. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### B6 · Thêm thiết bị 🔴 · S29
**Nghiệm thu:**
- [ ] **Một flow duy nhất** cho cả "đăng ký lần đầu" và "thêm máy thứ 3" — không có 2 màn hình riêng
- [ ] Mặc định 2 máy; muốn thêm máy phải có lý do
- [ ] Yêu cầu vào hàng chờ HR duyệt, có thời hạn hết hiệu lực
- [ ] **Bắt buộc nhập lý do** — thiếu lý do thì không gửi được
- [ ] Yêu cầu thêm thiết bị **chỉ nhận từ mạng nội bộ công ty**
**Phụ thuộc:** B5, E8

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2.1, mockup S29, code `hkt/frontend/src/modules/attendance/devices/AddDevicePage.tsx` và `BusinessGapController` (`/devices/request`, `/admin/devices`). Hoàn thiện MỘT flow duy nhất cho đăng ký lần đầu và máy thứ 3: lý do bắt buộc, chỉ nhận yêu cầu từ mạng nội bộ, yêu cầu có thời hạn, HR duyệt ở S28. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `POST /api/v1/devices/request` thiếu lý do → 400; gửi từ ngoài mạng công ty → 403; gửi hợp lệ → 200 + bản ghi isApproved=false; `POST /api/v1/admin/devices/{id}/approve` → 200 và thiết bị thành công; `GET /api/v1/admin/devices` phải có bản ghi vừa duyệt. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/devices/add`: bỏ trống lý do thì nút gửi phải disable; sau khi gửi, màn `/admin/devices` phải thấy yêu cầu mới và duyệt được; duyệt xong quay lại `/attendance/devices` thấy máy đã hoạt động. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

---

## C. Đơn từ — nhân viên

> **Nguyên tắc chung cho mọi đơn từ:** gửi được **từ bất kỳ đâu** — **không cần GPS, không cần mạng công ty**.
> Chỉ **chấm công** mới cần vị trí + mạng nội bộ.
> Mọi đơn đều có **quota** hiển thị sẵn, **validate tức thì**, và **bắt buộc lý do khi bị từ chối**.

### C1c · Tạo đơn đi muộn — prefill 🔴 · S07
> **Cập nhật 20/11:** form chỉ chọn **1 ngày**, chọn Đi muộn (sửa giờ vào) / Về sớm (sửa giờ ra) + giờ thực tế; số phút tự tính theo ca và giới hạn bởi `late_early.max_minutes` (cấu hình); ô giờ bị min/max theo max phút; hạn nộp 3 ngày; duyệt xong cập nhật `attendance_logs`.

**Nghiệm thu:**
- [ ] Mở form → **ngày và giờ đã điền sẵn từ log chấm công thật** (nhân viên không gõ)
- [ ] Chỉ chọn 1 ngày; chọn Đi muộn/Về sớm + giờ thực tế; không nhập thời lượng
- [ ] Số phút ≤ `late_early.max_minutes` (đổi cấu hình → ô giờ đổi min/max)
- [ ] Quota 2 lần/tháng → lần 3 **bị chặn ngay lúc tạo**, kèm số đã dùng
- [ ] "Lưu nháp" → **không trừ quota, không hiện cho quản lý**
- [ ] Nhân viên hỏi "vì sao bị chặn" → hiện đúng lý do theo rule
- [ ] Chọn lý do bằng **chip 1 chạm** (kẹt xe, họp, sự cố máy…)
**Phụ thuộc:** B1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §6, mockup S07, code `hkt/frontend/src/modules/attendance/requests/RequestsPage.tsx` (đã có phần prefill từ log) và `RequestController` (`POST /requests`). Hoàn thiện prefill ngày/giờ từ log đi muộn thật, quota 2 lần/tháng chặn ở server, lưu nháp không trừ quota và không hiện cho quản lý, chip lý do 1 chạm, thông báo lý do bị chặn theo rule. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `POST /api/v1/requests` type=LATE_EARLY lần 1 và 2 → 200; lần 3 trong cùng tháng → 400 kèm số quota đã dùng; tạo 1 đơn DRAFT → `GET /api/v1/requests/my-requests` có nó nhưng `GET /api/v1/requests/inbox` của quản lý KHÔNG thấy; lưu nháp KHÔNG trừ quota. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/requests`: tạo log đi muộn qua API rồi mở form → ngày/giờ phải được điền sẵn từ log (không phải ô trống); bấm lưu nháp → quota không đổi, đơn không hiện trong hộp thư duyệt của quản lý; gửi 3 lần trong tháng → lần 3 hiện lý do bị chặn; chip lý do bấm 1 lần đổi được lý do. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### C2c · Đơn bổ sung chấm công 🔴 · S31
> **Cập nhật 20/11:** form chỉ chọn **1 ngày** (hôm nay hoặc quá khứ trong `makeup.deadline_working_days`, không cho ngày tương lai), chọn **Giờ vào/Giờ ra + giờ thực tế**, **không nhập thời lượng**. Duyệt xong cập nhật `attendance_logs`.

**Nghiệm thu:**
- [ ] Hạn nộp tính theo **ngày làm việc**, hiện rõ hạn là ngày nào
- [ ] Chỉ 1 ngày trong hạn (min = hôm nay − 3, max = hôm nay); không chọn ngày tương lai
- [ ] Chọn Giờ vào hoặc Giờ ra + giờ thực tế; **không có ô Số lượng/Thời lượng**
- [ ] Quota 5 lần/tháng
- [ ] Bắt buộc lý do
- [ ] Quá hạn → nộp được nếu quy định cho phép, **bắt buộc lý do + gắn cờ**
**Phụ thuộc:** B1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §6, mockup S31, code `RequestsPage.tsx` và `RequestController`. Hoàn thiện đơn bổ sung công: hạn tính theo NGÀY làm việc (mặc định 3), quota 5 lần/tháng, lý do bắt buộc, cho phép quá hạn nếu rule bật và gắn cờ cho HR. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `POST /api/v1/requests` type=MAKEUP: trong hạn → 200; quá hạn khi rule `makeup` không cho phép → 400 nêu rõ số ngày quá hạn; lần 6 trong tháng → 400 vượt quota; đơn quá hạn được tạo phải có cờ hiện trong `GET /api/v1/requests/inbox`. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/requests` tab đơn bổ sung công: hạn nộp hiện rõ là NGÀY nào (không phải giờ); thiếu lý do thì nút gửi disable; gửi đơn quá hạn → hiện cờ đỏ kèm lý do theo rule. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### C3c · Đơn của tôi 🔴 · S08
> **Cập nhật 20/11:** phân trang server-side 10/trang; lọc server-side theo loại/trạng thái/**khoảng ngày**/lý do; cột **Ngày áp dụng** (1 ngày hoặc khoảng) + **Ngày tạo**; nút **Xem chi tiết** mọi dòng; **Sửa đơn** khi PENDING/REJECTED.

**Nghiệm thu:**
- [ ] Lịch sử đơn + trạng thái rõ ràng (chờ duyệt / được duyệt / bị từ chối + lý do)
- [ ] Badge quota còn lại luôn hiển thị
- [ ] Nhân viên **không thấy đơn của đồng nghiệp** (trừ khi được cấu hình)
- [ ] **Tab theo loại đơn + Tất cả**
- [ ] Đơn bị trả lại hoặc đang chờ duyệt → nút **"Sửa đơn"** ngay trong danh sách
- [ ] Phân trang + lọc khoảng ngày server-side; hiện Ngày áp dụng/Ngày tạo
- [ ] Nút Xem chi tiết hiện đủ thông tin + file đính kèm
**Phụ thuộc:** C1c

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.1, mockup S08, code `RequestsPage.tsx`, `RequestDetailPage.tsx` và `RequestController` (`/my-requests`, `/{id}`). Hoàn thiện lịch sử đơn + trạng thái + lý do từ chối, badge quota còn lại, tab theo loại đơn + Tất cả, nút "Sửa & gửi lại" khi bị trả, và chỉ thấy đơn của mình (trừ khi được cấu hình). **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/requests/my-requests` của một người KHÔNG được chứa đơn của người khác (so 2 response); `GET /api/v1/requests/{id}` → có timeline + lý do từ chối; `POST /api/v1/requests/{id}/withdraw` → trạng thái thành WITHDRAWN. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/requests`: tab theo loại + Tất cả lọc đúng số dòng; badge quota khớp số còn lại từ API; đơn bị trả lại có nút 'Sửa & gửi lại' và bấm được; đăng nhập bằng tài khoản khác không thấy đơn của người này. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### C4c · Xin nghỉ phép 🔴 · S30
> **Cập nhật 20/11:** nửa ngày = 0.5, chọn buổi sáng/chiều + khung giờ làm còn lại theo ca; `end_date` lưu thật và hiển thị khoảng ngày; loại nghỉ cần giấy tờ **bắt buộc ≥1 file, cho nhiều file**ảnh/PDF ≤10MB lưu DB; server chặn duyệt nếu thiếu.

**Nghiệm thu:**
- [ ] **8 loại nghỉ** hiện đúng, lấy từ cấu hình của HR (không hard-code)
- [ ] Đơn vị **ngày / nửa ngày (0.5)** — nửa ngày chọn buổi sáng/chiều, hiện khung giờ làm còn lại
- [ ] Loại nghỉ cần giấy tờ → chọn/nhiều file (ảnh/PDF) và chặn gửi/duyệt khi thiếu
- [ ] Ngày bắt đầu/kết thúc hiển thị rõ (1 ngày hoặc khoảng)
- [ ] Hạn gửi + giấy tờ đều cấu hình được theo từng loại
- [ ] Số dư phép còn lại hiện ngay trong form
- [ ] Đủ **8 loại nghỉ khớp cột bảng công**
- [ ] Chọn ngày → **tự tính số ngày làm việc** (trừ cuối tuần + lễ)
- [ ] Gửi đơn **từ bất kỳ đâu** — không cần GPS/mạng công ty
**Phụ thuộc:** E8, C6c

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §2.3, mockup S30, code `RequestsPage.tsx`, `LeaveController.java` (`/leave-types`), `LeaveType.java` và bảng `leave_ledger`. Hoàn thiện form xin nghỉ đủ 8 loại lấy từ cấu hình DB (không hard-code), đơn vị ngày/nửa ngày, tự tính ngày làm việc trừ cuối tuần + lễ, hiện số dư ngay trong form, lưu snapshot `applied_parameters`, gửi từ bất kỳ đâu (không GPS/mạng công ty). **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/leave-types` → đủ 8 loại; `POST /api/v1/requests` type=LEAVE với ngày trải qua cuối tuần → số ngày làm việc tính ra khớp số ngày làm việc thật; đổi cấu hình loại nghỉ rồi đọc lại đơn cũ → `applied_parameters` phải giữ nguyên giá trị lúc gửi. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/requests` tab nghỉ phép: dropdown loại nghỉ hiện đúng 8 loại lấy từ API; chọn ngày → số ngày làm việc tự tính (bỏ cuối tuần + lễ) khớp API; số dư phép hiện ngay trong form; đơn nghỉ chỉ cần quản lý duyệt, KHÔNG chuyển HR. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.
- [ ] Cho phép xin nghỉ cho ngày tương lai (tháng sau/năm sau), không giới hạn

### C5c · Đăng ký WFH 🔴 · S10
> **Cập nhật 20/11:** không giới hạn địa điểm, không lặp tuần; cả ngày chọn khoảng ngày (mỗi ngày làm việc 1 đơn, quota 2/tuần) hoặc nửa ngày 0.5 (1 ngày, sáng/chiều).

**Nghiệm thu:**
- [ ] WFH cả ngày chọn khoảng ngày; nửa ngày 0.5 chỉ 1 ngày + buổi sáng/chiều
- [ ] Không giới hạn địa điểm, không lặp tuần
- [ ] Quota 2 lần/tuần → lần 3 bị chặn
- [ ] Cho đăng ký lùi tối đa 3 ngày (hôm nay và 3 ngày trước) + ngày tương lai; quá 3 ngày bị chặn với lý do rõ
- [ ] Ngày WFH đã duyệt → **chấm công được ngoài mạng và ngoài bán kính GPS** (ngoại lệ duy nhất)
- [ ] Cho phép WFH ngày tương lai không giới hạn

**Phụ thuộc:** E7

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.1 (WFH), mockup S10, code `RequestsPage.tsx` và `RequestController`. Hoàn thiện WFH theo ngày hoặc nửa ngày (sáng/chiều), quota 2 ngày/tuần, cho đăng ký lùi tối đa 3 ngày và ngày tương lai, không giới hạn địa điểm, và ngoại lệ cho phép chấm công ngoài mạng/GPS khi ngày WFH đã được duyệt. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `POST /api/v1/requests` type=WFH: 2 lần/tuần → 200; lần 3 cùng tuần → 400 nêu đúng lý do quota; đăng ký cho ngày hôm nay hoặc 2 ngày trước → 200; quá 3 ngày trước → 400; ngày WFH đã duyệt → `POST /api/v1/attendance/check-in` với wifi/GPS ngoài văn phòng vẫn phải qua (ngoại lệ duy nhất). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/requests` tab WFH: tạo được WFH cả ngày và nửa ngày; quota hiện và lần 3 bị chặn ngay trên UI; lý do khi vi phạm hạn hiện rõ; đăng ký WFH xong thì màn chấm công hôm đó không bị chặn vì mạng/GPS. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### C6c · Số dư phép 🔴 · S09
**Nghiệm thu:**
- [ ] Card tổng phép/đã dùng/còn lại + progress bar phép năm; không bắt buộc hiển thị bảng riêng “số dư theo loại nghỉ”
- [ ] Phép ốm · phép thâm niên · phép tồn có card riêng
- [ ] Thẻ **Tổng phép còn lại** = phép năm còn + phép tồn còn — tự cộng, đổi số dư thì tự cập nhật
- [ ] **Phép ốm** và **phép thâm niên** có card riêng
- [ ] **Cộng phép hàng tháng vào ngày 15**, chỉ người vào làm từ **ngày 15 trở về trước** mới cộng trong tháng đó (vào 20/11 → tháng 11 không cộng, kỳ đầu tiên là 15/12)
- [ ] **Phép thâm niên cộng đúng ngày tròn thâm niên**, không gộp vào lần cộng ngày 15
- [ ] Cảnh báo **phép tồn** theo luật (toàn bộ → 01/04; còn 5 ngày → 01/07; tồn = 0 từ 01/07)
- [ ] Phép tồn là **thẻ riêng** cạnh phép năm (không ẩn vào dòng phụ)
- [ ] **Lịch sử phép có filter**: theo loại phép (phép năm · tồn · chức vụ · thâm niên · ốm · bù) và theo năm; lọc xong danh sách chỉ còn dòng khớp
- [ ] Sổ phép hiện **loại phép của từng dòng** và **số dư sau theo đúng loại đó** (AL trừ phép năm, S trừ/đếm phép ốm — không cộng chung một quỹ)
**Phụ thuộc:** E8

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.1, mockup S09, code `hkt/frontend/src/modules/attendance/leaves/LeavesPage.tsx`, `LeaveController` (`/leaves/my-balance`), `CronController` (`/monthly-leave-accrual`, `/yearly-seniority-accrual`). Hoàn thiện card từng loại nghỉ, thẻ Tổng phép còn lại tự cộng, cộng phép ngày 15 với cutoff (vào sau 15 → hoãn kỳ sau), thâm niên đúng ngày tròn, cảnh báo tồn theo 01/04 và 01/07, filter lịch sử theo loại + năm. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/leaves/my-balance` → số dư từng loại; TỔNG phép còn lại phải bằng TỔNG các loại (tính lại bằng script, không copy số hiển thị); `GET /api/v1/leaves/my-ledger` → có dòng cộng ngày 15 và dòng thâm niên với lý do đúng; chạy job cộng phép hàng tháng → `GET /api/v1/leaves/my-balance` tăng đúng số ngày; vào làm sau ngày 15 → tháng đó KHÔNG được cộng. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/leaves`: card từng loại hiện đúng số dư API; thẻ 'Tổng phép còn lại' = tổng các card, tự cộng và tự cập nhật khi đổi số dư; phép ốm và phép thâm niên có card riêng; lọc lịch sử theo loại phép và theo năm lọc đúng số dòng. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C7, mockup S12, code `hkt/frontend/src/modules/attendance/approvals/ApprovalsPage.tsx` và `RequestController` (`/inbox`, `/approve`, `/reject`, `/bulk-approve`). Hoàn thiện hộp thư duyệt: chip điều kiện ✅/❌ ngay trên dòng, từ chối bắt buộc lý do (disable nút), lọc loại/ngày, badge quá hạn, duyệt hàng loạt và CHỈ 1 audit log cho cả lô. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/requests/inbox` → 200; `POST /api/v1/requests/{id}/reject` không kèm lý do → 400; có lý do → 200 và đơn chuyển REJECTED; `POST /api/v1/requests/bulk-approve` với 12 đơn → 200 và `GET /api/v1/admin/audit-logs` chỉ có ĐÚNG 1 dòng cho cả lô. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/approvals`: chip ✅/❌ điều kiện hiện NGAY trên dòng (không phải mở mới thấy); bấm từ chối mà bỏ trống lý do → nút phải disable; duyệt 12 đơn và đo thời gian (mục tiêu ≤3 phút); duyệt hàng loạt xong phải thấy 1 dòng audit duy nhất. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### D2 · Chi tiết đơn 🔴 · S13
**Nghiệm thu:**
- [ ] Timeline đầy đủ: gửi → duyệt → kết quả, ai làm gì lúc nào
- [ ] Hiện chip điều kiện quyết định kết quả
- [ ] Có lịch sử chỉnh sửa
- [ ] Hiện **ảnh hưởng tới bảng công** (cộng/trừ bao nhiêu phút công)
- [ ] Có link tới **bảng công bị tác động**
**Phụ thuộc:** D1

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.2, mockup S13, code `RequestDetailPage.tsx` và `RequestController` (`GET /requests/{id}`). Hoàn thiện timeline gửi → duyệt → kết quả (ai, lúc nào), chip điều kiện quyết định, lịch sử chỉnh sửa, ảnh hưởng tới bảng công (cộng/trừ bao nhiêu phút) và link tới bảng công bị tác động. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/requests/{id}` sau khi đơn được duyệt → response có timeline đầy đủ (gửi → duyệt → kết quả) kèm actor + thời điểm; phần ảnh hưởng bảng công (số phút cộng/trừ) phải khớp với chênh lệch thực tế. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/requests/:id`: timeline hiện đúng thứ tự sự kiện, chip điều kiện hiện; mục 'ảnh hưởng tới bảng công' có số phút và link bảng công — bấm link phải tới đúng route + đúng kỳ. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.2, mockup S14, code `hkt/frontend/src/modules/attendance/calendar/TeamSchedulePage.tsx` và `BusinessGapController` (`/attendance/team-schedule`). Hoàn thiện lịch nhóm tuần/tháng với phân quyền xem 4 tầng (HR cả công ty · Manager cấp dưới · Team lead nhóm mình · Member team mình), hiện WFH/nghỉ/đi muộn/công đủ, đếm người có mặt mỗi ngày, cảnh báo khi vắng vượt ngưỡng (mặc định 60%). **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/attendance/team-schedule` với 4 tài khoản khác vai trò → response khác nhau đúng phạm vi (member không thấy nhóm khác); không có dữ liệu vẫn trả 200, không lỗi 500. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/team-schedule` lần lượt bằng 4 tài khoản → mỗi người chỉ thấy đúng phạm vi của mình; ô lịch hiện đủ 4 trạng thái; đếm người có mặt từng ngày khớp dữ liệu; tạo 3 WFH cùng ngày → hiện cảnh báo vắng quá ngưỡng; chuyển tuần/tháng hoạt động. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S33, code `hkt/frontend/src/modules/attendance/timesheet/DisputesPage.tsx`, `BusinessGapController` (`/disputes/{id}`) và `TimesheetPage.tsx`. Hoàn thiện màn chi tiết khiếu nại 3 cột (log gốc không sửa · đơn từ liên quan · bảng công HR đang sửa), gợi ý nguyên nhân theo rule, 3 cách xử lý, từ chối bắt buộc lý do + gửi thông báo, audit mọi thao tác, nút quay lại danh sách. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/disputes/{id}` → 200 + 3 nguồn dữ liệu (log chấm công gốc, đơn từ liên quan, bảng công HR) + gợi ý nguyên nhân theo rule; `POST /api/v1/disputes/{id}/resolve` từ chối mà không kèm lý do → 400; resolve thành công → `GET /api/v1/admin/audit-logs` có dòng mới. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/disputes/:id`: 3 cột hiển thị đúng dữ liệu từ 3 nguồn; gợi ý nguyên nhân hiện rõ; bấm từ chối mà bỏ trống lý do → nút disable; sau khi xử lý, nhân viên phải nhận được thông báo (kiểm `GET /api/v1/notifications` của tài khoản đó); nút quay lại về đúng `/attendance/disputes`. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### D5 · Sổ phép 🔴 · S34
**Nghiệm thu:**
- [ ] Mọi thay đổi số dư đều **truy vết được** — ai, lúc nào, vì lý do gì
- [ ] Lọc theo người, theo thời gian, theo loại nghỉ
- [ ] Xem sổ **theo nhân viên hoặc theo tháng**; lọc theo loại nghỉ/loại giao dịch
- [ ] Hiện **số dư sau mỗi giao dịch** — cộng dồn khớp số dư hiển thị
- [ ] HR **điều chỉnh tay** → tạo dòng `adjust` có lý do, **không sửa/xoá lịch sử**
- [ ] **Export sổ ra Excel**
**Phụ thuộc:** C4c

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S34, code `hkt/frontend/src/modules/attendance/leaves/AdminLeaveLedgerPage.tsx`, `LeaveController` (`/leaves/ledger/{userId}`), `LeaveLedgerEntry.java`. Hoàn thiện sổ phép append-only, hiện số dư SAU mỗi giao dịch, lọc theo người/thời gian/loại, HR điều chỉnh tay tạo dòng `adjust` kèm lý do (không sửa/xoá lịch sử), export Excel. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/leaves/ledger/{userId}` → 200; số dư sau mỗi giao dịch phải cộng dồn đúng (kiểm bằng script cộng lại từ các dòng, không so với số hiển thị); `POST /api/v1/leaves/adjust` không kèm lý do → 400; có lý do → tạo dòng loại `adjust`; thử sửa/xoá một dòng ledger cũ → phải bị từ chối (append-only). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/leave-ledger`: chọn người → bảng hiện lịch sử đúng người đó; lọc theo thời gian và loại nghỉ lọc đúng số dòng; cột số dư chạy đúng; nút export Excel tải được file, mở file xlsx đọc được (kiểm bằng script). **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C4 + `docs/02-business-attendance-time-tracking.md` §2.1.3, mockup S15, code `hkt/frontend/src/modules/attendance/timesheet/TimesheetPage.tsx`, bảng `timesheets/timesheet_cells/timesheet_audit_logs` (V2 ở `hkt/backend/core-service/src/main/resources/db/migration/`) và 2 file thật `doc/Rule chấm công.xlsx`, `doc/Pine team_T10.2026_Timekeeping Report.xlsx`. Hoàn thiện lưới đúng 53 cột (A–E + 31 ngày F–AJ + 17 tổng AK–BA), ký hiệu gốc, sửa ô tại chỗ bắt buộc lý do và tô đỏ ô đã sửa, sửa hàng loạt 1 audit log, chốt/khoá, export đúng 53 cột. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: đếm cột của header trả về từ API và so với file `doc/Pine team_T10.2026_Timekeeping Report.xlsx` bằng openpyxl (đọc cột thật, không so tay); ký hiệu ô ngày phải đúng bộ gốc của công ty (R · AL · S · 1.00 · R/0.50); sửa 1 ô → audit log phải có dòng ghi lý do; sau khi chốt & khoá → mọi lần sửa phải bị từ chối. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/timesheet`: đếm số cột hiển thị = 53 (đếm bằng script, không ước lượng); click vào ô ngày → modal sửa đúng ô đó (KHÔNG có bước chọn trường) và bắt buộc nhập lý do; sau khi lưu ô phải đổi màu đỏ và còn đỏ sau reload; sửa hàng loạt nhiều dòng chỉ tạo 1 audit log; bấm Chốt & khoá phải có hộp xác nhận, sau đó không sửa được nữa; export Excel ra file đúng 53 cột, mở lại bằng openpyxl và so từng cột với file mẫu. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### E2 · Bộ lọc + lưu view 🔴 · S15
**Nghiệm thu:**
- [ ] Lọc "Mobile · 11/2026 · đi muộn > 0" → **lưu lại, mở lại bằng 1 click**
- [ ] View đã lưu có thể chia sẻ bằng link
- [ ] Nhiều bộ lọc cùng lúc, hiện dạng chip để gỡ
**Phụ thuộc:** E1

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C5, mockup S15, code `TimesheetPage.tsx` và API bảng công. Hoàn thiện bộ lọc nhiều điều kiện hiển thị dạng chip, lưu view (tên + query), mở lại 1 click, chia sẻ bằng URL, xoá view. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: lọc 'Mobile · 11/2026 · đi muộn > 0' → số dòng response phải bằng số dòng UI hiện ra (đối chiếu bằng script); lưu view rồi mở lại view → response y hệt. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/timesheet`: bật 2 bộ lọc → 2 chip hiện; lưu view → mở lại bằng 1 click cho đúng tập dữ liệu; copy URL của view rồi mở tab mới → cùng kết quả; gỡ chip → dữ liệu mở rộng đúng. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### E3 · Cấu hình quy định 🔴 · S16
> Chi tiết: **`docs/06-business-rule-builder.md`**. 19 luật — **mọi luật đều có mặt trong đây**, không có luật nào chỉ nằm trong tài liệu.
**Nghiệm thu:**
- [ ] Thấy đủ **19 quy định** với giá trị đúng theo "Quyết định của HR" ở Mục 7
- [ ] Mọi thay đổi có **ngày hiệu lực** và **lịch sử phiên bản**
- [ ] **Rollback được** về phiên bản cũ, có lý do
- [ ] **Chỉ áp dụng cho toàn công ty** — không có lựa chọn ghi đè theo nhóm / chức danh ở màn hình này
- [ ] Màn hình **không hiện** "Đang áp dụng / Sắp áp dụng / Đã hết hiệu lực" — chỉ có **nút "Lịch sử thay đổi"**
**Phụ thuộc:** —

**Prompt AI:** Đọc `docs/06-business-rule-builder.md`, mockup S16, code `hkt/frontend/src/modules/attendance/rules/RuleEnginePage.tsx`, `RuleEngineController.java` (`GET /rules`, `PUT /rules/{key}`, versions/rollback) và bảng `rules/rule_versions` (V1/V2). Hoàn thiện đủ 19 rule, mọi thay đổi có ngày hiệu lực + version, rollback kèm lý do, chỉ scope toàn công ty, bỏ 3 badge trạng thái và chỉ giữ nút "Lịch sử thay đổi". **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/rules` → đúng 19 rule; so từng `rule_key` với bảng `rules` (19 key: late_early, makeup, wfh, hr_approval, approval_flow, attendance_security, share_account, shift_times, shift, late_without_request, payroll_period, leave_type_defaults, leave_request, leave_accrual, leave_seniority, leave_position_bonus, leave_carryover, okr_evaluation, notification); `PUT /api/v1/rules/{key}` không kèm `changeReason` → 400; có lý do → 200 và tạo version mới; `GET /api/v1/rules/{key}/versions` → có bản ghi mới; `POST /api/v1/rules/{key}/rollback/{versionId}` → giá trị về bản cũ. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/admin/rules`: đếm số rule = 19 (đếm bằng script); KHÔNG có badge 'Đang áp dụng / Sắp áp dụng / Đã hết hiệu lực'; bấm 'Lịch sử thay đổi' ra danh sách version có nút rollback; sửa 1 rule → có modal xác nhận trước khi lưu. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### E4 · Cấu hình 1 luật 🔴 · S17
**Nghiệm thu:**
- [ ] Form **sinh tự động từ catalog** — thêm 1 luật mới không phải sửa form
- [ ] Chỉ hiện trường liên quan (ví dụ chỉ hiện "hạn offline" khi bật "cho phép offline")
- [ ] Nhân viên thấy **cùng nội dung** ở trang tra cứu → không có chuyện tài liệu lệch phần mềm
- [ ] Bấm **Lưu** → hiện **hộp xác nhận** nội dung sắp lưu (thay đổi gì · ngày hiệu lực · ai bị ảnh hưởng) rồi mới lưu thật
- [ ] Nút **"Lịch sử thay đổi"** mở ra lịch sử phiên bản của luật đó, kèm nút rollback
**Phụ thuộc:** E3

**Prompt AI:** Đọc `docs/06-business-rule-builder.md` §3 và catalog 19 rule, mockup S17, code `RuleEnginePage.tsx` (modal sửa rule) + `RuleEngineController` (`PUT /rules/{key}`). Hoàn thiện form SINH TỰ ĐỘNG từ catalog (không hard-code field), field phụ thuộc (bật offline mới hiện hạn offline), modal xác nhận thay đổi/ngày hiệu lực/ai bị ảnh hưởng trước khi lưu, lịch sử + rollback. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `PUT /api/v1/rules/attendance_security` với `currentValue` + `changeReason` + `effectiveFrom` → 200 và giá trị lưu đúng như gửi; thiếu `changeReason` → 400; đọc lại `GET /api/v1/rules/{key}` → `effectiveFrom` và version đúng. **TEST GIAO DIỆN (bắt buộc):** cần đạt: modal sửa 1 rule: các trường hiện đúng theo catalog; tắt 'cho phép offline' → trường 'hạn offline' phải biến mất; bật lại → xuất hiện; bấm Lưu → modal xác nhận nêu đúng thay đổi + ngày hiệu lực + phạm vi bị ảnh hưởng, chỉ lưu khi xác nhận. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### E5 · Trang quy định tra cứu 🔴 · S19
**Nghiệm thu:**
- [ ] Nhân viên mở ra thấy **quy định đang áp dụng với mình**, bằng ngôn ngữ tự nhiên
- [ ] Nội dung **tự sinh từ cùng nguồn** với form cấu hình của HR
- [ ] Đổi quota xong, nhân viên **thấy ngay** quy định mới
- [ ] Mỗi quy định hiện **phiên bản + ngày hiệu lực**
- [ ] Có **mục lục + tìm kiếm + lọc theo nhóm**, kèm ví dụ thực tế
**Phụ thuộc:** E3

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C6, mockup S19, code `hkt/frontend/src/modules/attendance/rules/PolicyDocPage.tsx` và `RuleEngineController` (`/public-policy-doc`). Hoàn thiện trang tra cứu sinh từ CÙNG catalog với form HR: ngôn ngữ tự nhiên, mục lục + tìm kiếm + lọc nhóm, phiên bản + ngày hiệu lực, ví dụ thực tế; đổi rule xong nhân viên thấy ngay. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/rules/public-policy-doc` → 200; nội dung phải được SINH từ bảng `rules`: đổi 1 rule qua `PUT` rồi gọi lại → nội dung đổi theo đúng giá trị mới (không hard-code trong code). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/admin/policy-doc`: nội dung hiện bằng ngôn ngữ tự nhiên; tìm 'phép' và 'đi muộn' ra đúng mục; có mục lục + bộ lọc theo nhóm; mỗi quy định hiện phiên bản + ngày hiệu lực; đổi quota rule rồi reload → nhân viên thấy số mới. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### E6 · Ca làm việc & lịch nghỉ lễ 🔴 · S26
**Nghiệm thu:**
- [ ] Giờ vào/ra, giờ nghỉ trưa, đủ 8h/ngày · 4h/nửa ngày — đều cấu hình được
- [ ] **Ca linh hoạt**: cấu hình được khung giờ (ví dụ check-in 8h–10h · check-out 17h–19h) — làm đủ 8h trong khung thì **tính đủ 1 ngày công**, không bắt buộc đúng giờ
- [ ] **Bộ gán ca**: nhóm + chức danh → ca
- [ ] Ca ngoại lệ (7h30–16h30 · 7h00–16h00 · 10h00–19h00) gán cho nhóm, cần HR duyệt
- [ ] Lịch nghỉ lễ theo năm — thêm ngày lễ không cần sửa code
- [ ] Cấu hình **geofence bán kính + dải IP mạng nội bộ** cho văn phòng
**Phụ thuộc:** —

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S26, code `hkt/frontend/src/modules/shared/admin/ShiftHolidayPage.tsx`, `OrgStructureController.java` (`/admin/shifts`, `/admin/holidays`) và bảng `shifts`. Hoàn thiện ca thường + ca linh hoạt (4 mốc giờ, tổng ≥8h vẫn đủ công), bộ gán ca theo nhóm + chức danh, ca ngoại lệ, lịch lễ theo năm, cấu hình geofence bán kính + dải IP. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/admin/shifts` → 200; `POST /api/v1/admin/shifts/{code}/assign` gán ca cho nhóm → đọc lại phải khớp; `GET /api/v1/admin/holidays` → 200; tạo ca linh hoạt 8–10h / 17–19h rồi `POST /api/v1/attendance/check-in` trong khung với tổng ≥8h → phải tính đủ 1 ngày công; thêm ngày lễ → số ngày làm việc của tháng đó giảm đúng 1. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/admin/shifts`: hiện cả khung giờ linh hoạt và giờ cố định; gán ca theo nhóm/chức danh xong phải hiện trong bảng; thêm ngày lễ hiện trong lịch; cấu hình bán kính geofence + dải IP có chỗ sửa và lưu lại được. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §2.3, mockup S32, code `hkt/frontend/src/modules/attendance/leaves/LeaveTypesPage.tsx`, `LeaveController.java` (`GET/POST/PUT /admin/leave-types`), `LeaveType.java` và rule `leave_type_defaults`/`leave_request`. Hoàn thiện thêm loại nghỉ mới KHÔNG sửa code, 3 tầng kế thừa (mặc định → loại → đơn), đơn nghỉ chỉ 1 bước duyệt quản lý, hiếu hỉ/tang gia/thai sản nam-nữ, hạn nộp theo ngày, snapshot tham số vào request. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `POST /api/v1/admin/leave-types` với loại mới → 200 và `GET /api/v1/leave-types` phải có loại đó (KHÔNG cần sửa code); `PUT /api/v1/admin/leave-types/{code}` đổi tham số → đơn cũ đọc lại vẫn giữ `applied_parameters` cũ; tạo đơn nghỉ → `GET /api/v1/requests/inbox` chỉ có 1 bước duyệt (không phải 2). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/admin/leave-types`: thêm 1 loại mới qua form rồi thấy nó xuất hiện trong danh sách; loại mới phải xuất hiện trong dropdown form xin nghỉ (`/attendance/requests`) mà không cần sửa code; mỗi loại có tham số riêng (hưởng lương, trừ phép năm, đơn vị ngày/nửa ngày, cần giấy tờ, hạn gửi) và sửa được. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### E8 · Quản lý thiết bị 🔴 · S28
**Nghiệm thu:**
- [ ] Duyệt đăng ký mới / thu hồi thiết bị mất
- [ ] **Mặc định 2 thiết bị** — máy thứ 3 mới phải xin HR duyệt (kèm lý do)
- [ ] Mọi thao tác đều vào nhật ký thay đổi
**Phụ thuộc:** B5

**Prompt AI:** Đọc `docs/01-business-shared-core.md` §2, mockup S28, code `hkt/frontend/src/modules/attendance/devices/AdminDevicesPage.tsx`, `BusinessGapController` (`/admin/devices`), `DeviceRegistration.java`. Hoàn thiện duyệt/từ chối yêu cầu máy thứ 3, thu hồi thiết bị mất, hiện hạn mức 2 máy theo người, ghi audit mọi thao tác. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/admin/devices` → 200; `POST /api/v1/admin/devices/{id}/approve` → 200 và `GET /api/v1/devices` của chủ thiết bị thấy máy đó; `POST /api/v1/admin/devices/{id}/revoke` → sau đó `POST /api/v1/attendance/check-in` trên máy đó bị chặn (DEVICE_NOT_APPROVED); `GET /api/v1/admin/audit-logs` phải có dòng cho cả duyệt và thu hồi. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/admin/devices`: duyệt 1 yêu cầu → trạng thái đổi và hạn mức máy cập nhật; thu hồi 1 máy → nhân viên không chấm công được trên máy đó; mọi thao tác phải xuất hiện trong nhật ký thay đổi. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S45, code `hkt/frontend/src/modules/attendance/timesheet/DisputesPage.tsx` và `BusinessGapController` (`/disputes`). Hoàn thiện danh sách khiếu nại đang mở + đếm ngược hạn từng dòng, xử lý nhanh inline (sửa ô · tạo đơn bổ sung · từ chối kèm lý do), click mở chi tiết S33, quá hạn 2 ngày tự đóng, chặn "Chốt & khoá" khi còn khiếu nại. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/disputes` → 200 + danh sách đang mở kèm hạn; resolve từ chối không kèm lý do → 400; resolve thành công → đơn biến khỏi danh sách đang mở và `GET /api/v1/notifications` của nhân viên có thông báo. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/disputes`: mỗi dòng có đếm ngược hạn; xử lý inline 3 cách (sửa ô · tạo đơn bổng công · từ chối kèm lý do) đều hoạt động ngay trên dòng; bấm dòng → mở `/attendance/disputes/:id`; quá hạn 2 ngày thì dòng tự đóng; còn khiếu nại chưa xử lý → nút 'Chốt & khoá' bị chặn kèm lý do. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### E10 · Bảng phép tất cả mọi người 🔴 · S46
**Nghiệm thu:**
- [ ] Bảng **1 dòng = 1 người**: phép năm còn · phép tồn 2025 · phép ốm đã dùng · thâm niên · tổng đã dùng
- [ ] Lọc theo **nhóm** / **sắp hết phép** / **đã hết phép**
- [ ] Click vào 1 người → mở **sổ phép chi tiết** của người đó (D5)
- [ ] Số ở chân bảng = tổng của **những dòng đang lọc**
- [ ] Người sắp hết phép được **đánh dấu riêng**, không phải tìm trong bảng
**Phụ thuộc:** D5

**Prompt AI:** Đọc `docs/02-business-attendance-time-tracking.md` §5.3, mockup S46, code `hkt/frontend/src/modules/attendance/leaves/LeaveTablePage.tsx` và `LeaveController` (`/leaves/table`). Hoàn thiện bảng 1 dòng/người (phép năm còn, tồn 2025, ốm đã dùng, thâm niên, tổng đã dùng), lọc nhóm/sắp hết/hết, footer tổng theo ĐÚNG các dòng đang lọc, click mở sổ phép D5, đánh dấu người sắp hết. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/leaves/table` → 200; đối chiếu số dư mỗi người trong bảng với `GET /api/v1/leaves/ledger/by-code/{code}` (ít nhất 3 người); tổng 'đã dùng' phải bằng tổng các cột. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/attendance/leave-table`: 1 dòng = 1 người; lọc nhóm → số dòng và footer tổng thay đổi đúng (footer = tổng các dòng ĐANG LỌC, không phải tổng tất cả); người sắp hết phép được đánh dấu riêng; click 1 người → mở sổ phép D5 đúng người đó. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §2, mockup S20, code `hkt/frontend/src/modules/okr/dashboard/OKRDashboardPage.tsx` và `BusinessGapController` (`/okr/dashboard`). Hoàn thiện việc cần làm với OKR, điểm 2 nhóm + TB, card 20% mục tiêu công ty (không tính vào TB), card Self proposal năm sau + trạng thái, phase hiện tại + đếm ngược, nút Check-in nổi bật. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/okr/dashboard` và `GET /api/v1/okr/my-dashboard` → 200; điểm TB phải bằng trung bình CHỈ 2 nhóm Business/People — kiểm bằng script cộng lại, KHÔNG tính 20% công ty; nếu response có mục công ty thì phải tách riêng khỏi phần tính TB. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/okr/dashboard`: phần việc cần làm hiện đúng số việc từ API; điểm 2 nhóm + TB khớp số API; card 20% công ty có nhãn riêng và KHÔNG cộng vào TB; card self proposal hiện trạng thái + nút xem; phase + đếm ngược hạn hiện đúng. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §3 + `docs/04-business-convenience-features.md` §C14, mockup S21, code `hkt/frontend/src/modules/okr/my-okr/MyOKRPage.tsx` và API OKR. Hoàn thiện 2 nhóm cố định Business/People, tự nhập đầu việc, gợi ý kế thừa từ OKR quản lý (bấm 1 chạm chép), không đính kèm ở bước tạo, gửi → khoá sửa, xoá mục bắt buộc lý do + vẫn lưu lịch sử, có Box 4 self proposal. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `POST /api/v1/okr/objectives` tạo 2 nhóm → 200; `POST /api/v1/okr/submit-setup` → sau đó sửa lại phải bị từ chối (khoá sửa); xoá 1 mục không kèm lý do → 400; có lý do → 200 và mục vẫn còn trong lịch sử; `GET /api/v1/okr/manager-objectives` → danh sách gợi ý kế thừa. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/okr/my-okr`: đúng 2 nhóm Business/People; KHÔNG có ô đính kèm ở bước tạo; bấm gợi ý của manager → nội dung được chép sang (bấm 1 chạm); gửi → mọi ô chuyển sang read-only; xoá 1 mục → modal bắt buộc nhập lý do; có Box 4 self proposal. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### F3 · Check-in tiến độ 🔴 · S22
**Nghiệm thu:**
- [ ] Check-in **hàng tháng** theo từng đầu việc: **chỉ nhập giá trị mới** — không có cột tiến độ / mức độ tin cậy (tiến độ tự tính)
- [ ] **Prefill giá trị lần trước**
- [ ] Có mốc hạn, tự nhắc trước hạn
- [ ] **Đính kèm file làm evidence** — ảnh chụp kết quả, báo cáo, tài liệu liên quan
- [ ] Ở giai đoạn **review giữa kỳ** → nhân viên được sửa bổ sung OKR rồi nộp lại; nộp xong **khoá sửa lại**
**Phụ thuộc:** F2

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §4, mockup S22, code `MyOKRPage.tsx` (phần check-in) và `BusinessGapController` (`/okr/check-ins`). Hoàn thiện check-in hàng tháng CHỈ nhập giá trị mới (không cột tiến độ/độ tin cậy; tiến độ tự tính), prefill giá trị kỳ trước, hạn + nhắc trước hạn, đính kèm evidence, giai đoạn giữa kỳ cho sửa rồi nộp và khoá lại. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/okr/check-in/current` → 200 và trả về giá trị kỳ trước để prefill; `POST /api/v1/okr/check-in/submit` nhận giá trị mới → 200; tiến độ phải TỰ TÍNH từ giá trị (đổi giá trị → tiến độ đổi đúng công thức; response KHÔNG có trường tiến độ nhập tay). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/okr/my-okr` phần check-in: ô nhập CHỈ có giá trị (không cột tiến độ / mức độ tin cậy); giá trị kỳ trước được prefill sẵn; có chỗ đính kèm evidence và hiện file vừa chọn; gửi xong → khóa, không sửa được tới khi được mở ở review giữa kỳ. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### F4 · Duyệt OKR đầu năm 🔴 · S42
**Nghiệm thu:**
- [ ] Quản lý duyệt hoặc trả lại **2 nhóm**
- [ ] Trả lại → có góp ý, nhân viên thấy và sửa
- [ ] Nút **"Mở cho nhân viên sửa"** → nhân viên sửa bổ sung được trong lúc quản lý đang review
- [ ] Hiện **2 nhóm Business/People cạnh nhau** kèm đầu việc
- [ ] Chỉ thấy objective **trong phạm vi quản lý**; Duyệt/Trả lại bắt buộc góp ý
**Phụ thuộc:** F2

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §5, mockup S42, code `hkt/frontend/src/modules/okr/reports/OKRApprovalsPage.tsx` và `BusinessGapController` (`/okr/objectives/{id}/approve`). Hoàn thiện duyệt/trả lại 2 nhóm, trả lại bắt buộc góp ý, nút "Mở cho nhân viên sửa", chỉ thấy objective cấp dưới, hiện 2 nhóm cạnh nhau. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `PUT /api/v1/okr/reviews/{id}/approve-setup` trả lại không kèm góp ý → 400; duyệt → 200 và trạng thái đổi; `GET /api/v1/okr/manager-objectives` của manager A không được chứa objective của manager B. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/okr/team-approvals`: 2 nhóm Business/People hiện cạnh nhau; duyệt và trả lại đều hoạt động; trả lại mà bỏ trống góp ý → nút disable; bấm 'Mở cho nhân viên sửa' → NV sửa được, nộp lại thì lại khoá. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §5, mockup S43, code `hkt/frontend/src/modules/okr/assessment/MidYearReviewPage.tsx` và `BusinessGapController` (`/okr/mid-year-reviews`). Hoàn thiện nhận xét/coaching từng người, tiến độ check-in theo 2 nhóm + lịch sử, điều chỉnh mục tiêu bắt buộc lý do + audit, mở cho NV sửa bổ sung, hiện chênh lệch điểm tự chấm dự kiến vs thực tế. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/okr/mid-year-reviews` → 200; `POST /api/v1/okr/midyear-reviews` không kèm lý do khi điều chỉnh mục tiêu → 400; có lý do → 200 và `GET /api/v1/admin/audit-logs` có dòng (ai, lúc nào, thay đổi gì). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/okr/mid-year-review`: xem tiến độ theo 2 nhóm + lịch sử; có chỗ nhận xét riêng từng người (coaching); điều chỉnh mục tiêu bắt buộc nhập lý do; mở cho NV sửa → NV sửa được, nộp lại thì khoá; hiện chênh lệch điểm tự chấm dự kiến vs tiến độ thực tế. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### F6 · Đánh giá cuối năm 🔴 · S23
**Nghiệm thu:**
- [ ] Form **4 box** (kết quả · điều chỉnh · khó khăn · bài học)
- [ ] **Chấm 1–5 mỗi nhóm**; **điểm TB tự tính** — không có ô nhập tay
- [ ] Lưu **cả điểm tự chấm và điểm quản lý** để đối chiếu
**Phụ thuộc:** F3, F4

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §5, mockup S23, code `hkt/frontend/src/modules/okr/assessment/OKRAssessmentPage.tsx` và `BusinessGapController` (`/okr/reviews/{id}/self-assessment`). Hoàn thiện form 4 box (kết quả · điều chỉnh · khó khăn · bài học), chấm 1–5 mỗi nhóm, điểm TB TỰ TÍNH (không ô nhập tay), lưu cả điểm tự chấm và điểm quản lý, KHÔNG xếp loại A/B/C/D. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/okr/reviews/form-4box` → 200 với đúng 4 box; `POST /api/v1/okr/reviews/submit-self-review` với điểm 2 nhóm → 200 và lưu điểm tự chấm; `POST /api/v1/okr/reviews/{id}/manager-assess` → lưu điểm quản lý; đọc lại phải thấy HAI bộ điểm (tự chấm ≠ quản lý); điểm TB tính được bằng script từ 2 nhóm. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/okr/assessment`: đúng 4 box (kết quả · điều chỉnh · khó khăn · bài học); mỗi nhóm có thang 1–5; KHÔNG có ô 'điểm TB' nhập tay — phải tự tính hiện; KHÔNG có lựa chọn loại A/B/C/D; sau khi quản lý chấm, điểm quản lý hiện cạnh điểm tự chấm để đối chiếu. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### F7 · Review OKR cả nhóm 🟡 · S24
**Nghiệm thu:**
- [ ] **1 bảng** thay vì mở từng objective
- [ ] Có **cột điểm đề xuất** theo rule
- [ ] **Cảnh báo rule** trên dòng: tiến độ đứng yên ≥ 3 kỳ · lệch điểm tự chấm vs đề xuất > 0.2
- [ ] **Sắp xếp theo rủi ro** — việc cần xem trước lên trên
- [ ] Lọc **chưa đánh giá / có cảnh báo / theo nhóm**
- [ ] **Chấm hàng loạt** nhiều objective đã chọn; click 1 dòng → mở form đánh giá đầy đủ
**Phụ thuộc:** F3

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C8, mockup S24, code `hkt/frontend/src/modules/okr/reports/TeamReviewPage.tsx` và `BusinessGapController` (`/okr/team-review`). Hoàn thiện 1 bảng cho cả nhóm, cột điểm đề xuất theo rule, cảnh báo (tiến độ đứng yên ≥3 kỳ, lệch tự chấm >0.2), sắp xếp theo rủi ro, lọc chưa đánh giá/có cảnh báo/nhóm, chấm hàng loạt, click dòng mở form đầy đủ. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/okr/team-review` → 200; cột điểm đề xuất phải TÍNH được bằng script từ dữ liệu thô (đối chiếu với giá trị trả về); dòng có cảnh báo phải đúng điều kiện rule (đứng yên ≥3 kỳ, lệch tự chấm vs đề xuất >0.2). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/okr/team-review`: đúng 1 bảng; hàng có cảnh báo được đánh dấu; thứ tự mặc định là theo rủi ro (đối chiếu bằng script); lọc 'chưa đánh giá / có cảnh báo / theo nhóm' lọc đúng; tick nhiều dòng rồi chấm hàng loạt → điểm được ghi cho tất cả; click 1 dòng → mở form đánh giá đầy đủ. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §6, mockup S25, code `hkt/frontend/src/modules/okr/reports/OKRReportsPage.tsx` và API báo cáo OKR. Hoàn thiện bảng 9 trường + thời gian công tác tự tính, cột Trạng thái (đã chấm/chờ QL/chưa tự đánh giá), tóm tắt báo cáo từ số liệu, export Excel, 4 widget, HR chốt & khoá chu kỳ, danh sách OKR rủi ro theo rule. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/okr/admin/hr-summary-report` → 200 + đủ 9 trường; thời gian công tác phải TỰ TÍNH từ dữ liệu (kiểm bằng script cộng lại, không có trường nhập tay); `GET /api/v1/okr/admin/export-excel` → file Excel tải được, mở bằng openpyxl đọc được và có cột Trạng thái. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/okr/summary-report`: bảng đủ 9 trường + cột Trạng thái; 4 widget hiện và số liệu khớp bảng (đối chiếu bằng script); tóm tắt báo cáo nội dung sinh từ số liệu đã tính; export tải được file mở ra được; chốt & khoá chu kỳ → mọi thay đổi bị chặn, tóm tắt có link tới widget nguồn. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### F9 · Quản lý chu kỳ OKR 🔴 · S44
**Nghiệm thu:**
- [ ] **Timeline 5 phase** theo mốc tháng thật
- [ ] HR set hạn chót theo ngày, tự nhắc trước hạn
- [ ] Cấu hình thang điểm (1–5)
- [ ] Sau hạn chót → tự khóa, chỉ HR mở lại được
**Phụ thuộc:** —

**Prompt AI:** Đọc `docs/03-business-okr-performance.md` §5, mockup S44, code `hkt/frontend/src/modules/okr/cycles/OKRCyclesPage.tsx` và `BusinessGapController` (`/okr/cycles`). Hoàn thiện timeline 5 phase theo mốc tháng thật, set hạn chót theo ngày + nhắc trước hạn, cấu hình thang 1–5, auto-lock sau hạn và chỉ HR mở lại. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/okr/cycles` → 200 + đúng 5 phase với mốc tháng thật; đổi ngày hạn → đọc lại phải khớp; thang điểm 1–5 cấu hình được và được dùng đúng ở F6 (chấm biên 1 và 5 ở F6 xem có bị chặn không). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/okr/cycles`: timeline hiện 5 phase với mốc tháng thật; đặt hạn chót theo ngày được và tự nhắc trước hạn; đổi thang điểm → áp dụng ngay ở form đánh giá F6; sau hạn thì form bị khóa và chỉ HR mở lại được. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C1, mockup S02, code `hkt/frontend/src/modules/shared/todo/TodoInboxPage.tsx` và `TodoController.java`. Hoàn thiện todo inbox gom việc CẢ 2 module, phân loại overdue/sắp hạn/hôm nay/lưu ý, mỗi việc 1 nút hành động, hiện số phép còn lại, deep-link tới màn xử lý, empty state có CTA, là trang mặc định sau login. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/todos/my-inbox` → 200; số việc trả về phải BẰNG số việc UI hiện (đối chiếu bằng script, không ước lượng); `POST /api/v1/todos/{id}/complete` → việc biến khỏi nhóm chưa xong. **TEST GIAO DIỆN (bắt buộc):** cần đạt: mở `/` → phải vào thẳng `/todo`; tạo việc từ đơn/OKR/duyệt rồi reload → việc xuất hiện đúng nhóm phân loại (quá hạn / sắp đến hạn / hôm nay / lưu ý); mỗi việc chỉ có 1 nút hành động, bấm → deep-link tới đúng màn; số phép còn lại hiện trên trang; không có việc nào → empty state có CTA, không phải màn trắng. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

### G2 · Command palette 🔴 · S03
**Nghiệm thu:**
- [ ] `Ctrl+K` → tìm **nhân viên / đơn / quy định / cấu hình**
- [ ] Gõ tiếp là ra kết quả, không phải bấm "tìm"
- [ ] Từ kết quả → đi thẳng tới màn hình đích
- [ ] **Lọc theo phạm vi quyền** — manager không thấy kết quả ngoài nhóm mình
- [ ] Tìm **tiếng Việt không dấu** (`phep` → "phép", `dieu` → "đi muộn")
**Phụ thuộc:** A2

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C3, mockup S03, code `hkt/frontend/src/components/layout/CommandPalette.tsx` và `OrgStructureController` (`/search/quick`, `/search/actions`). Hoàn thiện Ctrl+K tìm nhân viên/đơn/quy định/cấu hình, kết quả live khi gõ, điều hướng thẳng, lọc theo phạm vi quyền, tìm tiếng Việt không dấu. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: gọi endpoint search với `q=phep` và `q=dieu` (KHÔNG DẤU) → phải trả kết quả chứa 'phép'/'đi muộn'; manager gọi search không được thấy kết quả ngoài nhóm mình (so 2 response khác vai trò). **TEST GIAO DIỆN (bắt buộc):** cần đạt: bấm Ctrl+K → palette hiện; gõ 'phep' (không dấu) → có kết quả 'phép'; gõ 'dieu' → có 'đi muộn'; kết quả hiện NGAY khi gõ (không cần bấm nút tìm); Enter → điều hướng tới đúng route; Esc → đóng; đăng nhập bằng manager không thấy kết quả ngoài nhóm. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C2, mockup S04/S04m, code `hkt/frontend/src/components/layout/NotificationDropdown.tsx`, `hkt/frontend/src/modules/shared/notifications/MobileNotificationsPage.tsx`, `OrgStructureController` (`/notifications`) và `CronController`. Hoàn thiện 3 kênh (web/email/Web Push), đúng người theo ma trận 17 sự kiện × 3 vai trò, dedupe 12h + quiet hours 21:00–07:00 + tối đa 3 push/ngày, escalate quá hạn >3 ngày, badge khớp Todo; tắt thông báo không làm mất việc. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: tạo 1 sự kiện (vd gửi đơn) → `GET /api/v1/notifications` của người nhận đúng phải có, của người không liên quan phải KHÔNG có; chạy job gửi lại cùng sự kiện trong 12h → không tạo bản ghi trùng (dedupe); số push trong ngày không vượt 3; việc quá hạn >3 ngày phải báo thêm cho quản lý. **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/notifications`: danh sách hiện đúng người nhận; badge trên menu khớp số việc chờ trong `/todo` (đối chiếu bằng script); tắt 1 loại ở G4 → sự kiện loại đó không hiện trong web VÀ vẫn còn trong `/todo`; viewport 390px vẫn dùng được. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.

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

**Prompt AI:** Đọc `docs/04-business-convenience-features.md` §C9, mockup S36, code `hkt/frontend/src/modules/shared/notifications/NotificationPrefsPage.tsx` và `BusinessGapController` (`/notifications/preferences`). Hoàn thiện bật/tắt TẤT CẢ loại thông báo, chọn kênh cho từng loại, đặt quiet hours, chỉ cấu hình phần của chính mình, lưu ngay + hoàn tác 1 click, hiện số việc chờ theo nhóm. **Cách test:** dựng stack `./run-local.sh`; gọi API thật kèm header `Authorization: Bearer <token>` (token lấy từ `POST /api/v1/auth/login` với tài khoản seed trong `db/migration/V3__fix_demo_seed_passwords.sql`); UI dùng Playwright — đăng nhập thật, assert dữ liệu hiện ra khớp API, thu console error + mọi request 4xx/5xx (cả hai phải rỗng) và chụp screenshot làm bằng chứng. **TEST SERVICE (bắt buộc):** cần đạt: `GET /api/v1/notifications/preferences` → 200 trả đúng danh sách loại; lưu prefs đổi 1 loại → đọc lại phải khớp; gọi endpoint lưu prefs với userId của người khác → phải bị từ chối (403/400). **TEST GIAO DIỆN (bắt buộc):** cần đạt: route `/settings/notifications`: mỗi loại có công tắc bật/tắt + chọn kênh (web/email/push); đặt giờ yên lặng được; tắt 1 loại → lưu NGAY không cần bấm 'Lưu' và có nút hoàn tác 1 click; hiện số việc chờ theo nhóm; đăng nhập tài khoản khác không sửa được prefs của người này. **ĐIỀU KIỆN DONE (thiếu 1 là chưa xong):** (1) lệnh curl đã chạy kèm HTTP status + response thật; (2) script Playwright chạy exit 0, in ra các assert đã pass, 0 lỗi console, 0 request 4xx/5xx; (3) MỌI tiêu chí nghiệm thu phía trên đã được tick KÈM bằng chứng test — không tick bằng mắt thấy là chạy được. Nếu có chạy Robot/JUnit thì ghi kết quả vào ticket; lưu ý `tests/robot/` hiện assert theo model cũ (rule key cũ, endpoint đã 404) nên phải sửa theo business hiện tại trước khi tính là xanh.
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
