# ACT HR 2026 — Tài Liệu Kiến Trúc Tổng Thể Hệ Thống (System Architecture Overview)

> **Mục tiêu tài liệu:** Cung cấp bức tranh toàn cảnh về kiến trúc hệ thống, các phân hệ cốt lõi, mô hình xác thực tài khoản nội bộ (Non-SSO), cơ chế chống gian lận chấm công 5 lớp (kèm nhận diện khuôn mặt) và kiến trúc Rule Engine cho bất kỳ Developer hay AI Agent nào tiếp quản dự án.

---

## 1. Bối cảnh & Mục tiêu Hệ thống

Hệ thống **ACT HR 2026** là nền tảng quản trị nhân sự nội bộ (Internal HR & Performance Management System) dành cho công ty ACT, hợp nhất hai bài toán nghiệp vụ trọng yếu vào một cơ sở dữ liệu và tài khoản tập trung:
1. **Bài toán 1: Chấm công & Quản lý Đơn từ (Time Attendance & Requests):** Giải quyết triệt để việc chấm công thủ công qua Excel, đơn từ phân mảnh và việc xử lý tranh chấp bảng công mỗi kỳ lương.
2. **Bài toán 2: Quản trị Mục tiêu & Đánh giá Hiệu suất OKR (Objectives & Performance Appraisal):** Chuẩn hóa quy trình thiết lập, theo dõi định kỳ và đánh giá cuối năm theo chuẩn Ascend/ACT với form 4 Box và ma trận chấm điểm 1–5.

### 3 Nguyên tắc Thiết kế Cốt lõi
1. **Rule-Driven (Dữ liệu hóa toàn bộ quy định):** 19 quy định về ca, quota, hạn nộp, công thức tính và luồng duyệt đều là cấu hình động có versioning, rollback và dry-run, không hard-code trong mã nguồn.
2. **Mobile-First & 1-Tap Experience:** Nhân viên chỉ mất < 4s để hoàn thành chấm công với 1 thao tác chạm.
3. **Auditable & Strict Security (Bảo mật & Toàn vẹn dữ liệu):** Mọi thay đổi dữ liệu công và điểm OKR đều có audit trail ghi nhận người sửa, giá trị cũ/mới, thời gian chuẩn Server và lý do.

---

## 2. Kiến trúc Công nghệ & Các Lớp Ứng dụng

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Layer (Giao diện người dùng)"]
        MobileApp["📱 Mobile App (PWA / Flutter / React Native)\n• Chấm công 1 chạm (Face + WiFi + Geofence)\n• Todo Inbox & Push Notifications\n• Tạo đơn & Tra cứu sổ phép"]
        WebPortal["💻 Web Portal (React / Vue SPA)\n• Command Palette (Ctrl+K)\n• Quản lý duyệt đơn hàng loạt\n• Lưới bảng công 45 cột (In-place Edit)\n• Form OKR 4 Box & Calibration Tool\n• Trình cấu hình Rule Engine (HR)"]
    end

    subgraph GatewayAuth ["Gateway & Authentication (Non-SSO)"]
        APIGateway["API Gateway & Reverse Proxy"]
        AuthService["Auth & User Lifecycle Service\n• Local Database Credentials (Bcrypt)\n• JWT Access/Refresh Token\n• Force Password Change Onboarding\n• Face Enrollment & Embedding Storage"]
        Mailer["Email Notification Service (Gmail / SMTP)\n• Gửi mật khẩu tạm & link kích hoạt\n• Email digest nhắc việc 8h sáng"]
    end

    subgraph CoreServices ["Core Business Engines (Microservices / Modular Monolith)"]
        AttendanceEngine["Attendance Engine\n• Face Liveness & Vector Matching\n• WiFi BSSID/IP & Geofence Validator\n• Server Timestamp Recorder (NTP)"]
        RequestEngine["Request & Workflow Engine\n• 4 loại đơn: Late/Early, Adjust, Leave, WFH\n• Ma trận duyệt đa cấp (Default vs CA/Mobile)\n• Auto-escalation SLA 48h"]
        TimesheetEngine["Timesheet & Payroll Calculation\n• Lưới 45 cột (26 ngày + 19 cột tổng hợp)\n• In-place edit + Audit trail\n• Khóa kỳ công & Xử lý đơn trễ kỳ sau"]
        OKREngine["OKR & Appraisal Engine\n• 20% Company + 80% Individual (Business/People)\n• Form 4 Box, Thang điểm 1-5 nguyên\n• Chu kỳ 4 giai đoạn & Quy trình 5 bước"]
        RuleEngine["⚙️ RULE ENGINE CORE\n• Parameter Catalog (19 Rules)\n• Versioning, Rollback & Dry-run Sandbox"]
    end

    subgraph DataLayer ["Data & Storage Layer"]
        MainDB[(PostgreSQL / MySQL)\n• Users, Roles, Shifts\n• AttendanceLogs, Requests\n• Timesheets, AuditLogs\n• OKRCycles, OKRReviews\n• Rules, RuleVersions]
        VectorStore[(Face Embedding Store / PostgreSQL pgvector)]
        FileStore[(Local / S3 Storage)\n• File đính kèm đơn ốm (giấy khám)\n• Minh chứng thành tích OKR]
    end

    ClientLayer --> APIGateway
    APIGateway --> AuthService
    APIGateway --> CoreServices
    AuthService --> Mailer
    AuthService --> MainDB
    AuthService --> VectorStore
    CoreServices --> MainDB
    CoreServices --> VectorStore
    CoreServices --> FileStore
