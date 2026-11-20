# 05 — Mô hình dữ liệu

## 1. Quy ước

- **Khóa chính:** mã định danh duy nhất, sinh tự động.
- **Thời gian:** đầy đủ ngày + giờ cho mốc thời gian; ngày làm việc lưu dạng ngày; **múi giờ lưu theo Asia/Ho_Chi_Minh** (UTC+7).
- **Số thập phân:** làm tròn 2 chữ số thập phân cho công/điểm/phép (tránh lỗi số thực với phép nửa ngày).
- **Dữ liệu linh hoạt:** một số mục có cấu trúc thay đổi theo loại (giá trị quy định, ảnh chụp báo cáo, dữ liệu trước/sau khi sửa) thì lưu ở dạng cấu trúc linh hoạt.
- **Xóa:** không xóa cứng dữ liệu nghiệp vụ → **xóa mềm** bằng `deleted_at` hoặc `status`. Riêng nhật ký thay đổi (`AuditLog`) **không bao giờ** xóa.
- **Mọi bảng nghiệp vụ** có `created_at`, `updated_at`. Bảng có chu kỳ/khóa thêm `locked_at`, `locked_by`.

## 2. Các thực thể nghiệp vụ và quan hệ giữa chúng

> Toàn bộ hệ thống chia làm **3 nhóm thực thể**: nhân sự & tổ chức, chấm công & phép, OKR.
> Dưới đây là quan hệ ở mức nghiệp vụ — không quan tâm bảng nào lưu ở đâu.

| Thực thể | Quan hệ với | Ghi chú |
|---|---|---|
| **Nhóm (`Team`)** | lồng nhau (`parent_team_id`), chứa **Người dùng** qua **Thành viên nhóm**, có **Trưởng nhóm** (`lead_id`) | Đơn vị phối hợp & phân trách duyệt. Công ty chính là một nhóm gốc; **không** có khái niệm phòng ban / chi nhánh |
| **Thành viên nhóm (`TeamMember`)** | thuộc **Nhóm**, là **Người dùng** | 1 người có thể thuộc **nhiều** nhóm |
| **Người dùng (`User`)** | thuộc **Chức danh**, có **Quản lý** (`manager_id`), là **Người gửi** của đơn & OKR, có **Phạm vi xem** (`UserScope`) | 4 vai trò: nhân viên · quản lý · HR · admin |
| **Chức danh (`Position`)** | thuộc tính của **Người dùng** | Không phải đơn vị tổ chức |
| **Phạm vi xem (`UserScope`)** | gán cho **Người dùng**, trỏ tới **Nhóm** / **Chức danh** / chính mình | Quyết định người đó thấy dữ liệu ai |
| **Thiết bị chấm công (`DeviceRegistration`)** | thuộc **Người dùng** | Thiết bị đã đăng ký được chấm công |
| **Hồ sơ khuôn mặt (`FaceProfile`)** | thuộc **Người dùng**, 1 hồ sơ active | Vector đặc trưng để đối chiếu khi chấm công; **không lưu ảnh thô** |
| **Bản ghi chấm công (`TimeEntry`)** | của **Người dùng**, 1 dòng/ngày | Nguồn sự thật để tính bảng công |
| **Bảng công (`Timesheet`)** | của **Người dùng** × 1 kỳ tháng, gồm nhiều **Ô công** (`TimesheetDay`) | Có vòng đời: tạm tính → công bố → khiếu nại → chốt & khóa |
| **Ô công (`TimesheetDay`)** | thuộc **Bảng công**, 1 ô = 1 người × 1 ngày | Lưu **trạng thái nửa ngày**, không lưu chuỗi ký hiệu |
| **Khiếu nại bảng công (`TimesheetDispute`)** | thuộc **Bảng công**, của **Người dùng** | Mở trong cửa sổ 2 ngày sau khi HR công bố |
| **Giao dịch phép (`LeaveTransaction`)** | của **Người dùng**, theo loại nghỉ & kỳ | Sổ phép: công/nghỉ, dư & đã dùng |
| **Loại nghỉ (`LeaveType`)** | có **Đơn nghỉ phép** | HR cấu hình được, **không** cố định trong phần mềm |
| **Đơn nghỉ phép (`LeaveRequest`)** | của **Người dùng**, thuộc **Loại nghỉ** | Lưu **ảnh chụp tham số** lúc gửi |
| **Đơn từ (`Request`)** | của **Người dùng**, đi qua **Luồng duyệt** | Đi muộn · bổ sung công · nghỉ phép · WFH |
| **Luồng duyệt (`ApprovalFlow`)** | gồm các **Bước duyệt** (`ApprovalStep`) | Cấu hình được: ai duyệt, mấy bước, SLA bao nhiêu giờ |
| **Bước duyệt (`ApprovalStep`)** | thuộc **Luồng duyệt**, có **Người được xem** (`ApprovalViewer`) | Tách **quyền xem** khỏi **quyền duyệt** |
| **Người được xem (`ApprovalViewer`)** | của **Bước duyệt**, chỉ tới **Người dùng** | Ảnh chụp ai được xem 1 đơn ở 1 bước, để audit & gỡ quyền |
| **Việc cần làm (`ApprovalTask`)** | gán cho người duyệt, thuộc **Đơn từ** | Có SLA để tính cảnh báo quá hạn |
| **Nhóm OKR (`OkrCycle`)** | chứa **Mục tiêu** (`Objective`) | Chu kỳ 2026 (đang chạy) + 2025 (đã chốt) |
| **Mục tiêu (`Objective`)** | của **Người dùng**, thuộc **Nhóm OKR**, có **Kết quả chính** | 2 mục tiêu/NV/kỳ: 1 Business + 1 People |
| **Kết quả chính (`KeyResult`)** | thuộc **Mục tiêu**, có **Check-in** & **Điểm đạt** | 3 KR mỗi mục tiêu |
| **Phân công OKR (`OkrAssignment`)** | gán **Mục tiêu** cho **Người dùng** / **Nhóm** | Quyền đọc & quyền trả lời check-in |
| **Check-in OKR (`OkrCheckIn`)** | của **Kết quả chính** | Giá trị + ghi chú (tiến độ tự tính) |
| **Điểm đạt (`OkrAchievement`)** | của **Mục tiêu**, theo nhóm Business/People | Thang 1–5, **không số lẻ, không 0** |
| **Đánh giá (`Review`)** | của **Người dùng** trong **Nhóm OKR** | Manager chấm & duyệt hàng loạt |
| **Quy định (`RuleConfig`)** | nhiều **phiên bản** theo phạm vi & thời gian | Mỗi phạm vi chỉ **1 phiên bản đang áp dụng** |
| **Cấu hình quy định (`RuleConfig`)** | áp dụng cho: toàn công ty / nhóm / chức danh / ca | Có ngày hiệu lực + lý do thay đổi + rollback |
| **Tài liệu (`Document`)** | quy định & chính sách cho **Trang quy định tra cứu** (C7) | Sinh từ cùng catalog với C13 |
| **Lịch trình báo cáo (`ScheduledReport`)** | định kỳ gửi báo cáo theo phân hệ | Có lịch, người nhận, tham số lọc |
| **View đã lưu (`SavedView`)** | của **Người dùng**, thuộc 1 phân hệ | Bộ lọc đã lưu để tái sử dụng |
| **Sửa ô bảng công (`TimesheetEdit`)** | của **Bảng công**, do **Người dùng** thực hiện | Ghi lại mọi lần sửa: cột, giá trị cũ/mới, lý do |
| **Việc cần làm hằng ngày (`ActionItem`)** | của **Người dùng**, gom từ nhiều phân hệ | Todo inbox (C1) |
| **Chỉ mục tìm kiếm (`SearchIndex`)** | gộp nhiều loại thực thể | Command palette (C3) |
| **Nhật ký thay đổi (`AuditLog`)** | ghi lại thao tác của **Người dùng** trên mọi thực thể | **Không bao giờ xóa** |
| **Thông báo (`Notification`)** | gửi cho **Người dùng**, gắn với 1 việc | 3 kênh: push · email · badge |
| **Tuỳ chọn thông báo (`NotificationPreference`)** | của **Người dùng**, theo từng sự kiện × kênh | Chỉ lưu dòng khi user **tắt** hoặc đổi kênh |
| **Đăng ký push (`PushSubscription`)** | của **Người dùng** | 1 người có thể đăng ký nhiều thiết bị |
| **Phiên đăng nhập (`RefreshToken`)** | của **Người dùng** | Chỉ lưu **mã băm** của phiên — lộ dữ liệu cũng không dùng được |

