# 11 — Cấu Trúc Dự Án, Phân Rã Module & Quy Ước Tổ Chức Mã Nguồn (Project Structure & Code Conventions)

> **Mục tiêu:** Cung cấp tài liệu cẩm nang kỹ thuật chi tiết về cấu trúc mã nguồn toàn bộ dự án (`hkt/`), ý nghĩa của từng thư mục, module, luồng kiến trúc (Architectural Flow), cách thức tổ chức mã nguồn và mô hình tích hợp **Keycloak** cho xác thực & phân quyền (kết hợp quản lý tổ chức/nhân sự linh hoạt từ phía ứng dụng cho HR & Admin).

---

## 1. Triết Lý Kiến Trúc & Cây Thư Mục Tổng Thể (`hkt/`)

Dự án được quy hoạch theo mô hình **Modular Monorepo** với tất cả mã nguồn nằm trong thư mục gốc `hkt/`:

```
hkt/
├── backend/
│   ├── core-service/               # ☕ Java Spring Boot 3 (ACT PULSE Core)
│   └── ai-face-service/            # 🐍 Python FastAPI (AI Face Recognition & Liveness)
│
├── frontend/                       # ⚡ Vite + React 18 + TypeScript + TailwindCSS
│
└── deploy/                         # 🚀 Hạ tầng triển khai container hóa
    ├── docker/                     # Docker Compose (Môi trường phát triển Local All-in-One)
    └── k8s/base/                   # Kubernetes Manifests & Ingress (Sẵn sàng Production)
```

---

## 2. Kiến Trúc Xác Thực Keycloak & Quản Trị Nhân Sự Ứng Dụng

Hệ thống áp dụng mô hình **Decoupled Identity & Organization Architecture** (Tách biệt giữa Xác thực định danh và Quản lý cơ cấu nhân sự):

```mermaid
flowchart TD
    User["Người dùng (Web / Mobile)"] --> Login["1. Đăng nhập qua Keycloak (OIDC / OAuth2)\nHoặc Local App Credentials"]
    Login --> KC["Keycloak IAM Server (Port 8180)\n• Quản lý Client, Realm 'act-pulse'\n• Cấp JWT Access Token & Refresh Token\n• Quản lý Realm Roles & Client Scopes"]
    KC --> Gateway["2. Gửi Bearer JWT Token vào Backend"]
    Gateway --> Security["Spring Security Resource Server\n(Giải mã JWT, trích xuất roles)"]
    
    subgraph AppDB ["Hệ Thống Ứng Dụng ACT PULSE (pulse-core-service)"]
        Security --> OrgMgmt["Module Quản Trị Tổ Chức & Nhân Sự\n• HR / Admin quản lý trực tiếp trên Web UI\n• Tạo phòng ban, nhóm (Teams), gán Leader\n• Gán ca làm việc, quota, ngày vào làm\n• Quản lý ma trận phân quyền: Admin, HR, Manager, Employee"]
        OrgMgmt --> Sync["Tự động đồng bộ sang Keycloak User qua Admin API"]
    end
```

### Điểm Sáng Trong Mô Hình Này:
1. **Keycloak chịu trách nhiệm:** Xác thực an toàn, cấp phát & xác thực chữ ký JWT, hỗ trợ SSO tương lai, quản lý phiên làm việc tập trung (Session management), ngăn chặn Brute-force.
2. **Hệ thống ứng dụng chịu trách nhiệm:** 
   * Quản lý hồ sơ nhân viên, phòng ban, nhóm làm việc đa tầng (Teams), cây phê duyệt (Manager $\rightarrow$ Employee).
   * Phân quyền nghiệp vụ chi tiết (Admin, HR_Admin, Line_Manager, Employee).
   * Khi HR thêm nhân viên mới trên ứng dụng: Backend vừa lưu vào CSDL nội bộ, vừa tự động gọi Keycloak Admin REST API để tạo tài khoản đồng bộ. HR và Admin hoàn toàn thao tác trên giao diện thân thiện của ứng dụng mà không cần phải truy cập vào trang Admin Console phức tạp của Keycloak.

---

## 3. Chi Tiết Cấu Trúc Backend 1: Core Service (`hkt/backend/core-service/`)

Core Service được xây dựng bằng **Java 21 + Spring Boot 3.3.x**, chia làm **3 phân hệ nghiệp vụ độc lập** bên cạnh tầng hạ tầng dùng chung (`common`, `config`):

