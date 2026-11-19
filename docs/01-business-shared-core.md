# 01 — Nền tảng dùng chung (Core)

> Mục 3 của tài liệu: *"Đây là phần xương sống mà cả 3 phân hệ cùng dựa vào."*

## 1. Ranh giới module

Hệ thống gồm 2 phân hệ nghiệp vụ (chấm công và OKR) cùng dùng chung một **lớp nền tảng (core)**: xác thực & phân quyền, danh bạ người dùng và tổ chức, quản lý thiết bị chấm công, luồng duyệt, thông báo, nhật ký thay đổi, tài liệu quy định và các tiện ích dùng chung (todo inbox, tìm kiếm nhanh).

> **Quy tắc phụ thuộc:** phân hệ chấm công và phân hệ OKR **được phép** dùng core; **core không được phụ thuộc ngược lại** vào hai phân hệ này. Mọi logic dùng chung (định danh người dùng, quyền theo phạm vi, quy trình duyệt, thông báo, audit) nằm ở core để không bị viết lại hai lần.

## 2. Mô hình dữ liệu lõi

### User & tổ chức

> **Không có `Department` / `Branch`.** Đơn vị cấp ứng dụng duy nhất là **nhóm (`Team`)**,
> và nhóm thì lồng nhau tự do — xem §Tổ chức linh hoạt bên dưới.
> Công ty chỉ cần 2 tầng (Công ty → Nhóm) cũng được, không sửa schema.

**Chức danh (`Position`)** — thuộc tính của người, không phải đơn vị tổ chức:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh chức danh | Khóa chính |
| `name` | Tên chức danh hiển thị | Bắt buộc |
| `level` | Cấp bậc của chức danh | Dùng để sắp xếp/thống kê phân tầng |
| `allow_wfh` | Chức danh này được phép làm việc từ xa | Có / không |
| `extra_leave_days` | Số ngày nghỉ phép được cộng thêm cho chức danh | Số nguyên không âm, mặc định 0 |