```

---

## 3. Cơ Chế Xác Thực & Quản Lý Tài Khoản Nội Bộ (Non-SSO)

Hệ thống **không phụ thuộc vào Google SSO**, giúp tổ chức làm chủ hoàn toàn dữ liệu nhân sự và kiểm soát chặt chẽ vòng đời tài khoản.

### 3.1. Quy trình Cấp phát Tài khoản từ HR
1. **Khởi tạo:** HR nhập thông tin nhân viên đơn lẻ qua Form (S40) hoặc Import tệp danh sách Excel.
2. **Mật khẩu ban đầu:** Hệ thống tự động sinh mật khẩu ngẫu nhiên an toàn (10 ký tự: chữ hoa, chữ thường, số, ký tự đặc biệt) hoặc HR nhập trực tiếp.
3. **Trạng thái tài khoản:** Gán trạng thái `PENDING_ACTIVATION` kèm cờ `must_change_password = true`.
4. **Gửi Email qua Gmail/SMTP:** Hệ thống kích hoạt gửi email thông báo tự động đến địa chỉ Gmail của nhân viên:
   * Tiêu đề: `[ACT HR 2026] Thông tin kích hoạt tài khoản hệ thống`
   * Nội dung: Tên tài khoản, Mật khẩu tạm thời, Link truy cập trực tiếp, Cảnh báo đổi mật khẩu trong 48h.

### 3.2. Luồng Đăng nhập Lần đầu & Đăng ký Khuôn mặt (Onboarding Flow)
```
[1. Nhập User & Mật khẩu tạm]
              ↓
[2. Hệ thống kiểm tra: must_change_password == true]
              ↓ Bắt buộc chặn các route khác
[3. Màn hình S01-A: Đổi mật khẩu mới]
   (Yêu cầu: >= 8 ký tự, đủ chữ hoa, thường, số, ký tự đặc biệt)
              ↓ Đổi mật khẩu thành công (must_change_password = false)
[4. Màn hình S01-B: Hướng dẫn Đăng ký Khuôn mặt (Face Enrollment)]
   (Chụp 3 góc mặt: thẳng, nghiêng trái, nghiêng phải → Lưu Vector 128D/512D)
              ↓
