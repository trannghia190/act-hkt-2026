# ACT-HKT 2026 — TÀI LIỆU QUẢN TRỊ TRẠNG THÁI & NHẬT KÝ THAY ĐỔI DỰ ÁN
*(PROJECT STATUS TRACKER & LIVING CHANGELOG)*

> **Phiên bản tài liệu**: `v2.2.0`  
> **Cập nhật lần cuối**: `18/11/2026`  
> **Hệ thống**: **ACT-HKT 2026 (Worklife & Performance Management System)**  
> **Áp dụng cho**: Toàn bộ dự án gồm Frontend UI, Core Service Backend (Java Spring Boot), AI Face Biometric Service (Python OpenCV), Cơ sở dữ liệu và Cơ sở hạ tầng Docker/Kubernetes.

---

## 1. MỤC ĐÍCH & QUY ƯỚC CẬP NHẬT TÀI LIỆU

### 1.1. Mục Đích
Tài liệu này là **bản ghi sống (Living Document)** duy nhất của dự án để quản lý tập trung và liên tục toàn bộ các thay đổi về mặt:
1. **Business (Nghiệp vụ)**: Luồng quy trình, chính sách nhân sự, phân quyền, tiêu chuẩn đánh giá.
2. **Technical (Kỹ thuật & Kiến trúc)**: Cấu trúc backend, AI models, cơ chế bảo mật, schema CSDL, Docker/K8s.
3. **Features & UI/UX (Tính năng & Giao diện)**: Các màn hình, component, responsive mobile, trạng thái sẵn sàng kiểm thử.

> **QUY TẮC BẮT BUỘC**: Mỗi khi thành viên đội ngũ (Developer, PO, QA) thực hiện bất kỳ cải tiến, sửa lỗi, nâng cấp kiến trúc hoặc thay đổi nghiệp vụ nào, **BẮT BUỘC PHẢI CẬP NHẬT VÀO TÀI LIỆU NÀY** cùng với file theo dõi tiến độ [`ACT_HR_2026_Project_Tracking.xlsx`](../ACT_HR_2026_Project_Tracking.xlsx).

### 1.2. Quy Ước Đánh Số Phiên Bản (Semantic Versioning)
- `vX.0.0` (Major): Thay đổi lớn về kiến trúc hệ thống, thêm/thay thế service mới, chuyển đổi database.
- `vX.Y.0` (Minor): Bổ sung màn hình mới, hoàn thiện nghiệp vụ mới, cập nhật mô hình AI hoặc API mới.
- `vX.Y.Z` (Patch): Sửa lỗi hiển thị UI, tối ưu thuật toán, cập nhật style, fix bug nhỏ.

---

## 2. TỔNG QUAN HIỆN TRẠNG TOÀN DỰ ÁN (SYSTEM STATUS OVERVIEW)

### 2.1. Trạng Thái Các Dịch Vụ Hệ Thống (Containers Status)

| Dịch Vụ (Service) | Công Nghệ | Cổng (Port) | Trạng Thái | Vai Trò & Trách Nhiệm |
| :--- | :--- | :--- | :---: | :--- |
| **Frontend UI** | React 18, Vite, TS, TailwindCSS | `3000` | 🟢 HEALTHY | Giao diện web responsive (không có app/PWA riêng), Sidebar drawer, Bottom Navigation |
| **Core Service** | Java 21, Spring Boot 3.3.4 | `8080` | 🟢 HEALTHY | Chấm công, nghỉ phép, OKR, phân quyền RBAC, tích hợp Gmail SMTP thật |
| **AI Face Service** | Python 3.11, FastAPI, OpenCV | `8000` | 🟢 HEALTHY | Kiểm tra chất lượng ảnh, trích xuất 512D Vector HOG, so khớp 1:N khuôn mặt |
| **PostgreSQL DB** | PostgreSQL 16 + pgvector | `5432` | 🟢 HEALTHY | CSDL quan hệ chính & lưu trữ vector sinh trắc học |
| **Redis Cache** | Redis 7 Alpine | `16379` | 🟢 HEALTHY | Cache phiên làm việc, giới hạn Brute-force đăng nhập 10 phút |


### 2.2. Thống Kê Mức Độ Sẵn Sàng Tính Năng (Feature Readiness)

- **Tổng số tính năng được thiết kế & phân rã chi tiết**: **121 micro-features** (được theo dõi chi tiết tại [`ACT_HR_2026_Project_Tracking.xlsx`](../ACT_HR_2026_Project_Tracking.xlsx)).
- **Sẵn sàng Test & Verify (Ready for Test & Verify)**: **121/121 tính năng (100% đã có API endpoint, UI flow và QA steps độc lập)**.
- **Khóa thiết bị phần hardware Native app**: Chờ tích hợp gói mobile wrapper (React Native / Capacitor)

