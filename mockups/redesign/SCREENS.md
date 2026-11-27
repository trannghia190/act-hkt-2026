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
| A2 | Đăng ký khuôn mặt | `/auth/enroll-face` | `FaceEnrollmentPage` | ✅ | ✅ | ✅ |

## 1 · Chung & Quản trị

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| S1 | Cần làm (Todo) | `/todo` | `TodoInboxPage` | ✅ | ✅ | ✅ |
| S2 | Thông báo (mobile) | `/notifications` | `MobileNotificationsPage` | ✅ | ✅ | ✅ |
| S3 | Tuỳ chỉnh thông báo | `/account/notifications` | `NotificationPrefsPage` | ✅ | ✅ | ✅ |
| S4 | Quản lý nhân viên | `/admin/employees` · `/admin/users` | `EmployeeManagementPage` | ✅ | ✅ | ✅ |
| S5 | Cây quản lý / Sơ đồ tổ chức | `/admin/org-tree` · `/admin/teams` | `OrgTreePage` | ✅ | ✅ | ✅ |
| S6 | Ca làm & Ngày lễ | `/admin/shifts` | `ShiftHolidayPage` | ✅ | ✅ | ✅ |
| S7 | Nhật ký kiểm toán | `/admin/audit-logs` | `AuditLogPage` | ✅ | ✅ | ✅ |
| S8 | Văn bản chính sách | `/admin/policy-doc` · `/attendance/policy-doc` | `PolicyDocPage` | ✅ | ✅ | ✅ |
| S9 | Bộ quy tắc | `/admin/rules` · `/attendance/rules` | `RuleEnginePage` | ✅ | ✅ | ✅ |
| S10 | Loại nghỉ phép | `/admin/leave-types` | `LeaveTypesPage` | ✅ | ✅ | ✅ |
| S11 | Quản lý thiết bị | `/admin/devices` | `AdminDevicesPage` | ✅ | ✅ | ✅ |
| S48 | Cấu hình Domain Host | `/admin/system-config` | `SystemDomainConfigPage` | ✅ | ✅ | ✅ |

## 2 · Chấm công

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| T1 | Chấm công | `/attendance/checkin` | `CheckInPage` | ✅ | ✅ | ✅ |
| T2 | Lịch chấm công | `/attendance/calendar` | `CalendarPage` | ✅ | ✅ | ✅ |
| T3 | Lịch nhóm | `/attendance/team-schedule` | `TeamSchedulePage` | ✅ | ✅ | ✅ |
| T4 | Đơn từ | `/attendance/requests` | `RequestsPage` | ✅ | ✅ | ✅ |
| T5 | Chi tiết đơn | `/attendance/requests/:id` | `RequestDetailPage` | ✅ | ✅ | ✅ |
| T6 | Duyệt đơn | `/attendance/approvals` | `ApprovalsPage` | ✅ | ✅ | ✅ |
| T7 | Nghỉ phép của tôi | `/attendance/leaves` | `LeavesPage` | ✅ | ✅ | ✅ |
| T8 | Sổ phép (HR) | `/attendance/leave-ledger` | `AdminLeaveLedgerPage` | ✅ | ✅ | ✅ |
| T9 | Bảng công tổng (HR) | `/attendance/leave-table` | `LeaveTablePage` | ✅ | ✅ | ✅ |
| T10 | Bảng công (HR) | `/attendance/timesheet` | `TimesheetPage` | ✅ | ✅ | ✅ |
| T11 | Bảng công của tôi | `/attendance/my-timesheet` | `MyTimesheetPage` | ✅ | ✅ | ✅ |
| T12 | Khiếu nại công | `/attendance/disputes` | `DisputesPage` | ✅ | ✅ | ✅ |
| T13 | Chi tiết khiếu nại | `/attendance/disputes/:id` | `DisputeDetailPage` | ✅ | ✅ | ✅ |
| T14 | Thiết bị của tôi | `/attendance/devices` | `MyDevicesPage` | ✅ | ✅ | ✅ |
| T15 | Thêm thiết bị | `/attendance/devices/add` | `AddDevicePage` | ✅ | ✅ | ✅ |

## 3 · Tài khoản

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| AC1 | Hồ sơ cá nhân (+ chọn theme) | `/account/profile` | `ProfilePage` | ✅ | ✅ | ✅ |
| AC2 | Passkey & bảo mật | `/account/passkey` | `PasskeySettingsPage` | ✅ | ✅ | ✅ |

## 4 · OKR

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| O1 | Tổng quan OKR | `/okr/dashboard` | `OKRDashboardPage` | ✅ | ✅ | ✅ |
| O2 | OKR của tôi | `/okr/my-okr` | `MyOKRPage` | ✅ | ✅ | ✅ |
| O3 | Chu kỳ OKR | `/okr/cycles` | `OKRCyclesPage` | ✅ | ✅ | ✅ |
| O4 | Chi tiết / tạo chu kỳ | `/okr/cycles/new` · `/okr/cycles/:id` | `OKRCycleDetailPage` | ✅ | ✅ | ✅ |
| O5 | Review OKR nhóm | `/okr/team-review` | `TeamReviewPage` | ✅ | ✅ | ✅ |
| O6 | Đánh giá OKR | `/okr/assessment` | `AssessmentPageRoute` | ✅ | ✅ | ✅ |
| O7 | Review giữa năm | `/okr/mid-year-review` | `MidYearReviewPage` | ✅ | ✅ | ✅ |
| O8 | Duyệt OKR | `/okr/team-approvals` | `OKRApprovalsPage` | ✅ | ✅ | ✅ |
| O9 | Báo cáo OKR | `/okr/summary-report` | `OKRReportsPage` | ✅ | ✅ | ✅ |

## 5 · Shell & Modal dùng chung

| # | Thành phần | File | Design | Impl | Verify |
|---|---|---|---|---|---|
| SH1 | Sidebar (desktop + mobile drawer) | `layout/Sidebar.tsx` | ✅ | ✅ | ✅ |
| SH2 | Header | `layout/Header.tsx` | ✅ | ✅ | ✅ |
| SH3 | Bottom nav (mobile) | `layout/MobileBottomNav.tsx` | ✅ | ✅ | ✅ |
| SH4 | Command palette (⌘K) | `layout/CommandPalette.tsx` | ✅ | ✅ | ✅ |
| SH5 | Theme switcher | `layout/ThemeSwitcher.tsx` | ✅ | ✅ | ✅ |
| M1 | Đổi mật khẩu | `account/ChangePasswordModal.tsx` | ✅ | ✅ | ✅ |
| M2 | Đổi mật khẩu lần đầu | `auth/FirstLoginChangePasswordModal.tsx` | ✅ | ✅ | ✅ |
| M3 | Kết nối Gmail | `common/EnterpriseGmailModal.tsx` | ✅ | ✅ | ✅ |
| M4 | Nhắc bật thông báo đẩy | `layout/PushOnboardingPrompt.tsx` | ✅ | ✅ | ✅ |

---

## Thứ tự đã chốt (theo luồng demo)

1. **Lõi demo** — A1 · S1 · T1 · T11 · T10 · T7 · T4/T5 · T6 · AC1 · S2/S3
2. **OKR** — O1…O9
3. **Quản trị HR** — S4…S11 · T8/T9 ✅ · T12/T13 · T14/T15 · AC2 · A2
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
- **A1 · mobile hero** ✅ (2026-11-26) — nâng cấp theo `index.html`: **hero gradient
  tối** (logo trắng + tiêu đề) trên mobile, form token bên dưới; giữ mã demo để
  thao tác. Đã sửa cả mockup lẫn `LoginPage`. Passkey đổi emoji 🔐 → icon `KeyRound`;
  nút chính/passkey 48px bo12. Kit: toolbar `fixed`→`sticky` (hết che đỉnh hero khi
  khổ hẹp). Verify: desktop1440 + mobile390 × Bento/Midnight, không tràn, desktop
  không regression. `tsc` + `build` sạch.
