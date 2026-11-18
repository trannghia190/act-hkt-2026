# Hệ Thống Quản Lý Nhân Sự & Đánh Giá Hiệu Suất ACT-HKT 2026
## Tài Liệu Đặc Tả Nghiệp Vụ, Kiến Trúc & Hướng Dẫn Phát Triển Cho Toàn Dự Án

> **Dự án:** ACT Hackathon 2026  
> **Phiên bản:** v2.2.0 Production-Ready Architecture  
> **Nguyên tắc cốt lõi:**
> 1. Hợp nhất Chấm công, Đơn từ & OKR trên một nền tảng duy nhất (ACT-HKT 2026).
> 2. 100% quy tắc nghiệp vụ cấu hình động qua Rule Engine (19 quy tắc, Versioning, Rollback, Dry-run sandbox).
> 3. Bảo mật 5 lớp chấm công chống gian lận (AI Face Recognition + Liveness Detection + WiFi BSSID nội bộ + Geofence 150m/300m + Server NTP Timestamp).
> 4. Xác thực nội bộ Non-SSO kết hợp Keycloak IAM OIDC, bảo vệ Brute-Force 15 phút.
> 5. Gửi email thông báo thật qua Gmail SMTP doanh nghiệp.

---

## 📚 Bản Đồ Danh Mục Tài Liệu Kỹ Thuật (Sequential Documentation Index)

Danh mục toàn bộ 22 tài liệu kỹ thuật và đặc tả nghiệp vụ của hệ thống được đánh chỉ số tuần tự, không trùng lặp, chia thành 2 nhóm chuyên biệt:

### 📑 Nhóm 1: Nghiệp Vụ & Đặc Tả Yêu Cầu Sản Phẩm (Business Specifications - BA/PO)

| Index | Tên Tệp Tài Liệu | Nội Dung Trọng Tâm & Nghiệp Vụ |
|:---:|---|---|
| **01** | [01-business-shared-core.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/01-business-shared-core.md) | Nền tảng dùng chung: Phân quyền RBAC 4 vai trò, Quản lý tài khoản Non-SSO, Đổi pass lần đầu (S01-A), Đăng ký khuôn mặt 3 góc (S01-B), Todo Inbox 2 tầng (S02), Thông báo đa kênh & Command Palette Ctrl+K (S03). |
| **02** | [02-business-attendance-time-tracking.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/02-business-attendance-time-tracking.md) | Bài toán 1 Chấm công: 5 phương thức chấm công, 5 lớp chống gian lận, 4 loại đơn từ & Quota Engine, Quản lý số dư phép & Sổ cái phép, Lưới bảng công 45 cột chuẩn Excel ACT. |
| **03** | [03-business-okr-performance.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/03-business-okr-performance.md) | Bài toán 2 Quản trị OKR & Đánh giá hiệu suất: Chu kỳ 4 giai đoạn, Form 4 Box (20% Company + 80% Individual), Thang điểm 1-5 nguyên ở tầng nhóm, Báo cáo 9 trường chuẩn HR và Calibration Board. |
| **04** | [04-business-convenience-features.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/04-business-convenience-features.md) | 18 tính năng tiện ích trải nghiệm người dùng (C1–C18): One-click Todo, Gợi ý đơn từ tự động từ log chấm công, Đồng bộ lịch Outlook/Google, Tìm kiếm nhanh, Batch approvals, v.v. |
| **05** | [05-business-data-model.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/05-business-data-model.md) | Mô hình dữ liệu nghiệp vụ tổng thể: Sơ đồ thực thể quan hệ (ERD), từ điển dữ liệu các bảng Core, Attendance, Leave, OKR, Audit Log và pgvector. |
| **06** | [06-business-rule-builder.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/06-business-rule-builder.md) | Đặc tả chi tiết Trình cấu hình quy định động (Rule Builder): Giao diện S18/S18-E, 19 luật chấm công/phép/OKR, AST JSON Schema, Versioning, Dry-run Sandbox và Trang tra cứu nội quy S19. |
| **07** | [07-business-mobile-punch.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/07-business-mobile-punch.md) | Đặc tả trải nghiệm chấm công 1 chạm di động (S05m): Tối ưu camera mobile, nhận diện khuôn mặt ngoại tuyến, xử lý cache offline 24h và đồng bộ khi có mạng. |
| **08** | [08-business-tasks-checklist.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/08-business-tasks-checklist.md) | Danh mục bảng kiểm tra nhiệm vụ chi tiết (Checklist P0/P1/P2) phân theo từng giai đoạn phát triển và tiêu chí nghiệm thu acceptance criteria. |
| **09** | [09-business-ba-po-guidelines.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/09-business-ba-po-guidelines.md) | Hướng dẫn chuyên sâu dành cho Business Analyst & Product Owner: Nguyên tắc giải quyết xung đột nghiệp vụ, tiêu chuẩn xử lý ngoại lệ và quy định báo cáo. |
| **10** | [10-business-feature-comments.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/10-business-feature-comments.md) | Tổng hợp các ý kiến đóng góp, phản hồi người dùng và ghi chú mở rộng nghiệp vụ cho các chu kỳ cập nhật tiếp theo. |