---

## 3. NHẬT KÝ THAY ĐỔI VỀ MẶT NGHIỆP VỤ (BUSINESS CHANGELOG)

### [2026-11-20] — Bản Cập Nhật v2.3.0 (Đơn từ, đính kèm, bảng công lưu DB)

**Nghiệp vụ & UI**
* WFH: bỏ giới hạn địa điểm + lặp tuần; cả ngày chọn khoảng ngày (1 đơn/ngày làm việc), nửa ngày 0.5 chọn sáng/chiều.
* Đi muộn/về sớm: 1 ngày, chọn đi muộn/về sớm + giờ thực tế; giới hạn phút theo `late_early.max_minutes`.
* Bổ sung chấm công: 1 ngày trong hạn (không ngày tương lai), chọn giờ vào/ra, bỏ ô thời lượng.
* Nghỉ phép nửa ngày = 0.5 + buổi sáng/chiều + khung giờ làm thực tế; `end_date` lưu DB và hiển thị khoảng ngày.
* Duyệt nghỉ phép ghi `leave_ledger` USED (nửa ngày 0.5); nghỉ ốm không trừ phép năm; số dư/sổ phép tính từ ledger, lọc AL/S theo loại.
* Đơn từ hiển thị tên loại nghỉ (Nghỉ ốm) thay mã S/AL; danh sách phân trang server-side, lọc khoảng ngày, cột Ngày tạo, nút Xem chi tiết, Sửa đơn khi chờ duyệt/bị từ chối.
* Đính kèm giấy tờ: nhiều fileảnh/PDF, lưu bytea DB, chặn gửi/duyệt khi thiếu.

**Kỹ thuật**
* Flyway V9–V14: `timesheet_disputes`, `todo_completions`, `request_attachments`, `requests.end_date` (+backfill).
* Bảng công: trạng thái kỳ/ô sửa tay/audit lưu `timesheets`, `timesheet_cells`, `timesheet_audit_logs` (không RAM); khiếu nại lưu DB.
* Quản lý nhân viên/audit log/OKR Form 4 Box/Todo completion đọc-ghi DB.
* API: paging/lọc đơn server-side, `PUT /requests/{id}`, upload/download attachments, `GET /attendance/my-shift`.
* Quota đơn chỉ tính đơn chờ/đã duyệt; không tính nháp, bị từ chối, đã hủy/tự hủy trùng ngày; UI lấy `/requests/my-quota` server-side.
* Thêm tài khoản QA độc lập `137ACT/123456` (cùng nhóm/quản lý/ca với 136ACT, có sổ phép 11 kỳ + log thiếu check-out hôm qua).
* Trùng ngày nghỉ phép/WFH: confirm hủy đơn cũ rồi áp dụng đơn mới (theo ngày+buổi), có audit `AUTO_CANCEL_DUPLICATE`.
* Nghỉ phép & WFH: không giới hạn ngày tương lai (xin cho tháng sau/năm sau).
* WFH: bỏ yêu cầu đăng ký trước 1 ngày; cho phép đăng ký lùi tối đa 3 ngày (cấu hình `wfh.submit_within_days`) và ngày tương lai.
* Phê duyệt đơn: tab Đã duyệt/Bị từ chối đọc lịch sử quyết định từ DB, số đếm cập nhật ngay sau khi duyệt/từ chối.
* Cron phép: cộng tháng đọc cấu hình `leave_accrual`, chạy daily + catch-up các kỳ lỡ khi khởi động; cắt phép tồn chạy daily, ghi `EXPIRED` + audit; chỉ user ACTIVE.
* Auth: JWT gửi qua `X-Auth-Token` để chạy sau ngrok basic auth; CORS localhost + domain tunnel.
* Test: API suite pass; UI kiểm thử bằng Chrome headless CDP; `tsc`/build/consistency pass.