```
hkt/backend/core-service/src/main/java/com/act/pulse/
├── PulseApplication.java           # Entrypoint chính khởi động Spring Boot
│
├── common/                         # TẦNG DÙNG CHUNG TOÀN HỆ THỐNG
│   ├── entity/                     # BaseEntity (UUID, createdAt, updatedAt), AuditEntity
│   ├── exception/                  # GlobalExceptionHandler, BusinessException, ResourceNotFoundException
│   ├── response/                   # ApiResponse<T>, PageResponse<T>
│   ├── enums/                      # RoleEnum, RequestStatusEnum, LeaveTypeEnum, AttendanceStatusEnum
│   └── util/                       # DateUtils, SecurityContextUtils, FormulaEngineUtils
│
├── config/                         # CẤU HÌNH HẠ TẦNG KỸ THUẬT
│   ├── SecurityConfig.java         # Tích hợp OAuth2 Resource Server (Keycloak JWT) & Local RBAC
│   ├── KeycloakAdminConfig.java    # Cấu hình Keycloak Admin Client để tạo/đồng bộ user tự động
│   ├── RedisConfig.java            # Cấu hình Redis Cache & Rate-limiter
│   ├── MailConfig.java             # Cấu hình dịch vụ gửi email kích hoạt qua Gmail/Mailpit
│   ├── CorsConfig.java             # Cấu hình CORS cho Frontend React
│   └── SwaggerConfig.java          # Cấu hình tài liệu API SpringDoc OpenAPI v3
│
└── modules/                        # 3 PHÂN HỆ NGHIỆP VỤ CHÍNH:
    │
    ├── 1. auth/                    # PHÂN HỆ 1: XÁC THỰC, TÀI KHOẢN & TỔ CHỨC
    │   ├── controller/             # AuthController, UserController, OrgStructureController
    │   ├── dto/
    │   │   ├── request/            # LoginRequest, ChangePasswordRequest, CreateUserRequest, TeamRequest
    │   │   └── response/           # AuthResponse, UserProfileResponse, OrgTreeResponse
    │   ├── entity/                 # User.java, Department.java, Team.java, Device.java, Role.java
    │   ├── repository/             # UserRepository, TeamRepository, DepartmentRepository, DeviceRepository
    │   └── service/                # AuthService, UserService, KeycloakSyncService, OrgService
    │       └── impl/               # AuthServiceImpl, UserServiceImpl, KeycloakSyncServiceImpl
    │
    ├── 2. attendance/              # PHÂN HỆ 2: CHẤM CÔNG, ĐƠN TỪ, SỔ PHÉP & BẢNG CÔNG
    │   ├── controller/             # AttendanceController, RequestController, TimesheetController, LeaveController
    │   ├── dto/
    │   │   ├── request/            # CheckInRequest, LateEarlyRequest, AdjustRequest, LeaveRequest, WfhRequest, CellEditRequest
    │   │   └── response/           # AttendanceStatusResponse, RequestSummaryResponse, TimesheetGridResponse, LeaveBalanceResponse
    │   ├── entity/                 # AttendanceLog, EmployeeRequest, Timesheet, TimesheetCell, TimesheetAuditLog, LeaveBalance, LeaveLedger
    │   ├── repository/             # AttendanceLogRepository, EmployeeRequestRepository, TimesheetRepository, LeaveBalanceRepository
    │   └── service/                # AttendanceService, RequestWorkflowService, TimesheetService, LeaveAccrualService
    │       └── impl/               # AttendanceServiceImpl, RequestWorkflowServiceImpl, TimesheetServiceImpl
    │
    └── 3. okr/                     # PHÂN HỆ 3: QUẢN TRỊ MỤC TIÊU & ĐÁNH GIÁ HIỆU SUẤT
        ├── controller/             # OKRController, OKRAssessmentController, OKRCalibrationController, OKRReportController
        ├── dto/
        │   ├── request/            # OKRSetupRequest, OKRCheckInRequest, OKRAssessmentSubmitRequest, CalibrationAdjustRequest
        │   └── response/           # OKRDashboardResponse, OKRReviewResponse, OKRSummaryReportResponse, CalibrationBoardResponse
        ├── entity/                 # OKRCycle.java, OKRReview.java (Form 4 Box), OKRItem.java
        ├── repository/             # OKRReviewRepository, OKRCycleRepository, OKRItemRepository
        └── service/                # OKRService, OKRAssessmentService, OKRCalibrationService, OKRReportService
            └── impl/               # OKRServiceImpl, OKRAssessmentServiceImpl
```

