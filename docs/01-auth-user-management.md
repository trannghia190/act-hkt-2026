# 01 — Quản Lý Người Dùng, Xác Thực Nội Bộ & Vòng Đời Mật Khẩu (Auth & User Lifecycle)

> **Mục tiêu:** Mô tả chi tiết phân hệ Quản lý tài khoản người dùng, cơ chế xác thực nội bộ (Non-SSO), quy trình tạo tài khoản & gửi email kích hoạt qua Gmail, luồng bắt buộc đổi mật khẩu và đăng ký khuôn mặt (Face Enrollment) lần đầu.

---

## 1. Mô Hình Người Dùng & Cơ Cấu Tổ Chức (Organization Structure)

### 1.1. Các Trường Thông Tin Nhân Viên
Hệ thống quản lý hồ sơ nhân viên phục vụ đồng thời cho Chấm công, Bảng lương và OKR:
* `id`: UUID (Khóa chính)
* `employee_code`: Mã nhân viên (ví dụ: `05ACT`, `136ACT`) — Duy nhất
* `full_name`: Họ và tên đầy đủ
* `email`: Email công việc / Gmail cá nhân nhận thông báo
* `position`: Chức danh công việc (ví dụ: Senior Software Engineer, QA Specialist)
* `department`: Phòng ban lớn (ví dụ: Phần mềm, QA, HR)
* `team`: Nhóm trực tiếp (ví dụ: `Sirius`, `Minion`, `Optimus`, `Zeus`, `Avenger`, `CA`, `Mobile`)
* `line_manager_id`: ID của Quản lý trực tiếp (Người duyệt đơn và review OKR)
* `role`: Vai trò hệ thống (`EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `EXECUTIVE`)
* `shift_id`: Ca làm việc được gán (Mặc định: 08:00 - 17:30)
* `joined_date`: Ngày vào công ty (Dùng để tính thời gian công tác và thâm niên)
* `status`: Trạng thái (`PENDING_ACTIVATION`, `ACTIVE`, `SUSPENDED`, `RESIGNED`)
* `must_change_password`: Boolean (`TRUE` khi tài khoản mới tạo hoặc HR reset pass)
* `face_enrolled`: Boolean (Đã hoàn thành đăng ký khuôn mặt hay chưa)

### 1.2. Ma Trận Phân Quyền (RBAC)
* **EMPLOYEE:** Xem thông tin cá nhân, chấm công, gửi 4 loại đơn, xem bảng công cá nhân, khai báo và tự đánh giá OKR cá nhân.
* **MANAGER:** Mọi quyền của Employee + Xem danh sách nhóm trực thuộc, duyệt đơn của nhóm (duyệt lẻ / hàng loạt), xem lịch nhóm vắng mặt/WFH, duyệt OKR đầu năm, review giữa năm và chấm điểm OKR cuối năm của nhóm.
* **HR_ADMIN:** Quản lý toàn bộ nhân viên, cấu hình ca, quản lý 19 rule, sửa bảng công tại chỗ (in-place edit), chốt khóa bảng công, tổng hợp báo cáo OKR toàn công ty, xuất Excel.
* **EXECUTIVE (Ban Điều Hành / Giám đốc):** Xem báo cáo tổng thể, đánh giá chung vào bảng tổng hợp OKR, xem Calibration board.

---

## 2. Quy Trình Khởi Tạo & Kích Hoạt Tài Khoản (Non-SSO Flow)

### 2.1. HR Tạo Tài Khoản
HR truy cập màn hình `S40 - Quản lý nhân viên`:
1. **Tạo đơn lẻ:** HR điền form với các trường bắt buộc (`employee_code`, `full_name`, `email`, `team`, `line_manager_id`, `joined_date`).
   * HR có thể tích chọn *"Hệ thống tự sinh mật khẩu"* hoặc nhập mật khẩu thủ công.
2. **Import hàng loạt:** HR upload file Excel danh sách nhân sự $\rightarrow$ Hệ thống kiểm tra trùng lặp email/mã nhân viên $\rightarrow$ Báo cáo kết quả và số lượng tài khoản tạo mới.

### 2.2. Dịch Vụ Gửi Email Tự Động (Email Activation Service)
Ngay sau khi tài khoản được lưu vào database:
* Hệ thống sinh mật khẩu ngẫu nhiên: Chuỗi 10 ký tự gồm chữ hoa, chữ thường, số, ký tự đặc biệt (ví dụ: `Act#2026$Xy`).
* Hệ thống mã hóa mật khẩu bằng `Bcrypt` (cost factor = 12) và lưu vào `users`.
* Kích hoạt Background Job gửi email qua Gmail/SMTP:
  * **Người nhận:** Email của nhân viên.
  * **Tiêu đề:** `[ACT HR 2026] Thông báo cấp tài khoản hệ thống & Kích hoạt`
  * **Nội dung email:**
    ```
    Xin chào [Họ và tên],
    
    Tài khoản hệ thống ACT HR 2026 của bạn đã được khởi tạo thành công.
    - Tên đăng nhập: [Email hoặc Mã nhân viên]
    - Mật khẩu tạm thời: [Mật khẩu ngẫu nhiên]
    - Đường dẫn đăng nhập: https://hr.act-corp.internal/login
    
    LƯU Ý BẢO MẬT:
    1. Vui lòng đăng nhập và ĐỔI MẬT KHẨU MỚI ngay trong lần đầu truy cập.
    2. Sau khi đổi mật khẩu, hệ thống sẽ hướng dẫn bạn chụp ảnh mẫu khuôn mặt để phục vụ chấm công.
    
    Trân trọng,
    Phòng Nhân sự ACT.
    ```

---

## 3. Trải Nghiệm Đăng Nhập Lần Đầu (First-Login Onboarding)

### 3.1. Chặn Truy Cập & Bắt Buộc Đổi Mật Khẩu (Screen S01-A)
1. Người dùng vào trang đăng nhập (`S01`), nhập email/mã NV và mật khẩu tạm.
2. Server xác thực thông tin đăng nhập thành công. Kiểm tra thấy cờ:
   $$\text{must\_change\_password} == \text{true}$$
3. Server trả về JWT token tạm thời chỉ có scope `FORCE_CHANGE_PASSWORD`.
4. Ứng dụng khóa toàn bộ các menu/trang khác và lập tức hiển thị Modal / Màn hình **Đổi Mật Khẩu Bắt Buộc (S01-A)**:
   * Ô 1: Nhập mật khẩu tạm hiện tại.
   * Ô 2: Nhập mật khẩu mới.
   * Ô 3: Xác nhận lại mật khẩu mới.
   * **Chính sách mật khẩu (Password Policy):** Tối thiểu 8 ký tự, ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số, 1 ký tự đặc biệt. Không được trùng mật khẩu cũ.
5. Sau khi người dùng submit mật khẩu mới thành công:
   * Server cập nhật hash mật khẩu mới.
   * Đặt `must_change_password = false`.
   * Cấp lại Access Token & Refresh Token chính thức.

### 3.2. Đăng Ký Khuôn Mặt Mẫu (Face Enrollment Wizard - Screen S01-B)
Sau khi đổi mật khẩu, nếu `face_enrolled == false`, ứng dụng chuyển sang bước Đăng ký Khuôn mặt:
1. Màn hình hiển thị hướng dẫn chụp ảnh trong điều kiện ánh sáng đầy đủ, không đeo khẩu trang/kính râm.
2. Camera mở khung tròn hướng dẫn căn chỉnh khuôn mặt:
   * Chụp góc thẳng (Frontal).
   * Quay nhẹ sang trái (Left turn).
   * Quay nhẹ sang phải (Right turn).
3. Ứng dụng trích xuất bộ vector đặc trưng (Face Embeddings - 128 hoặc 512 chiều) từ các khung hình đạt chuẩn liveness.
4. Gửi vector và ảnh chân dung chuẩn về server:
   * Vector được lưu vào `face_embeddings` (sử dụng PostgreSQL `pgvector`).
   * Ảnh chuẩn được lưu làm ảnh đại diện đại diện (Profile Photo).
   * Cập nhật `face_enrolled = true`.
5. Điều hướng người dùng về **Màn hình chính Todo Inbox (S02)**.

---

## 4. Quản Trị Mật Khẩu & Bảo Mật Nâng Cao

1. **HR Reset Mật Khẩu:** Khi nhân viên quên mật khẩu hoặc bị khóa:
   * HR vào `S40`, bấm nút *"Reset Mật khẩu & Gửi Email"*.
   * Hệ thống tự sinh mật khẩu tạm mới, đặt `must_change_password = true` và kích hoạt email gửi về hòm thư của nhân viên.
2. **Khóa Tài Khoản Khi Đăng Nhập Sai Nhiều Lần:**
   * Nhập sai mật khẩu liên tiếp **5 lần** $\rightarrow$ Khóa tài khoản tạm thời trong **15 phút**.
   * Nhập sai liên tiếp **10 lần** $\rightarrow$ Khóa vĩnh viễn, yêu cầu HR mở khóa.
3. **Cơ Chế Phiên Làm Việc (Session Management):**
   * Access Token có thời hạn 60 phút.
   * Refresh Token có thời hạn 30 ngày (lưu an toàn trên HttpOnly Cookie hoặc Secure Storage Mobile).