### [2026-11-18] — Bản Cập Nhật v2.2.0 (Chuẩn Hóa Đánh Số 22 Tài Liệu Hệ Thống & Nâng Cấp Tracking Excel Đầy Đủ Expected Behaviour)
- **Chuẩn Hóa Thứ Tự & Đánh Số Tuần Tự 22 Tài Liệu (`docs/`)**:
  - Loại bỏ hoàn toàn sự trùng lặp chỉ số (trước đây có 2 bộ tài liệu cùng mang đầu số 01, 02, 03...).
  - Phân tách rành mạch thành 2 nhóm chuyên biệt:
    - **Nhóm 1: Nghiệp vụ & Đặc tả yêu cầu sản phẩm BA/PO (`01` đến `10`)**: Shared Core, Chấm công, OKR, Tiện ích C1–C18, Data Model, Rule Builder, Mobile Punch, Tasks Checklist, BA/PO Guidelines, Feature Comments.
    - **Nhóm 2: Kiến trúc kỹ thuật & Kỹ thuật triển khai (`11` đến `22`)**: Architecture Overview, Auth & User Management, Attendance & Check-in, Requests Workflow, Leave Balance Accrual, Timesheet Grid 45 Columns, OKR Appraisal, Rule Engine Configuration, Notifications & Todo Inbox, API Spec & DB Schema, Code Conventions, System Changelog.
  - Cập nhật toàn diện liên kết chéo nội bộ trong `docs/README.md` và các tài liệu markdown.
- **Nâng Cấp Toàn Diện File Theo Dõi Tiến Độ [`ACT_HR_2026_Project_Tracking.xlsx`](../ACT_HR_2026_Project_Tracking.xlsx)**:
  - Bổ sung cột mới bắt buộc: **`Expected Behaviour (Cách hệ thống xử lý)`** làm rõ 4 yếu tố cốt lõi:
    - **Input**: Dữ liệu đầu vào, tham số query, form body JSON, token phạm vi, tọa độ GPS, ảnh sinh trắc học.
    - **Xử lý hệ thống & Lưu trữ**: Các bảng CSDL được insert/update, các cột trạng thái, thuật toán tính toán, quy tắc xác thực, cơ chế caching Redis, gửi email qua Gmail SMTP và ghi nhật ký kiểm toán.
    - **Output**: HTTP status code, payload JSON trả lời, thông báo giao diện (Toast, Banner), điều hướng màn hình.
    - **Kết quả cuối cùng**: Trạng thái thực tế đạt được của hệ thống và người dùng.
  - Phân rã sâu thành **121 micro-features** độc lập trải dài trên 3 Tab chuyên biệt (54 tính năng Nền tảng dùng chung, 41 tính năng Chấm công & Đơn từ, 26 tính năng Quản trị OKR).

### [2026-11-18] — Bản Cập Nhật v2.1.2 (Chuẩn Hóa Danh Mục Menu, Phân Quyền & Điều Hướng Mượt Mà)
- **Triệt Tiêu Trùng Lặp Menu Giữa Các Phân Hệ**:
  - Không còn hiện tượng các menu quản trị tổ chức, nhân sự, quy định bị lặp lại ở cả Chấm công và Hệ thống.
  - Mỗi phân hệ độc lập hoàn toàn về mặt ngữ cảnh:
    - **Chấm Công**: 10 mục (Chấm công, Lịch công, Bảng công của tôi, Đơn từ, Số dư phép, Duyệt đơn, Lịch nhóm, Bảng công 53 cột, Sổ cái phép).
    - **OKR**: 8 mục (Dashboard, Thiết lập/Check-in, Đánh giá 4 Box, Duyệt OKR nhóm, Review giữa năm, Team Board, báo cáo điểm, Bảng tổng hợp HR).
    - **Hệ Thống**: 8 mục (Quản lý nhân viên/tài khoản, Sơ đồ tổ chức/nhóm lồng nhau, Ca trực & nghỉ lễ, Đăng ký khuôn mặt 3 góc, Rule Engine 19 quy định, Tra cứu nội quy, Nhật ký audit).
- **Phân Quyền Hiển Thị Menu Động (Role-Based Dynamic Menu)**:
  - Menu tự động lọc theo quyền của người dùng đăng nhập (`ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`).
  - Nhân viên thông thường chỉ thấy các chức năng thuộc về cá nhân mình. Khi dùng role switcher trên Header chuyển sang Manager/HR/Admin, danh mục mở rộng tự động theo đúng quyền hạn mà không cần tải lại trang.
- **Tách Biệt Các Màn Hình Chuyên Biệt Mới**:
  - **S14 - Lịch trực quan nhóm**: Ma trận lịch làm việc tại văn phòng/WFH/phép của cả đội ngũ.
  - **S11 - Bảng công của tôi**: Theo dõi chi tiết từng ngày công, OT 150%, quota đi muộn cá nhân.
  - **S34 - Sổ cái biến động phép toàn công ty**: Màn hình quản trị cho HR Admin điều chỉnh và tra cứu biến động ngày phép của toàn bộ nhân viên.
  - **S42 - Duyệt mục tiêu OKR nhóm**: Phê duyệt bộ mục tiêu OKR 2 nhóm Business/People (không trọng số KR).
  - **S43 - Review & Coaching giữa năm**: Ghi nhận biên bản 1-on-1 coaching giữa năm.

