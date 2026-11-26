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
| S2 | Thông báo (mobile) | `/notifications` | `MobileNotificationsPage` | ✅ | ✅ | ✅ |
| S3 | Tuỳ chỉnh thông báo | `/account/notifications` | `NotificationPrefsPage` | ✅ | ✅ | ✅ |
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
| T1 | Chấm công | `/attendance/checkin` | `CheckInPage` | ✅ | ✅ | ✅ |
| T2 | Lịch chấm công | `/attendance/calendar` | `CalendarPage` | ✅ | ✅ | ✅ |
| T3 | Lịch nhóm | `/attendance/team-schedule` | `TeamSchedulePage` | ⬜ | ⬜ | ⬜ |
| T4 | Đơn từ | `/attendance/requests` | `RequestsPage` | ✅ | ✅ | ✅ |
| T5 | Chi tiết đơn | `/attendance/requests/:id` | `RequestDetailPage` | ✅ | ✅ | ✅ |
| T6 | Duyệt đơn | `/attendance/approvals` | `ApprovalsPage` | ✅ | ✅ | ✅ |
| T7 | Nghỉ phép của tôi | `/attendance/leaves` | `LeavesPage` | ✅ | ✅ | ✅ |
| T8 | Sổ phép (HR) | `/attendance/leave-ledger` | `AdminLeaveLedgerPage` | ⬜ | ⬜ | ⬜ |
| T9 | Bảng công tổng (HR) | `/attendance/leave-table` | `LeaveTablePage` | ⬜ | ⬜ | ⬜ |
| T10 | Bảng công (HR) | `/attendance/timesheet` | `TimesheetPage` | ✅ | ✅ | ✅ |
| T11 | Bảng công của tôi | `/attendance/my-timesheet` | `MyTimesheetPage` | ✅ | ✅ | ✅ |
| T12 | Khiếu nại công | `/attendance/disputes` | `DisputesPage` | ⬜ | ⬜ | ⬜ |
| T13 | Chi tiết khiếu nại | `/attendance/disputes/:id` | `DisputeDetailPage` | ⬜ | ⬜ | ⬜ |
| T14 | Thiết bị của tôi | `/attendance/devices` | `MyDevicesPage` | ⬜ | ⬜ | ⬜ |
| T15 | Thêm thiết bị | `/attendance/devices/add` | `AddDevicePage` | ⬜ | ⬜ | ⬜ |

## 3 · Tài khoản

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| AC1 | Hồ sơ cá nhân (+ chọn theme) | `/account/profile` | `ProfilePage` | ✅ | ✅ | ✅ |
| AC2 | Passkey & bảo mật | `/account/passkey` | `PasskeySettingsPage` | ⬜ | ⬜ | ⬜ |

## 4 · OKR

| # | Màn hình | Route | Component | Design | Impl | Verify |
|---|---|---|---|---|---|---|
| O1 | Tổng quan OKR | `/okr/dashboard` | `OKRDashboardPage` | ✅ | ✅ | ✅ |
| O2 | OKR của tôi | `/okr/my-okr` | `MyOKRPage` | ✅ | ✅ | ✅ |
| O3 | Chu kỳ OKR | `/okr/cycles` | `OKRCyclesPage` | ✅ | ✅ | ✅ |
| O4 | Chi tiết / tạo chu kỳ | `/okr/cycles/new` · `/okr/cycles/:id` | `OKRCycleDetailPage` | ✅ | ✅ | ✅ |
| O5 | Review OKR nhóm | `/okr/team-review` | `TeamReviewPage` | ✅ | ✅ | ✅ |
| O6 | Đánh giá OKR | `/okr/assessment` | `AssessmentPageRoute` | ✅ | ✅ | ✅ |
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