- **T11 · Bảng công của tôi** ✅ (2026-11-26) — mockup `screens/my-timesheet.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `MyTimesheetPage`: đầu trang gọn +
  điều hướng kỳ công (‹ Tháng ›) + In/PDF; 6 chỉ số chính có icon (tổng ngày công,
  công thực tế, phép năm, WFH, đi muộn, phép còn lại) + dải "Chi tiết ký hiệu" 5
  chỉ số phụ (mobile gộp vào nút "Đủ chỉ số"); lịch tháng ô vuông có chú giải + nhãn
  KN; bảng 11 cột: cột Ngày dính khi cuộn ngang, header viết tắt, nút khiếu nại gọn.
  Không đổi nghiệp vụ (khiếu nại, in, đổi kỳ). Verify: 3 theme × 320/390/1440 không
  tràn, cột Ngày dính đúng, modal khiếu nại mở/đóng được, `tsc` + `build` +
  `check-consistency` + `test_theme_responsive` sạch.
- **S1 · Cần làm** ✅ (2026-11-27) — mockup `screens/todo.html` bù 3 theme × desktop
  1440 + mobile 390. Áp vào `TodoInboxPage`: tab đang chọn dùng nền `accent-soft` +
  chữ `accent-dark` + badge đếm đỏ như mockup (thay chip đen); ô tìm kiếm việc nằm
  cạnh chip trên desktop và **trên** chip ở mobile (giữ nguyên tính năng lọc); bỏ nút
  "Tìm việc" trùng lặp ở đầu trang, giữ "+ Tạo đơn" cùng hàng tiêu đề ở cả 2 khổ.
  Verify: 3 theme × 390/1440 không tràn, `test_todo_responsive` + `test_theme_responsive`
  PASS, `tsc` + `build` + `check-consistency` sạch.
- **T10 · Bảng công & chốt lương (HR)** ✅ (2026-11-26) — mockup `screens/timesheet.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `TimesheetPage`: đầu trang eyebrow +
  `h1` + badge trạng thái + 3 nút (Xuất Excel / Chốt bảng công / Khoá kỳ công, icon
  lucide thay emoji); dải 3 chỉ số **đo từ dữ liệu thật** (37 NV · 16% đã chấm công =
  6/37 NV có log · 31 NV chưa có log công) — bỏ chỉ số "đủ công" suy đoán sai cho kỳ
  đang chạy; bộ lọc gộp 1 panel (Kỳ · Nhóm · tìm kiếm trong ô fld, chip lọc nhanh,
  pill bộ lọc đang áp dụng có nút X, Lưu view / Chia sẻ); bảng 53 cột: tiêu đề viết
  tắt 9.5px, chú giải màu cột ngày + hint "vuốt ngang" cho mobile; chú thích ký hiệu
  chuyển từ bảng 4 cột sang lưới 2 cột. Ngày chốt kỳ đọc từ `payroll_period.close_day`
  (API trả về) thay vì hardcode `1/12/2026`, tính theo đúng kỳ đang xem. Verify: 3
  theme × 320/360/390/414/1440 không tràn ngang, 0 lỗi JS, đổi kỳ 10/2026 hiện
  "Chu kỳ đóng 01/11/2026" đúng, `tsc` + `build` + `check-consistency` +
  `test_theme_responsive` sạch.
- **T7 · Nghỉ phép của tôi** ✅ (2026-11-26) — mockup `screens/leaves.html` (3 theme ×
  desktop 1440 + mobile 390). Áp vào `LeavesPage`: đầu trang eyebrow + `h1` "Số dư phép"
  + 2 nút (Xuất sổ phép CSV / Xin nghỉ phép → mở form đơn nghỉ); dải 4 chỉ số chính
  (Phép còn lại có thanh tiến trình · Phép năm · Phép tồn · Phép ốm BHXH); **dải phân
  bổ quỹ phép** tách rõ công chuẩn / phép chức vụ / phép thâm niên / đã sử dụng để
  đối chiếu quy chế (giữ đủ card riêng theo tiêu chí C6c); bảng sổ phép 6 cột trên
  desktop, **mobile đổi sang danh sách 2 dòng** (tên + badge · mô tả · số ngày + số
  dư) — không mất cột nào; bộ lọc chip + năm, số dòng hiện trên tiêu đề panel. Không
  đổi nghiệp vụ (bộ lọc, số dư, export). Verify: 3 theme × 320/360/390/414/768/1440
  không tràn ngang, 0 lỗi JS; lọc loại + năm lọc đúng số dòng; xuất CSV tải được;
  nút Xin nghỉ phép mở đúng form và form hiện số dư phép còn lại; `tsc` + `build` +
  `check-consistency` + `test_theme_responsive` + `test_mockup_responsive` sạch.
- **T4 · Đơn của tôi** ✅ (2026-11-26) — mockup `screens/requests.html` (3 theme × desktop
  1440 + mobile 390). Áp vào `RequestsPage`: đầu trang eyebrow + `h1` "Đơn của tôi" +
  nút "Tạo đơn mới"; **dải quota** dạng chip có thanh tiến trình (đi muộn 2/2 · bổ sung
  công 1/5 · WFH 0/2) + chip "Hạn nộp đơn: 3 ngày" — quota đọc từ API thật, hết lượt thì
  chip chuyển sang cảnh báo; bộ lọc gộp 1 panel (tìm kiếm trong ô fld · Loại · khoảng
  ngày) + **chip lọc trạng thái** (Tất cả / Chờ duyệt / Đã duyệt / Bị từ chối) có chấm
  màu trạng thái; bảng đơn: mã đơn rút gọn 8 ký tự, tiêu đề viết tắt 9.5px, cột hành
  động gọn — **vừa khung 1440 không phải cuộn ngang**; **mobile đổi sang danh sách 2
  dòng** (loại đơn + trạng thái · ngày + thời lượng · lý do · nút thao tác) thay vì
  bảng 9 cột làm UUID tràn 3 dòng; bỏ hết emoji (option loại đơn, phản hồi, đính kèm,
  toast). Không đổi nghiệp vụ (lọc, phân trang, tạo/sửa/hủy/gửi duyệt). Verify: 3
  theme × 320/360/390/414/768/1440 không tràn ngang, 0 lỗi JS; chip trạng thái + lọc loại
  + tìm kiếm đổi đúng tổng số đơn (200 → 6 / 2 / 102 / 92); phân trang chuyển trang đúng;
  nút Tạo đơn mới mở form; `tsc` + `build` + `check-consistency` +
  `test_theme_responsive` + `test_mockup_responsive` sạch.
- **T5 · Chi tiết đơn** ✅ (2026-11-26) — mockup `screens/request-detail.html` (3 theme ×
  desktop 1440 + mobile 390). Áp vào `RequestDetailPage`: thêm **link "Về danh sách đơn"**
  (trước không có đường quay lại); đầu trang eyebrow `Đơn #XXXX` + `h1` tên loại đơn +
  badge trạng thái + sub 1 dòng — **trước tiêu đề là UUID thô**; bố cục 2 cột: trái =
  Thông tin đơn (lưới nhãn/giá trị 2 cột, mã đơn full width) + Giấy tờ đính kèm, phải =
  **timeline "Diễn biến"** dọc có chấm trạng thái (xanh = đã xong, hổ phách = đang chờ)
  + lịch sử chỉnh sửa; điều kiện đơn chuyển từ emoji ✅ sang chip kiểm tra có icon
  (Trong quota / Nộp đúng hạn / Ảnh hưởng); link "Xem bảng công bị tác động" thành nút
  có icon thay cho link gạch chân. Bỏ emoji 📎 ở danh sách tệp. Không đổi nghiệp vụ
  (cùng API `/requests/{id}` + `/attachments`, cùng luồng tải/tải file tệp). Verify: 3
  theme × 320/360/390/414/768/1440 không tràn ngang, 0 lỗi JS; đơn chờ duyệt hiện 2
  bước timeline (Gửi đơn → Chờ quản lý duyệt), đơn đã duyệt hiện 2 bước (Gửi đơn → Đã
  duyệt) kèm người duyệt + thời điểm; link quay lại và link xem bảng công điều hướng
  đúng; `tsc` + `build` + `check-consistency` + `test_theme_responsive` +
  `test_mockup_responsive` sạch.
- **T6 · Duyệt đơn** ✅ (2026-11-26) — mockup `screens/approvals.html` (3 theme × desktop
  1440 + mobile 390). Áp vào `ApprovalsPage`: đầu trang eyebrow + `h1` "Duyệt đơn" +
  nút "Duyệt N đơn đã chọn" / "Tải lại" (icon lucide, có tooltip nói rõ chỉ ghi 1 dòng
  audit cho cả lô); **3 tab cũ → segmented control** đúng spec design system (ô 34px
  trong khung p-4px, đang chọn `bg-ink text-canvas`, đếm bằng font-mono) — trước là 3
  nút bo góc có emoji ⏳/✓/✕; bộ lọc gộp 1 panel (tìm kiếm trong ô fld · Loại · Ngày);
  bảng: mã đơn rút gọn 8 ký tự, tiêu đề viết tắt 9.5px, **chip điều kiện ✅/❌ vẫn hiện
  ngay trên dòng** (tiêu chí D1) nhưng đổi từ emoji sang icon lucide, cột Điều kiện
  `whitespace-nowrap` để không vỡ từng chữ; **mobile đổi sang danh sách 2 dòng** (NV +
  badge quá hạn/tự duyệt · thời gian + loại đơn · chip điều kiện · nút Từ chối / Duyệt
  / Chi tiết) — trước là bảng 9 cột bị tràn; bỏ hết emoji (⏳ quá hạn, 📎 đính kèm, 💬
  ý kiến, ✓ toast); chuẩn hoá nhãn về sentence case (Từ chối / Duyệt / Xác nhận từ
  chối). Không đổi nghiệp vụ: duyệt đơn / từ chối bắt buộc lý do / duyệt hàng loạt 1
  audit log, cùng API `/requests/inbox` + `/history` + `/approve` + `/reject` +
  `/bulk-approve`. Verify: 3 theme × 320/360/390/414/768/1440 không tràn ngang, 0 lỗi
  JS; segmented tab chuyển đúng số dòng (131 / 26 / 5); lọc loại + tìm kiếm lọc đúng;
  **nút "Xác nhận từ chối" disable khi bỏ trống lý do và bật khi đã nhập** (tiêu chí D1);
  nút duyệt hàng loạt hiện đúng số đơn đã chọn (3); bảng vừa khung 1440 — trước là
  1150px trong khung 1138px nên cắt mất nút thao tác; `tsc` + `build` +
  `check-consistency` + `test_theme_responsive` + `test_mockup_responsive` sạch.