### [2026-11-18] — Bản Cập Nhật v2.1.1 (Tinh Gọn Điều Hướng Mặc Định)
- **Loại Bỏ Màn Hình Home & Đặt Todo Inbox Là Trung Tâm**: Theo yêu cầu tối ưu hóa tốc độ làm việc cho nhân viên, hệ thống đã loại bỏ màn hình Home. Đường dẫn gốc `/` chuyển hướng trực tiếp đến màn hình trung tâm **`S02 - Cần Làm (Todo Inbox)`** (`/todo`).
- **Thanh Bottom Nav Trên Mobile**: Nút điều hướng đầu tiên được chuyển thành **`Cần Làm`** (`/todo`), giúp nhân viên khi mở app là thấy ngay các công việc và đơn từ cần xử lý.
- **Logo & Header Brand Link**: Bấm vào Logo thương hiệu ACT-HKT ở Header và Sidebar điều hướng trực tiếp về `/todo`.

### [2026-11-18] — Bản Nâng Cấp v2.1.0
- **Rebranding Tên Hệ Thống**: Chính thức đổi tên thương hiệu hệ thống từ `ACT PULSE` thành **`ACT-HKT 2026`** (Worklife & Performance Management).
- **Quy Trình Chống Chấm Công Hộ (Anti-Proxy Punch Business Rule)**:
  - Hệ thống áp dụng quy tắc so khớp sinh trắc học bắt buộc: Khi gửi yêu cầu check-in/check-out, AI Face Service sẽ nhận diện độc lập 1:N người đang đứng trước camera. Nếu kết quả trả về không trùng với mã nhân viên của tài khoản đăng nhập &rarr; Lập tức chặn đứng (`PROXY_PUNCH_BLOCKED`), từ chối tính công và ghi nhật ký gian lận vào Audit Trail.
- **Tiêu Chuẩn Đánh Giá Chất Lượng Ảnh Khuôn Mặt**:
  - Không cho phép chấm công với ảnh quá tối (< 20/255) hoặc ảnh bị mờ rung lắc (Laplacian variance < 15). Hệ thống bắt buộc nhân viên phải căn chỉnh lại ánh sáng và đưa mặt vào giữa khung tròn.
- **Tái Cấu Trúc Menu Quản Trị Tổ Chức & Nhân Sự**:
  - Bỏ nút icon ẩn `⚙️`, thay bằng 3 Tab phân hệ to rõ: **Chấm Công — OKR — Hệ Thống**.
  - Nhóm **Quản Lý Nhân Viên & Sơ Đồ Tổ Chức** được đưa trực tiếp vào cả phân hệ Chấm Công và Hệ Thống để người dùng tiếp cận trong 1 thao tác.

### [2026-11-17] — Bản v2.0.0
- **Onboarding Nhân Viên Mới**:
  - **Màn hình S01-A**: Bắt buộc đổi mật khẩu lần đầu với tài khoản mới hoặc vừa được reset pass.
  - **Màn hình S01-B**: Wizard hướng dẫn thu thập mẫu khuôn mặt 3 góc (Chính diện 0°, Nghiêng trái -30°, Nghiêng phải +30°).
- **Gửi Email Thật Qua Gmail Doanh Nghiệp**:
  - Bỏ hoàn toàn hệ thống Mailpit giả lập. Kết nối trực tiếp máy chủ `smtp.gmail.com:587` gửi thông báo thật đến hộp thư Gmail của nhân viên khi tạo tài khoản, reset mật khẩu, và khi quản lý phê duyệt/từ chối đơn.

---

## 4. NHẬT KÝ THAY ĐỔI VỀ MẶT KỸ THUẬT & KIẾN TRÚC (TECHNICAL CHANGELOG)

### [2026-11-18] — Technical Updates v2.1.2 (Kiến Trúc Điều Hướng & Chuẩn Hóa Phân Quyền)
1. **Kiến Trúc Điều Hướng Liền Mạch (Seamless Tab & Route Synchronization)**:
   - Trong `Sidebar.tsx`: Handler `handleTabChange` chuyển hướng `useNavigate` ngay lập tức đến landing page của phân hệ tương ứng (`/attendance/checkin`, `/okr/dashboard`, `/admin/employees`), triệt tiêu hiện tượng lệch pha giữa menu hiển thị và nội dung màn hình.
   - Bổ sung `useEffect` bắt trọn các đường dẫn con `/admin/*`, `/auth/*`, `/okr/*`, `/attendance/*`, `/todo` đảm bảo Tab phân hệ trên Sidebar luôn khớp 100% với URL trình duyệt mà không gây flicker giật màn hình.