---

### 💻 Nhóm 2: Kiến Trúc Kỹ Thuật & Triển Khai Hệ Thống (Technical & Engineering Specifications)

| Index | Tên Tệp Tài Liệu | Nội Dung Trọng Tâm & Dịch Vụ Đảm Nhiệm |
|:---:|---|---|
| **11** | [11-tech-architecture-overview.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/11-tech-architecture-overview.md) | Kiến trúc tổng thể hệ thống (C4 Model): Sơ đồ microservices, công nghệ Java Spring Boot + Python FastAPI + React TS + Postgres pgvector + Redis, luồng dữ liệu trung tâm. |
| **12** | [12-tech-auth-user-management.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/12-tech-auth-user-management.md) | Kỹ thuật xác thực Non-SSO, thuật toán bảo vệ Brute-Force Redis, JWT Token lifecycle, Tích hợp Gmail SMTP doanh nghiệp, API tạo/import nhân sự và Wizard Face Enrollment. |
| **13** | [13-tech-attendance-checkin.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/13-tech-attendance-checkin.md) | Thuật toán chấm công bảo mật 5 lớp: AI Face Embedding 512D + Liveness detection, Công thức khoảng cách Haversine Geofence, Xác thực WiFi BSSID/IP, Đồng bộ NTP Server Time. |
| **14** | [14-tech-requests-approval-workflow.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/14-tech-requests-approval-workflow.md) | Kỹ thuật workflow duyệt đơn: State machine 4 loại đơn, Bộ kiểm tra hạn ngạch (Quota Engine), Ma trận duyệt động (Default vs Custom), Cơ chế Auto-escalation SLA 48h. |
| **15** | [15-tech-leave-balance-accrual.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/15-tech-leave-balance-accrual.md) | Thuật toán tích lũy phép tự động: Tích lũy +1 ngày vào ngày 15 hàng tháng, Phép chức vụ (+3) & thâm niên (+1/2 năm), Ứng trước phép (Advance), Cronjob dọn phép tồn 01/04 & 01/07. |
| **16** | [16-tech-timesheet-payroll-export.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/16-tech-timesheet-payroll-export.md) | Kỹ thuật bảng công 45 cột chuẩn Excel ACT: Thuật toán aggregate giờ công thực tế, In-place editing có ghi audit trail, Quy trình khiếu nại công 2 ngày, Khóa kỳ công & Xuất file bảng lương. |
| **17** | [17-tech-okr-performance-appraisal.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/17-tech-okr-performance-appraisal.md) | Kỹ thuật phân hệ OKR & Đánh giá hiệu suất: Cấu trúc Form 4 Box, Công thức tính điểm trung bình trọng số, Pipeline phê duyệt 5 bước, Báo cáo HR 9 trường và Calibration Board phân phối chuẩn (Bell Curve). |
| **18** | [18-tech-rule-engine-configuration.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/18-tech-rule-engine-configuration.md) | Kiến trúc Rule Engine: Trình phân tích cú pháp AST, Quản lý phiên bản (Version Hash SHA-256), Cơ chế hoàn tác Rollback trong 1 click, Môi trường giả lập Dry-run Sandbox và Cache Redis. |
| **19** | [19-tech-notifications-todo-inbox.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/19-tech-notifications-todo-inbox.md) | Kỹ thuật Notification Engine & Todo Inbox S02: WebSocket thời gian thực, Ma trận 17 sự kiện thông báo, Digest email 8h00 sáng, Thuật toán Command Palette Ctrl+K (S03) fuzzy search. |
| **20** | [20-tech-api-spec-and-db-schema.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/20-tech-api-spec-and-db-schema.md) | Toàn văn DDL Cơ sở dữ liệu vật lý (PostgreSQL 16 + pgvector) và Danh mục toàn bộ hơn 60+ RESTful API Endpoints cho các phân hệ Core, Attendance, Leave, OKR, Admin. |
| **21** | [21-tech-code-conventions.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/21-tech-code-conventions.md) | Quy ước mã nguồn doanh nghiệp: Cấu trúc thư mục repository (`hkt/`), Chuẩn đặt tên Clean Architecture, Exception handling, Cấu hình bảo mật Spring Security và UI Theme tokens. |
| **22** | [22-system-changelog-and-status-tracker.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/22-system-changelog-and-status-tracker.md) | **Tài liệu quản trị trạng thái & nhật ký thay đổi dự án (Living Changelog)**: Cập nhật liên tục toàn bộ các thay đổi Business, Technical, Features, API và Ma trận tiến độ thực tế. |

