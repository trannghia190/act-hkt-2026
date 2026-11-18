# Hệ Thống Quản Lý Nhân Sự & Đánh Giá Hiệu Suất ACT HR 2026
## Tài Liệu Đặc Tả Nghiệp Vụ & Kiến Trúc Dành Cho Đội Ngũ Phát Triển & AI Agents

> **Dự án:** ACT Hackathon 2026  
> **Phiên bản:** v1.0 Production-Ready Architecture  
> **Nguyên tắc:** Hợp nhất Chấm công, Đơn từ & OKR trên một nền tảng; 100% quy định được cấu hình qua Rule Engine; Bảo mật 5 lớp chấm công (Khuôn mặt + Liveness + WiFi + Geofence + Server Time); Xác thực nội bộ Non-SSO.

---

## 📚 Bản Đồ Danh Mục Tài Liệu Kỹ Thuật (Documentation Index)

| Thứ tự | Tên tệp tài liệu | Nội dung trọng tâm & Phân hệ đảm nhiệm |
|---|---|---|
| **00** | [00-architecture-overview.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/00-architecture-overview.md) | Kiến trúc tổng thể, mô hình công nghệ, sơ đồ dịch vụ, triết lý thiết kế và luồng dữ liệu trung tâm. |
| **01** | [01-auth-user-management.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/01-auth-user-management.md) | Phân hệ Tài khoản nội bộ (Non-SSO), HR tạo/import nhân sự, dịch vụ gửi email kích hoạt qua Gmail, bắt buộc đổi mật khẩu lần đầu (S01-A) và Đăng ký mẫu khuôn mặt (S01-B). |
| **02** | [02-attendance-checkin.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/02-attendance-checkin.md) | Phân hệ Chấm công 1 chạm di động (S05m), Nhận diện khuôn mặt & Liveness detection, WiFi nội bộ, Định vị Geofence 150m/300m, Server Timestamp chuẩn NTP và xử lý offline 24h. |
| **03** | [03-requests-approval-workflow.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/03-requests-approval-workflow.md) | 4 loại đơn từ (Đi muộn, Bổ sung công 23:59 ngày làm việc, Nghỉ 8 loại, WFH max 2 ngày), Quota Engine, Lưu nháp vs Gửi đơn, Ma trận duyệt động (Default vs CA/Mobile) & SLA 48h. |
| **04** | [04-leave-balance-accrual.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/04-leave-balance-accrual.md) | Phân hệ Quản lý phép, thuật toán tích lũy (+1 ngày 15 hàng tháng), Phép chức vụ (+3), Thâm niên (+1/2 năm), Ứng trước phép (Leave advance), Mốc dọn phép tồn (01/04 & 01/07) và Sổ cái phép. |
| **05** | [05-timesheet-payroll-export.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/05-timesheet-payroll-export.md) | Lưới bảng công 45 cột chuẩn 100% mẫu Excel ACT, ký hiệu công gốc (1.00, 0.50, R, AL, S...), Sửa ô trực tiếp có audit log, Khiếu nại 2 ngày, Khóa kỳ công & Xuất file bảng lương. |
| **06** | [06-okr-performance-appraisal.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/06-okr-performance-appraisal.md) | Quản trị OKR & Đánh giá cuối năm, 20% Company + 80% Individual, Form 4 Box, Chấm điểm 1–5 nguyên ở cấp độ nhóm, Chu kỳ 4 giai đoạn, Quy trình 5 bước, Báo cáo 9 trường & Calibration Board. |
| **07** | [07-rule-engine-configuration.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/07-rule-engine-configuration.md) | Trình cấu hình 19 quy định động (Rule Engine), Quản lý phiên bản (Versioning), Hoàn tác (Rollback), Giả lập chạy thử (Dry-run Sandbox) và Trang tra cứu nội quy tự động (S19). |
| **08** | [08-notifications-todo-inbox.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/08-notifications-todo-inbox.md) | Màn hình Todo Inbox (S02), 3 kênh thông báo (Mobile Push, Email digest 8h, Badge), Ma trận 17 sự kiện theo vai trò, Thuật toán chống spam và Thanh tìm kiếm Command Palette Ctrl+K (S03). |
| **09** | [09-api-spec-and-db-schema.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/09-api-spec-and-db-schema.md) | Thiết kế Cơ sở dữ liệu vật lý quan hệ (PostgreSQL / pgvector) và Danh mục toàn bộ RESTful API Endpoints cho hệ thống. |
| **10** | [10-cho-ba-po.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/10-cho-ba-po.md) | Tài liệu nghiệp vụ gốc dành cho BA & Product Owner, 18 tiện ích (C1–C18), Backlog P0/P1/P2 và Tiêu chí nghiệm thu. |
| **11** | [11-project-structure-and-code-conventions.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/11-project-structure-and-code-conventions.md) | Cấu trúc thư mục toàn dự án (`hkt/`), ý nghĩa từng module, quy ước code enterprise, mô hình tích hợp Keycloak OIDC kết hợp quản trị tổ chức trực tiếp trên App. |
| **12** | [12-system-changelog-and-status-tracker.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/12-system-changelog-and-status-tracker.md) | **Tài liệu quản trị trạng thái & nhật ký thay đổi dự án (Living Changelog)**: Cập nhật liên tục các thay đổi Business, Technical, Features, API và Ma trận tiến độ dự án. |

---