2. **Bộ Lọc Phân Quyền Động (Dynamic Role-based Group Filtering)**:
   - Sidebar tự động duyệt mảng cấu hình `sidebar.config.ts`, kiểm tra `item.roles` với vai trò của người dùng hiện tại (`user.role`).
   - Tự động ẩn các nhóm rỗng nếu người dùng không có quyền truy cập bất kỳ mục nào trong nhóm đó (ví dụ nhóm Quản trị kỳ công & Quản lý nhóm đối với nhân viên `EMPLOYEE`).
3. **Phát Triển 5 Màn Hình Chuyên Biệt Mới**:
   - `TeamSchedulePage.tsx` (S14): Quản lý ma trận phân bổ nhân sự tuần/tháng.
   - `MyTimesheetPage.tsx` (S11): Bảng tổng hợp công, OT, quota đi muộn cá nhân.
   - `AdminLeaveLedgerPage.tsx` (S34): Sổ cái biến động phép toàn doanh nghiệp với tính năng điều chỉnh số dư phép.
   - `OKRApprovalsPage.tsx` (S42): Màn hình phê duyệt mục tiêu OKR 2 nhóm, không trọng số.
   - `MidYearReviewPage.tsx` (S43): Biên bản đối thoại và coaching giữa năm.
4. **Nâng Cấp Command Palette (Ctrl+K)**:
   - Cập nhật 22 action phím tắt toàn hệ thống, trỏ chính xác về các canonical routes chuẩn hóa.

### [2026-11-18] — Technical Updates v2.1.0
1. **Thiết Kế Responsive Mobile-First Toàn Diện (Frontend)**:
   - **Thanh Điều Hướng Đáy Màn Hình (`MobileBottomNav.tsx`)**: Cố định phía dưới màn hình trên mobile (< 1024px) gồm 5 phím tắt 1 chạm (Trang Chủ, Chấm Công Mobile, Đơn Từ, OKR, Menu Đầy Đủ). Nút Chấm công ở vị trí trung tâm nổi bật với gradient ngọc lục bảo.
   - **Ngăn Kéo Slide-Over Drawer (`Sidebar.tsx`)**: Trên mobile/tablet, Sidebar ẩn đi và trượt mượt mà từ bên trái ra kèm lớp nền làm mờ (backdrop blur) khi bấm nút menu ☰. Tự động đóng khi người dùng chọn menu hoặc chạm ra ngoài.
   - **Logo Thương Hiệu Riêng (`ActHktLogo.tsx`)**: Vector SVG hình khiên công nghệ kết hợp sóng xung sinh trắc học và hiệu ứng gradient ngọc lục bảo.
2. **Nâng Cấp Module Nhận Diện Khuôn Mặt Thực Tế (OpenCV + 512D Spatial HOG)**:
   - Thay thế hoàn toàn mã mock trước đây trong `hkt/backend/ai-face-service/app/main.py`.
   - **Quality Checker**: Đo độ nét bằng toán tử đạo hàm bậc hai Laplace `cv2.Laplacian` và độ sáng trung bình kênh xám `gray.mean()`.
   - **Face Detector**: Sử dụng bộ phân loại đa tầng `cv2.CascadeClassifier` tìm kiếm khuôn mặt.
   - **Feature Extractor**: Cắt ROI mặt, chuẩn hóa 128x128 px, cân bằng sáng lược đồ `cv2.equalizeHist`. Trích xuất 64 khối spatial x 8 góc định hướng gradients = vector 512 chiều chuẩn hóa $L_2$.
   - **Biometric Search**: Tính khoảng cách Cosine Similarity 1:N với toàn bộ nhân viên lưu trong CSDL `/app/data/face_db.json`.
3. **Core Service So Khớp Hai Chiều Chống Gian Lận (`AttendanceServiceImpl.java`)**:
   - Gọi REST API nội bộ `http://pulse-ai-face-service:8000/api/v1/face/verify-json`.
   - Thực hiện kiểm tra so khớp `matchedEmployeeCode` với `requesterCode`. Nếu không trùng, trả về mã trạng thái `PROXY_PUNCH_BLOCKED`.
   - Bổ sung `@PrePersist` và `@PreUpdate` trong `BaseEntity.java` đảm bảo trường `createdAt` không bao giờ bị null khi Hibernate persist.

---

## 5. BẢNG THEO DÕI TÍNH NĂNG & TIẾN ĐỘ CHI TIẾT (FEATURE MATRIX)

### 5.1. Phân Hệ 1: Nền Tảng Dùng Chung (18/18 Tính Năng — 100% Sẵn Sàng)