**Người dùng (`User`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh người dùng | Khóa chính |
| `email` | Email đăng nhập | Bắt buộc, duy nhất |
| `password_hash` | Mật khẩu đã băm | Chỉ lưu dạng băm, không lưu bản thô; chỉ dùng cho tài khoản demo/fallback |
| `full_name` | Họ tên hiển thị | Bắt buộc |
| `avatar_url` | Ảnh đại diện | Tùy chọn |
| `role` | Vai trò hệ thống | `employee` \| `manager` \| `hr` \| `admin` |
| `position_id` | Chức danh của người | Tham chiếu `Position`; **không phải** đơn vị cấp ứng dụng |
| `manager_id` | Quản lý trực tiếp | Tham chiếu `User`; **căn cứ để duyệt đơn** |
| `hire_date` | Ngày vào làm | Bắt buộc |
| `status` | Trạng thái làm việc | `active` \| `inactive` |
| `google_sub` | Liên kết tài khoản Google SSO | Bắt buộc với tài khoản thật; lưu ở lần đăng nhập Google đầu tiên để khớp các lần sau |

### Phân quyền theo phạm vi (Mục 3)

**Phạm vi xem dữ liệu (`UserScope`)** — gán cho từng người một hoặc nhiều phạm vi được phép xem:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bản ghi phạm vi | Khóa chính |
| `user_id` | Người được cấp phạm vi | Tham chiếu `User` |
| `scope_type` | Loại phạm vi xem dữ liệu | `team` (theo nhóm) \| `position` (theo chức danh) \| `self` (chỉ bản thân) |
| `scope_ref_id` | Đối tượng cụ thể của phạm vi | Nhóm hoặc chức danh tương ứng với `scope_type`; bỏ trống với `self` |

- **Employee**: chỉ dữ liệu của mình.
- **Manager**: dữ liệu của `manager_id == mình` (cấp dưới trực tiếp) + chính mình. Không thấy nhóm của đồng nghiệp.
- **HR**: toàn công ty, **hoặc** giới hạn theo nhóm nếu HR được cấp `UserScope(scope_type=team)`.
- **Admin**: tất cả + quản trị.

**Nguyên tắc kiểm tra quyền xem — `visible_user_ids`:**

| Vai trò | Danh sách người được thấy |
|---|---|
| `admin` | Toàn bộ — không giới hạn |
| `hr` | Toàn bộ — trừ khi bị gán `UserScope(scope_type=team)`, khi đó chỉ thấy các nhóm được gán |
| `manager` | Cấp dưới trực tiếp (`manager_id` trỏ tới mình) **+ chính mình** |
| `employee` | Chỉ chính mình |

> Đây là **mặc định cứng theo vai trò**, áp dụng ở mọi danh sách: bảng công, danh sách đơn, sơ đồ tổ chức, kết quả tìm kiếm.

#### 3b. Phân biệt "xem danh sách" và "xem 1 đơn"

> **Điểm mấu chốt:** `visible_user_ids` trả về **ai được thấy trong danh sách**.
> Còn **ai được mở 1 đơn cụ thể** là quyết định **riêng** — đó là chỗ `viewer_scope` của
> approval step đi vào. Hai thứ này **không được gộp**.

| Ngữ cảnh | Ai thấy | Cơ chế |
|---|---|---|
| **Danh sách** (bảng công, danh sách đơn, sơ đồ tổ chức) | Theo vai trò — `visible_user_ids` | Cứng theo vai trò, như **mặc định** |
| **1 đơn cụ thể** | Người gửi + approver hiện tại + **viewer theo `viewer_scope`** | Cấu hình được theo từng bước duyệt |
| **Đơn của người khác trong cùng team** | Chỉ khi team đó nằm trong `viewer_scope` | Cấu hình được |

**Vì sao tách:**
- Manager xem danh sách cấp dưới trực tiếp — nhưng **đồng nghiệp cùng team** có thể cần xem
  đơn của nhau để phối hợp (ví dụ nhân viên nghỉ phép, đồng nghiệp cần biết để chia việc).
  Nếu gộp vào `visible_user_ids`, cả team sẽ thấy **mọi** đơn của nhau — kể cả đơn phép.
- Ngược lại, nếu chỉ dựa vào `viewer_scope`, thì **danh sách** sẽ thiếu dữ liệu
  (quản lý không thấy nhân viên nào còn đơn chờ).

**Quy tắc kiểm tra quyền xem 1 đơn — `can_view_subject`** (4 nguồn, theo thứ tự, thỏa điều kiện bất kỳ là được):

| # | Nguồn quyền | Ai được xem | Ghi chú |
|---|---|---|---|
| 1 | Chủ đơn | Người gửi đơn | Luôn được xem đơn của chính mình |
| 2 | Approver hiện tại | Người đang giữ task duyệt của đơn | — |
| 3 | HR / Admin | `hr`, `admin` | Luôn được xem, bất kể cấu hình bước duyệt |
| 4 | Viewer theo `viewer_scope` của bước duyệt hiện tại | Người khớp với phạm vi viewer của bước đang chạy | Xem bảng cấu hình bước duyệt bên dưới |

> Các nguồn quyền được kiểm tra theo thứ tự, **thỏa điều kiện bất kỳ là được xem**.

> **Lưu ý bảo mật:** `viewer_scope` mặc định **KHÔNG** cho xem file đính kèm
> (`viewer_see_attachments=False`) — vì đơn nghỉ ốm có giấy khám là dữ liệu nhạy cảm.
> Và `include_reason=False` nếu HR muốn giấu lý do từ chối khỏi nhóm.

#### 3c. Quyền xem lịch nhóm

> **Lịch nhóm** (lịch làm việc / WFH / nghỉ của các thành viên) là **màn hình riêng** — quyền xem
> được quy định **riêng theo vai trò**, không dùng chung `visible_user_ids` (vốn là mặc định
> "chỉ mình + cấp dưới trực tiếp"), vì người cần xem lịch đồng đội còn cả thành viên ngang hàng.

| Vai trò | Xem được lịch của ai | Cơ chế |
|---|---|---|
| **HR** | **Toàn công ty** | Không giới hạn — trừ khi bị gán `UserScope(scope_type=team)`, khi đó chỉ thấy các nhóm được gán |
| **Manager** | **Các thành viên mình quản lý trực tiếp** | Theo `User.manager_id` trỏ tới mình (+ chính mình) |
| **Team lead** | **Các thành viên trong nhóm mình phụ trách** | Theo `Team.lead_id` — nhóm mà mình là trưởng |
| **Member** | **Các thành viên trong team của mình** | Theo `TeamMember` — các nhóm mình là thành viên |

> **Giới hạn rõ ràng:**
> - Member **không** thấy lịch của các team khác — chỉ team của mình.
> - Manager **không** thấy lịch của đồng nghiệp ngang hàng (cùng cấp, không phải cấp dưới trực tiếp).
> - Xem lịch **không** đồng nghĩa với xem đơn cá nhân của người đó — đơn vẫn phải qua
>   `can_view_subject` ở §3b.

### Thiết bị đăng ký (chống chấm công hộ — Mục 6.1)

**Thiết bị đã đăng ký (`DeviceRegistration`)** — mỗi lần nhân viên đăng ký một thiết bị tạo một bản ghi:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh lần đăng ký | Khóa chính |
| `user_id` | Nhân viên sở hữu thiết bị | Tham chiếu `User` |
| `device_fingerprint` | Dấu vân thiết bị | Băm từ canvas + screen + user-agent; là khoá nhận diện thiết bị |
| `device_name` | Tên thiết bị hiển thị | VD: "iPhone 15" |
| `platform` | Hệ điều hành/nền tảng | VD: "iOS 18.2" |
| `status` | Trạng thái thiết bị | `pending` (chờ duyệt) \| `active` (đang dùng) \| `revoked` (đã thu hồi) \| `replaced` (đã bị thay thế) |
| `registered_at` | Thời điểm đăng ký | Bắt buộc |
| `last_seen_at` | Lần cuối nhìn thấy thiết bị | Dùng để phát hiện thiết bị 90 ngày không dùng |
| `approved_by` | Người duyệt | Người dùng có quyền HR |
| `approved_at` | Thời điểm duyệt | Ghi khi chuyển sang `active` |
| `revoked_by` | Người thu hồi | HR hoặc chính nhân viên tự gỡ |
| `revoked_at` | Thời điểm thu hồi | Ghi khi chuyển sang `revoked` |
| `revoke_reason` | Lý do thu hồi | Bắt buộc khi HR thu hồi |
| `is_additional` | Máy thêm (ngoài hạn mức gốc) | Máy thêm được duyệt khi nhân viên đã đủ hạn mức thiết bị. Gỡ máy này → hạn mức tự động về lại mặc định |
| `granted_until` | Hạn dùng tuỳ chọn cho máy thêm | Có thể để trống = dùng vô thời hạn |

> Với `max_devices = 2` (mặc định) thì mỗi user có tối đa **2 thiết bị** đang hoạt động.
> Thêm thiết bị thứ 3 → tạo yêu cầu kèm lý do, chờ HR duyệt.

> **Không có bảng "ngoại lệ" riêng.** Hạn mức thiết bị được suy ra từ chính danh sách thiết bị
> đang hoạt động — nên không thể lệch với thực tế. Xem `device_allowance` bên dưới.

- Nhân viên đăng ký thiết bị lần đầu (web tự sinh fingerprint: canvas + screen + user-agent hash).
- Mỗi user tối đa **2 thiết bị đang hoạt động** (`max_devices`, cấu hình được trong C10).
- Chấm công từ thiết bị chưa được duyệt → **từ chối** + ghi log.
- **Thiết bị mới không tự đăng ký được** — luôn tạo yêu cầu chờ HR duyệt (xem §2.1).

### Hồ sơ khuôn mặt (xác thực khi chấm công)

**Hồ sơ khuôn mặt (`FaceProfile`)** — mỗi nhân viên có tối đa 1 hồ sơ đang hoạt động:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh hồ sơ | Khóa chính |
| `user_id` | Nhân viên sở hữu | Duy nhất với hồ sơ `active`; tham chiếu `User` |
| `embedding` | Vector đặc trưng khuôn mặt | **Không lưu ảnh thô**; so khớp 1:1 khi chấm công |
| `model_version` | Phiên bản model nhận diện | Dùng khi nâng cấp model để đăng ký lại nếu cần |
| `status` | Trạng thái hồ sơ | `active` (đang dùng) \| `reset` (HR đã huỷ, cần đăng ký lại) |
| `enrolled_at` | Thời điểm đăng ký | Bắt buộc; phải đang trong mạng nội bộ công ty |
| `enrolled_by` | Người thực hiện | Nhân viên tự đăng ký; HR có thể hỗ trợ |
| `consent_at` | Thời điểm đồng ý sinh trắc học | Bắt buộc trước khi chụp |
| `last_verified_at` | Lần khớp gần nhất | Ghi mỗi lần chấm công thành công |
| `reset_by` / `reset_reason` | Ai huỷ và vì sao | Bắt buộc khi HR reset (VD: đổi diện mạo, đeo kính khác) |

Nguyên tắc:
- **Mỗi lần chấm công** camera trước chụp ảnh → kiểm tra **liveness** → so khớp 1:1 với `embedding` đã đăng ký; chạy **song song** với kiểm tra thiết bị / mạng / GPS / ca.
- Không khớp hoặc không đạt liveness → **chặn** (không có đường vòng "HR xác minh sau").
- **Chỉ lưu vector đặc trưng**, không lưu ảnh thô. Ảnh chụp lúc chấm công chỉ tồn tại tạm để đối chiếu; offline thì lưu tạm trên máy đến khi đồng bộ xong rồi xoá.
- Nhân viên chưa có hồ sơ → **chưa chấm công được**; bấm "Đăng ký khuôn mặt" (3 góc + liveness) trong mạng công ty.
- HR **reset hồ sơ** khi nhận diện sai kéo dài (đổi diện mạo, phẫu thuật, kính…) kèm lý do + audit log.

### 2.1. Vòng đời thiết bị — đăng ký / duyệt / thay thế / thu hồi

Vì `max_devices = 2`, **quy trình đổi máy là hành trình phổ biến**, không phải trường hợp hiếm.
Thiết kế phải đảm bảo nhân viên **không bao giờ mất công** vì việc đổi máy.

> **Luồng đăng ký thiết bị mới:**
>
> 1. Nhân viên bấm "Đăng ký thiết bị mới".
> 2. Hệ thống tạo **yêu cầu thiết bị** ở trạng thái *"chờ duyệt"*.
> 3. Đồng thời tạo **ApprovalTask cho HR** (approval engine dùng chung).
> 4. **HR duyệt** → thiết bị chuyển sang *"đang hoạt động"*. Nếu nhân viên **đã đủ hạn mức thiết bị** (mặc định 2 máy) → máy này được đánh dấu là **"máy thêm"** và hạn mức **tăng thêm 1**.
> 5. **HR từ chối** → thiết bị chuyển sang *"đã thu hồi"* kèm lý do, nhân viên nhận thông báo.

**Nhân viên tự gỡ thiết bị:**

> Nhân viên bấm "Gỡ thiết bị" → thiết bị chuyển sang *"đã thu hồi"* (lý do: **nhân viên tự gỡ**).
> Nếu đó là **máy thêm** → hạn mức **tự động về lại mặc định (2 máy)**.

> Đây là cách đổi máy thông thường: **gỡ máy cũ + gửi yêu cầu thêm máy mới** →
> HR duyệt → nhân viên lại có đủ 2 máy. Không cần khái niệm "ngoại lệ" ở bất kỳ đâu.

**Hạn mức thiết bị được tính động — không có bảng riêng:**

| Khái niệm | Cách tính | Ý nghĩa |
|---|---|---|
| `device_allowance` | Hạn mức gốc (mặc định 2) + số máy thêm đang hoạt động | Số thiết bị nhân viên được dùng đồng thời |
| Số máy thêm đang hoạt động | Đếm các thiết bị có `status = active` **và** `is_additional = true` của nhân viên đó | Tự động về 2 khi nhân viên gỡ máy thêm |

**Rủi ro của việc dùng nhiều máy — và tại sao vẫn an toàn:**

| | 2 máy (mặc định) | 3 máy (HR duyệt) |
|---|---|---|
| Rủi ro share account | Thấp — 2 người share thì chỉ 1 người được công 1 ngày | Cao hơn — 3 máy đều hợp lệ cho 1 account |
| Cần bù lại bằng | — | `max_checkin_per_day = 1` **vẫn giữ** → nhiều người share vẫn chỉ công được 1 người/ngày |
| Nên dùng khi | Mặc định | Nhân viên thật sự cần 3 máy (điện thoại + máy tính bản + iPad khi đi công tác) |

> **Lưu ý quan trọng:** cho phép máy thứ 3 **không phá vỡ** lớp bảo vệ chính
> (`max_checkin_per_day = 1`). Ngay cả khi nhân viên có 3 máy được duyệt, nhiều người share
> tài khoản đó vẫn chỉ có 1 lượt công/ngày. Đây là **rủi ro có kiểm soát**, không phải lỗ hổng.

**Ba trường hợp cần xử lý riêng:**

| Tình huống | Cách xử lý | Mục đích |
|---|---|---|
| **Đổi máy** (mua máy mới, hết hạn) | Duyệt → thiết bị mới `active`, thiết bị cũ `replaced` | Không mất công, không cần xóa lịch sử cũ |
| **Mất / bị trộm máy** | HR thu hồi thiết bị cũ (`revoked`) **ngay lập tức** | Đóng lỗ hổng gian lận — thiết bị cũ không chấm công được nữa |
| **Hết hạn thiết bị cũ** (90 ngày không dùng) | Tự động `revoked` + nhắc nhân viên đăng ký lại | Tránh tích tụ thiết bị bị bỏ quên |

**Quy tắc quan trọng — không để nhân viên mất công:**

Khi nhân viên chấm công, hệ thống tra thiết bị đang hoạt động theo fingerprint:

| Tình huống | Kết quả | Thông báo cho nhân viên |
|---|---|---|
| Thiết bị đang hoạt động | Cho chấm công bình thường | — |
| Thiết bị từng dùng nhưng **đã bị thu hồi** | Từ chối | *"Thiết bị này đã bị thu hồi. Nếu bạn vừa đổi máy, hãy đăng ký thiết bị mới và chờ HR duyệt — nhân viên đã chấm công trước đó vẫn được giữ nguyên."* |
| Có yêu cầu đăng ký **đang chờ duyệt** | Từ chối | *"Yêu cầu đăng ký thiết bị đang chờ HR duyệt."* |
| **Chưa từng đăng ký** | Từ chối | *"Thiết bị chưa được đăng ký. Hãy đăng ký và chờ HR duyệt."* |

**Xử lý khi đơn bổ sung công có sẵn:** nếu nhân viên đã chấm công (check-in) bằng thiết bị cũ hôm nay,
rồi đổi máy và chấm công ra bằng máy mới (chưa duyệt) → hệ thống cho phép **ghi đè
`check_out` của chính entry hôm nay** mà không cần thiết bị mới được duyệt.
Lý do: `check_in` đã xác thực trên thiết bị hợp lệ, và việc đổi máy giữa ngày là chuyện bình thường.
Có ghi vào audit log để HR thấy.

**Đăng ký thiết bị qua mạng nội bộ công ty (khuyến nghị):**
Yêu cầu đăng ký thiết bị phải đến từ IP thuộc các dải IP văn phòng đã cấu hình.
Lý do: thiết bị lạ ở ngoài văn phòng mà vẫn được duyệt là lỗ hổng gian lận.

**Xác minh định kỳ (không bắt buộc, P2):**
HR có thể yêu cầu xác nhận định kỳ ("Bạn vẫn đang dùng thiết bị này?") mỗi 90 ngày.
Nếu quá hạn không xác nhận → thiết bị chuyển `revoked`. Đây là lớp phòng ngừa cuối cùng
cho trường hợp thiết bị bị trộm và dùng lâu dài mà không ai nhận ra.

### 2.2. Yêu cầu thêm thiết bị (một flow duy nhất)

**Không có khái niệm "ngoại lệ" trong hệ thống.** Nhân viên muốn thêm máy thứ ba
→ gửi **yêu cầu thêm thiết bị** (kèm lý do) → HR duyệt → dùng được 3 máy. Bỏ máy thứ ba →
hạn mức **tự động về lại 2 máy**.

**Quy tắc khi gửi yêu cầu thêm thiết bị:**

| Quy tắc | Nội dung |
|---|---|
| Bắt buộc có lý do | Không có `reason` → từ chối yêu cầu với thông báo *"Vui lòng nêu lý do cần thêm thiết bị."* |
| Đánh dấu máy thêm | Nếu số thiết bị đang hoạt động của nhân viên **đã đủ hạn mức** → yêu cầu mới được đánh dấu là "máy thêm" (`is_additional`) |
| Đi qua duyệt của HR | Mọi yêu cầu thêm thiết bị đều tạo task duyệt cho HR, dùng chung approval engine với đơn từ/OKR |
| Ghi nhận thiết bị mới | Yêu cầu được lưu ở trạng thái "chờ duyệt" kèm fingerprint, tên thiết bị, nền tảng |

**Quy tắc khi HR duyệt:**

| Quy tắc | Nội dung |
|---|---|
| Thiết bị chuyển hoạt động | `status = active`, ghi người duyệt + thời điểm duyệt |
| Hạn mức tự tính lại | Không cần cập nhật thủ công — `device_allowance` tự đếm lại số máy thêm đang hoạt động |
| HR **có thể đặt hạn** | `granted_until` — VD: chỉ cho công tác xa đến 31/12 |
| Ghi audit log | Mọi thao tác duyệt đều được ghi nhật ký |
| Thông báo chủ thiết bị | Nhân viên nhận thông báo kết quả duyệt |

**Quy tắc khi nhân viên tự gỡ thiết bị:**

| Quy tắc | Nội dung |
|---|---|
| Thiết bị chuyển "đã thu hồi" | `status = revoked`, `revoked_at` = thời điểm gỡ, `revoke_reason` = "Nhân viên tự gỡ" |
| Hạn mức tự về 2 máy | Không cần làm gì thêm — `device_allowance` tự đếm lại |
| Ghi audit log | Mọi thao tác gỡ đều được ghi nhật ký |

**Quy trình đổi máy thông thường (không cần khái niệm ngoại lệ):**

1. Nhân viên gỡ máy cũ → hạn mức về 2 máy, máy cũ `status = revoked`.
2. Nhân viên gửi yêu cầu thêm máy mới (kèm lý do).
3. HR duyệt → máy mới `status = active`.
4. Nhân viên lại có đủ 2 máy đang hoạt động.

**Yêu cầu khi HR duyệt:**
- Bắt buộc có `reason` từ nhân viên (hiển thị trong audit log và trên màn hình quản lý).
- HR **có thể đặt hạn** cho máy được duyệt (`granted_until`) — VD: chỉ cho công tác xa đến 31/12.
- HR có thể **thu hồi** bất kỳ lúc nào → máy bị `revoked` ngay, hạn mức tự về 2.
- Mọi thao tác (duyệt/thu hồi/gỡ) đều ghi audit log.

**Job bảo trì hạn mức:** hằng ngày → máy thêm đã quá `granted_until` → `revoked`
(`revoke_reason = "Hết hạn được cấp"`) + thông báo nhân viên. Hạn mức tự về 2 máy.

> **Vì sao không có bảng riêng:** hạn mức suy ra từ chính danh sách thiết bị đang hoạt động
> → không bao giờ lệch với thực tế. Nhân viên tự gỡ máy là hạn mức tự về 2 — không cần
> ai phải cập nhật gì thêm.

### Thuật ngữ — 3 khái niệm dễ nhầm, gọi khác nhau trong UI

> Có **2 thứ cùng gọi "nhóm"** trong hệ thống nếu không phân biệt. Chốt rõ để team
> không implement nhầm, và để người dùng không phải đoán.

| Khái niệm | Model | Gọi trong UI | Là gì |
|---|---|---|---|
| **Nhóm** | `Team` | "Nhóm" — Mobile, Galaxy, CSKH… | **Đơn vị tổ chức**: phối hợp, duyệt đơn, phân tầng OKR. Có trưởng nhóm, lồng nhau. |
| **Ca** | `Shift` | "Ca" — Ca hành chính, Ca sáng… | **Khung giờ làm việc**: giờ vào/ra, nghỉ trưa, linh hoặc cố định. |
| **Bộ gán ca** | `ShiftAssignment` | "Bộ gán ca" | **Quy tắc gán**: nhóm X + chức danh Y thì đi ca Z. |

> **Vì sao phải tách:** file Excel có cột *"Nhóm/Team"* — đó là `Team`.
> Riêng ca làm việc là khái niệm **cấu hình của HR**, không phải tổ chức.
> Trước đây gọi là "nhóm ca" (`ShiftGroup`) → dễ nhầm với "nhóm". Đã đổi thành **"ca"** và **"bộ gán ca"**.

### Tổ chức linh hoạt — MỘT khái niệm duy nhất: NHÓM (Team)

> **Vì sao không có "phòng ban" / "chi nhánh":** nhìn vào **chính file công ty** —
> `doc/Rule chấm công.xlsx` có cột *"Chức vụ/Position"* và *"Nhóm/Team"*, **không hề có
> cột "Phòng ban"**. Công ty đã không dùng phòng ban làm đơn vị cấp ứng dụng.
> Nếu cứ thêm "phòng ban" vào thì hệ thống định nghĩa thứ mà công ty không dùng.
>
> **Thay vào đó: 1 khái niệm duy nhất — NHÓM. Nhóm nằm trong nhóm.**
> Số tầng **không fix cứng**: công ty chỉ cần 2 tầng (Công ty → Nhóm) thì được,
> cần 5 tầng cũng được. Không có "phòng ban" nào cả — chỉ có nhóm và nhóm con.

**Nhóm (`Team`)** — đơn vị phối hợp & phân trách duyệt, có thể chứa nhóm con:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh nhóm | Khóa chính |
| `name` | Tên nhóm | Bắt buộc |
| `code` | Mã nhóm | Dùng để tra cứu/tham chiếu nhanh |
| `parent_team_id` | Nhóm cha | Bỏ trống = nhóm gốc (công ty / đơn vị cấp cao nhất); số tầng **không fix cứng**: nhóm gốc → nhóm con → nhóm cháu → … |
| `lead_id` | Trưởng nhóm | Người **duyệt hộ** cho thành viên; có thể để trống |
| `description` | Mô tả nhóm | Tùy chọn |
| `is_active` | Nhóm còn hoạt động | Có / không |
| `created_by` | Người tạo nhóm | Người dùng có quyền HR |
| `created_at`, `updated_at` | Mốc tạo / cập nhật | Ghi tự động |

**Thành viên nhóm (`TeamMember`)** — 1 người có thể thuộc **nhiều** nhóm:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh quan hệ thành viên | Khóa chính |
| `team_id` | Nhóm | Tham chiếu `Team` |
| `user_id` | Thành viên | Tham chiếu `User` |
| `role_in_team` | Vai trò của người đó trong nhóm | `member` \| `lead` (trưởng nhóm) |
| `joined_at` | Thời điểm gia nhập nhóm | Ghi tự động |

> Ràng buộc: **duy nhất** theo cặp (`team_id`, `user_id`) — một người không được xuất hiện 2 lần trong cùng một nhóm.

**Cây tổ chức — số tầng tự do:**

> **Công ty** (nhóm gốc, `parent_team_id` = rỗng)
> └── **Nhóm A**
> &nbsp;&nbsp;&nbsp;&nbsp;├── **Nhóm A1**
> &nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;└── **Nhóm A1a** — có thể sâu thêm bao nhiêu tầng tuỳ ý
> &nbsp;&nbsp;&nbsp;&nbsp;└── **Nhóm A2**
> └── **Nhóm B**
> &nbsp;&nbsp;&nbsp;&nbsp;└── **Nhân viên**

> **Không có khái niệm "phòng ban" hay "chi nhánh" ở đâu cả.** Muốn gom 3 nhóm thành
> "một đơn vị lớn" thì tạo 1 nhóm cha. Muốn tách nhóm ra thì tạo nhóm con. Muốn bỏ cấp trung
> gian thì chuyển thành viên lên nhóm ông. **Không sửa schema, không sửa code.**

**Quy tắc quan trọng — 1 manager quản lý nhiều nhóm:**

> Nhóm **không có "manager" riêng**. **Trưởng nhóm (`lead_id`) là người DUYỆT.**
> **Quản lý** (`manager_id` trên người dùng) quản lý **TRỰC TIẾP** các thành viên —
> và có thể quản lý **nhiều nhóm cùng lúc, không giới hạn**.

#### Cấu hình mặc định — nhóm, trưởng nhóm, quản lý (seed từ file thật)

> **Ý tưởng:** hệ thống **có sẵn** nhóm + trưởng nhóm + quản lý, vì đây là thứ mọi công ty đều có.
> Nhưng **cấp cao hơn thì để HR cấu hình thêm** — không fix cứng.

Nguồn dữ liệu gốc: file quy định chấm công của công ty (`doc/Rule chấm công.xlsx`) — cột **"Nhóm/Team"** + cột **"Quản lý trực tiếp"**.

**16 nhóm**, mỗi nhóm có **1 trưởng nhóm** (= người trong nhóm mà các thành viên report về):

| Nhóm | N | Trưởng nhóm | Quản lý |
|---|---|---|---|
| Kiểm thử phần mềm | 15 | ĐOÀN THỊ NHƯ MAI | — (nhóm gốc) |
| Galaxy | 6 | PHẠM XUÂN HIẾU | PHẠM XUÂN HIẾU |
| Hỗ trợ kỹ thuật | 5 | NGUYỄN QUANG VINH | NGUYỄN QUANG VINH |
| Avenger | 4 | NGUYỄN THANH TÙNG | NGUYỄN THANH TÙNG |
| Hades | 4 | PHẠM XUÂN HIẾU | PHẠM XUÂN HIẾU |
| Minion | 4 | NGUYỄN QUANG VINH | NGUYỄN QUANG VINH |
| Mobile | 4 | NGUYỄN QUANG TÙNG | — (nhóm gốc) |
| Nhân sự | 4 | NGUYỄN THỊ PHƯỢNG | — (nhóm gốc) |
| Sirius | 4 | NGUYỄN THANH TÙNG | NGUYỄN THANH TÙNG |
| Optimus | 2 | NGUYỄN THANH TÙNG | NGUYỄN THANH TÙNG |
| Devops | 2 | NGUYỄN QUANG VINH | NGUYỄN QUANG VINH |
| Kế toán | 2 | *(chưa có)* | *(chưa có)* |
| Savior | 3 | TRẦN HOÀNG HIỆP | — (nhóm gốc) |
| Titan | 3 | PHẠM XUÂN HIẾU | PHẠM XUÂN HIẾU |
| Web | 3 | NGUYỄN THANH TÙNG | NGUYỄN THANH TÙNG |
| Zeus | 3 | NGUYỄN QUANG VINH | NGUYỄN QUANG VINH |

**Cấp trên cấp dưới — 3 nhóm cha, do HR cấu hình thêm:**

> **Hades** (trưởng: PHẠM XUÂN HIẾU) → Galaxy · Hades · Titan
> **Minion** (trưởng: NGUYỄN QUANG VINH) → Devops · Hỗ trợ kỹ thuật · Minion · Zeus
> **Sirius** (trưởng: NGUYỄN THANH TÙNG) → Avenger · Optimus · Sirius · Web

> **Vì sao 3 quản lý này là "cấp cao hơn":** họ quản lý **nhiều nhóm** (4 + 4 + 3 nhóm).
> Trong seed, 3 quản lý đó đứng đầu 3 nhóm cha tương ứng. **HR có thể thêm cấp nữa**
> (VD một giám đốc quản lý cả 3 nhóm cha) — không sửa schema, chỉ gán `parent_team_id`.
>
> **Nhóm "Kế toán" không có trưởng** — đây là **dữ liệu thật của công ty** (1 người tự báo cáo,
> 1 người không có quản lý). **Để nguyên, không cảnh báo**: nhóm không có trưởng vẫn hoạt động bình
> thường — đơn của thành viên chuyển lên **quản lý trực tiếp** (theo `User.manager_id`) thay vì
> trưởng nhóm. Trưởng nhóm chỉ là **người duyệt thay thế**, không phải điều kiện để nhóm tồn tại.

### Tách quyền XEM khỏi quyền DUYỆT

> **Đây là nguyên tắc cốt lõi của phần này.** Trước đây hệ thống gộp "được thấy" và
> "được duyệt" làm một — dẫn tới không thể cho đồng nghiệp cùng team **thấy** đơn để phối hợp
> mà **không** cho họ duyệt. Đó là 2 quyền khác nhau hoàn toàn.

| | **Quyền DUYỆT** (`approver`) | **Quyền XEM** (`viewer`) |
|---|---|---|
| Ai | 1 người cụ thể (theo step) | Nhiều người (nhóm, team, vai trò) |
| Nhận task approval | ✅ Có | ❌ Không |
| Bị tính SLA / nhắc quá hạn | ✅ Có | ❌ Không |
| Bấm Duyệt / Từ chối | ✅ Được | ❌ Không (chỉ xem) |
| Thấy nội dung đơn | ✅ | ✅ (nếu cấu hình) |
| Thấy lý do từ chối | ✅ | ✅ (nếu cấu hình) |

**Bước duyệt (`ApprovalStep`)** — mỗi bước trong luồng duyệt:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bước duyệt | Khóa chính |
| `flow_id` | Luồng duyệt chứa bước này | Tham chiếu luồng duyệt |
| `step_order` | Thứ tự bước | Bắt buộc; các bước chạy tuần tự |
| `approver_type` | Kiểu người duyệt ở bước này | `role` \| `manager` \| `hr` \| `position` \| `team_lead` \| `user` |
| `approver_ref_id` | Đối tượng cụ thể được trỏ tới | Nhóm/chức danh/vai trò/người tương ứng với `approver_type` |
| `require_reason_on_reject` | Bắt buộc ghi lý do khi từ chối | Có / không |
| `sla_hours` | Số giờ chờ tối đa | Có thể để trống = không tính SLA; dùng để nhắc quá hạn |
| `viewer_scope` | **Ai được XEM đơn ở bước này** (để phối hợp) | Cấu hình gồm: danh sách `teams`, danh sách `roles`, danh sách `users`, cờ `include_reason`, cờ `viewer_see_attachments`. **Mặc định: người gửi + approver + HR** (nếu có bước HR) |

> **Vì sao không hardcode tên trưởng nhóm:** đó là quy định của công ty **tại thời điểm này**.
> Khi team CA đổi trưởng, hoặc thêm team mới cần duyệt qua HR, HR phải sửa được trong UI —
> không sửa code. Nên rule lưu **theo team**, và `lead_id` của team là nơi chứa tên người.

**Snapshot người được xem (`ApprovalViewer`)** — ghi lại ai được quyền xem 1 đơn ở 1 bước, để audit và gỡ quyền khi đổi cấu hình:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bản ghi | Khóa chính |
| `step_id` | Bước duyệt đã cấp quyền xem | Tham chiếu `ApprovalStep` |
| `subject_type` | Loại đối tượng được xem | `request` \| `okr_review` \| `okr_score` |
| `subject_id` | Đối tượng cụ thể được xem | Đơn/OKR cụ thể |
| `viewer_id` | Người được cấp quyền xem | Tham chiếu `User` |
| `viewer_scope` | Phạm vi đã dùng để tính quyền | Lưu lại để hiểu **vì sao** người đó được xem |
| `granted_at` | Thời điểm cấp quyền | Ghi tự động |

**Ví dụ cấu hình thật** (theo file Excel — team CA & Mobile có luồng duyệt riêng):

| Trường hợp | Bước 1 | Bước 2 |
|---|---|---|
| **Đơn đi muộn của nhân viên team Mobile** | Người duyệt: **trưởng nhóm Mobile (Tim)**. Phạm vi người xem: nhóm Mobile + vai trò HR, **có xem lý do từ chối** → Tim duyệt (quyết định), đồng nghiệp Mobile và HR thấy để phối hợp | Người duyệt: **HR**. Phạm vi người xem: nhóm Mobile |
| **Đơn của nhân viên team CA** | Người duyệt: **trưởng nhóm CA (Hiệp)** | Người duyệt: **HR** |
| **Đơn của nhân viên các team khác** | Người duyệt: **quản lý trực tiếp** | Người duyệt: **HR** |

**Cấu hình trong rule catalog** (mục cấu hình "Luồng duyệt đơn" — `approval_flow`):

| Trường cấu hình | Nhãn hiển thị | Ý nghĩa & giá trị mặc định |
|---|---|---|
| `steps` | Các bước duyệt | Mô tả từng bước: approver + `viewer_scope` + `sla_hours` |
| `default_viewer_teams` | Team mặc định được xem | Danh sách nhóm; nguồn dữ liệu là danh sách nhóm; **để trống = chỉ người gửi + approver thấy** |
| `viewer_see_reason` | Người xem thấy lý do từ chối | Có / không; mặc định **Có** |
| `viewer_see_attachments` | Người xem thấy file đính kèm | Có / không; mặc định **Không** |

### Approval Engine (dùng chung cho đơn từ VÀ OKR — Mục 3)

Đây là phần tái sử dụng giá trị nhất. Thiết kế **generic** để cả 2 module dùng chung:

**Luồng duyệt (`ApprovalFlow`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh luồng duyệt | Khóa chính |
| `module` | Phân hệ sử dụng luồng | `request` (đơn từ) \| `okr` |
| `name` | Tên luồng | Bắt buộc |
| `steps` | Các bước duyệt thuộc luồng | Có thứ tự, mỗi bước 1 vai trò duyệt |

**Task duyệt (`ApprovalTask`)** — một đơn cụ thể đang chờ 1 người quyết định:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh task | Khóa chính |
| `flow_id` | Luồng duyệt | Tham chiếu `ApprovalFlow` |
| `step_id` | Bước duyệt hiện tại | Tham chiếu `ApprovalStep` |
| `subject_type` | Loại đối tượng được duyệt | `request` \| `okr_review` \| `okr_score` |
| `subject_id` | Đối tượng cụ thể | Tham chiếu đơn/OKR |
| `assignee_id` | Người được giao duyệt | Tham chiếu `User` |
| `status` | Trạng thái task | `pending` \| `approved` \| `rejected` \| `returned` \| `cancelled` |
| `decided_by` | Người đã quyết định | Người thực hiện duyệt/từ chối |
| `decided_at` | Thời điểm quyết định | Ghi khi có quyết định |
| `reason` | Lý do (bắt buộc nếu bước yêu cầu) | Nội dung lý do từ chối/trả lại |
| `assigned_at` | Thời điểm giao task | Dùng để tính SLA |
| `snapshot_manager_id` | Snapshot quản lý tại thời điểm giao | Giải quyết tình huống **"chuyển phòng giữa năm"** — task cũ vẫn trỏ đúng người duyệt lúc giao |

**Luồng duyệt (áp dụng chung Mục 3 + 6.6):**

1. Nhân viên tạo đơn.
2. **Quota engine kiểm tra NGAY LÚC TẠO** (Mục 6.6 bước 1) → chặn nếu vượt.
3. Tạo **ApprovalTask cho bước 1** (quản lý trực tiếp).
4. Quản lý **duyệt / từ chối** (bắt buộc lý do).
5. Nếu luồng có bước 2 (HR): tạo task cho HR.
6. HR duyệt.
7. Phát sự kiện (event) → phân hệ tương ứng cập nhật bảng công / điểm OKR.
8. Gửi **notification** cho nhân viên.

**Thứ tự ưu tiên khi giao task duyệt:**

| Ưu tiên | Nguồn người duyệt |
|---|---|
| 1 | `manager_id` hiện tại của người gửi |
| 2 | Trưởng nhóm (`Team.lead_id`) của nhóm người gửi — nếu có bước duyệt trưởng nhóm |
| 3 | HR theo scope |

**Nhắc quá hạn (Mục 3):** job hàng giờ quét task `pending` có `assigned_at + sla_hours < now` → gửi notification nhắc người duyệt + gửi HR nếu quá 2× SLA.

**Trả lại để làm lại:** `status=returned` → subject quay về `draft` cho người tạo sửa, khi submit lại tạo task mới (giữ audit trail đầy đủ).

### Notification & Audit Log (Mục 3)

**Thông báo (`Notification`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh thông báo | Khóa chính |
| `user_id` | Người nhận | Tham chiếu `User` |
| `module` | Phân hệ phát sinh | `timesheet` \| `okr` \| `system` |
| `type` | Loại thông báo | VD: duyệt đơn, task quá hạn, nhắc thiết bị |
| `title` | Tiêu đề | Bắt buộc |
| `body` | Nội dung | Bắt buộc |
| `link` | Đường dẫn tới đối tượng | Deep-link để bấm vào xem ngay |
| `is_read` | Đã đọc hay chưa | Có / không |
| `created_at` | Thời điểm tạo | Ghi tự động |

> Thông báo được gửi kèm **email** và **push** (web push).

**Việc cần làm (`ActionItem`)** — mọi việc một người cần làm, gom từ nhiều module:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh việc | Khóa chính |
| `user_id` | Người cần làm việc này | Tham chiếu `User` |
| `module` | Phân hệ phát sinh việc | `timesheet` \| `okr` \| `system` |
| `kind` | Loại việc | VD: chấm công, bổ sung công, WFH report, check-in OKR |
| `title` | Tiêu đề việc | Bắt buộc |
| `description` | Mô tả việc | Bắt buộc |
| `due_at` | Hạn xử lý | Có thể trống = không có hạn |
| `urgency` | Mức độ khẩn | `normal` \| `soon` \| `overdue` \| `sla_breach` |
| `action_url` | Đường dẫn hành động | Deep-link tới màn hình xử lý |
| `action_label` | Nhãn nút hành động | VD: "Chấm công", "Duyệt" |
| `entity_type` | Loại đối tượng liên quan | VD: đơn, OKR, thiết bị |
| `entity_id` | Đối tượng liên quan | Tham chiếu đối tượng |
| `status` | Trạng thái việc | `open` \| `done` \| `dismissed` |
| `created_at` | Thời điểm tạo | Ghi tự động |
| `done_at` | Thời điểm hoàn thành | Ghi khi đánh dấu xong |

> Đây là trang "Cần làm" — **màn hình mặc định sau khi đăng nhập** của nhân viên.

**Chỉ mục tìm kiếm (`SearchIndex`)** — chỉ mục thống nhất cho command palette (Ctrl+K):

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh mục | Khóa chính |
| `kind` | Loại đối tượng | `user` \| `request` \| `objective` \| `timesheet` \| `document` \| `rule` \| `action` |
| `title` | Tiêu đề hiển thị | Bắt buộc |
| `subtitle` | Phụ đề hiển thị | VD: chức danh, nhóm, trạng thái |
| `content` | Nội dung tìm kiếm | Đã chuẩn hóa: bỏ dấu, chữ thường — cho phép tìm tiếng Việt không dấu |
| `url` | Đường dẫn tới đối tượng | Deep-link |
| `role_scope` | Ai được thấy | Cấu hình phạm vi hiển thị theo vai trò/nhóm; kết quả tìm kiếm **chỉ trả về trong phạm vi người dùng được phép thấy** |
| `updated_at` | Thời điểm cập nhật | Ghi tự động |

> **Vì sao không dùng tìm kiếm toàn văn có sẵn:** tiếng Việt không có từ điển tốt → dùng
> trigram + khớp tiền tố trên nội dung đã bỏ dấu.

**Nhật ký thay đổi (`AuditLog`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bản ghi nhật ký | Khóa chính |
| `actor_id` | Người thực hiện | Tham chiếu `User` |
| `action` | Loại hành động | `create` \| `update` \| `approve` \| `reject` \| `score` \| `lock` \| `export` |
| `entity_type` | Loại đối tượng bị thay đổi | VD: đơn, điểm chấm công, thiết bị |
| `entity_id` | Đối tượng bị thay đổi | Tham chiếu đối tượng |
| `before` | Trạng thái trước khi sửa | Snapshot để đối chiếu |
| `after` | Trạng thái sau khi sửa | Snapshot để đối chiếu |
| `ip` | Địa chỉ IP người thực hiện | Ghi lại |
| `user_agent` | Thiết bị/trình duyệt người thực hiện | Ghi lại |
| `created_at` | Thời điểm ghi | Ghi tự động |

> Tài liệu nói rõ: *"Nhật ký thay đổi: ghi lại ai sửa gì, lúc nào — bắt buộc với dữ liệu công và điểm OKR vì liên quan đến lương và đánh giá."* → **Mọi write vào `TimeEntry`, `Timesheet`, `CheckIn`, `Score` đều bắt buộc ghi audit log.** Dùng decorator/mixin để không ai quên:

> Mọi hành động ghi dữ liệu công/điểm OKR đều phải đi qua một **lớp audit bắt buộc**,
> ghi lại: **ai làm, làm gì, trước và sau như thế nào, lúc nào, từ IP/thiết bị nào.**

### Document (nguồn cho trang quy định — Mục 5 + phân hệ CMS)

**Tài liệu (`Document`)**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh tài liệu | Khóa chính |
| `title` | Tiêu đề tài liệu | Bắt buộc |
| `category` | Phân loại | `announcement` (thông báo) \| `policy` (chính sách) \| `form` (biểu mẫu) |
| `body` | Nội dung | Bắt buộc |
| `version` | Phiên bản | Số nguyên tăng dần |
| `effective_from` | Ngày hiệu lực | Bắt buộc |
| `effective_to` | Ngày hết hiệu lực | Có thể trống = còn hiệu lực |
| `status` | Trạng thái | `draft` \| `published` \| `archived` |
| `team_id` | Phạm vi đăng (nhóm) | Có thể trống = đăng toàn công ty |
| `require_ack` | Bắt buộc xác nhận đã đọc | Có / không |
| `file_url` | Đường dẫn file đính kèm | Tùy chọn |
| `checksum` | Mã kiểm tra file | Xác nhận file không bị đổi |
| `created_by` | Người tạo | Người dùng có quyền HR |
| `published_at` | Thời điểm xuất bản | Ghi khi chuyển sang `published` |

Dùng chung cho:
- Phân hệ CMS (thông báo / chính sách / biểu mẫu) — bài toán 3, không xây trong hackathon này nhưng schema đã sẵn sàng.
- **Trang quy định tra cứu (C6)**: render trực tiếp từ `Document` + `RuleConfig` → nhân viên tự tra "quota đi muộn là bao nhiêu" mà không phải hỏi HR.
- Nguồn cho command palette (C3).

### Action Center — Todo Inbox (C1)

Service tập trung gom việc từ mọi module về 1 nơi. **Không nằm trong module nào** → thuộc `core`.

**Quy tắc gom việc (`build_inbox`)** — gom mọi việc đang chờ user, sắp xếp theo mức độ khẩn:

| Nguồn | Loại việc được gom |
|---|---|
| Chấm công | Chấm công, bổ sung công, WFH report |
| OKR | Check-in, tự chấm, bị trả lại |
| Hệ thống | Phép tồn sắp hết hạn, bảng công chờ kiểm tra |

> Sau khi gom, toàn bộ danh sách được **sắp xếp theo mức độ khẩn** (`urgency`).

**Quy tắc chống spam (rất quan trọng — nhắc nhiều quá thì bỏ qua):**

| Quy tắc | Giá trị | Ý nghĩa |
|---|---|---|
| `max_push_per_day_per_user` | 3 | Tối đa 3 push mỗi ngày mỗi người |
| `digest_email_at` | 08:00 | Email tổng hợp lúc 08:00 gom mọi việc chưa xong |
| `quiet_hours` | 21:00 → 07:00 | Không gửi nhắc trong giờ nghỉ |
| `dedupe_window_hours` | 12 | Cùng một thông báo trong 12 giờ không gửi lặp |
| `escalate_after_days` | 3 | Việc quá 3 ngày chưa xử lý → báo thêm cho quản lý |

## 3. Auth & SSO

HR đã quyết định: *"Em nghĩ nên dùng tài khoản google của công ty luôn"*.

**Quy tắc đăng nhập (business):**

| Quy tắc | Nội dung |
|---|---|
| Cách đăng nhập | **Tài khoản Google của công ty** (@act.vn) — 1 nút "Đăng nhập bằng Google công ty" trên trang đăng nhập |
| Tên miền | Chỉ chấp nhận email thuộc tên miền công ty; tài khoản Google ngoài tên miền bị **từ chối kèm thông báo rõ** |
| Xác định vai trò | **Tự động** từ tài khoản (`User.role` + `UserScope`) — **không có bước/màn hình chọn vai trò** ở bất kỳ luồng đăng nhập nào |
| Sau đăng nhập | Vào thẳng màn hình **"Cần làm"** (todo inbox) của vai trò được phân |
| Giới hạn thử | Tối đa **5 lần thử trong 10 phút / IP** — quá là chặn tạm thời |
| Khớp tài khoản | Tài khoản được khớp theo địa chỉ email công ty; `google_sub` lưu liên kết Google SSO |
| Phiên đăng nhập | Phiên ngắn hạn (15 phút) + phiên làm mới dài hạn (7 ngày); đăng xuất thu hồi được |
| Tài khoản demo | Chỉ dùng cho buổi demo (email + mật khẩu fallback) — **vai trò vẫn tự lấy từ tài khoản**, không có màn hình chọn vai trò |

> **Lưu ý bảo mật:** phiên làm mới được **thu hồi được** (đăng xuất hoặc đổi mật khẩu) và
> **chỉ lưu dạng băm** trong hệ thống — không lưu bản thô → dump dữ liệu không lộ phiên dùng được.

## 4. Realtime

Thông báo & nhắc việc **đẩy tới người dùng ngay (realtime)** — không cần refresh trang. Kết nối có **heartbeat định kỳ** để không bị đứt kết nối qua mạng trung gian.

**Các loại thông báo realtime đẩy tới người dùng:**

| Loại | Khi nào bắn | Người dùng dùng để |
|---|---|---|
| `notification` | Có thông báo mới | Hiện toast + tăng badge chuông |
| `action_item` | Có việc mới trong todo inbox | Thêm vào list "Cần làm" không cần refresh |
| `approval` | Đơn/điểm đổi trạng thái | Cập nhật badge "Duyệt đơn" + timeline |
| `ping` | Mỗi **25 giây** | Heartbeat — giữ kết nối không bị đứt |

**Quy tắc vận hành realtime:**

| Quy tắc | Nội dung |
|---|---|
| Nhiều tab | Một user mở nhiều tab → **mọi tab đều nhận** thông báo |
| Ngắt kết nối | Khi client ngắt kết nối → dọn đăng ký tương ứng (tránh rò rỉ bộ nhớ) |
| Client chậm | Nếu hàng đợi đầy (client chậm) → **bỏ message cũ nhất** thay vì chặn nguồn phát sinh |
| Hướng truyền | Một chiều — server đẩy xuống client |

## 5. Acceptance criteria cho Core

- [ ] Đăng nhập bằng **Google công ty** → vào thẳng "Cần làm" của vai trò được phân; **không có bước chọn vai trò**
- [ ] Menu hiển thị đúng theo 4 vai trò, URL không thuộc vai trò trả 403
- [ ] Manager chỉ thấy dữ liệu cấp dưới trực tiếp; HR thấy toàn công ty; HR giới hạn theo chi nhánh không thấy chi nhánh khác
- [ ] **Lịch nhóm**: HR xem toàn công ty · Manager xem cấp dưới trực tiếp (`manager_id`) · Team lead xem nhóm mình phụ trách (`Team.lead_id`) · Member xem team của mình (`TeamMember`) — **không** thấy team khác
- [ ] **Thiết bị**: mặc định **2 thiết bị**; thiết bị thứ 3 phải gửi yêu cầu kèm lý do → HR duyệt
- [ ] Approval flow chạy đúng: **nghỉ phép = 1 bước (quản lý)**; đi muộn / bổ sung / WFH của CA, Mobile = 2 bước (quản lý/trưởng nhóm → HR)
- [ ] Task quá SLA sinh notification
- [ ] Mọi thao tác duyệt/từ chối/sửa điểm đều có bản ghi audit log
- [ ] Notification đẩy tức thời lên badge (không cần refresh)
- [ ] **Todo inbox** gom đúng mọi việc đang chờ, mỗi việc có 1 nút hành động deep-link
- [ ] **Command palette Ctrl+K** tìm được: nhân viên, đơn, quy định, cấu hình — và **chỉ trả về kết quả người dùng được phép thấy**
- [ ] Nhắc việc tôn trọng `quiet_hours` và giới hạn 3 push/ngày
- [ ] Digest email 08:00 gom tất cả việc chưa xong