## 🚀 Hướng Dẫn Dành Cho AI Agent & Developer Bắt Đầu Triển Khai
1. **Khảo sát giao diện:** Mở tệp [mockups/index.html](file:///Users/sang/Projects/App/act-hkt-2026/mockups/index.html) trên trình duyệt để đối chiếu 48 màn hình trực quan từ S00 đến S46.
2. **Khởi tạo cơ sở dữ liệu:** Đọc kỹ [09-api-spec-and-db-schema.md](file:///Users/sang/Projects/App/act-hkt-2026/docs/09-api-spec-and-db-schema.md) để chạy các câu lệnh DDL tạo bảng và quan hệ Foreign Key.
3. **Theo dõi tiến độ dự án (3 Tabs chuyên biệt):** Tệp Excel [`ACT_HR_2026_Project_Tracking.xlsx`](file:///Users/sang/Projects/App/act-hkt-2026/ACT_HR_2026_Project_Tracking.xlsx) được chia thành 3 tab độc lập:
   * **Tab 1 — Nền Tảng Dùng Chung:** Quản lý tài khoản Non-SSO, Đổi pass lần đầu, Face Enrollment, Todo Inbox, Command Palette Ctrl+K, Thông báo, Ủy quyền, Rule Engine (19 luật, Versioning, Rollback, Dry-run), Cơ cấu tổ chức và Centralized Audit Log.
   * **Tab 2 — Chấm Công & Đơn Từ:** Chấm công 1 chạm di động, Liveness detection, WiFi/Geofence, Server timestamp, 4 loại đơn từ, Quota engine, Ma trận duyệt động, Auto-escalation SLA 48h, Phép năm & Luật dọn phép tồn, Lưới bảng công 45 cột chuẩn Excel ACT, In-place edit, Khiếu nại 2 ngày và Khóa kỳ công.
   * **Tab 3 — Quản Trị & Đánh Giá OKR:** Thiết lập OKR đầu năm (20% Company + 80% Individual), Form 4 Box chuẩn Ascend/ACT, Chấm điểm 1-5 nguyên ở tầng nhóm, Chu kỳ 4 giai đoạn, Quy trình 5 bước, Báo cáo 9 trường chuẩn HR, Bell Curve Calibration Board và Team OKR Board.

---

## 🏗️ Kiến Trúc Kho Mã Nguồn & Cấu Trúc Dự Án (Repository Structure)

Toàn bộ mã nguồn hệ thống được đặt tập trung trong thư mục **`hkt/`**, phân tách rành mạch giữa 2 dịch vụ Backend (Java Spring Boot Core & Python AI Face Service), 1 ứng dụng Frontend phân chia module theo Sidebar Menu và tầng DevOps (Docker + Kubernetes):

```
act-hkt-2026/
├── hkt/                            # 🚀 Toàn bộ source codes Backend & Frontend
│   ├── backend/
│   │   ├── core-service/           # Java Spring Boot 3 (ACT PULSE Core: Auth, Attendance & OKR)
│   │   │   ├── src/main/java/com/act/pulse/
│   │   │   │   ├── PulseApplication.java
│   │   │   │   ├── common/         # BaseEntity, ApiResponse, GlobalExceptionHandler
│   │   │   │   ├── config/         # Security, Redis, Mail, Swagger
│   │   │   │   └── modules/        # 3 Modules chuẩn hóa (controller, service, repository, entity, dto):
│   │   │   │       ├── auth/       # Xác thực, đổi mật khẩu lần đầu, phân quyền
│   │   │   │       ├── attendance/ # Chấm công, đơn từ, sổ phép, bảng công 45 cột
│   │   │   │       └── okr/        # Form 4 Box, thang điểm 1-5, báo cáo HR 9 trường
│   │   │   ├── src/main/resources/ # application.yml & db/migration
│   │   │   ├── pom.xml             # Maven dependencies (pulse-core-service)
│   │   │   └── Dockerfile              # Multi-stage Eclipse Temurin 21
│   │   │
│   │   └── ai-face-service/        # Python FastAPI (Face Recognition, Liveness, OCR & Vector Search)
│       ├── app/
│       │   ├── main.py             # FastAPI entrypoint (/verify, /enroll)
│       │   ├── api/v1/             # Endpoints
│       │   ├── core/               # App configuration & pgvector connection
│       │   ├── models/             # Pydantic schemas & Vector models
│       │   └── services/           # Face detection, embedding & anti-spoofing
│       ├── requirements.txt        # FastAPI, OpenCV, MediaPipe, pgvector
│       └── Dockerfile              # Python 3.11 slim
│
│   ├── frontend/                   # Vite + React 18 + TypeScript + TailwindCSS
│   │   ├── src/
│   │   │   ├── config/             # sidebar.config.ts (Định nghĩa menu chuẩn theo mockup)
│   │   │   ├── components/layout/  # Sidebar.tsx, Rail, Header
│   │   │   ├── modules/            # Phân rã theo menu tính năng trên Sidebar:
│   │   │   │   ├── attendance/     # checkin, calendar, timesheet, requests, approvals, leaves, rules
│   │   │   │   ├── okr/            # dashboard, my-okr, approvals, assessment, calibration, reports
│   │   │   │   └── shared/         # auth, todo, admin, notifications
│   │   │   ├── services/           # Axios API clients
│   │   │   ├── types/              # TypeScript domain models
│   │   │   └── utils/              # Helper formatters
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── Dockerfile
│   │
│   └── deploy/
│       ├── docker/
│       │   └── docker-compose.yml  # Local All-in-One: Postgres (pgvector), Redis, Mailpit, Core, AI, Frontend
│       └── k8s/base/               # Kubernetes Manifests: Deployments, Services, Ingress, Kustomization
│
├── docs/                           # 10 Tài liệu Markdown đặc tả kiến trúc & nghiệp vụ
├── mockups/index.html              # 48 Màn hình UI Mockup hoàn chỉnh
└── ACT_HR_2026_Project_Tracking.xlsx # Bảng theo dõi tiến độ 3 Tab chi tiết cho QA/Dev