### Quy Ước Đặt Tên & Tổ Chức Code (Coding Conventions):
* **Controller:** Chỉ làm nhiệm vụ tiếp nhận HTTP request, validate dữ liệu đầu vào qua `@Valid`, điều phối Service và bọc kết quả trong `ApiResponse.ok(data, message)`. Tuyệt đối không viết logic nghiệp vụ trong Controller.
* **Service / ServiceImpl:** Chứa 100% logic nghiệp vụ. Sử dụng `@Transactional` cho các hàm ghi dữ liệu để đảm bảo tính toàn vẹn (ACID).
* **DTO (Data Transfer Object):** Tách biệt rành mạch giữa `dto.request` (dữ liệu client gửi lên) và `dto.response` (dữ liệu trả về client), không để lộ Entity trực tiếp ra ngoài API.
* **Repository:** Kế thừa `JpaRepository<Entity, UUID>`, đặt tên query method rõ nghĩa theo chuẩn Spring Data.

---

## 4. Chi Tiết Cấu Trúc Backend 2: AI Face Recognition Service (`hkt/backend/ai-face-service/`)

Được xây dựng bằng **Python 3.11 + FastAPI + OpenCV + MediaPipe + pgvector**, chuyên biệt hóa cho tác vụ xử lý hình ảnh và tìm kiếm vector:

```
hkt/backend/ai-face-service/
├── app/
│   ├── main.py                     # Entrypoint FastAPI, khai báo routers và middlewares
│   ├── api/v1/                     # Endpoints (/api/v1/face/verify, /enroll, /liveness)
│   ├── core/                       # Cấu hình tham số, kết nối DB PostgreSQL pgvector
│   ├── models/                     # Pydantic Schemas (VerifyRequest, VerifyResponse, EnrollRequest)
│   ├── services/                   # Thuật toán AI:
│   │   ├── face_detector.py        # Phát hiện khuôn mặt trong khung hình
│   │   ├── liveness_analyzer.py    # Phát hiện chớp mắt & chuyển động 3D (Anti-spoofing)
│   │   └── face_embedder.py        # Trích xuất vector 512D & so khớp Cosine Distance
│   └── repositories/               # Tra cứu vector trong database pgvector
├── requirements.txt                # Thư viện: fastapi, uvicorn, mediapipe, opencv, pgvector
└── Dockerfile                      # Container Python slim
```

---

## 5. Chi Tiết Cấu Trúc Frontend UI (`hkt/frontend/`)

Ứng dụng UI sử dụng **Vite + React 18 + TypeScript + TailwindCSS**, tổ chức theo triết lý **Feature Modules & Sidebar Navigation**:

```
hkt/frontend/src/
├── types/                          # 📦 Hệ thống Type Definitions tập trung toàn hệ thống:
│   ├── auth.types.ts               # UserRole, AuthUser, SmtpConfigPayload, SmtpStatusResponse
│   ├── attendance.types.ts         # DayAttendance, ShiftConfig, HolidayConfig, TimesheetRow, RequestItem, RuleItem
│   ├── okr.types.ts                # Objective, KeyResult, EmployeeRating, HRSummaryRecord
│   └── index.ts                    # Barrel export toàn bộ types
│
├── services/                       # 🌐 Tầng gọi API qua HTTP Client chuẩn hóa:
│   ├── api.client.ts               # Fetch/Axios Client đính kèm JWT Bearer token tự động
│   ├── auth.service.ts             # API Login, Reset OTP, SmtpConfig, SendNotification
│   └── index.ts
│
├── utils/                          # 🛠️ Hàm tiện ích dùng chung:
│   ├── export.utils.ts             # Tiện ích xuất dữ liệu sang CSV/Excel chuẩn UTF-8 BOM
│   ├── format.utils.ts             # Định dạng ngày giờ chuẩn VN, tiền tệ VND
│   └── index.ts
│
├── config/
│   └── sidebar.config.ts           # Bản đồ menu Sidebar phân theo 3 Module, ánh xạ đúng mã màn hình S01-S46
│
├── context/
│   └── AuthContext.tsx             # Quản lý phiên đăng nhập, localStorage và Quick Role Switcher
│
├── components/
│   ├── common/                     # Thư viện Component nguyên tử dùng chung (Atoms/Molecules):
│   │   ├── Button.tsx              # Nút bấm chuẩn với các variant (primary, outline, ghost)
│   │   ├── Badge.tsx               # Huy hiệu trạng thái (Status, Priority, Screen ID)
│   │   ├── Card.tsx                # Khung thẻ hiển thị nội dung
│   │   ├── Modal.tsx               # Hộp thoại popup đa dụng
│   │   ├── EnterpriseGmailModal.tsx# Modal cấu hình & gửi Gmail Doanh Nghiệp thật
│   │   └── index.ts
│   │
│   └── layout/                     # Bố cục giao diện chung (Layout Shell):
│       ├── Header.tsx              # Thanh tiêu đề trên cùng, chuông thông báo, role switcher, profile user
│       ├── Sidebar.tsx             # Thanh menu bên trái có nút chuyển 1-chạm giữa 3 Module
│       ├── CommandPalette.tsx      # Thanh tìm kiếm phím tắt toàn năng Ctrl+K (S03)
│       ├── ProtectedRoute.tsx      # Bộ bảo vệ route và phân quyền theo Role người dùng
│       └── index.ts
│
├── routes/                         # 🧭 Hệ thống định tuyến ứng dụng:
│   ├── AppRoutes.tsx               # Khai báo tập trung toàn bộ route phân theo 3 Phân hệ
│   └── index.ts
│
├── modules/                        # 📂 Các tính năng nghiệp vụ được phân rã theo Module:
│   ├── attendance/                 # 1. PHÂN HỆ CHẤM CÔNG & QUẢN LÝ THỜI GIAN:
│   │   ├── checkin/                # Chấm công khuôn mặt Face AI & Liveness (S05m)
│   │   ├── calendar/               # Lịch chấm công tháng cá nhân (S06) & Lịch nhóm (S14)
│   │   ├── requests/               # Đơn của tôi, WFH cap 3 ngày, OT, Quên chấm công (S08/S30/S31)
│   │   ├── approvals/              # Phê duyệt đơn nhóm của Quản lý & HR (S12/S13)
│   │   ├── leaves/                 # Số dư phép & Sổ cái phép cá nhân (S09/S34)
│   │   ├── timesheet/              # Lưới tổng hợp bảng công 45 cột & chốt lương (S15)
│   │   └── rules/                  # Rule Engine 19 luật linh hoạt (S16) & Dry-Run Simulator (S18)
│   │
│   ├── okr/                        # 2. PHÂN HỆ MỤC TIÊU & ĐÁNH GIÁ HIỆU SUẤT:
│   │   ├── dashboard/              # Tổng quan Dashboard OKR toàn công ty (S20)
│   │   ├── my-okr/                 # Biểu mẫu 4 Box thiết lập OKR & Check-in tuần (S21/S22)
│   │   ├── assessment/             # Đánh giá hiệu suất cuối năm 4 Box (S23)
│   │   ├── calibration/            # Cân chuẩn điểm Bell Curve toàn công ty (S24)
│   │   └── reports/                # Báo cáo tổng hợp OKR 9 trường (S25) & Team Board (S46)
│   │
│   ├── shared/                     # 3. NỀN TẢNG DÙNG CHUNG & QUẢN TRỊ DOANH NGHIỆP:
│   │   ├── admin/                  # Quản lý nhân viên (S40), Sơ đồ tổ chức (S41), Ca làm (S26), Audit Log (S35)
│   │   ├── todo/                   # Hộp thư Todo Inbox tập trung (S02)
│   │   └── notifications/          # Ủy quyền phê duyệt tạm thời (S37)
│   │
│   └── auth/                       # 4. ĐĂNG NHẬP & PHÂN QUYỀN:
│       └── LoginPage.tsx           # Màn hình đăng nhập & Quên mật khẩu gửi OTP Gmail thật (S01)
│
├── App.tsx                         # Khởi tạo Layout, Shell & Route Provider tinh gọn
├── main.tsx                        # Entrypoint render React 18 DOM
└── index.css                       # Thiết lập Tailwind Directives, Typography, Custom Scrollbar
```

---

## 6. Môi Trường Triển Khai Container & Keycloak (`hkt/deploy/`)

### Docker Compose (`hkt/deploy/docker/docker-compose.yml`)
Khởi chạy đồng bộ 6 dịch vụ cốt lõi với 1 lệnh `docker compose up -d`:
1. `pulse-keycloak`: Keycloak IAM Server (Port 8180) quản lý xác thực OAuth2/OIDC.
2. `pulse-postgres`: PostgreSQL 16 tích hợp extension `pgvector` (Port 5432).
3. `pulse-redis`: Redis 7 Alpine làm cache và rate-limiter chống tấn công (Port 16379:6379).
4. `pulse-core-service`: Java Spring Boot 3 Core Service (Port 8080) kết nối trực tiếp máy chủ Gmail Doanh Nghiệp thật qua SMTP TLS `smtp.gmail.com:587`.
5. `pulse-ai-face-service`: Python FastAPI Face Recognition & Liveness Engine (Port 8000).
6. `pulse-frontend`: React Vite SPA chạy trên cổng 3000.

### Kubernetes Manifests (`hkt/deploy/k8s/base/`)
Gồm đầy đủ các manifest cho Deployment (có HPA và probes), Services, Ingress định tuyến và Kustomization sẵn sàng đưa vào môi trường Production.