- **T1 · Chấm công** ✅ (2026-11-26) — mockup `screens/checkin.html` đã có sẵn, bố cục
  2 cột + camera + 5 lớp xác thực đã áp từ commit `f83cb3a`; vòng này bổ sung phần
  còn thiếu: **thêm đầu trang** theo mockup (crumb "Chấm công" + `h1` "Chấm công hôm
  nay" + chip trạng thái thiết bị) — trước màn hình mở ra không có tiêu đề. Chip
  trạng thái thiết bị đọc từ API `/devices` và đối chiếu fingerprint trình duyệt
  (dùng chung `getDeviceFingerprint`), hiện 4 trạng thái: đã xác thực (xanh) ·
  chờ duyệt (hổ phách) · đã bị thu hồi (đỏ) · máy này chưa đăng ký (hổ phách) —
  kèm tooltip nói rõ lớp xác thực "khóa thiết bị" sẽ ra sao. Không đổi nghiệp vụ:
  cùng 5 lớp xác thực, cùng nút 1 chạm, cùng payload `CheckInRequest`. Verify: 3
  theme × 320/360/390/414/1440 không tràn ngang, 0 lỗi JS; bấm nút chấm công chạy
  đủ 5 lớp và hiện rõ **lý do bị chặn + cách khắc phục** ("Bạn đã dùng đủ 2 thiết
  bị — máy thứ 3 phải được HR duyệt" + nút "Thử lại lượt khác"); bật webcam thật với
  Chromium fake device; `tsc` + `build` + `check-consistency` + `test_theme_responsive` +
  `test_mockup_responsive` sạch.
- **T2 · Lịch chấm công** ✅ (2026-11-27) — mockup `screens/calendar.html` (3 theme ×
  desktop 1440 + mobile 390). Áp vào `CalendarPage`: đầu trang eyebrow + `h1` "Lịch công
  tháng" + sub; **nút chuyển tháng ‹ ›** gộp trong 1 khung (icon lucide, nhãn tháng
  font-mono) — trước là 2 nút bo góc có emoji ◀ ▶ và badge 📅; **dải 5 chỉ số** đo từ
  API thật (công chuẩn 20 ngày · công tích lũy 1.5 ngày · đi muộn 0 lần · phép năm
  1 ngày còn 11 · WFH 0 ngày) kèm icon; lưới lịch ô vuông 7 cột T2→CN — **mobile ô
  nhỏ 52px, giờ vào/ra + số giờ chỉ hiện từ `sm`** (trước 7 cột trong 390px làm "Ngày
  nghỉ" bị cắt thành "Ngà"); ô cuối tuần hiện "—" thay vì đoạn text dài; **nhãn KN**
  cho 5 ngày đã có khiếu nại + chú giải thêm mục KN; panel chi tiết ngày chuyển từ `Card`
  sang panel viền, lưới 4 ô (trạng thái · giờ vào · giờ ra · số giờ) + **dòng cảnh báo
  đi muộn** và **dòng khiếu nại** (HR đang xử lý / đã xử lý / bị từ chối, kèm lý do) với
  nút dẫn đúng chỗ — nút "Tạo đơn giải trình đi muộn" / "Tạo đơn bổ sung công" nay
  mang `?create=…&date=…` để form mở sẵn đúng loại đơn và đúng ngày. Không đổi
  nghiệp vụ (API `/attendance/my-timesheet`, chuyển tháng theo `?month=YYYY-MM`).
  Verify: 3 theme × 320/390/768/1440 không tràn ngang, 0 lỗi JS, 0 request 4xx/5xx;
  API trả 30 ngày = lưới vẽ 30 ô; bấm ‹ › đổi tháng **và URL** (`month=2026-11` →
  `2026-12` → về `2026-11`); click ngày mở panel chi tiết rồi đóng được; 5 nhãn KN khớp
  5 ngày có dispute trong API; form đơn mở đúng loại `LATE_EARLY` + ngày `2026-11-22`;
  `tsc` + `build` + `check-consistency` + `test_theme_responsive` +
  `test_mockup_responsive` sạch.
- **AC1 · Hồ sơ cá nhân (+ chọn theme)** ✅ (2026-11-27) — mockup `screens/profile.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `ProfilePage`: đầu trang eyebrow +
  `h1` "Hồ sơ cá nhân" + sub + nút "Chỉnh sửa hồ sơ"; hero chuyển từ `bg-canvas`
  sang panel `bg-surface` viền 14px, tên lên `font-display` 21px + 3 badge (mã NV ·
  vai trò · trạng thái); 4 ô hành động nhanh (Đổi mật khẩu · Passkey · Khuôn mặt ·
  Thiết bị) cao 40px bo 10px — trước là 4 ô bo 12px trộn 2 hàng ở mobile; 2 card
  "Thông tin cá nhân" / "Công việc" dùng panel mới (header tách viền, bo 13px) thay
  `Card`; dòng thông tin có đường kẻ ngăn cách `border-line-soft` + chữ đậm hơn;
  icon "Phòng ban" đổi `Briefcase` → `Building2` (icon đúng nghĩa); **card "Giao diện"
  thêm badge "Đang dùng · Midnight Rail"** + preview mini-mockup cao 56px (mobile) /
  64px (desktop) — **mobile chuyển từ 3 card dọc sang 3 hàng ngang** (preview 108px
  bên trái · tên + mô tả bên phải) để không phải cuộn 3 màn hình; nút input form sửa
  hồ sơ có `id` + `htmlFor` và focus ring `ring-accent/20`. Không đổi nghiệp vụ: cùng
  API `/auth/profile` GET/PUT, cùng luồng đổi avatar / đổi mật khẩu / chuyển theme
  (localStorage + sync DB). Verify: 3 theme × 320/360/390/414/768/1024/1440 không tràn
  ngang, 0 lỗi JS, 0 request 4xx/5xx; theme khớp DB khi mở màn; bấm "Bento Studio" áp
  **ngay** (`data-theme` + localStorage) và **lưu DB** (`GET /auth/profile` trả về
  `bento-studio`); reload vẫn giữ theme; `aria-pressed` đúng ô đang chọn; form sửa hồ
  sơ mở với tên hiện tại; 4 đích điều hướng bảo mật đúng; `tsc` + `build` +
  `check-consistency` + `test_theme_responsive` + `test_mockup_responsive` sạch.
- **S2 · Thông báo & nhắc việc** ✅ (2026-11-27) — mockup `screens/notifications.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `MobileNotificationsPage`: banner cũ
  (`bg-canvas` bo 16px + badge "Trung tâm thông báo") → **đầu trang eyebrow + `h1`
  "Thông báo & nhắc việc" + sub**, nút "Cài đặt thông báo" ở góc phải dẫn
  `/account/notifications` (trước chỉ có chữ "Cài đặt" nhỏ); bộ lọc gộp 1 hàng (ô
  tìm kiếm có icon + select nhóm sự kiện, cao 38px bo 10px); **chip lọc pill 31px**
  đúng spec design system (đang chọn `bg-ink text-canvas`, đếm bằng font-mono) +
  nút "Đọc tất cả" — trước là 2 chip tròn + nút chữ đỏ lệch hẳn; **thẻ thông báo**
  bo 13px, chấm trạng thái đỏ/hổ phách/xám theo mức độ, tiêu đề `break-words` +
  `min-w-0` để **không đẩy card ra ngoài lưới ở 390px** (trước card rộng 415px
  trong cột 338px → nút "Xử lý ngay" bị cắt); nút xoá thành **ô vuông 28px có
  viền** (trước là icon trần) kèm `aria-label`; empty state **bỏ emoji 🎉** → icon
  `Inbox` trong vòng tròn xanh; footer gộp 2 dòng thành 1 dòng. Không đổi nghiệp vụ:
  cùng API `/notifications` + `mark-all-read` + `DELETE /notifications/{id}`, cùng
  lọc / tìm kiếm / phân trang. Verify: 3 theme × 320/360/390/414/768/1024/1440
  không tràn ngang, 0 lỗi JS, 0 request 4xx/5xx; chip đếm khớp header API (489 tổng /
  173 chưa đọc); lọc "Chưa đọc" gửi `unread=true`, "Tất cả" gửi `unread=false`, tìm
  kiếm gửi `q=`; số thẻ = số item API trả về.
- **S3 · Tuỳ chỉnh thông báo** ✅ (2026-11-27) — mockup `screens/notification-prefs.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `NotificationPrefsPage`: banner cũ →
  **đầu trang eyebrow + `h1` "Tuỳ chỉnh thông báo" + sub** (nhấn mạnh "tắt thông
  báo không làm mất việc") + badge "Tự động lưu ngay · Hiệu lực tức thì"; 2 thẻ số
  việc chờ lên dạng card 13px có icon ô vuông bo 9px; các `Card` → **panel mới**
  (header tách viền, bo 13px, body 14–16px) với tiêu đề viết gọn ("Khung giờ yên
  lặng" / "Thông báo đẩy trên thiết bị này"); **ma trận sự kiện** dùng tab header
  9.5px uppercase `font-extrabold` theo spec, dòng sự kiện có đường kẻ
  `border-line-soft` và 3 toggle Web · Email · Push **giữ nguyên hành vi**; input
  giờ yên lặng có `id` + `htmlFor` + focus ring accent. Không đổi nghiệp vụ: cùng
  API `/notifications/preferences` GET/PUT, **lưu ngay không cần bấm Lưu**, có nút
  **Hoàn tác 1 click**, chỉ hiện sự kiện theo vai trò. Verify: 3 theme ×
  320/360/390/414/768/1024/1440 không tràn ngang, 0 lỗi JS, 0 request 4xx/5xx; số
  toggle = 3 × 25 sự kiện API trả về; đổi 1 toggle → **lưu thẳng DB** và hiện nút
  Hoàn tác; bấm Hoàn tác → DB trở lại giá trị cũ; `tsc` + `build` +
  `check-consistency` + `test_theme_responsive` + `test_mockup_responsive` sạch.
- **O1 · Tổng quan OKR** ✅ (2026-11-27) — mockup `screens/okr-dashboard.html` (3 theme ×
  desktop 1440 + mobile 390). Áp vào `OKRDashboardPage`: tiêu đề cũ "Bảng Điều Khiển Mục
  Tiêu & Hiệu Suất (OKR Dashboard)" → **đầu trang eyebrow + `h1` "Tổng quan OKR" + sub**;
  select chu kỳ cao 36px bo 10px có `aria-label`; **banner phase** đổi từ gradient cứng
  sang gradient mềm theo token `accent-line`/`accent-soft`, pill phase bo tròn có icon
  `Target`, **bỏ emoji ⏱ / ✓ / ⏳ / 🚀** sang icon lucide (`Timer`, `CheckCircle2`,
  `Clock`, `Rocket`); trạng thái check-in `CLOSED` nay hiện dạng pill xám có nhãn đầy
  đủ (trước không hiện gì — mất thông tin); nút "Xem nội dung" thành nút có icon
  `ChevronRight`; **3 thẻ điểm** dùng chung layout `.stats`: nhãn 10px uppercase
  `font-extrabold`, số `font-display` 28px, thanh tiến độ 6px bo tròn, badge "Tiến độ
  0%" chuyển `ok` → `gray` (0% không phải đạt); card mục tiêu công ty chuyển sang panel
  13px + khối `status-info-soft` thay emoji 📌; **mobile header panel `flex-wrap`** để
  tiêu đề dài không đẩy số đếm ra ngoài. Không đổi nghiệp vụ: cùng API
  `/okr/dashboard` + `/okr/cycles`, cùng công thức điểm TB (Business + People)/2,
  mục tiêu công ty 20% vẫn tách riêng. Verify: 3 theme × 320/360/390/414/768/1024/1440
  không tràn ngang, 0 lỗi JS; phase/đếm ngược/điểm/việc cần làm/đề xuất khớp API cho
  cả `136ACT` (nhân viên) và `05ACT` (quản lý); `tsc` + `build` + `check-consistency` +
  `test_theme_responsive` + `test_mockup_responsive` sạch.
- **O2 · OKR của tôi** ✅ (2026-11-27) — mockup `screens/okr-my-okr.html` (3 theme ×
  desktop 1440 + mobile 390). Áp vào `MyOKRPage`: `Card` bọc cả trang → **tách đầu
  trang `.phead`** (eyebrow + `h1` phase + 2 badge trạng thái + sub) với 3 nút hành
  động **có icon lucide** (Sparkles / Save / Send) thay emoji ✦ 💾 📤; **xoá lưới 3
  phase trùng thông tin** với `OKRPhaseTimeline` (timeline đã hiện đủ NV/QL + trạng
  thái) — trước hiển thị 2 bản cùng thông tin; các `Card` → **panel 13px** (header
  tách viền, tiêu đề 13.5px + số đếm font-mono); **bỏ hết 11 emoji làm icon**
  (🔒 🔓 ⚠️ 💡 ✏️ 📋 📎 ⏰ ℹ️) sang icon lucide (Lock / LockOpen / AlertTriangle /
  Lightbulb / Pencil / History / Paperclip / Timer); banner khoá sửa dùng
  `status-warn-soft` + `status-warn-line`; **shared `Modal`**: nút đóng ✕ → icon `X`
  kèm `aria-label="Đóng"`; textarea bo 10px + focus ring accent. Không đổi nghiệp vụ:
  cùng API `/okr/my-okr` + `/okr/objectives` + `/okr/check-in`, **vẫn ẩn nút Lưu nháp
  / Gửi duyệt khi bộ mục tiêu đang khoá** (isLocked=true). Verify: 3 theme ×
  320/360/390/414/768/1024/1440 không tràn ngang, 0 lỗi JS, 0 request 4xx/5xx; trang
  **không còn emoji** (kể cả trong modal check-in); modal check-in mở/đóng được;
  API `isLocked=true` → nút Gửi/Lưu **ẩn** và banner khoá sửa **hiện**; `tsc` +
  `build` + `check-consistency` + `test_theme_responsive` + `test_mockup_responsive`
  sạch.
- **O3 · Chu kỳ OKR** ✅ (2026-11-27) — mockup `screens/okr-cycles.html` (3 theme ×
  desktop 1440 + mobile 390). Áp vào `OKRCyclesPage`: tiêu đề "Quản Lý Chu Kỳ OKR" →
  **đầu trang eyebrow + `h1` "Chu kỳ OKR" + sub**, nút "Làm mới" / "Chu kỳ mới" có
  icon lucide (`RefreshCw` / `Plus`) thay emoji ↻ / +; `Card` → **panel 13px** có header
  "Danh sách chu kỳ" + số đếm; header bảng viết tắt 9.5px uppercase `font-extrabold`
  theo spec, ô `px-3` (trước `px-4` khiến bảng rộng dần), cột Năm dùng `font-mono`;
  nút "Cập nhật" / "Xoá" có icon `Pencil` / `Trash2`; khối quy tắc bo 13px + đậm nhãn
  hành động; **mobile đổi từ bảng 4 cột sang danh sách card 2 dòng** (dòng 1 = năm +
  tên + badge · dòng 2 = 3 phase NV/QL · dòng 3 = nút hành động) — bảng 4 cột không
  vừa 390px. Không đổi nghiệp vụ: cùng API `/okr/cycles` + `activate` / `deactivate` /
  `DELETE` (kèm modal xoá cứng 409), giữ nguyên luật "1 chu kỳ active" và các nhãn
  trạng thái NV/QL. Verify: 3 theme × 320/360/390/414/768/1024/1440 không tràn ngang,
  0 lỗi JS; `tsc` + `build` + `check-consistency` + `test_theme_responsive` +
  `test_mockup_responsive` sạch.
- **O4 · Chi tiết / tạo chu kỳ OKR** ✅ (2026-11-27) — mockup
  `screens/okr-cycle-detail.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `OKRCycleDetailPage`: link "← Danh sách chu kỳ" → **nút back có icon** `ArrowLeft`;
  tiêu đề → **đầu trang eyebrow + `h1` + badge + sub**; **bỏ hết 7 emoji làm icon**
  (✎ ▶ 🔔 ⏸ 🔒 🔓 +) sang icon lucide (Pencil / Play / BellRing / PauseCircle /
  Lock / LockOpen / Plus); các `Card` → **panel 13px** (header tách viền, tiêu đề
  13.5px); input/select/textarea bo 10px + focus ring accent; màu `text-danger` →
  `text-status-danger`; dòng "Phase đã khoá cứng" nay có icon `Lock`. Không đổi
  nghiệp vụ: cùng API cấu hình chu kỳ + 3 phase × 2 cửa sổ + mục tiêu công ty, kèm
  modal **mở lại chu kỳ/phase bắt buộc nhập lý do** và ghi audit. Verify: 3 theme ×
  320/360/390/414/768/1024/1440 không tràn ngang, 0 lỗi JS; cả `/okr/cycles/new` và
  `/okr/cycles/:id` đều render đúng; `tsc` + `build` + `check-consistency` +
  `test_theme_responsive` + `test_mockup_responsive` sạch.
- **O5 · Review OKR cả nhóm** ✅ (2026-11-27) — mockup `screens/okr-team-review.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `TeamReviewPage`: tiêu đề → **đầu
  trang eyebrow + `h1` "Review OKR cả nhóm" + sub**; nút "Tải lại" / "Chấm hàng loạt"
  có icon lucide (`RefreshCw` / `CheckCheck`) thay emoji ↻; `Card` → **panel 13px**;
  ô tìm kiếm + 2 select bo 10px cao 38px có `aria-label` + focus ring accent;
  **header bảng 10 cột viết tắt 9.5px uppercase `font-extrabold`** theo spec;
  **bỏ emoji ⚠️** trong cột cảnh báo → icon `AlertTriangle`; `text-danger` →
  `text-status-danger`; empty state có icon `Users` + giải thích "chỉ xuất hiện sau
  khi đã gửi bộ mục tiêu"; **mobile đổi từ bảng 10 cột sang danh sách card 2 dòng**
  (dòng 1 = NV + trạng thái · dòng 2 = 3 nhóm điểm Business/People/TB + QL ·
  dòng 3 = cảnh báo · dòng 4 = link mở form) — bảng 10 cột không vừa 390px. Không
  đổi nghiệp vụ: cùng API `/okr/team-review` + `/okr/reviews/{id}/manager-assess`,
  chấm hàng loạt **bắt buộc nhận xét**, sắp xếp theo rủi ro giảm dần. Verify: 3
  theme × 320/360/390/414/768/1024/1440 không tràn ngang, 0 lỗi JS; trang **không
  còn emoji**; `tsc` + `build` + `check-consistency` + `test_theme_responsive` +
  `test_mockup_responsive` sạch.
- **O6 · Đánh giá OKR (chấm điểm)** ✅ (2026-11-27) — mockup
  `screens/okr-assessment.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `OKRAssessmentPage` + `OkrSelfAssessmentSection`: **tạo component dùng chung
  `components/common/Panel.tsx`** (header tách viền + tiêu đề/mô tả + action, bo 13px,
  body 16px) — thay cho `Card` cũ ở 6 khối; đầu trang → **eyebrow + `h1` + badge +
  sub**, select chọn nhân viên cao 36px có `aria-label`; **bỏ hết 3 emoji làm icon**
  (🔒 👋) sang icon lucide (Lock / UserPlus); textarea bo 10px + focus ring accent;
  `text-danger` → `text-status-danger`. Không đổi nghiệp vụ: cùng form 4 Box
  (Box 1 tự điền · Box 2 Business · Box 3 People · Box 4 định hướng), chấm điểm
  **không có điểm lẻ**, **kết quả bắt buộc khi nộp bản cuối năm**, điểm trung bình
  **tự tính (không có ô nhập tay)**, điểm Quản lý lưu song song để đối chiếu.
  Verify: 3 theme × 320/360/390/414/768/1024/1440 không tràn ngang, 0 lỗi JS; trang
  **không còn emoji**; `tsc` + `build` + `check-consistency` + `test_theme_responsive` +
  `test_mockup_responsive` sạch.
- **O7 · Review & coaching giữa năm** ✅ (2026-11-27) — mockup
  `screens/okr-mid-year-review.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `MidYearReviewPage`: tiêu đề → **đầu trang eyebrow + `h1` + sub**, nút "Mở cho
  nhân viên sửa" có icon `LockOpen` thay emoji 🔓; 7 `Card` → **component `Panel`
  dùng chung** (danh sách NV sticky · chi tiết NV · Business · People · biên bản
  coaching · audit trail · trạng thái tải); **bỏ hết 2 emoji làm icon** (🔒 ⚠️) sang
  icon lucide (Lock / AlertTriangle); tiêu đề nhóm Business/People nay là `action` của
  panel (chấm màu 10px) thay vì chữ trong header; textarea bo 10px + focus ring accent;
  nút "Bớt" dùng `text-status-danger`. Không đổi nghiệp vụ: cùng API review giữa năm,
  **điều chỉnh mục tiêu bắt buộc có lý do + audit trail**, biên bản coaching 3 ý
  (NV chia sẻ · coaching của QL · cam kết H2), mở lại cho NV sửa có ghi audit. Verify:
  3 theme × 320/360/390/414/768/1024/1440 không tràn ngang, 0 lỗi JS; trang **không
  còn emoji**; `tsc` + `build` + `check-consistency` + `test_theme_responsive` +
  `test_mockup_responsive` sạch.
- **O8 · Duyệt mục tiêu OKR cấp dưới** ✅ (2026-11-27) — mockup
  `screens/okr-approvals.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `OKRApprovalsPage`: tiêu đề → **đầu trang eyebrow + `h1` + sub**; **3 nút tab cũ →
  segmented control đúng spec design system** (ô 34px trong khung p-4px, đang chọn
  `bg-ink text-canvas`, đếm bằng font-mono) — trước là 3 nút bo góc dùng
  `bg-accent`; `Card` → **component `Panel` dùng chung** (tiêu đề NV + mã ở header,
  badge trạng thái + nút "Xem chi tiết 2 nhóm" ở action); **bỏ hết 4 emoji làm icon**
  (🔓 ↩️ ✅) sang icon lucide (LockOpen / Undo2 / Check) + thêm icon `Eye` cho nút xem;
  nút "Trả lại" dùng `text-status-danger` + `border-status-danger-line` (trước dùng
  `border-danger/40` — token không tồn tại). Không đổi nghiệp vụ: cùng API duyệt OKR,
  **phê duyệt / trả lại kèm góp ý / mở lại cho NV sửa** với 3 hành động đúng trạng
  thái, modal xem chi tiết 2 nhóm. Verify: 3 theme × 320/360/390/414/768/1024/1440
  không tràn ngang, 0 lỗi JS; trang **không còn emoji**; `tsc` + `build` +
  `check-consistency` + `test_theme_responsive` + `test_mockup_responsive` sạch.
- **O9 · Báo cáo tổng hợp OKR (9 trường)** ✅ (2026-11-27) — mockup
  `screens/okr-reports.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `OKRReportsPage`: tiêu đề → **đầu trang eyebrow + `h1` + sub**, input mốc tính
  thời gian công tác có `aria-label` + bo 10px; **bỏ hết 3 emoji làm icon** (📥 🔒 📊)
  sang icon lucide (Download / Lock / AlertTriangle); **4 widget** từ `Card` → card 13px
  theo layout `.stats` (nhãn 10px uppercase `font-extrabold`, số `font-display` 24px);
  các khối `Card` → **component `Panel` dùng chung** (tóm tắt C15 · tiến độ theo
  nhóm · phân bố điểm · điểm TB theo nhóm · chưa tự đánh giá · danh sách rủi ro) với
  `id` neo giữ nguyên cho link "→ xem nguồn"; **header bảng 13 cột viết tắt 9.5px
  uppercase `font-extrabold`** theo spec; bộ lọc bo 10px có `aria-label`. Không đổi
  nghiệp vụ: cùng API báo cáo HR + export Excel + **chốt & khoá chu kỳ** (có modal
  xác nhận, chặn khi còn hồ sơ chưa chấm), 9 trường dữ liệu + 4 widget + tóm tắt
  C15 + danh sách rủi ro theo rule. Verify: 3 theme × 320/360/390/414/768/1024/1440
  không tràn ngang, 0 lỗi JS; trang **không còn emoji**; `tsc` + `build` +
  `check-consistency` + `test_theme_responsive` + `test_mockup_responsive` sạch.
- **S4 · Quản lý nhân viên & sơ đồ duyệt** ✅ (2026-11-27) — mockup
  `screens/employee-management.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `EmployeeManagementPage`: tiêu đề → **đầu trang eyebrow + `h1` + badge P0 + sub**;
  **4 metric card** từ "icon tròn + chữ" → layout `.stats` (nhãn 10px uppercase
  `font-extrabold` + icon, số `font-display` 24px); chip nhóm → **pill 31px đúng spec**
  (đang chọn `bg-ink text-canvas`); bộ lọc `Card` → **Panel dùng chung**, input/select
  bo 10px có `aria-label` + focus ring accent; **header bảng 8 cột viết tắt 9.5px
  uppercase `font-extrabold`**; **bỏ hết 6 emoji làm icon** (⚠ ×3 🔑 ✕ ⚠️) sang icon
  lucide (AlertTriangle / ShieldAlert / Key / X) — gồm cả marker "⚠ " do **backend**
  gửi kèm trong `approvalChain`, nay được tách ra bằng helper `splitApprovalChain`;
  **mobile đổi từ bảng 8 cột sang danh sách card 2 dòng** (dòng 1 = NV + trạng thái ·
  dòng 2 = nhóm + chuỗi cấp trên + ngày gia nhập · dòng 3 = nút Xem/Sửa/Đổi sếp) —
  bảng 8 cột không vừa 390px. Không đổi nghiệp vụ: cùng API nhân sự + nhóm, đổi
  quản lý **bắt buộc có lý do + ghi audit + chuyển đơn chờ**, thêm/xem/sửa nhân viên.
  Verify: 3 theme × 320/360/390/414/768/1024/1440 không tràn ngang, 0 lỗi JS; trang
  **không còn emoji** (kể cả marker từ backend); `tsc` + `build` + `check-consistency` +
  `test_theme_responsive` + `test_mockup_responsive` sạch.
- **S5 · Cây quản lý / Sơ đồ tổ chức** ✅ (2026-11-27) — mockup
  `screens/org-tree.html` (3 theme × desktop 1440 + mobile 390). Áp vào `OrgTreePage`:
  tiêu đề → **đầu trang eyebrow + `h1` + badge P0 · A4 + sub**, chip cảnh báo "N điểm
  cần sửa" **bỏ emoji ⚠** sang icon `AlertTriangle`; **4 metric card** từ "icon tròn +
  chữ" → layout `.stats` (nhãn 10px uppercase `font-extrabold` + icon, số
  `font-display` 24px); **3 nút chuyển kiểu hiển thị → segmented control** đúng spec
  (khung `p-1` bo 12px, ô 34px bo 9px, đang chọn `bg-ink text-canvas`, có icon
  Workflow/LayoutGrid/ListTree); **4 nút lọc → pill 31px** (`Chỉ xem điểm kẹt` /
  `Ẩn nhóm rỗng` / `Mở tất cả` / `Thu gọn`), có `aria-pressed`; input tìm nhóm bo 10px
  + focus ring accent; mọi khối `Card` → **component `Panel` dùng chung** (toolbar,
  loading, empty state, cây thư mục, drawer chi tiết); **tab lọc thành viên** trong
  drawer → tab header 9.5px uppercase `font-extrabold`, đang chọn gạch accent;
  **bỏ hết emoji làm icon** (`✕` toast / drawer, `⚠` chip lọc, `💡` gợi ý) sang icon
  lucide (X / AlertTriangle / Lightbulb). **Không đổi nghiệp vụ**: cùng API
  `/api/v1/org/tree`, đổi trưởng nhóm (bắt buộc lý do + ghi audit + chuyển đơn chờ),
  gán/đổi sếp cho nhân viên, tạo nhóm con, 3 kiểu hiển thị (Graph / Thẻ phân tầng /
  Cây thư mục) + thu phóng. Verify: 3 theme × 320/360/390/414/768/1024/1440 không
  tràn ngang, 0 lỗi JS; **4 metric khớp đúng API** (11 nhóm / 28 người / 134 đơn /
  8 điểm lỗi); lọc "Chỉ xem điểm kẹt" giữ đúng nhóm có vấn đề; "Ẩn nhóm rỗng" bỏ
  Zeus; drawer mở đúng danh sách thành viên; trang **không còn emoji**; `tsc` + `build` +
  `check-consistency` + `test_theme_responsive` + `test_mockup_responsive` sạch.
- **S6 · Ca làm việc & lịch nghỉ lễ** ✅ (2026-11-27) — mockup
  `screens/shift-holiday.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `ShiftHolidayPage`: tiêu đề → **đầu trang eyebrow + `h1` + badge P0 + sub**; 2 nút
  tab cũ → **segmented control** đúng spec (ô 34px bo 9px, đang chọn `bg-ink
  text-canvas`, icon Clock/Calendar); **mỗi ca là 1 card bo 13px** thay vì 1 khối
  gộp: header tách viền (mã ca `font-mono` trong chip accent + tên + badge trạng
  thái) và **thân 4 ô thời gian** (Vào ca / Ra ca / Nghỉ trưa / Giờ mỗi ngày — icon
  Sun/Moon/Coffee/Landmark, nhãn 9.5px uppercase `font-extrabold`, giờ `font-mono`);
  khung linh hoạt → khối cảnh báo `status-ok-soft` + viền `status-ok-line`; phạm vi
  áp dụng → hàng có icon Shield; **nút Lên/Xuống dùng icon lucide** (ArrowUp/
  ArrowDown) thay ký tự ↑/↓, kèm `aria-label` mô tả hệ quả; **modal chuyển sang
  component `Modal` dùng chung** (tiêu đề + nút đóng X, Escape đóng, scroll body) —
  trước là 2 form tự dựng overlay; input bo 10px + focus ring accent; **bộ chọn CSV**
  (nhóm/chức danh/nhân viên) bo 10px, chip đã chọn có nút X icon thay ký tự ×;
  lịch nghỉ lễ → **Panel dùng chung** + `Badge` hưởng lương / không lương; nút
  hành động dùng `Button` (primary/secondary/outline) theo spec. Không đổi nghiệp vụ:
  cùng API `/api/v1/admin/shifts` + `/admin/holidays`, ca chuẩn không tắt/xóa được,
  sắp xếp ưu tiên ca, tạo/sửa/xóa ca & ngày lễ, validate thiếu tên/ngày. Verify:
  3 theme × 320/360/390/414/768/1024/1440 không tràn ngang, 0 lỗi JS; hiển thị đủ
  2 ca + đúng khung giờ vào/ra/nghỉ + số giờ khớp API; ca chuẩn không có nút
  Tắt/Xóa và bộ chọn phạm vi bị khoá, mã ca khoá khi sửa; validate thiếu tên ngày lễ
  báo lỗi; trang **không còn emoji**; `tsc` + `build` + `check-consistency` +
  `test_theme_responsive` + `test_mockup_responsive` sạch.
- **S7 · Nhật ký kiểm toán (Audit Log)** ✅ (2026-11-27) — mockup
  `screens/audit-log.html` (3 theme × desktop 1440 + mobile 390). Áp vào `AuditLogPage`:
  tiêu đề → **đầu trang eyebrow + `h1` + badge S35 + sub**; **5 metric card** từ "icon
  tròn + chữ" → layout `.stats` (nhãn 10px uppercase `font-extrabold`, số
  `font-display` 24px) — lưới 5 cột ở desktop, 2 cột ở mobile; **7 chip lọc nhóm →
  pill 31px** (`bg-ink text-canvas` khi chọn) kèm **số đếm `font-mono` luôn khớp
  số dòng thực sự hiện ra**; **sửa lỗi lọc nhóm**: tham số `category` của API chỉ
  so khớp tên entity nên chọn "Sửa bảng công" chỉ trả 5 bản ghi thay vì 206 — nay
  lọc **phía client** theo cả `action` lẫn `entity`, bổ sung nhóm "Khiếu nại" và
  "Thiết bị", nhóm "Điểm OKR" (0 bản ghi — OKR ghi audit ở bảng riêng `okr_audit_logs`)
  được thay bằng nhóm có dữ liệu thật; **bảng 7 cột** header 9.5px uppercase
  `font-extrabold` theo spec, cột "Đối tượng" có **entityId bấm được để lọc theo
  nhân viên** (đã thay `<div onClick>` bằng `<button>` để bàn phím dùng được);
  diff **giá trị cũ gạch ngang** (`status-danger-soft`) → mũi tên → **giá trị mới**
  (`status-ok-soft`); nút "Thử xoá" dùng icon ShieldCheck + `status-danger-line`
  (giữ nguyên hành vi kiểm tra append-only); **action badge có nhãn tiếng Việt** cho
  37 hành động thay vì hiện mã kỹ thuật; bộ lọc `Card` → **Panel dùng chung**, input
  bo 10px + focus ring accent; xuất CSV giờ xuất **đúng số dòng đang lọc** và báo
  số dòng trong toast. Không đổi nghiệp vụ: cùng API `/api/v1/admin/audit-logs`,
  lọc keyword/actor/ngày, kiểm tra append-only (405), export CSV. Verify: 3 theme ×
  320/360/390/414/768/1024/1440 không tràn ngang, 0 lỗi JS; **8/8 chip khớp đúng số
  dòng** (1617 / 206 / 127 / 792 / 333 / 164 / 101 / 2); chip "Bảng công" chỉ chứa
  log bảng công; diff cũ→mới hiển thị; click đối tượng lọc được theo nhân viên;
  nút "Thử xoá" trả 405 đúng chuẩn A5; `tsc` + `build` + `check-consistency` +
  `test_theme_responsive` + `test_mockup_responsive` sạch.

- **S8 · Tra cứu nội quy (Policy doc)** ✅ (2026-11-27) — mockup
  `screens/policy-doc.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `PolicyDocPage`: đầu trang eyebrow `BookOpen` + `h1` + badge S19 + sub; **bìa tóm
  tắt** đảo màu (`bg-ink text-canvas`, tự đúng ở cả theme sáng lẫn tối) hiển thị
  **19 quy định · 6 nhóm · số mục đã tuỳ chỉnh** lấy từ dữ liệu; ô tìm kiếm
  (`aria-label="Tìm quy định"`) + dòng đếm khớp kết quả lọc; **7 chip nhóm pill
  31px** có số đếm `font-mono` khớp số thẻ thực hiện; **mục lục 2 tầng thu gọn mặc
  định** (`<details>` — hết chiếm nửa màn hình như bản cũ), bấm nhóm là lọc, bấm
  tên quy định là mở đúng thẻ và cuộn tới; danh sách **accordion chỉ mở 1 mục**
  (`aria-expanded`), thẻ mở hiện mô tả + **ví dụ minh hoạ** (riêng `payroll_period`
  sinh từ chính giá trị đang cấu hình) + **nhãn nghiệp vụ tiếng Việt** từ
  `RuleValueSummary` (không phải key kỹ thuật) + JSON gốc thu gọn cho kỹ thuật;
  hàng quy định **2 dòng trên mobile** (tên trên, mã + phiên bản dưới) — không còn
  tên bị bóp thành 3 dòng; verify 3 theme × 7 bề rộng không tràn ngang (390:
  `scrollWidth=390`), 0 lỗi JS, 0 HTTP ≥ 400; `tsc --noEmit` + `npm run build` sạch.

- **S9 · Bộ quy tắc vận hành (Rule engine)** ✅ (2026-11-27) — mockup
  `screens/rule-engine.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `RuleEnginePage`: tiêu đề "Cấu hình 19 quy định" → **đầu trang eyebrow
  `SlidersHorizontal` "Quản trị HR" + `h1` + badge S16 + sub**; **bìa tóm tắt**
  (`bg-ink text-canvas`, tự đúng cả theme sáng/tối) hiển thị **19 quy định · 6
  nhóm · số mục đã tuỳ chỉnh** từ dữ liệu; ô tìm kiếm ra **Panel** (icon Search,
  focus ring accent) + dòng đếm `Đang hiện N quy định · cập nhật gần nhất <ngày>`;
  thêm **7 chip lọc nhóm pill 31px** (`aria-pressed`, đếm `font-mono` khớp dữ
  liệu) — lọc client theo `category`; **bảng 5 cột → danh sách card 13px**: tên +
  badge nhóm + tag phiên bản, ruleKey mono, **3–4 chip giá trị nghiệp vụ** (đọc
  `fieldMeta`/`formatFieldValue`, không phải JSON thô), mô tả ngắn, **details "Xem
  đủ giá trị đang áp dụng"** mở bảng đầy đủ + JSON gốc cho kỹ thuật; nút **Lịch
  sử/Sửa** xếp dọc desktop, xếp ngang nửa-đầu mobile; 2 modal tự viết → **`Modal`
  dùng chung** (Escape/X đóng, cuộn thân, footer Huỷ/Lưu) — giữ nguyên toàn bộ
  nghiệp vụ (lý do bắt buộc, xác nhận, rollback tạo phiên bản mới, map vị trí văn
  phòng). Verify: 19 mục, LEAVE lọc ra 6, tìm "phép" ra 4, mở rộng/modal sửa/modal
  lịch sử đều PASS; 3 theme × 7 bề rộng không tràn ngang; 0 lỗi JS, 0 HTTP ≥ 400,
  0 emoji; `tsc` + `build` sạch.

- **S10 · Danh mục loại nghỉ phép** ✅ (2026-11-27) — mockup
  `screens/leave-types.html` (3 theme × desktop 1440 + mobile 390). Áp vào
  `LeaveTypesPage` (bảng đơn giản 1 heading → hệ thống card): đầu trang eyebrow
  `CalendarDays` "Quản trị HR" + `h1` "Danh mục loại nghỉ phép" + badge S10 +
  nút **"+ Thêm loại nghỉ"** accent; **bìa tóm tắt** `bg-ink text-canvas` (tổng /
  đang dùng / cần giấy tờ); **4 chip lọc** (Tất cả / Hệ thống / HR tự thêm / Đang
  tắt — đếm khớp dữ liệu, `aria-pressed`, cuộn ngang mobile); **mỗi loại nghỉ =
  card 13px**: mã mono chip accent-soft + tên + tag "hệ thống" (icon Lock) +
  badge đang dùng/đã tắt, **5–6 chip giá trị** (số ngày/năm hoặc Theo BHXH, đơn
  vị, hưởng lương, giấy tờ, hạn gửi, trừ phép năm); nút **Sửa** luôn hiện, **Xoá**
  chỉ loại HR tự thêm; footer giải thích vì sao hệ thống không xoá được. Modal tự
  viết → **`Modal` dùng chung** (thêm `role="dialog"`, `aria-modal`, click nền
  đóng), field Mã (khoá khi sửa) + Tên + số ngày/năm + 4 toggle + đơn vị + hạn
  gửi. Verify: đúng 16 loại, tạo mới rơi vào "HR tự thêm" (1), xoá về 0, modal
  sửa mở với Mã disabled, không emoji; 3 theme × 7 bề rộng không tràn; 0 lỗi JS,
  0 HTTP ≥ 400; `tsc` + `build` sạch.

- **S11 · Thiết bị chấm công** ✅ (2026-11-27) — mockup
  `screens/device-management.html` (3 theme × desktop 1440 + mobile 390). Đầu
  trang eyebrow `ShieldCheck` "Quản trị HR" + badge S11; **bìa tóm tắt** đếm
  chờ duyệt / đang hoạt động / đã thu hồi; **3 Panel** (Chờ duyệt / Đang hoạt
  động / Đã thu hồi) — mỗi thiết bị là dòng card: icon laptop/điện thoại theo
  model, model + tag OS + badge trạng thái, **tên + mã nhân viên** (nạp kèm từ
  `/admin/users`, lỗi thì lùi về mã ID ngắn) + fingerprint mono, meta "Yêu cầu
  lúc / Hoạt động / Hết hạn" hoặc "Thu hồi lúc · Không thể chấm công". Nút Duyệt
  accent, Từ chối/Thu hồi viền danger; hàng mobile rơi xuống dưới, mỗi nút chia
  đôi chiều rộng. `window.prompt` → **Modal thu hồi**: chip lý do nhanh + textarea
  bắt buộc (nút submit disabled tới khi có lý do). Verify: đúng 0/1/3, thu hồi
  chuyển nhóm ngay, disabled→enabled, khôi phục dữ liệu; tên nhân viên hiện đúng
  thay ID; không emoji; 3 theme × 7 bề rộng không tràn; 0 lỗi JS/HTTP ≥ 400;
  `tsc` + `build` sạch.

- **T8 · Sổ cái biến động phép (HR)** ✅ (2026-11-27) — mockup
  `screens/leave-ledger.html` (3 theme × desktop 1440 + mobile 390). Bảng phẳng
  → sổ cái nhóm theo tháng: đầu trang eyebrow `BookOpen` "Chấm công" + h1 + badge
  T8 + 2 nút (Điều chỉnh số dư accent / Xuất CSV viền); **bìa `bg-ink text-canvas`**
  chọn nhân viên + 3 số dư (được hưởng / đã dùng / còn lại); Panel lọc (tìm lý do
  + mã bút toán, chọn tháng, 5 chip loại biến động đếm khớp dữ liệu, cuộn ngang
  mobile); **mỗi tháng = section** với tổng ngày trong tháng, mỗi bút toán là dòng
  card: ngày mono, tag loại (Cấp phép ok / Sử dụng danger / HR điều chỉnh info /
  Hết hạn tồn gray) + loại phép, lý do đầy đủ, meta người thực hiện + mã bút toán,
  số ngày ±kèm số dư còn lại. Modal điều chỉnh số dư dùng `Modal` chung (chip lý do
  nhanh, bắt buộc lý do, validate khác 0). Verify: cộng đúng theo tháng, lọc/tìm
  khớp số đếm, điều chỉnh thêm bút toán mới, 3 theme × 7 bề rộng không tràn;
  0 lỗi JS/HTTP ≥ 400; `tsc` + `build` sạch.

- **T9 · Bảng phép toàn công ty (HR)** ✅ (2026-11-27) — mockup
  `screens/leave-table.html` (3 theme × desktop 1440 + mobile 390). Bảng phẳng
  8 cột → **bìa `bg-ink text-canvas`** "Năm nay · toàn công ty" + 4 số tổng
  (nhân viên / ngày còn lại / sắp hết vàng / đã hết đỏ) khớp bộ lọc hiện tại;
  Panel lọc (tìm tên-mã, chọn nhóm, đếm nhân viên, 3 chip Tất cả / Sắp hết (< 2) /
  Đã hết cuộn ngang mobile); bảng desktop cột đầu **dính trái**, tiêu đề số có
  tooltip giải thích nghiệp vụ, hàng tổng `tfoot` cộng theo bộ lọc; mobile là
  card: avatar chữ cái + badge "Còn X ngày / Hết phép" + lưới 3 số (phép năm còn /
  tồn còn / đã dùng). Mọi dòng/card **link thẳng sổ phép** `?user=<mã>`. Panel
  "Đọc số" giải thích quy tắc ngày 01/04 và 01/07. Verify: 43 dòng → chip 1 / 32 /
  43 khớp, tìm "136" còn 1 dòng, deep-link `?user=01HR` mở đúng sổ, 3 theme ×
  7 bề rộng không tràn; 0 lỗi JS/HTTP ≥ 400; `tsc` + `build` sạch.

- **T12 · Khiếu nại bảng công** ✅ (2026-11-27) — mockup
  `screens/disputes.html` (3 theme × desktop 1440 + mobile 390). Thay
  `window.prompt` bằng **Modal xử lý**: chọn "Duyệt & sửa ô (hiệu lực ngay)" hoặc
  "Bổ sung công (tạo đơn chờ duyệt)", nhập đủ giờ vào/ra khi duyệt sửa giờ, bắt
  buộc lý do. Bìa `bg-ink text-canvas` "Hàng chờ xử lý" + 4 số (cần xử lý vàng /
  đã xử lý / bị từ chối / quá hạn); Panel lọc tìm tên-mã-lý do + 5 chip cuộn ngang
  mobile; thanh **chọn tất cả / duyệt & sửa ô hàng loạt / từ chối hàng loạt** có
  modal lý do chung, đơn không hợp lệ (thiếu giờ đề xuất) bị bỏ qua và **liệt kê
  rõ**; mỗi dòng hiện tag loại (Sửa giờ / WFH / Nghỉ phép), badge trạng thái,
  "NV xin" đúng nội dung, hạn xử lý (quá hạn tô vàng) + số giấy tờ; mobile là
  card với lưới 3 nút. Verify: 3 đơn chờ → modal duyệt sửa giờ 08:30→17:30 lưu
  `RESOLVED/FIX` đúng, modal WFH/nghỉ hiện cảnh báo hiệu lực ngay, bulk từ chối
  bắt buộc lý do, 3 theme × 7 bề rộng không tràn; 0 lỗi JS/HTTP ≥ 400;
  `tsc` + `build` sạch.
- **T13 · Chi tiết khiếu nại** ✅ (2026-11-27) — mockup
  `screens/dispute-detail.html` (3 theme × desktop 1440 + mobile 390). Màn thật vốn
  đã đủ nghiệp vụ 3 nguồn đối chiếu → chỉ làm mockup + verify, không sửa logic. Bố
  cục: đầu trang `h1` + mã đơn + badge trạng thái + dòng NV/mã/ngày công/hạn; bìa
  `bg-ink text-canvas` "Đối chiếu 3 nguồn trước khi sửa" + 3 số (ngày còn lại vàng /
  đơn liên quan / giấy tờ); lưới 3 thẻ **1 · Log gốc** (giờ vào/ra, "không sửa
  được"), **2 · NV khiếu nại** (điều NV xin, đơn liên quan), **3 · Ô bảng công**
  (ký hiệu HR đang giữ); dải nhắc quy tắc màu warn; Panel **Xử lý khiếu nại** (chọn
  chế độ Sửa giờ/WFH/Nghỉ, giờ vào/ra bắt buộc, buổi, lý do bắt buộc, 3 nút Duyệt &
  cập nhật / Tạo đơn bổ sung công / Từ chối). Đơn đã đóng đổi tiêu đề "Chi tiết
  khiếu nại" + Panel "Kết quả xử lý" — đúng như app. Verify (HR 01HR): đơn quá hạn
  DC-01 render đúng 3 thẻ + "Quá hạn"; state PENDING (mock dữ liệu) hiện đủ form
  prefill 08:47, nút hành động có tooltip, mobile 390 không tràn ngang
  (`scrollWidth` = `clientWidth` = 384), 0 lỗi JS; 3 theme × 2 khổ mở được.
  Không sửa code nên `tsc`/`build` giữ nguyên trạng thái sạch của T12.

- **T14 · Thiết bị của tôi** ✅ (2026-11-27) — mockup `screens/my-devices.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `MyDevicesPage`: đầu trang gọn +
  badge T14; bìa `bg-ink` "Chỉ máy đã đăng ký mới chấm công được" + 3 số (x/2 đang
  hoạt động, chờ duyệt, đã thu hồi); Panel danh sách với nút `+ Đăng ký` (đổi thành
  "Máy này đã đăng ký" khi fingerprint hiện tại nằm trong danh sách); mỗi dòng có
  icon laptop/phone, tên + nền tảng + badge trạng thái + badge "thiết bị hiện tại",
  fingerprint mono, giờ hoạt động / gửi yêu cầu, nút Hủy yêu cầu / Xóa thiết bị;
  Panel hồ sơ khuôn mặt + link Passkey. Verify (NV 01HR): 2 thiết bị thu hồi render
  đúng nhãn xám, mobile 390 không tràn ngang, 0 lỗi JS; `tsc` + `build` sạch.
- **T15 · Đăng ký thiết bị** ✅ (2026-11-27) — mockup `screens/add-device.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `AddDevicePage`: bìa `bg-ink` theo
  hạn mức (còn hạn → "Kích hoạt thiết bị đang mở"/"Ngay"; đủ 2/2 → cảnh báo + "30
  ngày hiệu lực"), form 1 panel: fingerprint readonly, tên thiết bị, khối lý do bắt
  buộc + cảnh báo Wi-Fi nội bộ 403 + quy định khi vượt hạn mức; khối xanh khi còn
  hạn mức; nút Hủy / Thêm thiết bị (Gửi yêu cầu chờ HR duyệt); trạng thái gửi xong
  dùng `ok-soft`. Giữ nguyên API `/devices/request` + header `X-Office-Network` +
  `wifiBssid`. Verify: tài khoản còn hạn mức render khối xanh và nút "Thêm thiết
  bị", mobile 390 không tràn, 0 lỗi JS; `tsc` + `build` sạch.

- **AC2 · Passkey & bảo mật** ✅ (2026-11-27) — mockup `screens/passkey.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `PasskeySettingsPage`: đầu trang
  gọn + badge AC2; bìa `bg-ink` "Private key không bao giờ rời thiết bị" + số
  passkey / 100% an toàn phần cứng; Panel "Passkey của tài khoản" (nút `+ Thêm
  passkey`, mỗi dòng có icon fingerprint, tên + badge "Đang dùng", giờ đăng ký &
  dùng gần nhất, nút Gỡ) + empty/đang tải; Panel "Cách hoạt động" 3 bước đánh số
  + ghi chú link "Thiết bị của tôi". Giữ nguyên API webauthn, xác nhận confirm
  khi gỡ. Verify (NV 136ACT): 1 passkey thật render đúng, mobile 390 không tràn
  (`scrollWidth`=`clientWidth`=384), Bento mobile tương phản tốt, 0 lỗi JS
  (`tsc` + `build` sạch).
- **A2 · Đăng ký khuôn mặt** ✅ (2026-11-27) — mockup `screens/face-enrollment.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `FaceEnrollmentPage`: nâng cấp
  đầu trang + hero tối (4 hồ sơ đã nạp · 1 góc chụp · vector 128D); tab ngang
  gọn (Đăng ký 1 góc · Thử nghiệm 1:N · Quản lý hồ sơ) có badge; camera khung
  cố định 290px desktop / 220px mobile (sửa `aspect-4/3` không tồn tại → oval
  gợi ý co theo khổ); panel phải gọn: mã NV + phòng ban dạng ô, họ tên/phòng ban
  sửa được, chế độ 1 góc ⇄ 3 góc, checkbox đồng ý lưu vector (bắt buộc trước khi
  gửi), ghi chú "ảnh gốc không lưu". Giữ nguyên API enroll + tab verify/profile.
  Verify: Midnight desktop+mobile 390 không tràn; Bento desktop tương phản tốt;
  tab verify render đúng; `tsc` + `build` sạch.
- **S48 · Cấu hình Domain Host** ✅ (2026-11-27) — mockup `screens/system-config.html`
  (3 theme × desktop 1440 + mobile 390). Áp vào `SystemDomainConfigPage`: đầu
  trang chuẩn + badge S48; bìa `bg-ink` "Một tên miền chuẩn — mọi liên kết hệ
  thống" + 3 số host/môi trường/cập nhật gần nhất; cột trái Panel "Thiết lập tên
  miền gốc" (input + preset + lý do + nút lưu) và Panel "Xem trước liên kết tự
  động"; cột phải Panel trạng thái (host, DB key, người/thời gian sửa), Panel
  chính sách, thẻ Gmail SMTP. Giữ nguyên API `GET/PUT system-config`, nút Nạp
  lại & modal Gmail. Verify (HR 01HR): 3 theme desktop + mobile 390 đều không
  tràn ngang, `tsc` + `build` sạch, `test_theme_responsive` ĐẠT.
- **T3 · Lịch nhóm** ✅ (2026-11-27) — mockup `screens/team-schedule.html` đã đủ
  3 theme × desktop 1440 + mobile 390; app `TeamSchedulePage` vốn khớp khung
  (bìa tóm tắt, banner xung đột, lưới tháng/tuần, legend, panel chi tiết ngày).
  Bổ sung theo mockup: panel chi tiết trên mobile thu gọn người có mặt — hiện 5
  người đầu, phần còn lại gộp sau nút "+N người khác đang có mặt đủ ngày" (bấm
  để mở đủ, desktop vẫn hiện toàn bộ). Verify manager 05ACT: 3 theme × 4 bề rộng
  320/390/768/1440 không tràn ngang, nút gộp/mở đúng, `tsc` + `build` sạch.
- **SH1–SH5 · Shell** ✅ (2026-11-27) — Sidebar/Header/BottomNav dùng chung đã token
  3 theme (`rail-*` cho rail tối, rail trắng ở Ascend Clean), không còn hex cứng;
  Command palette (⌘K) + Theme switcher trong Header render đúng theme. Verify:
  desktop 1440 (palette 3 theme) + mobile 390 (drawer mở/đóng ở 3 theme), không
  tràn, `test_theme_responsive` ĐẠT.
- **SH2 · Header (tinh chỉnh)** ✅ (2026-11-28) — desktop bỏ badge ACT-HKT trùng
  thương hiệu, thay bằng **crumb + tên màn** lấy từ nav (khớp path hoặc màn cha gần
  nhất: `/okr/cycles/new` → "Chu kỳ OKR"); mobile giữ brand `ACT-HKT` (ẩn <360px).
  Giảm mật độ mobile: ẩn theme switcher (đổi ở Hồ sơ), giữ tìm kiếm/chuông/camera/
  avatar/đăng xuất; mọi nút icon 36×36 + `aria-label`. Verify 320/360/375/390/414/
  768/1024/1440: header không tràn ngang, đổi theme 3 template ổn, tìm kiếm/palette/
  hồ sơ/logout hoạt động, `tsc` + `build` sạch.
- **M1–M4 · Modal** ✅ (2026-11-27) — Đổi mật khẩu (desktop 3 theme), Đổi mật khẩu
  lần đầu (mobile 390 3 theme, nút Bỏ qua/Cập nhật rõ), Kết nối Gmail (System
  Domain Config, 3 theme), Nhắc bật Web Push (toast desktop + mobile). Tất cả dùng
  token (`surface/line/ink/status-*`), không có màu cứng; nội dung không tràn ở
  390px.
- **SH1 · Tổ chức lại menu (2026-11-28)** — Nhóm HR 13 mục tách thành
  **Chấm công & phép** (bảng công/chốt, khiếu nại, bảng phép, sổ phép) ·
  **Quản trị nhân sự** (nhân viên, cây quản lý, ca & lễ, loại nghỉ, thiết bị) ·
  **Cấu hình & hệ thống** (bộ quy tắc, audit, domain); mục OKR của HR gộp vào
  nhóm OKR chung thay vì lặp header. Thêm **Sổ phép nhân viên**
  (`/attendance/leave-ledger`, màn T8) vốn có route nhưng thiếu menu. Menu
  nhân viên đổi “Quy định tra cứu” → **Nội quy & quy chế** trỏ
  `/attendance/policy-doc` (không còn dùng route `/admin`). HR/Manager vẫn là
  2 nhánh song song, Admin = cả hai. Verify HR 01HR: 3 theme + mobile drawer,
  click 3 link mới mở đúng màn; `tsc` + `build` + `check-consistency` sạch.