---

## 🚀 Hướng Dẫn Dành Cho AI Agent & Developer Bắt Đầu Triển Khai
1. **Khảo sát giao diện:** Mở tệp [mockups/index.html](file:///Users/sang/Projects/App/act-hkt-2026/mockups/index.html) trên trình duyệt để đối chiếu 48 màn hình trực quan từ S00 đến S46.
2. **Khởi động môi trường phát triển cục bộ:** Chạy script `./start-dev.sh` tại thư mục gốc để khởi chạy toàn bộ 6 dịch vụ hệ thống (PostgreSQL, Redis, Keycloak, Spring Boot Core, FastAPI AI Face, React Frontend).
3. **Khởi tạo cơ sở dữ liệu:** Đọc kỹ [20-tech-api-spec-and-db-schema.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/20-tech-api-spec-and-db-schema.md) để chạy các câu lệnh DDL tạo bảng và quan hệ Foreign Key.
4. **Theo dõi tiến độ dự án (3 Tabs chuyên biệt):** Tệp Excel [`ACT_HR_2026_Project_Tracking.xlsx`](file:///Users/sang/Projects/App/act-hkt-2026/ACT_HR_2026_Project_Tracking.xlsx) được chia thành 3 tab độc lập:
   * **Tab 1 — Nền Tảng Dùng Chung:** Quản lý tài khoản Non-SSO, Đổi pass lần đầu, Face Enrollment, Todo Inbox, Command Palette Ctrl+K, Thông báo, Ủy quyền, Rule Engine (19 luật, Versioning, Rollback, Dry-run), Cơ cấu tổ chức và Centralized Audit Log.
   * **Tab 2 — Chấm Công & Đơn Từ:** Chấm công 1 chạm di động, Liveness detection, WiFi/Geofence, Server timestamp, 4 loại đơn từ, Quota engine, Ma trận duyệt động, Auto-escalation SLA 48h, Phép năm & Luật dọn phép tồn, Lưới bảng công 45 cột chuẩn Excel ACT, In-place edit, Khiếu nại 2 ngày và Khóa kỳ công.
   * **Tab 3 — Quản Trị & Đánh Giá OKR:** Thiết lập OKR đầu năm (20% Company + 80% Individual), Form 4 Box chuẩn Ascend/ACT, Chấm điểm 1-5 nguyên ở tầng nhóm, Chu kỳ 4 giai đoạn, Quy trình 5 bước, Báo cáo 9 trường chuẩn HR, Bell Curve Calibration Board và Team OKR Board.

---

## 🏗️ Kiến Trúc Kho Mã Nguồn & Cấu Trúc Dự Án (Repository Structure)

Toàn bộ mã nguồn hệ thống được đặt tập trung trong thư mục **`hkt/`**, phân tách rành mạch giữa 2 dịch vụ Backend (Java Spring Boot Core & Python AI Face Service), 1 ứng dụng Frontend phân chia module theo Sidebar Menu và tầng DevOps (Docker + Kubernetes):

```
act-hkt-2026/
├── start-dev.sh                    # 🚀 Script khởi chạy toàn bộ hệ thống ở Local trong 1 chạm
├── ACT_HR_2026_Project_Tracking.xlsx # Bảng theo dõi tiến độ chi tiết hàng trăm tính năng cho QA/Dev
├── docs/                           # 22 Tài liệu Markdown đặc tả kiến trúc & nghiệp vụ (01 -> 22)
├── mockups/index.html              # 48 Màn hình UI Mockup hoàn chỉnh
└── hkt/                            # 🚀 Toàn bộ source codes Backend & Frontend
    ├── backend/
    │   ├── core-service/           # Java Spring Boot 3 (ACT-HKT Core: Auth, Attendance & OKR)
    │   │   ├── src/main/java/com/act/pulse/
    │   │   │   ├── PulseApplication.java
    │   │   │   ├── common/         # BaseEntity, ApiResponse, GlobalExceptionHandler
    │   │   │   ├── config/         # Security, Redis, Mail, Swagger
    │   │   │   └── modules/        # 3 Modules chuẩn hóa (controller, service, repository, entity, dto):
    │   │   │       ├── auth/       # Xác thực, đổi mật khẩu lần đầu, phân quyền
    │   │   │       ├── attendance/ # Chấm công, đơn từ, sổ phép, bảng công 45 cột
    │   │   │       └── okr/        # Form 4 Box, thang điểm 1-5, báo cáo HR 9 trường
    │   │   ├── src/main/resources/ # application.yml & db/migration
    │   │   ├── pom.xml             # Maven dependencies (pulse-core-service)
    │   │   └── Dockerfile          # Multi-stage Eclipse Temurin 21
    │   │
    │   └── ai-face-service/        # Python FastAPI (Face Recognition, Liveness, OCR & Vector Search)
    │       ├── app/
    │       │   ├── main.py         # FastAPI entrypoint (/verify, /enroll)
    │       │   ├── api/v1/         # Endpoints
    │       │   ├── core/           # App configuration & pgvector connection
    │       │   ├── models/         # Pydantic schemas & Vector models
    │       │   └── services/       # Face detection, embedding & anti-spoofing
    │       ├── requirements.txt    # FastAPI, OpenCV, MediaPipe, pgvector
    │       └── Dockerfile          # Python 3.11 slim
    │
    ├── frontend/                   # Vite + React 18 + TypeScript + TailwindCSS
    │   ├── src/
    │   │   ├── config/             # sidebar.config.ts (Định nghĩa menu chuẩn theo mockup)
    │   │   ├── components/layout/  # Sidebar.tsx, Rail, Header
    │   │   ├── modules/            # Phân rã theo menu tính năng trên Sidebar:
    │   │   │   ├── attendance/     # checkin, calendar, timesheet, requests, approvals, leaves, rules
    │   │   │   ├── okr/            # dashboard, my-okr, approvals, assessment, calibration, reports
    │   │   │   └── shared/         # auth, todo, admin, notifications
    │   │   ├── services/           # Axios API clients
    │   │   ├── types/              # TypeScript domain models
    │   │   └── utils/              # Helper formatters
    │   ├── package.json
    │   ├── vite.config.ts
    │   └── Dockerfile
    │
    └── deploy/
        ├── docker/
        │   └── docker-compose.yml  # Local All-in-One: Postgres (pgvector), Redis, Keycloak, Core, AI, Frontend
        └── k8s/base/               # Kubernetes Manifests: Deployments, Services, Ingress, Kustomization
```