[5. Điều hướng vào Màn hình Todo Inbox (S02)]
```

---

## 4. Cơ Chế Chấm Công 5 Lớp Chống Gian Lận (Multi-factor Attendance)

Để đảm bảo không có kẽ hở gian lận chấm công hộ hoặc làm sai lệch giờ công, hệ thống kết hợp đồng thời 5 chốt chặn:

| Lớp | Cơ chế kiểm tra | Hành vi xử lý khi vi phạm |
|---|---|---|
| **1. Khuôn mặt (Face & Liveness)** | Camera quét khuôn mặt + kiểm tra cử chỉ sống (chớp mắt/quay nhẹ đầu). So khớp vector đặc trưng với mẫu đã đăng ký. | **Chặn hoàn toàn** nếu không khớp hoặc phát hiện dùng ảnh in/màn hình phát lại. |
| **2. Mạng nội bộ (WiFi / Subnet IP)** | Nhận diện BSSID WiFi hoặc dải IP mạng văn phòng công ty. | Cho phép cảnh báo nếu ở ngoài mạng (trừ ngày có đơn WFH hợp lệ). |
| **3. Định vị văn phòng (Geofencing)** | Xác định khoảng cách tới tọa độ văn phòng:<br>• $\le 150m$: Hợp lệ.<br>• $150m - 300m$: Cho chấm + gắn cờ `low_gps_accuracy`.<br>• $> 300m$: **Chặn hoàn toàn** (trừ ngày WFH). | Chống việc ngồi nhà cách nhiều km vẫn bấm check-in. |
| **4. Thiết bị phần cứng (Device Binding)** | Khóa 1 tài khoản với 1 thiết bị di động duy nhất (`hardware_device_id`). | Đổi thiết bị phải làm đơn gửi HR phê duyệt. |
| **5. Thời gian chuẩn Server (Server Timestamp)** | Mọi mốc thời gian ghi nhận đều lấy từ đồng hồ máy chủ (NTP synchronized), bỏ qua hoàn toàn `client_time` của điện thoại. | Ngăn chặn 100% việc nhân viên chỉnh lùi giờ trên điện thoại. |

---

## 5. Quy Chuẩn Đơn Từ Linh Hoạt qua Rule Engine

Mọi quy định về đơn từ được đưa vào các tham số của Rule Engine:
* **Hạn nộp Bổ sung chấm công:** Tính theo **ngày làm việc (Working Days)**, hạn chót là **23:59:59 của ngày thứ 3** (không tính thứ Bảy, Chủ nhật và ngày lễ).
* **Đơn Đi muộn / Về sớm:** Hỗ trợ 2 chế độ:
  1. *Có kế hoạch:* Đăng ký trước 08:00 sáng.
  2. *Đột xuất:* Cho phép đăng ký trong ngày phát sinh kèm giải trình lý do khẩn cấp.
* **Cơ chế Ứng phép năm (Leave Advance):** Cho phép nhân viên xin trước tối đa 3 ngày phép khi số dư hiện tại chưa kịp tích lũy, có cờ khấu trừ tự động vào các tháng tiếp theo.
* **Cảnh báo xóa phép tồn tự động:** Tự động gửi thông báo qua Mobile và Email trước các mốc nhạy cảm 01/04 và 01/07 vào các ngày thứ 30, 15 và 3.

---

## 6. Danh Mục Tài Liệu Kỹ Thuật Chi Tiết Trong Thư Mục `docs/`

Để hỗ trợ phát triển theo từng chuyên đề, tài liệu được phân tách rõ ràng:
* [12-tech-auth-user-management.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/12-tech-auth-user-management.md): Nghiệp vụ Quản lý người dùng, Xác thực nội bộ, Email kích hoạt & Đăng ký khuôn mặt.
* [13-tech-attendance-checkin.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/13-tech-attendance-checkin.md): Nghiệp vụ Chấm công 1 chạm, Liveness detection, WiFi & Geofence, Server timestamp.
* [14-tech-requests-approval-workflow.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/14-tech-requests-approval-workflow.md): Nghiệp vụ 4 loại đơn từ, Quota engine, Ma trận duyệt động (Default/CA/Mobile) & Auto-escalation.
* [15-tech-leave-balance-accrual.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/15-tech-leave-balance-accrual.md): Quy tắc tính số dư phép, luật phép tồn, ứng phép và sổ phép audit log.
* [16-tech-timesheet-payroll-export.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/16-tech-timesheet-payroll-export.md): Lưới bảng công 45 cột chuẩn Excel, sửa tại chỗ, quy trình chốt khóa & xuất báo cáo lương.
* [17-tech-okr-performance-appraisal.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/17-tech-okr-performance-appraisal.md): Quản trị OKR, Form 4 Box, thang điểm 1-5, quy trình đánh giá 5 bước & Calibration board.
* [18-tech-rule-engine-configuration.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/18-tech-rule-engine-configuration.md): Kiến trúc Rule Engine, 19 tham số cấu hình, Versioning, Rollback & Dry-run sandbox.
* [19-tech-notifications-todo-inbox.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/19-tech-notifications-todo-inbox.md): Todo Inbox tập trung, 3 kênh thông báo, 17 sự kiện nghiệp vụ x 3 actor, Command Palette Ctrl+K.
* [20-tech-api-spec-and-db-schema.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/20-tech-api-spec-and-db-schema.md): Đặc tả API Endpoint RESTful chi tiết và Cấu trúc cơ sở dữ liệu vật lý toàn hệ thống.