| STT | Mã Màn Hình | Tên Tính Năng | Trạng Thái | Hướng Dẫn Test Nhanh |
| :-: | :--- | :--- | :-: | :--- |
| 1 | `[S01]` | Đăng nhập tài khoản nội bộ & Khóa brute-force 10 phút | 🟢 Ready for Test | Đăng nhập `Admin/Admin` hoặc thử nhập sai 5 lần |
| 2 | `[S01-A]` | Bắt buộc đổi mật khẩu lần đầu (Force Password Change) | 🟢 Ready for Test | Popup tự động bật khi tài khoản có cờ `mustChangePassword` |
| 3 | `[S01-B]` | Đăng ký mẫu khuôn mặt 3 góc (Face Enrollment Wizard) | 🟢 Ready for Test | Truy cập `/auth/enroll-face`, chụp 3 góc mặt webcam |
| 4 | `[S40.1]` | HR tạo nhân viên đơn lẻ & gửi email kích hoạt Gmail | 🟢 Ready for Test | Vào `/admin/employees`, bấm `+ Thêm nhân viên`, nhập Gmail thật |
| 5 | `[S40.2]` | HR Batch Import danh sách nhân viên từ Excel | 🟢 Ready for Test | Nút tải file mẫu và nhập file Excel tại `/admin/employees` |
| 6 | `[S40.3]` | HR Reset mật khẩu & gửi lại OTP qua Gmail | 🟢 Ready for Test | Bấm nút `Đặt lại mật khẩu` trên từng dòng nhân viên |
| 7 | `[S00]` | Thanh điều hướng Shell & Phân tách 3 phân hệ | 🟢 Ready for Test | Trải nghiệm 3 tab Chấm Công - OKR - Hệ Thống trên Sidebar |
| 8 | `[S02]` | Màn hình trung tâm Todo Inbox (3 mức ưu tiên) | 🟢 Ready for Test | Vào `/todo`, xem danh sách P0, P1, P2 |
| 9 | `[S03]` | Thanh tìm kiếm toàn năng Command Palette (Ctrl+K) | 🟢 Ready for Test | Bấm `Ctrl+K` hoặc nút tìm kiếm trên Header |
| 10 | `[S04/S04m]` | Trung tâm thông báo đa kênh & Gộp chống spam | 🟢 Ready for Test | Bấm biểu tượng thông báo và xem toast popup |
| 12 | `[S16/S17]` | Trình cấu hình 19 quy định bằng Form (Rule Builder) | 🟢 Ready for Test | Vào `/attendance/rules`, chỉnh sửa tham số quy định |
| 13 | `[S17]` | Lịch sử phiên bản quy định & Hoàn tác 1-chạm | 🟢 Ready for Test | Xem lịch sử phiên bản ngay trong màn cấu hình và bấm `Hoàn tác` |
| 15 | `[S19]` | Trang tra cứu nội quy tự động cho nhân viên | 🟢 Ready for Test | Vào `/attendance/policy-doc` |
| 16 | `[S41]` | Cây sơ đồ tổ chức & Quản lý phân cấp nhóm | 🟢 Ready for Test | Vào `/admin/org-tree`, thêm/sửa/xóa nhóm lồng nhau |
| 17 | `[S26]` | Quản lý ca làm việc & Lịch nghỉ lễ theo năm | 🟢 Ready for Test | Vào `/admin/shifts`, thêm ca làm & ngày lễ |
| 18 | `[S35]` | Nhật ký thay đổi tập trung & Kiểm toán hệ thống | 🟢 Ready for Test | Vào `/admin/audit-logs`, lọc theo loại hành động, xuất CSV |

---

### 5.2. Phân Hệ 2: Chấm Công & Đơn Từ (27/30 Tính Năng — 90% Sẵn Sàng)

