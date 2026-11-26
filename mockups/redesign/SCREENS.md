# Tracking màn hình — Design → Implement → Verify

Quy trình 3 bước cho **từng màn hình**, cho **3 theme**
(Ascend Clean · Midnight Rail · Bento Studio) × **2 khổ**
(desktop 1440 · mobile 390).

## Quy trình (Definition of Done mỗi màn)

| Bước | Việc | DONE khi |
|---|---|---|
| **1 · Design** | Mockup dựa trên màn hình hiện tại (giữ nguyên nghiệp vụ), cho 3 theme × desktop+mobile | Có file mockup mở được cả 3 theme + 2 khổ |
| **2 · Implement** | Áp vào code để **giống mockup** (màu, vị trí, font, kích thước, component) | Màn chạy khớp mockup ở 3 theme × 2 khổ |
| **3 · Verify** | So màn thật ↔ mockup + smoke tính năng | Checklist tick hết, tính năng không hỏng |

> Nếu trang đã có design đủ 3 theme × 2 khổ → **bỏ qua bước 1**.
> Hiện chỉ có **mockup hướng** (🟡) cho 4 màn mẫu trong `index.html`
> (Cần làm · OKR · Bảng công · Đăng nhập) — các màn này cần **bù mobile + 3 theme**
> chứ không cần làm lại từ đầu.

## Trạng thái

| Ký | Nghĩa |
|---|---|
| ⬜ | Chưa làm |
| 🟡 | Có mockup hướng (thiếu khổ/theme) |
| ✅ | Xong |

> Nền tảng đã có sẵn: token 3 theme (commit `1cef466`), áp token toàn bộ màn
> (commit `02b6d7c`). Cột **Impl** ở đây = *khớp design*, không phải *đã token*.

---

## 0 · Auth & Onboarding

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| A1 | Đăng nhập | `/login` | `LoginPage` | ✅ | ✅ | ✅ |
| A2 | Đăng ký khuôn mặt | `/auth/enroll-face` | `FaceEnrollmentPage` | ⬜ | ⬜ | ⬜ |

## 1 · Chung & Quản trị

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| S1 | Cần làm (Todo) | `/todo` | `TodoInboxPage` | 🟡 | ⬜ | ⬜ |
| S2 | Thông báo (mobile) | `/notifications` | `MobileNotificationsPage` | ⬜ | ⬜ | ⬜ |
| S3 | Tuỳ chỉnh thông báo | `/account/notifications` | `NotificationPrefsPage` | ⬜ | ⬜ | ⬜ |
| S4 | Quản lý nhân viên | `/admin/employees` · `/admin/users` | `EmployeeManagementPage` | ⬜ | ⬜ | ⬜ |
| S5 | Cây quản lý / Sơ đồ tổ chức | `/admin/org-tree` · `/admin/teams` | `OrgTreePage` | ⬜ | ⬜ | ⬜ |
| S6 | Ca làm & Ngày lễ | `/admin/shifts` | `ShiftHolidayPage` | ⬜ | ⬜ | ⬜ |
| S7 | Nhật ký kiểm toán | `/admin/audit-logs` | `AuditLogPage` | ⬜ | ⬜ | ⬜ |
| S8 | Văn bản chính sách | `/admin/policy-doc` · `/attendance/policy-doc` | `PolicyDocPage` | ⬜ | ⬜ | ⬜ |
| S9 | Bộ quy tắc | `/admin/rules` · `/attendance/rules` | `RuleEnginePage` | ⬜ | ⬜ | ⬜ |
| S10 | Loại nghỉ phép | `/admin/leave-types` | `LeaveTypesPage` | ⬜ | ⬜ | ⬜ |
| S11 | Quản lý thiết bị | `/admin/devices` | `AdminDevicesPage` | ⬜ | ⬜ | ⬜ |

## 2 · Chấm công

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| T1 | Chấm công | `/attendance/checkin` | `CheckInPage` | ⬜ | ⬜ | ⬜ |
| T2 | Lịch chấm công | `/attendance/calendar` | `CalendarPage` | ⬜ | ⬜ | ⬜ |
| T3 | Lịch nhóm | `/attendance/team-schedule` | `TeamSchedulePage` | ⬜ | ⬜ | ⬜ |
| T4 | Đơn từ | `/attendance/requests` | `RequestsPage` | ⬜ | ⬜ | ⬜ |
| T5 | Chi tiết đơn | `/attendance/requests/:id` | `RequestDetailPage` | ⬜ | ⬜ | ⬜ |
| T6 | Duyệt đơn | `/attendance/approvals` | `ApprovalsPage` | ⬜ | ⬜ | ⬜ |
| T7 | Nghỉ phép của tôi | `/attendance/leaves` | `LeavesPage` | ⬜ | ⬜ | ⬜ |
| T8 | Sổ phép (HR) | `/attendance/leave-ledger` | `AdminLeaveLedgerPage` | ⬜ | ⬜ | ⬜ |
| T9 | Bảng công tổng (HR) | `/attendance/leave-table` | `LeaveTablePage` | ⬜ | ⬜ | ⬜ |
| T10 | Bảng công (HR) | `/attendance/timesheet` | `TimesheetPage` | 🟡 | ⬜ | ⬜ |
| T11 | Bảng công của tôi | `/attendance/my-timesheet` | `MyTimesheetPage` | 🟡 | ⬜ | ⬜ |
| T12 | Khiếu nại công | `/attendance/disputes` | `DisputesPage` | ⬜ | ⬜ | ⬜ |
| T13 | Chi tiết khiếu nại | `/attendance/disputes/:id` | `DisputeDetailPage` | ⬜ | ⬜ | ⬜ |
| T14 | Thiết bị của tôi | `/attendance/devices` | `MyDevicesPage` | ⬜ | ⬜ | ⬜ |
| T15 | Thêm thiết bị | `/attendance/devices/add` | `AddDevicePage` | ⬜ | ⬜ | ⬜ |