## 3. Các chỉ mục truy vấn quan trọng

> Đây là các **đường dẫn truy vấn thường xuyên** của hệ thống — quyết định tốc độ màn hình nào là
> "nặng" và cần chỉ mục riêng.

| Chỉ mục | Trường | Mục đích | Vì sao cần |
|---|---|---|---|
| `idx_timeentry_user_date` | `user_id`, `work_date` | Lấy lịch chấm công của 1 người trong 1 khoảng ngày | Chấm công là truy vấn nặng nhất, luôn lọc theo người + ngày |
| `idx_timeentry_date` | `work_date` | Lấy toàn bộ bản ghi chấm công trong 1 ngày | Báo cáo theo ngày & đối soát toàn công ty |
| `idx_timesheet_user_period` | `user_id`, `period_start` | Mở bảng công của 1 người trong 1 kỳ | Mỗi người chỉ có 1 bảng công mỗi kỳ → phải là duy nhất |
| `idx_timesheet_status` | `status`, `period_start` | Lọc bảng công theo trạng thái (tạm tính / công bố / đã khóa) | HR mở danh sách kỳ đang công bố & kỳ cần chốt |
| `idx_leave_txn_user_year` | `user_id`, `year_key` | Xem sổ phép cả năm của 1 người | Tính số dư phép tồn theo năm |
| `idx_leave_txn_user_month` | `user_id`, `month_key` | Xem sổ phép trong tháng | Tính phép nghỉ theo kỳ công |
| `idx_leave_txn_type` | `type` | Tổng hợp theo loại nghỉ | Đối chiếu cột tổng hợp bảng công |
| `idx_request_user_status` | `user_id`, `status` | Danh sách đơn của 1 người theo trạng thái | Màn hình "đơn của tôi" |
| `idx_request_type_status` | `request_type`, `status` | Lọc đơn theo loại & trạng thái | Todo inbox & bộ lọc đa chiều |
| `idx_request_dates` | `start_date`, `end_date` | Tìm đơn phủ trong một khoảng ngày | Chặn trùng ngày đã nghỉ phép |
| `idx_apptask_assignee_status` | `assignee_id`, `status` | Việc duyệt đang chờ tôi | Màn hình việc cần làm |
| `idx_apptask_sla` | `status`, `assigned_at` (chỉ việc đang chờ) | Tìm việc quá hạn để leo thang | Chỉ lọc việc đang chờ → nhỏ hơn nhiều |
| `idx_objective_user_cycle` | `user_id`, `cycle_id` | Mục tiêu của 1 người trong 1 chu kỳ | Mỗi người có đúng 2 mục tiêu mỗi kỳ |
| `idx_objective_status` | `status`, `cycle_id` | Lọc mục tiêu theo trạng thái trong chu kỳ | Bảng điều khiển OKR |
| `idx_objective_team` | `team_id`, `cycle_id` | Mục tiêu của 1 nhóm trong 1 chu kỳ | Review theo nhóm (C9) |
| `idx_kr_objective` | `objective_id` | Kết quả chính của 1 mục tiêu | Tính điểm đề xuất & hiển thị cây mục tiêu |
| `idx_audit_entity` | `entity_type`, `entity_id`, `created_at` (mới nhất trước) | Lịch sử thay đổi của 1 thực thể | Truy vết "ai sửa cái này, khi nào" |
| `idx_audit_actor` | `actor_id`, `created_at` (mới nhất trước) | Toàn bộ thao tác của 1 người | Audit & điều tra quyền |
| `idx_notif_user_unread` | `user_id`, `is_read`, `created_at` (mới nhất trước) | Thông báo chưa đọc của 1 người | Badge đếm số + danh sách thông báo |
| `idx_refresh_token_hash` | `token_hash` | Tìm phiên đăng nhập theo mã băm | Đăng xuất thật (thu hồi phiên) |
| `idx_refresh_token_user` | `user_id`, `revoked_at` | Liệt kê phiên của 1 người, đã thu hồi hay chưa | Thu hồi hàng loạt khi đổi mật khẩu |
| `idx_notifpref_user` | `user_id` | Tuỳ chọn thông báo của 1 người | Bảng nhỏ, truy vấn theo người |
| `idx_pushsub_user` | `user_id` | Thiết bị đã đăng ký nhận push của 1 người | Gửi thông báo tới mọi thiết bị |
| `idx_savedview_owner` | `owner_id`, `module` | View đã lưu của 1 người theo phân hệ | Mở nhanh bộ lọc đã lưu (C5) |
| `idx_team_member_user` | `user_id` | Các nhóm 1 người thuộc | Phân quyền theo nhóm |
| `idx_team_member_team` | `team_id` | Thành viên của 1 nhóm | Danh sách nhóm & trưởng nhóm |
| `idx_team_parent` | `parent_team_id` (chỉ nhóm còn hoạt động) | Nhóm con của 1 nhóm | Dựng cây tổ chức |
| `idx_team_lead` | `lead_id` (chỉ nhóm còn hoạt động) | Nhóm do 1 người dẫn | Tìm việc duyệt theo trưởng nhóm |
| `idx_team_code` | `code` | Tìm nhóm theo mã | Mã nhóm là duy nhất → tra cứu nhanh |
| `idx_approvalviewer_subj` | `subject_type`, `subject_id` | Ai được xem 1 thực thể cụ thể | Gỡ quyền xem khi đổi cấu hình |
| `idx_approvalviewer_user` | `viewer_id` | Các thực thể 1 người được xem | Danh sách "tôi được xem đơn nào" |
| `idx_rule_active` | `rule_key`, `scope_type`, `scope_ref_id` (quy định đang hiệu lực) | Quy định đang áp dụng cho 1 phạm vi | Mỗi phạm vi chỉ được có **1** phiên bản đang áp dụng |
| `idx_rule_lookup` | `rule_key`, `scope_type`, `scope_ref_id`, `effective_from` (mới nhất trước) | Tra cứu quy định theo thời gian | Tính lại lịch sử: bảng công tháng 5 dùng quy định có hiệu lực tháng 5 |