| STT | Mã Màn Hình | Tên Tính Năng | Trạng Thái | Ghi Chú Kỹ Thuật |
| :-: | :--- | :--- | :-: | :--- |
| 1 | `[S05m.1]` | Giao diện chấm công 1 chạm siêu tốc (< 4s) | 🟢 Ready for Test | Hoạt động tại `/attendance/checkin` |
| 2 | `[S05m.2]` | Xác thực khuôn mặt AI 512D & Anti-Spoofing | 🟢 Ready for Test | Tích hợp OpenCV thực tế |
| 3 | `[S05m.3]` | Kiểm tra WiFi BSSID nội bộ & Gắn cờ cảnh báo | 🟢 Ready for Test | So khớp router `ACT_OFFICE_5G` |
| 4 | `[S05m.4]` | Định vị Geofencing 2 vùng (Xanh 150m & Vàng 300m) | 🟢 Ready for Test | Vùng xanh hợp lệ, vàng giải trình, đỏ từ chối |
| 5 | `[S05m.5]` | Ghi nhận chuẩn thời gian máy chủ NTP (Server Timestamp) | 🟢 Ready for Test | Chống tua giờ trên thiết bị |
| 6 | `[S27/S28]` | Khóa thiết bị phần cứng (Device Binding 1-1) | 🟡 In Progress | Đã mô phỏng trên Web; Cần Mobile SDK cho App Native |
| 7 | `[S05m.6]` | Chấm công ngoại tuyến (Offline Mode) & Đồng bộ 24h | 🟡 In Progress | LocalStorage queue sẵn sàng; Cần SQLite Background Sync |
| 8 | `[S06]` | Lịch công tháng cá nhân (Monthly Calendar) | 🟢 Ready for Test | Lưới trực quan tại `/attendance/calendar` |
| 9 | `[S07]` | Tạo đơn đi muộn / về sớm (Auto-fill log công) | 🟢 Ready for Test | Tạo đơn tại `/attendance/requests` |
| 10 | `[S31]` | Tạo đơn bổ sung chấm công (Hạn 3 ngày làm việc) | 🟢 Ready for Test | Kiểm tra chặn quá hạn 3 ngày |
| 11 | `[S30.1]` | Tạo đơn xin nghỉ phép (Kiểm tra số dư khả dụng) | 🟢 Ready for Test | Trừ phép động, cảnh báo âm phép |
| 12 | `[S30.2]` | Tạo đơn nghỉ ốm (Bắt buộc đính kèm giấy khám) | 🟢 Ready for Test | Validation đính kèm chứng từ y tế |
| 13 | `[S10]` | Tạo đơn làm việc từ xa WFH (Max 2 ngày/tuần) | 🟢 Ready for Test | Chặn không cho chọn quá 2 ngày WFH/tuần |
| 14 | `[S08]` | Cơ chế Lưu nháp vs Gửi đơn & Rút đơn (Withdraw) | 🟢 Ready for Test | Nút Hủy/Rút đơn khi đang ở trạng thái chờ duyệt |
| 15 | `[S12.1]` | Hộp thư duyệt của quản lý & Chip điều kiện thông minh | 🟢 Ready for Test | Màn hình `/attendance/approvals` |
| 16 | `[S12.2]` | Tính năng duyệt đơn hàng loạt (Bulk Approval) | 🟢 Ready for Test | Chọn checkbox và bấm Duyệt hàng loạt |
| 17 | `[S12.3]` | Từ chối đơn bắt buộc nhập lý do & Bắn email | 🟢 Ready for Test | Popup bắt buộc lý do & gửi Gmail nhân viên |
| 18 | `[S12.4]` | Ma trận duyệt động theo nhóm (1 cấp vs 2 cấp) | 🟢 Ready for Test | Nhóm Mobile/CA duyệt 2 cấp (Lead &rarr; HR) |
| 19 | `[S12.5]` | Tự động chuyển cấp duyệt quá hạn (Auto-Escalation SLA) | 🟡 In Progress | Cần cấu hình Cron Daemon K8s định kỳ 1h |
| 20 | `[S14]` | Lịch trực quan nhóm (Team Absence & WFH Calendar) | 🟢 Ready for Test | Tab Lịch nhóm tại `/attendance/team-schedule` |
| 21 | `[S09.1]` | Tự động cộng phép định kỳ & Phép thâm niên | 🟢 Ready for Test | Bảng số dư tại `/attendance/leaves` |
| 22 | `[S09.2]` | Cơ chế ứng trước phép năm (Leave Advance Max 3 ngày) | 🟢 Ready for Test | Cho phép số dư khả dụng âm đến -3 |
| 23 | `[S09.3]` | Luật dọn phép tồn (Mốc 01/04 & 01/07) & Cảnh báo | 🟢 Ready for Test | Hiển thị hạn dùng phép tồn năm cũ |
| 24 | `[S34]` | Sổ cái biến động phép (Leave Ledger Audit Trail) | 🟢 Ready for Test | Tab Sổ cái phép tại `/attendance/leave-ledger` |
| 25 | `[S15.1]` | Lưới bảng chấm công 53 cột chuẩn mẫu Excel ACT | 🟢 Ready for Test | Màn hình `/attendance/timesheet` |
| 26 | `[S15.2]` | Sửa trực tiếp trên ô (In-Place Edit) & Bắt buộc Audit | 🟢 Ready for Test | Click đúp chuột vào ô bảng công để sửa |
| 27 | `[S15.3]` | Bộ máy tính tự động 17 cột chỉ số tổng hợp | 🟢 Ready for Test | Tự động cộng giờ công, làm thêm, phạt muộn |
| 28 | `[S11/S33]`| Quy trình nhân viên khiếu nại bảng công (Hạn 2 ngày) | 🟢 Ready for Test | Nút khiếu nại tại `/attendance/my-timesheet` |
| 29 | `[S15.4]` | Khóa bảng công (Lock Timesheet) & Xử lý đơn trễ | 🟢 Ready for Test | Nút Khóa bảng công dành cho HR Lead |
| 30 | `[S15.5]` | Xuất file Excel chuẩn 53 cột tương thích phần mềm lương | 🟢 Ready for Test | Xuất file Excel/CSV UTF-8 BOM chuẩn |