## 3 · Tài khoản

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| AC1 | Hồ sơ cá nhân (+ chọn theme) | `/account/profile` | `ProfilePage` | ⬜ | ⬜ | ⬜ |
| AC2 | Passkey & bảo mật | `/account/passkey` | `PasskeySettingsPage` | ⬜ | ⬜ | ⬜ |

## 4 · OKR

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| O1 | Tổng quan OKR | `/okr/dashboard` | `OKRDashboardPage` | 🟡 | ⬜ | ⬜ |
| O2 | OKR của tôi | `/okr/my-okr` | `MyOKRPage` | ⬜ | ⬜ | ⬜ |
| O3 | Chu kỳ OKR | `/okr/cycles` | `OKRCyclesPage` | ⬜ | ⬜ | ⬜ |
| O4 | Chi tiết / tạo chu kỳ | `/okr/cycles/new` · `/okr/cycles/:id` | `OKRCycleDetailPage` | ⬜ | ⬜ | ⬜ |
| O5 | Review OKR nhóm | `/okr/team-review` | `TeamReviewPage` | ⬜ | ⬜ | ⬜ |
| O6 | Đánh giá OKR | `/okr/assessment` | `AssessmentPageRoute` | ⬜ | ⬜ | ⬜ |
| O7 | Review giữa năm | `/okr/mid-year-review` | `MidYearReviewPage` | ⬜ | ⬜ | ⬜ |
| O8 | Duyệt OKR | `/okr/team-approvals` | `OKRApprovalsPage` | ⬜ | ⬜ | ⬜ |
| O9 | Báo cáo OKR | `/okr/summary-report` | `OKRReportsPage` | ⬜ | ⬜ | ⬜ |

## 5 · Shell & Modal dùng chung

| # | Thành phần | File | Design | Impl | Verify |
|---|---|---|---|---|---|
| SH1 | Sidebar (desktop + mobile drawer) | `layout/Sidebar.tsx` | ⬜ | ⬜ | ⬜ |
| SH2 | Header | `layout/Header.tsx` | ⬜ | ⬜ | ⬜ |
| SH3 | Bottom nav (mobile) | `layout/MobileBottomNav.tsx` | ⬜ | ⬜ | ⬜ |
| SH4 | Command palette (⌘K) | `layout/CommandPalette.tsx` | ⬜ | ⬜ | ⬜ |
| SH5 | Theme switcher | `layout/ThemeSwitcher.tsx` | ⬜ | ⬜ | ⬜ |
| M1 | Đổi mật khẩu | `account/ChangePasswordModal.tsx` | ⬜ | ⬜ | ⬜ |
| M2 | Đổi mật khẩu lần đầu | `auth/FirstLoginChangePasswordModal.tsx` | ⬜ | ⬜ | ⬜ |
| M3 | Kết nối Gmail | `common/EnterpriseGmailModal.tsx` | ⬜ | ⬜ | ⬜ |
| M4 | Nhắc bật thông báo đẩy | `layout/PushOnboardingPrompt.tsx` | ⬜ | ⬜ | ⬜ |

---

## Thứ tự đã chốt (theo luồng demo)

1. **Lõi demo** — A1 · S1 · T1 · T11 · T10 · T7 · T4/T5 · T6 · AC1 · S2/S3
2. **OKR** — O1…O9
3. **Quản trị HR** — S4…S11 · T8/T9 · T12/T13 · T14/T15 · AC2 · A2
4. **Shell & modal** — SH1…SH5 · M1…M4

> Tổng: **39 màn** + **9 thành phần shell/modal**.

## File mockup (đã chốt: HTML mỗi màn)

- Thư mục: `mockups/redesign/screens/<slug>.html`
- Kit dùng chung: `_kit.css` (token 3 theme **copy nguyên văn** từ `src/index.css`
  dòng 19–209) + `_kit.js` (tự chèn thanh đổi theme + khổ desktop/mobile)
- Mỗi file: `<div id="stage" data-theme="midnight-rail" data-vp="desktop">`
  chứa `.frame-desktop` (1440) và `.frame-mobile` (390) — giống hệt bản thật.
- Mở `python3 -m http.server 8899` trong `mockups/redesign/` → `/screens/<slug>.html`

## Nhật ký

- **A1 · Login** ✅ — mockup `screens/login.html`; app `LoginPage` khớp mockup ở
  Midnight desktop + Bento mobile (logo ACT HR/ASCEND TECH, đủ 3 mã demo, divider
  "hoặc", passkey, footer 2 dòng). App vốn đã đúng nên bước 2 không cần sửa code.