## 4. Quy tắc "khóa kỳ" (điểm mấu chốt — Mục 6.7 & 4.3)

Cả bảng công và OKR đều có **vòng đời khóa**. Quy tắc bắt buộc:

**Trạng thái chung của mọi bảng có thể chốt/khóa:**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `status` | Trạng thái hiện tại của kỳ | Tạm tính · công bố · đang xử lý khiếu nại · **đã khóa** |
| `locked_at` | Thời điểm khóa | Bỏ trống = chưa khóa |
| `locked_by` | Người thực hiện khóa | Bỏ trống = chưa khóa |

> **Ghi vào khi trạng thái đã khóa → bị chặn ở tầng nghiệp vụ (không chỉ ở màn hình).**
> **Mọi thay đổi sau khóa đều được ghi vào nhật ký thay đổi.**

**Luật nghiệp vụ (Mục 6.7) — CHỐT 17/11/2026:**
> **Kỳ đã khóa là bản cuối cùng. Không có điều chỉnh sau khóa.**
> Không có bản ghi "điều chỉnh kỳ", không áp đơn vào kỳ sau, không sửa ngược kỳ đã chốt.

**Áp đơn đã duyệt vào bảng công:**
- Tìm kỳ công theo ngày bắt đầu của đơn → mở bảng công của người gửi trong kỳ đó (chưa có thì tạo).
- **Nếu kỳ đã khóa → KHÔNG áp, KHÔNG tạo bản ghi điều chỉnh.** Báo lỗi:
  *"Kỳ công {kỳ} đã chốt và khóa — đơn không thể áp dụng. Liên hệ HR để xử lý ngoài hệ thống nếu cần."*
- Nếu chưa khóa → áp đơn vào bảng công như bình thường.

**Chặn ngay từ đầu (không đợi đến lúc duyệt):**
- Tạo đơn nhắm tới ngày thuộc kỳ đã khóa → **chặn khi tạo**, báo "Kỳ này đã chốt".
- Đơn đang chờ mà kỳ của nó bị khóa trong lúc chờ → **tự động hủy** với lý do "Kỳ đã chốt", thông báo cho người gửi.
- Đơn đã duyệt trước khi khóa thì đã nằm trong bảng công → không có gì phải bù.

> **Vì sao bỏ điều chỉnh kỳ sau:** hệ thống **không quản lý lương** — nó chỉ xuất bảng công.
> Một bản ghi "điều chỉnh" không có nơi tiêu thụ sẽ thành dữ liệu chết, và người dùng tưởng
> mình đã được tính công trong khi bảng công thật vẫn không đổi. Thà chặn rõ ràng.

**Vòng đời 1 kỳ công** (rule `payroll_period` — `publish_day` = 11, `dispute_window_days` = 2, `lock_delay_days` = 3):

```
Kỳ 11/2026                                    (hôm nay 12/11 — đang ở bước 1)
      │
      ├─ 11/11  HR CÔNG BỐ bảng công TẠM TÍNH   → status = published
      │                                          dispute_deadline = 13/11
      │        Nhân viên xem bảng công của mình, đếm ngược 2 ngày để khiếu nại
      │        (đây là lúc màn hình "Bảng công của tôi" hiện đồng hồ đếm ngược)
      │
      ├─ 12/11  HR XỬ LÝ khiếu nại (nếu có)     → status = reviewing
      │        Nhân viên vẫn khiếu nại được đến hết 13/11
      │
      ├─ 30/11  Kỳ công kết thúc
      │
      └─ 03/12  HR CHỐT & KHÓA                   → status = locked
```

> **Vì sao công bố giữa kỳ chứ không đợi cuối tháng:** nhân viên cần thấy số liệu
> **sớm** để khiếu nại kịp — nếu đợi tới 01/12 mới công bố thì lỗi chấm công đầu tháng
> phải chờ gần một tháng mới biết. Công bố ngày 11 → lỗi ngày 05/11 được khiếu nại
> ngay, HR xử lý trong 2 ngày.
>
> **Nhân viên xem được bảng công của mình cả khi kỳ chưa kết thúc** (tạm tính, cập nhật
> theo ngày) — nhưng **chỉ khiếu nại được sau khi HR công bố** (`published`), vì trước đó
> số liệu chưa chốt.

## 4b. Dữ liệu của các tính năng tiện lợi (C1–C13)

### Todo inbox (C1)

**Việc cần làm (`ActionItem`)** — mọi việc một người cần làm, gom từ nhiều phân hệ:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh việc | Khóa chính |
| `user_id` | Người cần làm việc này | Bắt buộc |
| `module` | Phân hệ sinh ra việc | `timesheet` \| `okr` \| `system` |
| `kind` | Loại việc | Bắt buộc |
| `title` | Tiêu đề việc | Bắt buộc — ví dụ "Chấm công ra", "Check-in KR: Doanh thu Q4" |
| `description` | Mô tả chi tiết | Tùy chọn |
| `due_at` | Hạn hoàn thành | Có thể bỏ trống = không có hạn |
| `urgency` | Mức độ gấp | `normal` \| `soon` \| `overdue` \| `sla_breach` |
| `action_url` | Đường dẫn tới màn hình xử lý | Bắt buộc — nút hành động 1 chạm |
| `action_label` | Nhãn trên nút hành động | Bắt buộc — ví dụ "Chấm công", "Check-in ngay" |
| `entity_type`, `entity_id` | Thực thể gốc sinh ra việc | Để mở đúng nơi cần xử lý |
| `status` | Trạng thái việc | `open` \| `done` \| `dismissed` |
| `created_at` | Thời điểm sinh việc | Ghi tự động |
| `done_at` | Thời điểm hoàn thành | Bỏ trống = chưa xong |