---

### 5.3. Phân Hệ 3: Quản Trị & Đánh Giá OKR (11/11 Tính Năng — 100% Sẵn Sàng)

| STT | Mã Màn Hình | Tên Tính Năng | Trạng Thái | Hướng Dẫn Test Nhanh |
| :-: | :--- | :--- | :-: | :--- |
| 1 | `[S20]` | Dashboard quản trị OKR cá nhân & Tiến độ chu kỳ | 🟢 Ready for Test | Vào `/okr/dashboard` |
| 2 | `[S21]` | Thiết lập OKR đầu năm (Kế thừa 20% công ty) | 🟢 Ready for Test | Nút 1-chạm kế thừa mục tiêu chiến lược tại `/okr/my-okr` |
| 3 | `[S42]` | Quản lý duyệt mục tiêu OKR đầu năm | 🟢 Ready for Test | Duyệt mục tiêu tại `/okr/team-approvals` |
| 4 | `[S22]` | Check-in tiến độ định kỳ (Hàng tháng / Quý) | 🟢 Ready for Test | Cập nhật thanh trượt % tiến độ tại `/okr/my-okr` |
| 5 | `[S43]` | Quản lý Review & Coaching giữa năm (Mid-Year) | 🟢 Ready for Test | Màn hình `/okr/mid-year-review` |
| 6 | `[S23.1]` | Form đánh giá cuối năm 4 Box (Chuẩn Ascend/ACT) | 🟢 Ready for Test | Màn hình `/okr/assessment` |
| 7 | `[S23.2]` | Quy tắc chấm điểm 1-5 nguyên & Tự tính điểm TB | 🟢 Ready for Test | Chọn điểm nguyên 1-5, tự tính điểm trung bình 2 nhóm |
| 8 | `[S23.3]` | Quy trình đánh giá cuối năm 5 bước | 🟢 Ready for Test | Thanh Stepper 5 bước tự động chuyển trạng thái |
| 9 | `[S25]` | Báo cáo tổng hợp OKR 9 trường & Xuất Excel HR | 🟢 Ready for Test | Màn hình `/okr/summary-report`, xuất file Excel |
| 10 | `[S24]` | Bảng so sánh review cả nhóm & điểm 1–5 | 🟢 Ready for Test | Màn hình `/okr/team-review`, không xếp loại/không bell curve |
| 11 | `[S46]` | Bảng theo dõi tiến độ OKR nhóm (Team Board) | 🟢 Ready for Test | Màn hình `/okr/team-board` theo dõi Kanban nhóm |

---

## 6. HƯỚNG DẪN CẬP NHẬT TÀI LIỆU KHI CÓ THAY ĐỔI MỚI

Khi bạn hoặc đội ngũ phát triển thực hiện bất kỳ thay đổi nào:

1. **Thay đổi về Nghiệp vụ (Business)**:
   - Thêm vào mục **3. NHẬT KÝ THAY ĐỔI VỀ MẶT NGHIỆP VỤ**.
   - Ghi rõ: Ngày cập nhật, phiên bản, quy định mới hoặc quy trình được điều chỉnh.
2. **Thay đổi về Kỹ thuật / Kiến trúc (Technical)**:
   - Thêm vào mục **4. NHẬT KÝ THAY ĐỔI VỀ MẶT KỸ THUẬT & KIẾN TRÚC**.
   - Ghi rõ: Công nghệ mới, schema CSDL, API endpoint mới, hoặc cấu hình container/k8s.
3. **Cập nhật Tiến độ Tính năng (Features)**:
   - Cập nhật cột **Trạng Thái** trong bảng mục **5. BẢNG THEO DÕI TÍNH NĂNG**.
   - Mở file Excel [`ACT_HR_2026_Project_Tracking.xlsx`](../ACT_HR_2026_Project_Tracking.xlsx) và cập nhật cột tương ứng để đồng bộ 100%.