### Command palette (C3)

**Chỉ mục tìm kiếm (`SearchIndex`)** — chỉ mục tìm kiếm thống nhất, gộp mọi loại thực thể:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh mục tìm kiếm | Khóa chính |
| `kind` | Loại thực thể được tìm | `user` \| `request` \| `objective` \| `timesheet` \| `document` \| `rule` \| `action` |
| `title` | Tiêu đề hiển thị | Bắt buộc |
| `subtitle` | Mô tả phụ | Tùy chọn |
| `content` | Nội dung đã chuẩn hóa để tìm | Đã bỏ dấu, chuyển chữ thường |
| `url` | Đường dẫn tới kết quả | Bắt buộc |
| `role_scope` | Ai được thấy kết quả này | Bắt buộc — chỉ trả về đúng phạm vi người dùng được phép |
| `updated_at` | Mốc cập nhật chỉ mục | Ghi tự động |

> **Vì sao không dùng tìm kiếm toàn văn có sẵn:** tiếng Việt không có từ điển tốt nên tìm kiếm
> toàn văn cho kết quả sai. Chỉ mục riêng, so khớp theo từ bỏ dấu + tiền tố, cho kết quả chính xác.

### Lưu view (C5)

**View đã lưu (`SavedView`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh view | Khóa chính |
| `owner_id` | Người sở hữu view | Bắt buộc |
| `name` | Tên view | Bắt buộc — ví dụ "Đi muộn tháng này" |
| `module` | Phân hệ áp dụng | `timesheet` \| `okr` \| `requests` |
| `filters` | Bộ điều kiện lọc đã lưu | Ví dụ `{"teams":["Mobile"],"month":"2026-11",...}` |
| `is_shared` | Chia sẻ trong phòng ban | Có / không |
| `is_pinned` | Ghim lên đầu danh sách | Có / không |
| `created_at` | Thời điểm tạo | Ghi tự động |

### Sửa ô bảng công (C4)

**Sửa ô bảng công (`TimesheetEdit`)** — mỗi lần sửa ô bảng công đều được ghi lại:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh lần sửa | Khóa chính |
| `timesheet_id` | Bảng công bị sửa | Bắt buộc |
| `user_id` | Người thực hiện sửa | Bắt buộc |
| `field` | Cột bảng công bị sửa | `actual_hours` \| `late_minutes` \| `paid_leave_days` \| … |
| `old_value` | Giá trị trước khi sửa | Ghi lại để hoàn tác & đối chiếu |
| `new_value` | Giá trị sau khi sửa | Ghi lại để hoàn tác & đối chiếu |
| `reason` | Lý do sửa | **BẮT BUỘC** nếu sửa cột nhạy cảm |
| `source` | Nguồn thay đổi | `manual` \| `bulk` \| `import` |
| `created_at` | Thời điểm sửa | Ghi tự động |

### Báo cáo tự động theo lịch (C10)

**Lịch trình báo cáo (`ScheduledReport`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh lịch trình | Khóa chính |
| `name` | Tên báo cáo | Bắt buộc |
| `module` | Phân hệ lấy dữ liệu | `timesheet` \| `okr` |
| `schedule_cron` | Lịch chạy định kỳ | Bắt buộc — ví dụ ngày 2 hàng tháng |
| `recipients` | Danh sách người nhận | Bắt buộc |
| `params` | Tham số lọc khi tạo báo cáo | Ví dụ tháng, phòng ban, định dạng |
| `last_run_at` | Lần chạy gần nhất | Bỏ trống = chưa chạy lần nào |
| `next_run_at` | Lần chạy kế tiếp | Ghi tự động |
| `is_active` | Lịch trình còn bật | Có / không |

### Dữ liệu của core — đăng nhập, thông báo, push

Các phần này **chưa có trong ERD** nhưng cần cho D2. Bổ sung ở đây để không sót.

**Phiên đăng nhập (`RefreshToken`)** — dùng để thu hồi phiên khi đăng xuất:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh phiên | Khóa chính |
| `user_id` | Người sở hữu phiên | Bắt buộc |
| `jti` | Mã định danh phiên trong token | Bắt buộc — dùng để thu hồi đúng từng phiên |
| `token_hash` | Mã băm của token | Bắt buộc — **chỉ lưu mã băm**, không lưu bản thô |
| `expires_at` | Thời điểm hết hạn | Bắt buộc |
| `revoked_at` | Thời điểm thu hồi | Bỏ trống = còn hiệu lực; điền khi đăng xuất / đổi mật khẩu |
| `created_at` | Thời điểm tạo phiên | Ghi tự động |

> Ràng buộc: **duy nhất** theo cặp (`user_id`, `jti`).
>
> **Vì sao chỉ lưu mã băm:** lộ dữ liệu cũng không tạo được phiên đăng nhập hợp lệ.

**Tuỳ chọn thông báo (`NotificationPreference`)** — người dùng tắt/bật từng loại nhắc:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh tuỳ chọn | Khóa chính |
| `user_id` | Người đặt tuỳ chọn | Bắt buộc |
| `event_key` | Loại sự kiện được nhắc | Ví dụ `late_no_checkout`, `okr_checkin_due` |
| `channel` | Kênh nhận | `push` \| `email` \| `badge` |
| `enabled` | Bật hay tắt | Có / không |
| `updated_at` | Mốc cập nhật | Ghi tự động |

> Ràng buộc: **duy nhất** theo cặp (`user_id`, `event_key`, `channel`).
>
> **Vì sao chỉ lưu dòng khi user tắt, không lưu đầy đủ:**
> mặc định là bật → không cần dòng nào cho user chưa tùy chỉnh. Bảng nhỏ, truy vấn đơn giản,
> và tránh phải thay đổi cấu trúc khi thêm sự kiện mới vào ma trận 17.

**Đăng ký push (`PushSubscription`)** — 1 người có thể đăng ký nhiều thiết bị:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh đăng ký | Khóa chính |
| `user_id` | Người đăng ký | Bắt buộc |
| `endpoint` | Địa chỉ nhận push của thiết bị | Bắt buộc — **duy nhất** |
| `p256dh` | Khóa công khai của thiết bị | Bắt buộc |
| `auth` | Khóa xác thực của thiết bị | Bắt buộc |
| `created_at` | Thời điểm đăng ký | Ghi tự động |
| `last_used_at` | Lần gửi push thành công gần nhất | Ghi tự động |

**Cột nhạy cảm trong bảng công** (bắt buộc lý do khi sửa):
`actual_hours` · `late_minutes` · `early_minutes` · `paid_leave_days` · `bhxh_leave_days` · `violations`

### Loại nghỉ cấu hình được

**Loại nghỉ (`LeaveType`)** — HR cấu hình, không cố định trong phần mềm:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh loại nghỉ | Khóa chính |
| `name` | Tên loại nghỉ | Bắt buộc |
| `description` | Mô tả loại nghỉ | Tùy chọn |
| `color` | Màu hiển thị trên bảng công | Tùy chọn |
| `icon` | Biểu tượng hiển thị | Tùy chọn |
| `parameter_values` | Tham số riêng của loại nghỉ | Chỉ chứa trường **thực sự khác mặc định** |
| `is_active` | Loại nghỉ còn dùng | Có / không |
| `is_system` | Loại chuẩn của hệ thống | Có = không cho xoá |
| `display_order` | Thứ tự hiển thị | Số nguyên |
| `created_by` | Người tạo | Người dùng có quyền HR |
| `created_at`, `updated_at` | Mốc tạo / cập nhật | Ghi tự động |

**Đơn nghỉ phép (`LeaveRequest`)** — lưu **ảnh chụp tham số** lúc gửi:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh đơn | Khóa chính |
| `user_id` | Người xin nghỉ | Bắt buộc |
| `leave_type_id` | Loại nghỉ | Tham chiếu `LeaveType` |
| `start_date` | Ngày bắt đầu nghỉ | Bắt buộc |
| `end_date` | Ngày kết thúc nghỉ | Bắt buộc |
| `days` | Số ngày nghỉ | 1 chữ số thập phân (0.5 = nửa ngày) |
| `is_half_day` | Nghỉ nửa ngày | Có / không |
| `reason` | Lý do nghỉ | Bắt buộc |
| `attachments` | File đính kèm | Danh sách file |
| `applied_parameters` | Ảnh chụp tham số đã áp dụng | Bắt buộc — đổi cấu hình sau không làm sai lịch sử báo cáo lương |
| `submitted_at` | Thời điểm gửi | Ghi tự động |
| `decided_at` | Thời điểm có quyết định | Bỏ trống = chưa quyết định |

**Quy tắc bất biến:**
- `parameter_values` chỉ chứa trường **thực sự khác mặc định** → gộp 3 tầng không bị ghi đè nhầm.
- Định nghĩa tham số nằm trong **catalog quy định** (không phải dữ liệu lưu trữ) vì cần kiểu dữ liệu,
  kiểm tra hợp lệ, nhãn hiển thị và điều kiện hiện/ẩn — không phải dữ liệu nghiệp vụ. Nơi lưu trữ
  chỉ giữ **giá trị**.
- Loại có `accrual_rule = none` (ốm, thai sản, tang) **không trừ số dư phép năm** — nhưng vẫn ghi
  vào sổ phép để kế toán đối chiếu.

### Quy định (`RuleConfig`) — có phiên bản (C13)

**Quy định (`RuleConfig`)** — một **phiên bản** của một quy định, cho một phạm vi, trong một khoảng thời gian:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh phiên bản | Khóa chính |
| `rule_key` | Mã quy định | Bắt buộc — 19 quy định trong catalog |
| `scope_type` | Phạm vi áp dụng | `global` \| `team` \| `position` \| `shift` |
| `scope_ref_id` | Thực thể cụ thể trong phạm vi | Bỏ trống khi phạm vi = toàn công ty |
| `value` | Giá trị đang áp dụng | Bắt buộc — có kiểu & kiểm tra hợp lệ theo catalog |
| `effective_from` | Ngày bắt đầu hiệu lực | Bắt buộc |
| `effective_to` | Ngày kết thúc hiệu lực | Bỏ trống = **đang áp dụng** |
| `version` | Số thứ tự phiên bản | Số nguyên tăng dần |
| `note` | Lý do thay đổi | **BẮT BUỘC** |
| `reverted_from_id` | Phiên bản bị hoàn tác | Bỏ trống = không phải lần hoàn tác |
| `created_by` | Người tạo phiên bản | Người dùng có quyền HR |
| `created_at` | Thời điểm tạo | Ghi tự động |

**Ràng buộc:**
- Mỗi `(rule_key, scope_type, scope_ref_id)` chỉ có **1 phiên bản đang áp dụng** tại một thời điểm.
- Lưu phiên bản mới → phiên bản cũ đóng `effective_to = effective_from_mới`.
- **Không bao giờ xóa phiên bản** — chỉ đóng `effective_to`. Rollback = tạo phiên bản mới trỏ về phiên bản cũ.
- Phiên bản đã hết hiệu lực **vẫn được dùng để tính lại lịch sử** (bảng công tháng 5 dùng quy định có hiệu lực tháng 5).

### Nhóm — đơn vị phối hợp & phân trách duyệt (cấu hình linh hoạt)

> **Không fix cứng tổ chức công ty.** Một công ty chỉ cần 3 nhóm cũng được, 300 nhóm cũng được.
> HR tạo/sửa/xoá nhóm trên màn hình. Seed 17 nhóm từ `doc/Rule chấm công.xlsx` (cột "Nhóm/Team").

**Nhóm (`Team`)** — đơn vị phối hợp & phân trách duyệt. Có thể chứa nhóm con.
Số tầng **KHÔNG** fix cứng: cha = rỗng (gốc) → nhóm con → nhóm cháu → …
Công ty chính là một nhóm gốc. **KHÔNG** có khái niệm phòng ban / chi nhánh.
> Thực thể: `class Team(Base)`

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh nhóm | Khóa chính |
| `name` | Tên nhóm | Bắt buộc |
| `code` | Mã nhóm | Bắt buộc — **duy nhất** |
| `parent_team_id` | Nhóm cha | Bỏ trống = nhóm gốc (công ty / đơn vị cấp cao nhất) |
| `lead_id` | Trưởng nhóm | Người **duyệt hộ** cho thành viên; có thể bỏ trống |
| `description` | Mô tả nhóm | Tùy chọn |
| `is_active` | Nhóm còn hoạt động | Có / không — xoá nhóm là **xoá mềm** |
| `created_by` | Người tạo nhóm | Người dùng có quyền HR |
| `created_at`, `updated_at` | Mốc tạo / cập nhật | Ghi tự động |

**Thành viên nhóm (`TeamMember`)** — 1 người có thể thuộc **nhiều** nhóm:
> Thực thể: `class TeamMember(Base)`

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh quan hệ thành viên | Khóa chính |
| `team_id` | Nhóm | Tham chiếu `Team` |
| `user_id` | Thành viên | Tham chiếu `User` |
| `role_in_team` | Vai trò của người đó trong nhóm | `member` \| `lead` (trưởng nhóm) |
| `joined_at` | Thời điểm gia nhập nhóm | Ghi tự động |

> Ràng buộc: **duy nhất** theo cặp (`team_id`, `user_id`) — một người không xuất hiện 2 lần trong cùng một nhóm.

**Cây tổ chức — số tầng tự do:**

```
Công ty (nhóm gốc, parent = None)
└── Nhóm A
    ├── Nhóm A1
    │   └── Nhóm A1a          ← sâu thêm bao nhiêu tuỳ ý
    └── Nhóm A2
└── Nhóm B
    └── Nhân viên
```

**Quan hệ 3 vai trò — suy ra, không lưu trùng:**

| Vai trò | Ở đâu lưu | Ý nghĩa |
|---|---|---|
| **Thành viên** | `TeamMember` | 1 người có thể ở nhiều nhóm |
| **Trưởng nhóm** | `Team.lead_id` | người DUYỆT hộ cho thành viên nhóm |
| **Quản lý của nhóm** | **suy ra**: `User.manager_id` của trưởng nhóm | không lưu riêng → không thể lệch |

> **Vì sao quản lý của nhóm không lưu thành cột riêng:** trưởng nhóm đã có `User.manager_id`
> trỏ tới quản lý. Lưu thêm `Team.manager_id` là tạo **2 nguồn sự thật** cho cùng 1 thứ →
> chắc chắn sẽ lệch. Suy ra là cách duy nhất an toàn.
>
> **Hệ quả:** trưởng nhóm có thể **không thuộc nhóm mà họ dẫn** (thực tế đúng như vậy ở
> công ty này: PHẠM XUÂN HIẾU ở nhóm *Hades* nhưng dẫn nhóm *Galaxy*). Đó là bình thường —
> không cần ràng buộc trưởng nhóm phải là thành viên.

**Quy tắc:**
- **Không có `Department` / `Branch`.** Muốn gom 3 nhóm thành đơn vị lớn → tạo nhóm cha.
  Muốn bỏ cấp trung gian → chuyển thành viên lên nhóm ông. **Không sửa cấu trúc dữ liệu, không sửa phần mềm.**
- Một người có thể dẫn **nhiều nhóm** (một quản lý cấp cao dẫn 3–4 nhóm) — không giới hạn.
- Xoá nhóm → **mềm** (`is_active=False`); phải chuyển member sang nhóm khác trước.
- `UserScope.scope_type` = `team|position|self` → cấp quyền xem theo nhóm.

### Quyền XEM tách khỏi quyền DUYỆT

> **Nguyên tắc:** quyền duyệt (quyết định) và quyền xem (để phối hợp) là **2 khái niệm khác nhau**.
> Người được xem **không** nhận task, **không** bị tính SLA, **không** bấm được Duyệt/Từ chối.

**Bước duyệt (`ApprovalStep`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bước duyệt | Khóa chính |
| `flow_id` | Luồng duyệt chứa bước này | Bắt buộc |
| `step_order` | Thứ tự bước | Số nguyên — 1 là bước đầu |
| `approver_type` | Ai được phép duyệt | `role` \| `manager` \| `hr` \| `position` \| `team_lead` \| `user` |
| `approver_ref_id` | Thực thể cụ thể của người duyệt | Theo `approver_type` |
| `require_reason_on_reject` | Bắt buộc ghi lý do khi từ chối | Có / không |
| `sla_hours` | Số giờ tối đa để xử lý | Có thể bỏ trống = không tính SLA |
| `viewer_scope` | **Ai được XEM đơn ở bước này** (để phối hợp) | Cấu hình gồm: danh sách `teams`, danh sách `roles`, danh sách `users`, cờ `include_reason`, cờ xem file đính kèm |

**Người được xem (`ApprovalViewer`)** — ảnh chụp ai được quyền xem 1 đơn ở 1 bước, để audit và gỡ quyền khi đổi cấu hình:
> Thực thể: `class ApprovalViewer(Base)`

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bản ghi xem | Khóa chính |
| `step_id` | Bước duyệt | Bắt buộc |
| `subject_type` | Loại thực thể được xem | Bắt buộc — ví dụ đơn từ, mục tiêu OKR |
| `subject_id` | Thực thể cụ thể được xem | Bắt buộc |
| `viewer_id` | Người được xem | Bắt buộc |
| `viewer_scope` | Phạm vi đã dùng để tính | Ghi lại để hiểu **vì sao** người đó được xem |
| `granted_at` | Thời điểm cấp quyền xem | Ghi tự động |

### OKR — theo mô hình 2 nhóm Business/People (thang 1–5)

**Mục tiêu (`Objective`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh mục tiêu | Khóa chính |
| `user_id` | Chủ mục tiêu | Bắt buộc |
| `cycle_id` | Chu kỳ OKR | Bắt buộc |
| `team_id` | Nhóm phụ trách | Bắt buộc |
| `category` | Nhóm mục tiêu | `business` \| `people` |
| `title` | Tiêu đề mục tiêu | Bắt buộc |
| `description` | Mô tả mục tiêu | Tùy chọn |
| `status` | Trạng thái | `draft` \| `submitted` \| `approved` \| `returned` \| `locked` |
| `submitted_at` | Thời điểm gửi duyệt | Bỏ trống = còn nháp |
| `approved_at` | Thời điểm được duyệt | Bỏ trống = chưa duyệt |
| `locked_at` | Thời điểm khóa kỳ | Bỏ trống = chưa khóa |

**Kết quả chính (`KeyResult`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh KR | Khóa chính |
| `objective_id` | Mục tiêu cha | Bắt buộc |
| `title` | Tiêu đề KR | Bắt buộc |
| `target_value` | Giá trị mục tiêu | Bắt buộc |
| `current_value` | Giá trị hiện tại | 0 mặc định |
| `unit` | Đơn vị đo | Bắt buộc — ví dụ %, VND, lượt |
| `weight` | Trọng số trong mục tiêu | Tổng trọng số mỗi mục tiêu = 100 |
| `sort_order` | Thứ tự hiển thị | Số nguyên |

**Check-in OKR (`OkrCheckIn`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh lần check-in | Khóa chính |
| `key_result_id` | KR được check-in | Bắt buộc |
| `cycle_id` | Chu kỳ | Bắt buộc |
| `value` | Giá trị tại thời điểm check-in | Bắt buộc |
| `note` | Ghi chú giải thích | Tùy chọn |
| `created_by` | Người check-in | Bắt buộc |
| `created_at` | Thời điểm check-in | Ghi tự động |

**Điểm đạt (`OkrAchievement`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bản ghi điểm | Khóa chính |
| `objective_id` | Mục tiêu được chấm | Bắt buộc |
| `cycle_id` | Chu kỳ | Bắt buộc |
| `business_score` | Điểm ở nhóm Business | ∈ {1,2,3,4,5} — **không số lẻ, không 0** |
| `people_score` | Điểm ở nhóm People | ∈ {1,2,3,4,5} — **không số lẻ, không 0** |
| `average_score` | Điểm trung bình | **luôn** = (business + people) / 2 — tính tự động, không nhập tay |
| `scored_by` | Người chấm | Bắt buộc |
| `scored_at` | Thời điểm chấm | Ghi tự động |

> **Vì sao nhóm được chấm 1 điểm, không bình quân:** nhóm Business và nhóm People được chấm
> **độc lập**, không trộn thành một con số — nên `OkrAchievement` **không có** trường trọng số.

**Ràng buộc:**
- `business_score` / `people_score` ∈ {1,2,3,4,5} — **không số lẻ, không 0** (0 = chưa chấm → để NULL).
- `average_score` **luôn** = (business + people) / 2 — tính ở tầng nghiệp vụ, không nhập tay.
- Mỗi NV có **đúng 2 objective** mỗi kỳ (1 Business + 1 People) → duy nhất theo (`user_id`, `cycle_id`, `category`).
- `OkrAchievement` **không có** trường trọng số — vì nhóm được chấm 1 điểm, không bình quân.

### Bảng công — theo mẫu export thật (53 cột)

**Ô công (`TimesheetDay`)** — 1 ô = 1 người × 1 ngày. Lưu **TRẠNG THÁI nửa ngày**, không lưu chuỗi ký hiệu.

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh ô | Khóa chính |
| `timesheet_id` | Bảng công chứa ô này | Bắt buộc |
| `work_date` | Ngày làm việc | Bắt buộc |
| `morning` | Ký hiệu buổi sáng | `work` \| `R` \| `AL` \| `S` \| `RO` \| `CL` \| `ML` \| `PL` \| `UP` \| `NL` |
| `afternoon` | Ký hiệu buổi chiều | Bỏ trống = đủ ngày (ký hiệu buổi sáng áp dụng cả ngày) |
| `morning_hours` | Số giờ buổi sáng | 2 chữ số thập phân — 0.5 = nửa ngày |
| `afternoon_hours` | Số giờ buổi chiều | 2 chữ số thập phân — 0.5 = nửa ngày |
| `source` | Nguồn ghi nhận | `punch` \| `request` \| `import` \| `manual` |
| `note` | Ghi chú | Tùy chọn |

> **Vì sao không lưu chuỗi `"R/0.50"`:** để **tính tổng bằng công thức**, **sửa 1 phần ngày** (C4),
> và **render ra ký hiệu gốc** bằng 1 hàm thuần → export khớp file HR 100%.
> Chi tiết bảng tra cứu ký hiệu: `docs/02` §2.1.3.

**Cột tổng hợp của bảng công** (17 cột theo file gốc) — lưu trên `Timesheet`:
`manager_code` · `wfh_days` · `total_work_days` · `nl_days` · `al_days` · `cl_days` · `sick_days` ·
`bhxh_days` · `ro_days` · `up_days` · `ml_days` · `pl_days` · `total_days` ·
`remaining_leave_days` · `actual_work_days` · `paid_leave_days` · `unpaid_leave_days`.

> 17 cột tổng hợp là **chỉ đọc** — luôn tự tính từ các ô ngày. HR sửa **ô ngày** (C4); ô đã sửa lưu trong `TimesheetEdit` + hiện màu đỏ trên lưới.

## 5. Dữ liệu mẫu (bắt buộc — demo không được rỗng)

> **Tóm tắt khối lượng dữ liệu mẫu** (theo đúng tên khóa để tra cứu nhanh):
> `"teams": 16` · `"team_members": 69` · `"positions": 5` · `"users": 69` ·
> `"shift_assignments": 4` · `"holidays": 14` · `"leave_types": 8` · `"office_locations": 2` ·
> `"devices": 30` · `"rule_configs": 19` · `"rule_versions": 22` · `"documents": 8` ·
> `"saved_views": 6` · `"timesheets": 180` · `"time_entries": ~4000` · `"requests": 120` ·
> `"leave_transactions": 400` · `"wfh_schedules": 60` · `"okr_cycles": 2` ·
> `"objectives": 90` · `"key_results": 270` · `"okr_checkins": 600` · `"reviews": 45`

| Loại dữ liệu | Số lượng | Ghi chú |
|---|---|---|
| `"teams"` — Nhóm | 16 | Từ `doc/Rule chấm công.xlsx` — mỗi nhóm có trưởng |
| `"team_members"` — Thành viên nhóm | 69 | Theo cột "Nhóm/Team" |
| `"positions"` — Chức danh | 5 | Developer, Senior Dev, QA, Support, Manager |
| `"users"` — Người dùng | 69 | 3 quản lý cấp cao + 5 quản lý nhóm + trưởng + NV |
| `"shift_assignments"` — Gán ca | 4 | Nhóm CA — gán ca cho nhóm (không phải nhóm tổ chức) |
| `"holidays"` — Ngày lễ | 14 | Lịch nghỉ lễ Việt Nam 2026 |
| `"leave_types"` — Loại nghỉ | 8 | NL, AL, S, RO, CL, ML, PL, UP (khớp cột bảng công) |
| `"office_locations"` — Văn phòng | 2 | 2 văn phòng + geofence + dải IP |
| `"devices"` — Thiết bị | 30 | Thiết bị đăng ký sẵn |
| `"rule_configs"` — Quy định | 19 | 19 rule, giá trị mặc định đúng Mục 7 |
| `"rule_versions"` — Phiên bản quy định | 22 | Có lịch sử phiên bản (2 rule có 3 phiên bản) để demo lịch sử + rollback |
| `"documents"` — Tài liệu | 8 | Quy định + chính sách (cho trang tra cứu C7) |
| `"saved_views"` — View đã lưu | 6 | View mặc định: Cần duyệt, Đi muộn T11, ... (C5) |
| `"timesheets"` — Bảng công | 180 | 6 tháng × 30 user |
| `"time_entries"` — Bản ghi chấm công | ~4000 | Dữ liệu chấm công 6 tháng |
| `"requests"` — Đơn từ | 120 | Đơn từ ở mọi trạng thái |
| `"leave_transactions"` — Giao dịch phép | 400 | Sổ phép 6 tháng |
| `"wfh_schedules"` — Lịch WFH | 60 | |
| `"okr_cycles"` — Chu kỳ OKR | 2 | 2026 (đang chạy) + 2025 (đã chốt, có lịch sử) |
| `"objectives"` — Mục tiêu | 90 | 3 objective × 30 user |
| `"key_results"` — Kết quả chính | 270 | 3 KR mỗi objective |
| `"okr_checkins"` — Check-in OKR | 600 | Check-in 6 tháng |
| `"reviews"` — Đánh giá | 45 | |

**Yêu cầu chất lượng dữ liệu mẫu:**
- Dữ liệu phải **có biến động thực tế**: đi muộn 1–25 phút (không ai đi muộn đều 30 phút), có ngày vắng, có người làm OT, có người dùng quota hết.
- Phải có **case đặc biệt** để demo: 1 nhân viên chuyển phòng giữa năm, 1 nhân viên mới tháng 9, 1 đơn nghỉ 5 ngày (quản lý duyệt là đủ), 1 đơn đi muộn của nhóm CA (2 bước: trưởng nhóm → HR), 1 đơn bị trả lại, 1 objective bị sửa điểm (có lý do).
- **Todo inbox phải có việc thật**: dữ liệu mẫu phải tạo ra ít nhất 3 việc đang chờ cho user demo (quên chấm công, check-in OKR đến hạn, phép tồn sắp hết hạn) — nếu inbox trống thì demo tính năng C1 không có tác dụng.
- **Quy định phải có lịch sử phiên bản**: ít nhất 2 rule có 3 phiên bản (để demo lịch sử + rollback).
- Mật khẩu tất cả tài khoản demo: `demo@123` — hiển thị trên trang đăng nhập để judge 1-click vào.

## 6. Khởi tạo dữ liệu & đặt lại môi trường phát triển

> Quy trình vận hành dữ liệu cho môi trường phát triển: **tạo cấu trúc dữ liệu từ đầu** → **nạp dữ liệu mẫu**.
> Nền tảng dữ liệu (cấu trúc ban đầu) được tạo bằng **một bước tạo cấu trúc tường minh** —
> **không** dùng cách tự sinh tự động — để lịch sử thay đổi cấu trúc luôn sạch và truy vết được.

- **Tạo cấu trúc dữ liệu:** chạy một bước nâng cấp cấu trúc tới phiên bản mới nhất.
- **Đặt lại sạch trong môi trường phát triển:** hạ cấu trúc về nền tảng rồi nâng lại phiên bản mới nhất, sau đó nạp lại dữ liệu mẫu.
- **Nâng cấp lên môi trường thật:** dùng đúng bước nâng cấp cấu trúc như trên — **không** dùng cách tạo bảng hàng loạt, để lịch sử cấu trúc luôn sạch.

## 7. Sao lưu & khôi phục (không được mất dữ liệu chốt công)

> Dữ liệu bảng công đã chốt là **dữ liệu để trả lương** — mất là mất tiền thật của người lao động.
> Vì vậy **luôn sao lưu trước mỗi lần chạy quy trình chốt công thật**, và lưu cả bản sao lưu
> với dấu thời gian để không ghi đè bản cũ.

| Bước | Nội dung | Vì sao cần |
|---|---|---|
| **Sao lưu** | Xuất toàn bộ dữ liệu thành 1 tệp nén, **đặt tên kèm ngày + giờ** | Giữ nhiều mốc, không đè lên bản cũ |
| **Khôi phục** | Nạp lại tệp sao lưu vào hệ thống, **xoá dữ liệu đang có trước khi nạp** | Đảm bảo dữ liệu khôi phục đúng với bản sao lưu, không trộn dữ liệu cũ |
| **Trên cloud** | Dịch vụ cloud có **snapshot tự động** → dùng snapshot đó, không cần quy trình riêng | Không tốn công sức vận hành thủ công |

> **Vì sao bắt buộc sao lưu trước mỗi lần chốt công:** quy trình chốt công ghi hàng loạt vào bảng
> công và khóa kỳ — nếu chạy sai, không có đường quay lại nếu không có bản sao lưu.

---

## Cập nhật schema thực tế — 20/11/2026

Các bảng/cột đã bổ sung và đang dùng trong code (Flyway V2–V14):

| Bảng / cột | Trạng thái | Mục đích |
|---|---|---|
| `requests.end_date` | Thêm (V12) | Ngày kết thúc áp dụng; backfill V13/V14 cho đơn nghỉ cũ theo `duration` N ngày làm việc |
| `request_attachments` | Thêm (V11) | File thật (`bytea`), `file_name`, `content_type`, `size_bytes`, `uploaded_by`; 1 đơn nhiều file |
| `timesheet_disputes` | Thêm (V9) | Khiếu nại bảng công: user/ngày/lý do/status/deadline/resolution; seed DC-01/DC-02 |
| `todo_completions` | Thêm (V10) | Trạng thái hoàn tất Todo theo người dùng |
| `timesheets` | Đang dùng | Status kỳ công theo người/tháng (`draft/published/locked`), publishedAt, disputeDeadline, lockedAt |
| `timesheet_cells` | Đang dùng | Ô sửa tay theo kỳ/ngày/symbol, `is_manual=true` |
| `timesheet_audit_logs` | Đang dùng | Audit từng lần sửa ô (old/new/reason/changed_by) |
| `okr_reviews` | Đang dùng | Form 4 Box tự đánh giá + điểm quản lý chấm |
| `leave_types.config`, `submit_within_days`, `requires_attachment`, `unit`, `is_paid`, `deducts_annual_leave` | Đang dùng | Cấu hình loại nghỉ 3 tầng |
| `leave_ledger` | Đang dùng | GRANT (chuẩn/tồn/thâm niên), USED âm khi duyệt nghỉ, ADJUST ±; số dư tính lại từ ledger |
| `notifications` | Đang dùng | Thông báo DB cho nhân viên (duyệt/từ chối/khiếu nại) |

**Ghi chú quan trọng:** `requests` hiện dùng `work_date` + `end_date` (không còn `start_date`); `payload` là JSONB chứa `unit`, `half_day_period`, `work_window_*`, `late_early`, `time`, `adjust_kind`, `duration`. Mọi trạng thái bảng công/khiếu nại/todo/OKR review đều đọc-ghi DB, không còn lưu RAM.
