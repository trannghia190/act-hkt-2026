# 08 — Trình cấu hình quy định (Rule Builder)

> **Quyết định kiến trúc quan trọng nhất của bài toán 1.**
> Một **catalog quy định duy nhất** sinh ra **hai bề mặt**:
> 1. **Trang cấu hình** cho HR (sửa quy định bằng form)
> 2. **Trang tra cứu** cho nhân viên (đọc quy định có hiệu lực)
>
> Nhờ vậy: HR đổi quota → nhân viên thấy ngay quy định mới ở cùng một nguồn. Không có chuyện tài liệu lệch với phần mềm — vì tài liệu **được sinh ra từ** phần mềm.

---

## 1. Vì sao đây là P0

Tài liệu yêu cầu (Mục 6.2):
> *"Các giới hạn được HR **cấu hình trên hệ thống**, không cố định trong phần mềm, và có **ngày hiệu lực** để thay đổi khi quy định thay đổi."*

Nếu chỉ có API mà không có UI → HR vẫn phải gọi API hoặc sửa DB → claim "cấu hình được" là giả. **Judge sẽ hỏi "chỉnh quota bằng cách nào?" và đó là câu hỏi chắc chắn đến.**

**Đây cũng là khoảnh khắc demo mạnh nhất:** HR đổi quota **ngay trên sân khấu**, xem trước ảnh hưởng, áp dụng từ ngày mai — và nhân viên bên cạnh thấy quy định mới ngay.

---

## 2. Mô hình dữ liệu — có versioning

Mỗi quy định được lưu thành **nhiều phiên bản nối tiếp**. Một phiên bản là một bản ghi gồm:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh phiên bản | Khóa chính |
| `rule_key` | Quy định mà phiên bản này thuộc về | Bắt buộc · trỏ tới 1 trong **19 quy định** trong catalog |
| `scope_type` | Phạm vi áp dụng của phiên bản | `global` · `team` · `position` · `shift` |
| `scope_ref_id` | Đối tượng cụ thể trong phạm vi (phòng ban / chức danh / ca) | Bắt buộc khi `scope_type` ≠ `global`; để trống khi áp dụng toàn công ty |
| `value` | Bộ giá trị của quy định tại phiên bản này | Đầy đủ các trường của quy định tương ứng |
| `effective_from` | Ngày bắt đầu có hiệu lực | Bắt buộc |
| `effective_to` | Ngày kết thúc hiệu lực | Để trống = **đang áp dụng**; có giá trị = đã hết hiệu lực |
| `version` | Số thứ tự phiên bản của cùng một phạm vi | Tăng dần theo thời gian |
| `note` | Lý do thay đổi | **Bắt buộc** — ghi vào nhật ký kiểm tra |
| `reverted_from_id` | Phiên bản gốc nếu đây là một lần rollback | Để trống nếu không phải rollback |
| `created_by` / `created_at` | Người tạo · thời điểm tạo | — |

**Quy tắc bất biến:**
- Mỗi `(rule_key, scope_type, scope_ref_id)` có **nhiều phiên bản**, nối tiếp theo `effective_from`.
- **Chỉ một phiên bản "đang áp dụng"** tại một thời điểm cho mỗi scope.
- Lưu phiên bản mới → phiên bản cũ được đóng (`effective_to = effective_from_mới`).
- **Rollback = tạo phiên bản mới** với giá trị cũ (không xóa lịch sử) → có thể rollback nhiều lần.
- Phiên bản đã hết hiệu lực **vẫn dùng để tính lại lịch sử** (ví dụ: bảng công tháng 5 dùng quy định có hiệu lực tháng 5).

**Nguyên tắc chọn quy định đang áp dụng:** phạm vi **cụ thể hơn** (phòng ban, chức danh, ca) được ưu tiên trước phạm vi **toàn công ty** → cho phép HR ghi đè cho một phòng mà không ảnh hưởng công ty.

> Ưu tiên scope **cụ thể hơn** (phòng ban) trước scope **global** → cho phép HR ghi đè cho một phòng mà không ảnh hưởng công ty.

---

## 3. Catalog — nguồn sự thật duy nhất

Catalog là **danh sách 19 quy định** mà toàn bộ hệ thống đọc. Mỗi quy định mô tả:

| Thuộc tính | Ý nghĩa |
|---|---|
| `key` | Mã định danh của quy định — dùng để tra cứu, ghi đè theo phạm vi và ánh xạ tới nơi sử dụng |
| `domain` | Nhóm nghiệp vụ: `timesheet` (chấm công) · `leave` (nghỉ phép) · `okr` (đánh giá OKR) · `system` (hệ thống) |
| `category` | Danh mục nhỏ dùng để gom nhóm trên màn hình cấu hình của HR |
| `name` | Tên quy định hiển thị cho HR và nhân viên |
| `description` | Mô tả ngắn bằng ngôn ngữ nghiệp vụ, hiện ngay dưới tiêu đề trong form cấu hình |
| `fields` | Danh sách trường cấu hình — **form được sinh ra từ danh sách này** |
| `default_value` | Bộ giá trị mặc định khi quy định chưa có phiên bản nào áp dụng |
| `allowed_scopes` | Các phạm vi mà quy định này được phép áp dụng (toàn công ty / phòng ban / chức danh / nhóm / ca) |
| `policy_template` | Câu thông báo hiển thị cho nhân viên trên trang tra cứu, có điền giá trị đang áp dụng |
| `impact_analyzer` | Bộ phân tích ảnh hưởng dùng cho **dry-run** — nếu có, HR xem được số liệu cụ thể trước khi lưu |

Mỗi trường cấu hình (`fields`) mô tả:

| Thuộc tính | Ý nghĩa |
|---|---|
| `key` | Mã định danh của trường — dùng để lưu giá trị và ghi đè theo phạm vi |
| `label` | Nhãn hiển thị trên form cho HR |
| `type` | Kiểu dữ liệu: số nguyên · số thập phân · công tắc · giờ · ngày-trong-tháng · ngày · lựa chọn · lựa chọn nhiều · chữ · ngưỡng xếp loại |
| `unit` | Đơn vị hiển thị sau ô nhập (vd "lần/tháng", "phút", "mét") |
| `min` / `max` | Giá trị nhỏ nhất / lớn nhất được phép nhập |
| `options` | Danh sách lựa chọn cố định (mỗi lựa chọn có một mã và một nhãn hiển thị) |
| `options_source` | Nguồn lựa chọn động — danh sách phòng ban / chức danh / loại nghỉ lấy từ hệ thống |
| `help` | Gợi ý nghiệp vụ hiển thị dưới ô nhập |
| `default` | Giá trị mặc định của riêng trường này |
| `visible_when` | Điều kiện hiển thị: trường chỉ xuất hiện khi một trường khác đang có giá trị chỉ định |

**Quy tắc bất biến của catalog:** giao diện **không hard-code** form nào. Form được sinh ra từ danh sách trường của catalog. Thêm một quy định mới = thêm 1 mục vào catalog, không sửa giao diện.

### 3.1. Danh sách quy định (19 rule)

Catalog gồm **19 quy định**, chia theo 4 nhóm nghiệp vụ: **Đơn từ** (4), **Chấm công & bảng công** (6), **Nghỉ phép** (7), **OKR** (1), cộng **Thông báo** (1).

#### Nhóm "Đơn từ"

##### 3.1.1 · Đi muộn / về sớm — `late_early`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Đơn từ |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty · Phòng ban · Chức danh |
| Mô tả (`description`) | Số lần được tạo đơn mỗi tháng, thời lượng tối đa mỗi lần và thời điểm phải gửi. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `max_count` | Số lần tối đa | Số nguyên | 2 lần/tháng | 0 – 31 | Số đơn đi muộn/về sớm một nhân viên được tạo trong một tháng. Vượt số này thì **không cho tạo đơn**. |
| `max_minutes` | Thời lượng tối đa mỗi lần | Số nguyên | 60 phút | 1 – 480 | Một đơn không được cover quá số phút này. |
| `submit_before` | Đơn phải gửi trước | Giờ | 08:00 | — | Đơn gửi sau thời điểm này sẽ bị từ chối. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `max_count` = 2 · `max_minutes` = 60 · `submit_before` = 08:00 |
| Câu thông báo (`policy_template`) | "Bạn được tạo đơn đi muộn/về sớm **{max_count} lần mỗi tháng**, mỗi lần tối đa **{max_minutes} phút**. Đơn phải gửi trước **{submit_before}**." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `quota` — dry-run đếm được số đơn đang chờ bị ảnh hưởng và số người bị ảnh hưởng |

##### 3.1.2 · Bổ sung chấm công — `makeup`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Đơn từ |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty · Phòng ban |
| Mô tả (`description`) | Dùng khi quên chấm công hoặc gặp sự cố. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `max_count` | Số lần tối đa | Số nguyên | 5 lần/tháng | 0 – 31 | Số đơn bổ sung chấm công được tạo trong một tháng. |
| `deadline_working_days` | Hạn nộp | Số nguyên | 3 ngày làm việc kể từ ngày quên chấm | 0 – 30 | Tính theo **ngày làm việc** — trừ cuối tuần, ngày lễ và ngày nghỉ phép. |
| `reason_required` | Bắt buộc ghi lý do | Công tắc | Bật | — | Không có lý do thì không gửi được đơn. |
| `allow_overdue_with_approval` | Cho phép nộp quá hạn nếu HR duyệt | Công tắc | Bật | — | Tắt nếu công ty muốn chặt tuyệt đối — đơn quá hạn sẽ không tạo được. |
| `overdue_requires_reason` | Đơn quá hạn bắt buộc có lý do chi tiết | Công tắc | Bật | — | Đơn quá hạn phải giải thích rõ lý do vì sao muộn. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `max_count` = 5 · `deadline_working_days` = 3 · `reason_required` = Bật · `allow_overdue_with_approval` = Bật · `overdue_requires_reason` = Bật |
| Câu thông báo (`policy_template`) | "Đơn bổ sung chấm công tối đa **{max_count} lần mỗi tháng** và phải được gửi trong vòng **{deadline_working_days} ngày làm việc** kể từ ngày bạn quên chấm công." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `quota` |

##### 3.1.3 · Làm việc từ xa (WFH) — `wfh`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Đơn từ |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty · Phòng ban · Chức danh |
| Mô tả (`description`) | Quota WFH, thời hạn đăng ký và yêu cầu báo cáo công việc. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `max_count` | Số ngày WFH tối đa | Số nguyên | 2 lần/tuần | 0 – 7 | Số ngày làm việc từ xa được phép trong một tuần. |
| `min_lead_working_days` | Đăng ký trước tối thiểu | Số nguyên | 1 ngày làm việc | 0 – 14 | Số ngày làm việc phải báo trước khi ngày WFH diễn ra. |
| `allow_late_request` | Cho phép đơn gấp | Công tắc | Bật | — | Đơn gấp vẫn tạo được nhưng bị đánh dấu để quản lý thấy. |
| `report_required` | Bắt buộc gửi báo cáo công việc | Công tắc | Bật | — | Ngày WFH phải kèm báo cáo công việc. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `max_count` = 2 · `min_lead_working_days` = 1 · `allow_late_request` = Bật · `report_required` = Bật |
| Câu thông báo (`policy_template`) | "Bạn được đăng ký WFH **{max_count} ngày mỗi tuần**. Đăng ký trước ít nhất **{min_lead_working_days} ngày làm việc**." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `quota` |

##### 3.1.4 · Nhóm cần HR duyệt thêm — `hr_approval`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Đơn từ |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty · Nhóm |
| Mô tả (`description`) | Những nhóm mà mọi đơn nghỉ đều phải qua thêm bước HR duyệt sau khi trưởng nhóm/quản lý duyệt. Theo quyết định của HR: CA + Mobile. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `teams` | Nhóm áp dụng | Lựa chọn nhiều | CA, Mobile | Danh sách nhóm lấy từ hệ thống | Đơn của nhân viên thuộc các nhóm này sẽ chuyển thêm bước HR duyệt. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `teams` = CA, Mobile |
| Câu thông báo (`policy_template`) | "Đơn nghỉ phép của nhân viên thuộc **{teams}** sẽ được quản lý duyệt trước, sau đó chuyển thêm 1 bước để HR duyệt." |
| Phân tích ảnh hưởng (`impact_analyzer`) | Không có — dry-run chỉ trả thông báo chung số người bị ảnh hưởng. |

> **Lưu ý về phạm vi của quy định này:** ngưỡng *"nghỉ từ N ngày trở lên cần HR duyệt"* **KHÔNG** nằm ở đây — nó là **tham số của từng loại nghỉ** (`requires_hr_approval` + `min_days_for_hr_approval` trong `leave_type_defaults`). Nhờ vậy mỗi loại nghỉ tự quyết định, thay vì 1 quy định chung áp đè lên tất cả.
>
> **Vì sao:** *"Nghỉ tang gia"* có thể cần 2 bước duyệt, còn *"Nghỉ phép năm"* thì không — nếu gộp vào 1 quy định thì không diễn tả được.

#### Nhóm "Chấm công & bảng công"

##### 3.1.5 · Luồng duyệt đơn — `approval_flow`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Phê duyệt |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty · Nhóm · Phòng ban · Chức danh |
| Mô tả (`description`) | Ai duyệt, ai được xem để phối hợp, và mỗi bước chờ bao lâu. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `steps` | Các bước duyệt | Chữ | `[]` | Danh sách bước; mỗi bước gồm loại người duyệt, người duyệt cụ thể, số giờ chờ tối đa và phạm vi người được xem | Thứ tự các bước duyệt của một đơn. |
| `default_viewer_teams` | Nhóm mặc định được xem | Lựa chọn nhiều | Không chọn nhóm nào | Danh sách nhóm lấy từ hệ thống | Để trống = chỉ người gửi + người duyệt thấy. Bật để đồng nghiệp cùng nhóm thấy đơn mà KHÔNG duyệt được. |
| `viewer_see_reason` | Người xem thấy lý do từ chối | Công tắc | Bật | — | Người được xem đơn có đọc được lý do từ chối không. |
| `viewer_see_attachments` | Người xem thấy file đính kèm | Công tắc | Tắt | — | Mặc định KHÔNG — đơn nghỉ ốm có giấy khám là dữ liệu nhạy cảm. |
| `team_lead_step_enabled` | Cho phép bước duyệt bởi trưởng nhóm | Công tắc | Bật | — | Áp dụng cho các nhóm cần duyệt qua trưởng nhóm thay vì quản lý trực tiếp. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `steps` = rỗng · `default_viewer_teams` = rỗng · `viewer_see_reason` = Bật · `viewer_see_attachments` = Tắt · `team_lead_step_enabled` = Bật |
| Câu thông báo (`policy_template`) | "Đơn của bạn sẽ được **{approver_label}** xét duyệt. Bạn nhận được thông báo khi có kết quả." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `approval` |

##### 3.1.6 · Kiểm tra khi chấm công — `attendance_security`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Chấm công |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Các lớp kiểm tra để chống chấm công hộ. Không đạt lớp nào thì CHẶN — không có cảnh báo suông. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `require_internal_network` | Bắt buộc trong mạng nội bộ công ty | Công tắc | Bật | — | Ngoài mạng công ty → chặn. Ngoại lệ duy nhất: ngày WFH đã duyệt. |
| `require_geofence` | Bắt buộc trong bán kính văn phòng | Công tắc | Bật | — | Ngoài bán kính → chặn. Ngoại lệ duy nhất: ngày WFH đã duyệt. |
| `geofence_radius_m` | Bán kính cho phép | Số nguyên | 150 mét | 50 – 5000 · chỉ hiện khi `require_geofence` = Bật | Mặc định 150m — GPS trong tòa nhà lệch 20–50m nên nhỏ hơn sẽ chặn nhầm. |
| `gps_accuracy_tolerance_m` | Sai số GPS tối đa để xác nhận | Số nguyên | 100 mét | 20 – 500 · chỉ hiện khi `require_geofence` = Bật | Sai số GPS kém hơn ngưỡng này → không xác định được vị trí → chặn kèm hướng dẫn. |
| `allow_offline_punch` | Cho phép chấm công khi mất mạng | Công tắc | Bật | — | Cho phép nhân viên check-in khi rớt mạng. |
| `offline_max_hours` | Hạn đồng bộ offline tối đa | Số nguyên | 24 giờ | 1 – 72 · chỉ hiện khi `allow_offline_punch` = Bật | Quá hạn → entry bị từ chối khi đồng bộ, nhân viên phải tạo đơn bổ sung công. |
| `max_devices` | Số thiết bị được đăng ký | Số nguyên | 1 thiết bị | 1 – 5 | Đặt 1 để chặn dùng chung tài khoản — thiết bị thứ 2 phải được HR duyệt. |
| `grace_minutes` | Số phút đến muộn được miễn | Số nguyên | 0 phút | 0 – 60 | Số phút đến muộn vẫn không bị tính là đi muộn. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `require_internal_network` = Bật · `require_geofence` = Bật · `geofence_radius_m` = 150 · `gps_accuracy_tolerance_m` = 100 · `allow_offline_punch` = Bật · `offline_max_hours` = 24 · `max_devices` = 1 · `grace_minutes` = 0 |
| Câu thông báo (`policy_template`) | "Chấm công chỉ hợp lệ trên **thiết bị đã đăng ký**, trong **mạng nội bộ công ty**, trong bán kính **{geofence_radius_m}m** quanh văn phòng. Mất mạng thì vẫn chấm được, nhưng phải đồng bộ trong **{offline_max_hours} giờ**. Bạn được đăng ký tối đa **{max_devices} thiết bị**. Ngoại lệ duy nhất: ngày WFH đã được duyệt." |
| Phân tích ảnh hưởng (`impact_analyzer`) | Không có — dry-run chỉ trả thông báo chung số người bị ảnh hưởng. |

##### 3.1.7 · Chống dùng chung tài khoản — `share_account`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Chấm công |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Chặn và phát hiện việc nhiều người dùng chung một tài khoản để chấm công hộ. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `max_checkin_per_day` | Số lần check-in tối đa mỗi ngày | Số nguyên | 1 lần | 1 – 4 | Đặt 1 để chặn kiểu "chia ca": 2 người dùng chung 1 tài khoản chỉ công được 1 người 1 ngày. |
| `require_sso` | Bắt buộc đăng nhập bằng tài khoản công ty (SSO) | Công tắc | Bật | — | Tài khoản Google cá nhân của mỗi người là lớp phòng ngừa mạnh nhất. |
| `require_2fa` | Bắt buộc xác thực 2 bước | Công tắc | Tắt | — | Yêu cầu thêm một lớp xác thực ngoài mật khẩu. |
| `device_confirm_required` | Thêm thiết bị mới phải được HR duyệt | Công tắc | Bật | — | Nhân viên không tự đăng ký được thiết bị mới. |
| `alert_on_new_device` | Cảnh báo khi đăng nhập từ thiết bị mới | Công tắc | Bật | — | Gửi cảnh báo cho cả người dùng lẫn quản lý khi có đăng nhập lạ. |
| `max_additional_devices` | Số máy thêm được duyệt | Số nguyên | 1 máy | 0 – 5 | Mặc định mỗi tài khoản 1 máy. HR có thể duyệt thêm N máy cho trường hợp cần thiết — mỗi lần duyệt là 1 yêu cầu thêm thiết bị, có lý do. |
| `device_request_need_reason` | Bắt buộc có lý do khi yêu cầu thêm thiết bị | Công tắc | Bật | — | Yêu cầu thêm thiết bị phải nêu lý do. |
| `device_grant_days` | Số ngày tối đa được dùng máy thêm | Số nguyên | 0 ngày | 0 – 365 | 0 = không đặt hạn. Nếu đặt, HR chọn ngày hết hạn khi duyệt và hệ thống tự thu hồi. |
| `device_request_from_office_only` | Chỉ nhận yêu cầu đăng ký thiết bị từ mạng nội bộ công ty | Công tắc | Bật | — | Thiết bị lạ ở ngoài văn phòng mà vẫn được duyệt là lỗ hổng gian lận. |
| `device_expiry_days` | Số ngày không dùng thì tự thu hồi thiết bị | Số nguyên | 90 ngày | 0 – 365 | 0 = không tự thu hồi. Giúp tránh tích tụ thiết bị bị bỏ quên. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `max_checkin_per_day` = 1 · `require_sso` = Bật · `require_2fa` = Tắt · `device_confirm_required` = Bật · `alert_on_new_device` = Bật · `device_request_from_office_only` = Bật · `device_expiry_days` = 90 |
| Câu thông báo (`policy_template`) | "Mỗi tài khoản chỉ được chấm công **1 lần vào và 1 lần ra mỗi ngày** trên **thiết bị đã đăng ký**. Bạn đăng ký **1 thiết bị**; muốn thêm thiết bị thì gửi yêu cầu để HR duyệt." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `share_account` |

##### 3.1.8 · Giờ làm việc — `shift_times`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Chấm công |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty · Ca · Phòng ban · Chức danh |
| Mô tả (`description`) | Giờ check-in, check-out, giờ nghỉ trưa và số giờ phải làm đủ. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `check_in_start` | Giờ check-in từ | Giờ | 08:00 | — | Bắt đầu của khung giờ check-in được chấp nhận. |
| `check_in_end` | Giờ check-in đến | Giờ | 09:30 | — | Sau giờ này vào muộn — cần đơn nếu muốn không bị trừ công. |
| `check_out_start` | Giờ check-out từ | Giờ | 17:00 | — | Trước giờ này về sớm — cần đơn nếu muốn không bị trừ công. |
| `check_out_end` | Giờ check-out đến | Giờ | 18:30 | — | Sau giờ này vẫn được tính đủ ngày công. |
| `lunch_start` | Giờ nghỉ trưa từ | Giờ | 12:00 | — | Bắt đầu khoảng nghỉ trưa không tính vào giờ làm. |
| `lunch_end` | Giờ nghỉ trưa đến | Giờ | 13:00 | — | Kết thúc khoảng nghỉ trưa — khoảng này KHÔNG tính vào giờ làm. |
| `standard_hours_full` | Giờ làm đủ 1 ngày | Số thập phân | 8 giờ | 1 – 24 | Số giờ làm đủ để tính một ngày công. |
| `standard_hours_half` | Giờ làm đủ nửa ngày | Số thập phân | 4 giờ | 0.5 – 12 | Số giờ làm đủ để tính nửa ngày công. |
| `probation_with_child_hours` | Giờ làm cho thử việc có con < 1 tháng | Số thập phân | 7 giờ | 1 – 24 | Áp dụng cho nhân viên thử việc có con nhỏ dưới 1 tháng. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `check_in_start` = 08:00 · `check_in_end` = 09:30 · `check_out_start` = 17:00 · `check_out_end` = 18:30 · `lunch_start` = 12:00 · `lunch_end` = 13:00 · `standard_hours_full` = 8 · `standard_hours_half` = 4 · `probation_with_child_hours` = 7 |
| Câu thông báo (`policy_template`) | "Giờ làm việc của bạn: check-in từ **{check_in_start}** đến **{check_in_end}**, check-out từ **{check_out_start}** đến **{check_out_end}**. Nghỉ trưa **{lunch_start}–{lunch_end}** không tính vào giờ làm. Bạn cần làm đủ **{standard_hours_full} giờ/ngày** (hoặc **{standard_hours_half} giờ/nửa ngày**)." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `shift_times` |

##### 3.1.9 · Ca & bộ gán ca — `shift`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Chấm công |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty · Ca · Phòng ban · Chức danh |
| Mô tả (`description`) | Ca cố định và các ca ngoại lệ theo nhóm. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `default_shift_start` | Giờ vào của ca mặc định | Giờ | 08:00 | — | Giờ vào áp dụng cho ca mặc định. |
| `default_shift_end` | Giờ ra của ca mặc định | Giờ | 17:00 | — | Giờ ra áp dụng cho ca mặc định. |
| `allow_exception_shift` | Cho phép ca ngoại lệ theo nhóm | Công tắc | Bật | — | Cho phép gán ca khác cho một số nhóm. VD: 7h30–16h30 · 7h00–16h00 · 10h00–19h00 — fix cho một số đối tượng. |
| `exception_shift_approval` | Ca ngoại lệ cần HR duyệt | Công tắc | Bật | — | Ca ngoại lệ chỉ có hiệu lực sau khi HR duyệt. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `default_shift_start` = 08:00 · `default_shift_end` = 17:00 · `allow_exception_shift` = Bật · `exception_shift_approval` = Bật |
| Câu thông báo (`policy_template`) | "Ca làm việc của bạn: **{default_shift_start}–{default_shift_end}**. Nhóm của bạn có thể được gán ca ngoại lệ — xem tại mục *Ca & lịch nghỉ lễ*." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `shift_times` |

##### 3.1.10 · Đi muộn không có đơn — `late_without_request`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Chấm công |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Cách tính khi nhân viên đi muộn mà không tạo đơn. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `deduct_actual_minutes` | Trừ đúng số phút thực tế | Công tắc | Bật | — | Đi muộn không có đơn thì trừ công theo đúng số phút thực tế. |
| `rounding` | Cách làm tròn | Lựa chọn | Không làm tròn | Không làm tròn · Block 15 phút · Block 30 phút · Ghi vi phạm, không trừ công | Cách quy đổi số phút đi muộn thành khoản trừ công. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `deduct_actual_minutes` = Bật · `rounding` = Không làm tròn |
| Câu thông báo (`policy_template`) | "Nếu bạn đi muộn mà không tạo đơn, số phút đi muộn thực tế sẽ **được trừ trực tiếp** khỏi công của bạn." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `late_no_request` |

##### 3.1.11 · Kỳ công & khiếu nại — `payroll_period`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `timesheet` |
| Danh mục (`category`) | Bảng công |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Chu kỳ tính bảng công và hạn khiếu nại. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `period_start_day` | Kỳ công bắt đầu ngày | Số nguyên | 1 ngày trong tháng | 1 – 28 | Ngày bắt đầu kỳ tính công của tháng. |
| `period_end_mode` | Kỳ công kết thúc | Lựa chọn | Ngày cuối tháng | Ngày cuối tháng · Ngày cố định | Chọn cách tính ngày kết thúc kỳ công. |
| `period_end_day` | Ngày kết thúc | Số nguyên | 25 ngày | 1 – 28 · chỉ hiện khi `period_end_mode` = Ngày cố định | Ngày kết thúc kỳ công khi chọn chế độ ngày cố định. |
| `publish_day` | Ngày công bố bảng công tạm tính | Số nguyên | 11 ngày trong tháng | 1 – 28 | Trong kỳ đang chạy, HR công bố bảng công tạm tính vào ngày này để nhân viên kiểm tra và khiếu nại sớm, thay vì chờ cuối tháng. |
| `dispute_window_days` | Hạn khiếu nại (ngày) | Số nguyên | 2 ngày | 1 – 15 | Số ngày nhân viên khiếu nại được sau khi bảng công được công bố; cũng là số ngày HR có để xử lý mỗi khiếu nại. |
| `lock_delay_days` | Chốt & khóa sau khi kết thúc kỳ | Số nguyên | 3 ngày | 1 – 15 | Số ngày sau ngày cuối kỳ để HR chốt & khóa bảng công. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `period_start_day` = 1 · `period_end_mode` = Ngày cuối tháng · `period_end_day` = 25 · `publish_day` = 11 · `dispute_window_days` = 2 · `lock_delay_days` = 3 |
| Câu thông báo (`policy_template`) | "Bảng công của bạn được tính từ ngày **{period_start_day}** đầu tháng đến cuối tháng. HR công bố bảng công để bạn kiểm tra vào ngày **{publish_day}** hàng tháng, và bạn có **{dispute_window_days} ngày** để khiếu nại nếu thấy sai." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `payroll` |

#### Nhóm "Nghỉ phép"

##### 3.1.12 · Mặc định chung cho mọi loại nghỉ — `leave_type_defaults`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `leave` |
| Danh mục (`category`) | Nghỉ phép |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty · Phòng ban |
| Mô tả (`description`) | Tầng 1 trong 3 tầng. Mỗi loại nghỉ ghi đè được phần này theo tham số riêng. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `min_lead_days` | Phải báo trước ít nhất | Số nguyên | 1 ngày làm việc | 0 – 30 | 0 = được báo gấp. Loại nghỉ riêng có thể ghi đè (VD: nghỉ tang gia = 0). |
| `requires_manager_approval` | Cần quản lý duyệt | Công tắc | Bật | — | Đơn phải qua bước duyệt của quản lý trực tiếp. |
| `requires_hr_approval` | Cần thêm bước HR duyệt | Công tắc | Tắt | — | Đơn ngoài bước quản lý còn phải qua thêm một bước HR duyệt. |
| `min_days_for_hr_approval` | Nghỉ từ N ngày trở lên → thêm bước HR duyệt | Số nguyên | 3 ngày | 0 – 60 | Ngưỡng số ngày nghỉ tính từ đó sẽ kích hoạt bước duyệt HR. |
| `require_document_days` | Cần giấy tờ từ ngày thứ | Số nguyên | 0 ngày | 0 – 30 | 0 = không cần giấy tờ. Từng loại ghi đè được (VD: nghỉ ốm = 2). |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `min_lead_days` = 1 · `requires_manager_approval` = Bật · `requires_hr_approval` = Tắt · `min_days_for_hr_approval` = 3 · `require_document_days` = 0 |
| Câu thông báo (`policy_template`) | "Đơn nghỉ phép phải được gửi trước ít nhất **{min_lead_days} ngày làm việc**. Nghỉ từ **{min_days_for_hr_approval} ngày** trở lên sẽ được quản lý duyệt rồi chuyển HR duyệt thêm." |
| Phân tích ảnh hưởng (`impact_analyzer`) | Không có — dry-run chỉ trả thông báo chung số người bị ảnh hưởng. |

##### 3.1.13 · Chính sách nhắc việc — `notification`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `system` |
| Danh mục (`category`) | Thông báo |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Khi nào nhắc, nhắc ai, và nhắc bao nhiêu lần để không spam. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `max_push_per_day` | Số push tối đa/ngày (nhân viên) | Số nguyên | 3 lần | 1 – 10 | Giới hạn số thông báo đẩy một nhân viên nhận trong một ngày. |
| `max_push_per_day_manager` | Số push tối đa/ngày (quản lý) | Số nguyên | 5 lần | 1 – 20 | Quản lý nhận nhiều việc hơn nên được phép nhiều thông báo hơn. |
| `digest_email_at` | Giờ gửi email digest | Giờ | 08:00 | — | Giờ gom các việc còn lại vào một email tổng hợp. |
| `quiet_hours_start` | Bắt đầu giờ yên tĩnh | Giờ | 21:00 | — | Từ giờ này không gửi thông báo đẩy. |
| `quiet_hours_end` | Kết thúc giờ yên tĩnh | Giờ | 07:00 | — | Từ giờ này trở lại bắt đầu gửi thông báo đẩy. |
| `dedupe_window_hours` | Cùng 1 việc chỉ nhắc 1 lần trong | Số nguyên | 12 giờ | 1 – 72 | Khoảng thời gian mà cùng một việc chỉ được nhắc một lần. |
| `escalate_after_days` | Quá số ngày thì báo thêm cho quản lý | Số nguyên | 3 ngày | 1 – 14 | Việc chưa xong quá số ngày này thì báo thêm cho quản lý. |
| `remind_before_due_days` | Nhắc trước hạn (ngày) | Lựa chọn nhiều | 3 ngày, 1 ngày | Danh sách số ngày | Nhắc trước hạn bao nhiêu ngày. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `max_push_per_day` = 3 · `max_push_per_day_manager` = 5 · `digest_email_at` = 08:00 · `quiet_hours_start` = 21:00 · `quiet_hours_end` = 07:00 · `dedupe_window_hours` = 12 · `escalate_after_days` = 3 · `remind_before_due_days` = 3, 1 |
| Câu thông báo (`policy_template`) | "Bạn sẽ nhận thông báo đẩy khi có việc cần làm, tối đa **{max_push_per_day} lần/ngày**, không nhắc trong khung giờ nghỉ. Mọi việc còn lại được gom vào email lúc **{digest_email_at}**." |
| Phân tích ảnh hưởng (`impact_analyzer`) | Không có — dry-run chỉ trả thông báo chung số người bị ảnh hưởng. |

##### 3.1.14 · Thời hạn & điều kiện xin nghỉ — `leave_request`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `leave` |
| Danh mục (`category`) | Nghỉ phép |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty · Phòng ban |
| Mô tả (`description`) | Khi nào phải gửi đơn, có cần duyệt không, và giới hạn số ngày. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `min_lead_days` | Phải gửi trước ít nhất | Số nguyên | 1 ngày làm việc | 0 – 30 | 0 = được gửi cùng ngày. Nếu không đủ thời gian, đơn được gắn cờ "gấp" nhưng vẫn tạo được. |
| `mark_late_request` | Đơn gửi muộn được đánh dấu | Công tắc | Bật | — | Đơn không đủ thời gian báo trước sẽ bị gắn cờ để quản lý thấy. |
| `require_document_days` | Loại nghỉ cần giấy tờ từ ngày thứ | Số nguyên | 2 ngày | 0 – 30 | 0 = không cần giấy tờ. VD: nghỉ ốm từ ngày thứ 3 trở đi cần giấy y tế. |
| `max_consecutive_days` | Số ngày nghỉ liên tiếp tối đa | Số nguyên | 0 ngày | 0 – 60 | 0 = không giới hạn. Vượt thì cần kèm lý do và quản lý duyệt. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `min_lead_days` = 1 · `mark_late_request` = Bật · `require_document_days` = 2 · `max_consecutive_days` = 0 |
| Câu thông báo (`policy_template`) | "Đơn nghỉ phép phải được gửi trước ít nhất **{min_lead_days} ngày làm việc**. Loại nghỉ cần giấy tờ từ ngày thứ **{require_document_days}** trở đi." |
| Phân tích ảnh hưởng (`impact_analyzer`) | Không có — dry-run chỉ trả thông báo chung số người bị ảnh hưởng. |

##### 3.1.15 · Cách cộng phép — `leave_accrual`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `leave` |
| Danh mục (`category`) | Nghỉ phép |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Cộng phép theo tháng hay đầu năm, và số ngày phép năm. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `mode` | Chế độ cộng phép | Lựa chọn | Cộng hàng tháng | Cộng hàng tháng · Cộng đầu năm | Chọn cách phân bổ phép năm. |
| `monthly_day` | Ngày cộng phép hàng tháng | Số nguyên | 15 ngày | 1 – 28 · chỉ hiện khi `mode` = Cộng hàng tháng | Ngày trong tháng mà phép được cộng thêm. |
| `yearly_days` | Số ngày phép năm | Số thập phân | 12 ngày | 0 – 60 · chỉ hiện khi `mode` = Cộng đầu năm | Tổng số phép năm được cộng một lần vào đầu năm. |
| `join_cutoff_day` | Ngày chốt để được cộng phép trong tháng | Số nguyên | 15 ngày | 1 – 28 · chỉ hiện khi `mode` = Cộng hàng tháng | Chỉ người ĐÃ vào làm từ ngày này trở về trước mới được cộng 1 ngày phép trong tháng đó. VD vào 20/11 → tháng 11 không cộng, ngày 15/12 mới cộng. |
| `allow_half_day` | Cho phép nghỉ nửa ngày | Công tắc | Bật | — | Cho phép xin nghỉ nửa ngày. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `mode` = Cộng hàng tháng · `monthly_day` = 15 · `join_cutoff_day` = 15 · `yearly_days` = 12 · `allow_half_day` = Bật |
| Câu thông báo (`policy_template`) | "Phép năm của bạn được cộng **1 ngày vào ngày 15 hàng tháng** (tổng 12 ngày/năm). Chỉ người đã vào làm **từ ngày 15 trở về trước** mới được cộng trong tháng đó — nếu bạn vào làm sau ngày 15 thì tháng đó không cộng, kỳ cộng đầu tiên là ngày 15 của tháng sau." |
| Phân tích ảnh hưởng (`impact_analyzer`) | Không có — dry-run chỉ trả thông báo chung số người bị ảnh hưởng. |

##### 3.1.16 · Phép thâm niên — `leave_seniority`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `leave` |
| Danh mục (`category`) | Nghỉ phép |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Cộng thêm phép theo thời gian làm việc. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `enabled` | Bật phép thâm niên | Công tắc | Bật | — | Tắt nếu công ty không cộng phép theo thâm niên. |
| `every_years` | Cộng mỗi | Số nguyên | 2 năm | 1 – 10 | Chu kỳ làm việc để được cộng thêm phép. |
| `days` | Số ngày cộng | Số thập phân | 1 ngày | 0 – 10 | Số phép được cộng thêm mỗi kỳ thâm niên. |
| `accrual_on` | Cộng vào ngày nào | Lựa chọn | `anniversary` — Đúng ngày tròn thâm niên | `anniversary` — Đúng ngày tròn thâm niên · `monthly_day` — Ngày cộng phép hàng tháng | Mặc định cộng ĐÚNG NGÀY TRÒN thâm niên (VD vào 01/03/2021 → cộng ngày 01/03/2023, 01/03/2025…) — công bằng cho người vào giữa năm. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `enabled` = Bật · `every_years` = 2 · `days` = 1 · `accrual_on` = `anniversary` — Đúng ngày tròn thâm niên |
| Câu thông báo (`policy_template`) | "Cứ mỗi **2 năm** làm việc, bạn được cộng thêm **1 ngày phép** — cộng vào **đúng ngày tròn thâm niên** của bạn." |
| Phân tích ảnh hưởng (`impact_analyzer`) | Không có — dry-run chỉ trả thông báo chung số người bị ảnh hưởng. |

##### 3.1.17 · Phép theo chức vụ — `leave_position_bonus`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `leave` |
| Danh mục (`category`) | Nghỉ phép |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Cộng thêm phép cho một số chức danh. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `enabled` | Bật phép theo chức vụ | Công tắc | Bật | — | Tắt nếu công ty không cộng phép theo chức danh. |
| `positions` | Chức danh được cộng | Lựa chọn nhiều | Manager | Danh sách chức danh lấy từ hệ thống | Những chức danh được hưởng phép cộng thêm. |
| `days` | Số ngày cộng | Số thập phân | 3 ngày | 0 – 10 | Số phép được cộng thêm cho chức danh đã chọn. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `enabled` = Bật · `positions` = Manager · `days` = 3 |
| Câu thông báo (`policy_template`) | "Người giữ chức danh **Manager** được cộng thêm **3 ngày phép** vào phép hàng năm." |
| Phân tích ảnh hưởng (`impact_analyzer`) | Không có — dry-run chỉ trả thông báo chung số người bị ảnh hưởng. |

##### 3.1.18 · Phép tồn — `leave_carryover`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `leave` |
| Danh mục (`category`) | Nghỉ phép |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Chuyển phép sang năm sau và thời điểm hết hạn. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `enabled` | Cho phép chuyển phép tồn | Công tắc | Bật | — | Tắt nếu công ty không cho chuyển phép sang năm sau. |
| `full_until` | Dùng được toàn bộ phép tồn đến | Ngày-trong-tháng | 01/04 | — | Trước mốc này, toàn bộ phép năm cũ vẫn dùng được. |
| `partial_until` | Chỉ còn số ngày giữ lại đến | Ngày-trong-tháng | 01/07 | — | Từ mốc này chỉ còn được giữ một phần nhỏ phép tồn. |
| `partial_days` | Số ngày phép tồn được giữ lại | Số thập phân | 5 ngày | 0 – 30 | Số ngày phép tồn còn được dùng sau khi hết thời gian dùng toàn bộ. |
| `expire_on` | Phép tồn hết hạn từ | Ngày-trong-tháng | 01/07 | — | Từ ngày này phép tồn của năm trước bị hết hạn hoàn toàn. |
| `manual_exempt` | Cho phép HR bảo lưu thủ công | Công tắc | Bật | — | Phần phép tồn được đánh dấu bảo lưu sẽ không bị reset. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `enabled` = Bật · `full_until` = 01/04 · `partial_until` = 01/07 · `partial_days` = 5 · `expire_on` = 01/07 · `manual_exempt` = Bật |
| Câu thông báo (`policy_template`) | "Phép năm chưa dùng của bạn được chuyển sang năm sau. Bạn dùng được **toàn bộ** phép tồn đến **01/04**, sau đó chỉ còn **5 ngày**, và từ **01/07** phép tồn của năm trước bằng 0." |
| Phân tích ảnh hưởng (`impact_analyzer`) | `carryover` |

#### Nhóm "OKR"

##### 3.1.19 · Cách đánh giá — `okr_evaluation`

| Thuộc tính | Nội dung |
|---|---|
| Nhóm nghiệp vụ (`domain`) | `okr` |
| Danh mục (`category`) | Đánh giá OKR |
| Phạm vi áp dụng (`allowed_scopes`) | Toàn công ty |
| Mô tả (`description`) | Thang điểm, xếp loại, tần suất cập nhật và phân tầng. |

| Trường | Nhãn hiển thị | Kiểu | Giá trị mặc định | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
| `scale_min` | Điểm thấp nhất | Số nguyên | 1 điểm | 1 – 5 | Thang 1–5 theo form đánh giá HR (`doc/OKR_doc.md`). |
| `scale_max` | Điểm cao nhất | Số nguyên | 5 điểm | 1 – 5 | Chấm 1–5 mỗi nhóm (Business/People), không có điểm lẻ. |
| `score_categories` | Số nhóm điểm | Số nguyên | 2 nhóm | Cố định bằng 2 | Business + People. Phần mềm tự tính điểm trung bình. |
| `checkin_interval` | Tần suất cập nhật tiến độ | Lựa chọn | Hàng tháng | Hàng tuần · Hàng tháng · Hàng quý | Nhân viên phải cập nhật tiến độ OKR bao nhiêu lần một kỳ. |
| `grade_thresholds` | Ngưỡng xếp loại | Ngưỡng xếp loại | A ≥ 4.5 · B ≥ 3.5 · C ≥ 2.5 | Các ngưỡng phải giảm dần | Áp trên điểm trung bình 1–5. |
| `alignment_enabled` | Bật phân tầng Công ty → Phòng ban → Cá nhân | Công tắc | Bật | — | Bật cơ chế liên kết mục tiêu từ cấp công ty xuống cấp cá nhân. |
| `weight_sum` | Tổng trọng số các KR | Số nguyên | 100% | 50 – 200 | Tổng trọng số của tất cả KR trong một mục tiêu. |

| Thuộc tính | Nội dung |
|---|---|
| Giá trị mặc định (`default_value`) | `scale_min` = 1 · `scale_max` = 5 · `score_categories` = 2 · `checkin_interval` = Hàng tháng · `grade_thresholds` = A ≥ 4.5, B ≥ 3.5, C ≥ 2.5 · `alignment_enabled` = Bật · `weight_sum` = 100 |
| Câu thông báo (`policy_template`) | "Bạn được cập nhật tiến độ **{checkin_interval}**. Điểm OKR được chấm trên thang **{scale_min} – {scale_max}** theo 2 nhóm Business và People — phần mềm tự tính điểm trung bình. Xếp loại A/B/C/D theo ngưỡng do công ty quy định." |
| Phân tích ảnh hưởng (`impact_analyzer`) | Không có — dry-run chỉ trả thông báo chung số người bị ảnh hưởng. |

### 3.2. Bảng đối chiếu với quyết định của HR (Mục 7)

Mọi giá trị mặc định trong catalog **khớp đúng** với cột "Quyết định của HR":

| Quyết định HR | Rule | Giá trị mặc định |
|---|---|---|
| Kỳ công 01 → cuối tháng | `payroll_period` | start 1, end last_day |
| Nhân viên khiếu nại trong **2 ngày** | `payroll_period` | `publish_day` = 11, `dispute_window_days` = 2, `lock_delay_days` = 3 |
| Vượt quota đi muộn → **không cho tạo đơn** | `late_early` + engine | `max_count` = 2, chặn server-side |
| Đi muộn không có đơn → **tính theo đúng giờ làm việc thực tế** | `late_without_request` | `deduct_actual_minutes` = True, `rounding` = exact |
| WFH: 2 lần/tuần | `wfh` | `max_count` = 2 |
| Bổ sung công: 5 lần/tháng | `makeup` | `max_count` = 5 |
| Rule áp dụng chung, không phân biệt phòng ban | tất cả `allowed_scopes` | `global` mặc định (vẫn override được) |
| Đơn cần HR duyệt thêm: CA + Mobile | `hr_approval` | `teams` = [CA, Mobile] |
| Phép hàng tháng +1 ngày 15 | `leave_accrual` | mode monthly, day 15 |
| Phép thâm niên +1/2 năm | `leave_seniority` | every 2 năm, +1 ngày |
| Phép chức vụ manager +3 | `leave_position_bonus` | positions [Manager], +3 ngày |
| Phép tồn 01/04 → 5 ngày → 01/07 = 0 | `leave_carryover` | 04-01 / 5 ngày / 07-01 |

### 3.2b. Đối chiếu với `doc/Rule chấm công.xlsx` (quy định chính thức của công ty)

> Sheet *"Rule về chấm công (cho team)"* — nguồn quy định **chính thức**, ưu tiên cao hơn Mục 7 của PDF.

| Quyết định trong file Excel | Rule | Giá trị mặc định |
|---|---|---|
| Check in **8h00 → 9h30** | `shift_times` | `check_in_start` 08:00, `check_in_end` 09:30 |
| Check out **17h00 → 18h30** | `shift_times` | `check_out_start` 17:00, `check_out_end` 18:30 |
| Nghỉ trưa **12:00 → 13:00** (không tính giờ làm) | `shift_times` | `lunch_start` 12:00, `lunch_end` 13:00 |
| Đủ **8 tiếng/ngày**, **4 tiếng/nửa ngày** | `shift_times` | `standard_hours_full` 8, `standard_hours_half` 4 |
| **TH con < 1 tháng** → 7 tiếng/ngày | `shift_times` | `probation_with_child_hours` 7 |
| Ca ngoại lệ 7h30–16h30 · 7h00–16h00 · 10h00–19h00 | `shift` | `allow_exception_shift` True, cần HR duyệt |
| Quên check in/out: tối đa **5 lần/tháng** | `makeup` | `max_count` 5 |
| Quên check in/out: hạn **03 ngày** kể từ ngày đăng ký | `makeup` | `deadline_days` 3 (ngày lịch) |
| Quên check in/out: **không tính công** | `makeup` | `no_punch_no_pay` True |
| Đi muộn/về sớm: **2 lần/tháng**, **≤ 60 phút/lần** | `late_early` | `max_count` 2, `max_minutes` 60 |
| Đơn phải bấm **SUBMIT** (Save = nháp, không tính quota) | engine | `Request.status = draft\|submitted` |
| Remote: **2 ngày/tuần**, chặn ngày thứ 3 | `wfh` | `max_count` 2, `block_third_day` True |
| Remote: đơn tối thiểu **0,5 ngày** | `wfh` | `min_days_per_request` 0.5 |
| Nghỉ phép / ốm / đi muộn: hạn **03 ngày** | `leave_request` + `late_early` | `submit_within_days` 3 (ngày lịch) |
| Nghỉ ốm: **bắt buộc attach giấy khám** | `leave_request` | `require_attachment` True |
| Luồng duyệt: team **CA** & **Mobile** → trưởng nhóm → HR | `approval_flow` | scope=team, cấu hình theo nhóm — **không hardcode tên** |
| Phép năm **12 ngày**, cộng ngày 15 hàng tháng | `leave_accrual` | mode monthly, day 15, 12 ngày/năm |
| Phép chức vụ Manager **+3** (tổng 15) | `leave_position_bonus` | positions [Manager], +3 |
| Phép thử việc **2 ngày**, cộng khi chính thức hoá | `leave_accrual` | `probation_days` 2, `on_confirmation` True |

---

### 3.3. Bảng ánh xạ rule → nơi sử dụng

> Mỗi rule phải có **ít nhất một nơi đọc nó**. Nếu một rule không được đọc ở đâu → hoặc rule thừa, hoặc thiếu chỗ dùng.

| Rule key | Đọc ở đâu | Ghi chú |
|---|---|---|
| `shift_times` | Punch service + engine tính công | **Giờ vào 8h00–9h30 · ra 17h00–18h30 · nghỉ trưa 12:00–13:00 · đủ 8h/ngày, 4h/nửa ngày** (nguồn: `doc/Rule chấm công.xlsx`) |
| `shift` | Punch service + trang cấu hình ca | Ca mặc định + **ca ngoại lệ theo nhóm** (7h30–16h30 · 7h00–16h00 · 10h00–19h00) |
| `late_early` | Quota engine khi tạo đơn đi muộn/về sớm | Số lần/tháng + số phút/lần + giờ phải gửi |
| `makeup` | Quota engine khi tạo đơn bổ sung công | Quota + hạn nộp theo ngày làm việc + cho phép nộp quá hạn |
| `wfh` | Quota engine khi đăng ký WFH | Quota/tuần (2 ngày) · chặn ngày thứ 3 · đơn tối thiểu 0,5 ngày · hạn đăng ký |
| `approval_flow` | Approval engine — cấu hình luồng duyệt theo nhóm | **Approver (bắt buộc)** + **viewer (tùy chọn — để phối hợp)** + SLA. Không hardcode tên trưởng nhóm |
| `hr_approval` | Approval engine khi tạo task bước 2 | Phòng ban nào mọi đơn đều qua HR (CA + Mobile) |
| `attendance_security` | Punch service khi check-in | Mạng nội bộ + geofence + số thiết bị + phút miễn trễ |
| `share_account` | Punch service + job phát hiện bất thường | 1 check-in/ngày + 1 thiết bị + SSO + chính sách thiết bị mới |
| `late_without_request` | Job tổng hợp bảng công | Trừ đúng phút thực tế (theo quyết định HR) |
| `payroll_period` | Job tổng hợp + màn hình bảng công | Kỳ công 01→cuối tháng · **công bố ngày 11** + hạn khiếu nại 2 ngày + khóa sau 3 ngày |
| `leave_type_defaults` | Form xin nghỉ phép (tầng 1) | Mặc định chung cho mọi loại nghỉ |
| `leave_request` | Form xin nghỉ phép (tầng 1, phần thời hạn) | Hạn gửi · đánh dấu gấp · giấy tờ · giới hạn ngày |
| `leave_accrual` | Job cộng phép hàng tháng | Cộng 1 ngày ngày 15 · cho phép nửa ngày · **phép thử việc 2 ngày cộng khi chính thức hoá** |
| `leave_seniority` | Job cộng phép đầu năm | +1 ngày mỗi 2 năm thâm niên, **đúng ngày tròn thâm niên** |
| `leave_position_bonus` | Job cộng phép đầu năm | +3 ngày cho chức danh Manager (tổng 15 ngày/năm) |
| `leave_carryover` | Job mốc 01/04 & 01/07 | Chuyển tồn · giữ 5 ngày · hết hạn = 0 |
| `notification` | Job `scan_and_notify` | Chống spam + giờ nhắc + số push/ngày |
| `okr_evaluation` | Engine chấm điểm + form review | **Thang 1–5 · 2 nhóm Business/People** · xếp loại · tần suất check-in · phân tầng |

**Nguồn quy định:** `shift_times`, `shift`, `wfh`, `hr_approval`, `leave_accrual`, `leave_seniority`,
`leave_position_bonus`, `leave_carryover` lấy trực tiếp từ **`doc/Rule chấm công.xlsx`** (sheet *"Rule về
chấm công (cho team)"* — quy định chính thức của công ty). `okr_evaluation` lấy từ **`doc/OKR_doc.md`**
(thang 1–5, 2 nhóm Business/People, điểm TB tự tính).

**Lưu ý về tầng kế thừa của nghỉ phép:** `leave_type_defaults` (tầng 1) → tham số của loại nghỉ (tầng 2) →
ghi đè của đơn (tầng 3). Ba rule `leave_*` ở trên đều cộng/trừ **số dư**; còn
`leave_type_defaults` + `leave_request` điều khiển **điều kiện tạo đơn**. Xem `docs/02-bai-toan-1-cham-cong.md` §2.3.

## 4. UI — Trang cấu hình quy định

### 4.1. Danh sách (màn hình chính)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Cấu hình quy định              [ Đang áp dụng ▾ ]  [ Lịch sử thay đổi ] │
│                                                                         │
│ ĐƠN TỪ                                          Áp dụng cho            │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Đi muộn / về sớm                              Toàn công ty           │ │
│ │ 2 lần/tháng · tối đa 60 phút · gửi trước 08:00                    │ │
│ │ Hiệu lực từ 01/10/2026 · phiên bản 2              [ Cấu hình ]      │ │
│ ├─────────────────────────────────────────────────────────────────────┤ │
│ │ Bổ sung chấm công                            Toàn công ty           │ │
│ │ 5 lần/tháng · hạn 3 ngày làm việc · bắt buộc lý do                │ │
│ │ Hiệu lực từ 01/10/2026 · phiên bản 1              [ Cấu hình ]      │ │
│ ├─────────────────────────────────────────────────────────────────────┤ │
│ │ Cần HR duyệt thêm                                                  │ │
│ │ Nghỉ từ 3 ngày · phòng ban: CA, Mobile                             │ │
│ │ ⚠ Đơn hôm nay đến hạn nộp                                        │ │
│ │                                                      [ Cấu hình ]      │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ CHẤM CÔNG & BẢNG CÔNG                                                  │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Kiểm tra khi chấm công          Toàn công ty                       │ │
│ │ Mạng nội bộ + GPS + 3 thiết bị + không miễn phút trễ               │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ...                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Tính năng của danh sách:**
- Nhóm theo `category`, mỗi rule hiển thị **giá trị hiện tại bằng ngôn ngữ tự nhiên** (không phải JSON).
- Dưới rule global, hiện các **scope override** dạng dòng con: `↳ Phòng ban Mobile — 3 lần/tháng — hiệu lực từ 01/11`.
- Badge **"Sẽ áp dụng từ 01/12/2026"** nếu có phiên bản tương lai (khi toggle "Sắp áp dụng").
- Toggle đầu trang: **Đang áp dụng / Sắp áp dụng / Đã hết hiệu lực / Tất cả**.

### 4.2. Panel cấu hình 1 rule

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Đi muộn / về sớm                                                      │
│ Số lần được tạo đơn mỗi tháng, thời lượng tối đa mỗi lần và           │
│ thời điểm phải gửi.                                                      │
│                                                                         │
│ ÁP DỤNG CHO                                                            │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [ Toàn công ty            ▾ ]  ← Toàn công ty / Phòng ban / Chức danh│ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ GIÁ TRỊ                                                                │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Số lần tối đa            [  2  ]  lần/tháng                         │ │
│ │ Thời lượng tối đa/lần    [ 60  ]  phút                              │ │
│ │ Đơn phải gửi trước        [ 08:00 ]                                 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ HIỆU LỰC TỪ                                                            │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [ 12/11/2026 ]  ⓘ Kể từ ngày mai. Đơn đã tạo trước đó không       │ │
│ │                   bị ảnh hưởng.                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ LÝ DO THAY ĐỔI                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [ Tăng quota vì đội Mobile cần hỗ trợ gấp trong mùa cao điểm  ]    │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠ 3 bảng công tháng 10/2026 đã khóa — sẽ không bị đụng tới.       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ [Xem trước ảnh hưởng]                              [ Hủy ]  [ Lưu ]   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Chi tiết form (render generic từ `fields`):**

| Kiểu field | Ô nhập trên UI | Ghi chú |
|---|---|---|
| Số nguyên / số thập phân | Ô nhập số | Có đơn vị hiển thị sau ô, chặn giá trị ngoài khoảng cho phép |
| Công tắc | Công tắc bật/tắt | Có mô tả rõ tác dụng |
| Giờ | Ô chọn giờ | |
| Ngày-trong-tháng | Ô chọn ngày | Hiển thị "01/04" dạng DD/MM |
| Lựa chọn | Danh sách 1 lựa chọn | |
| Lựa chọn nhiều | Danh sách nhiều lựa chọn | Lựa chọn động từ danh sách phòng ban / chức danh / loại nghỉ lấy từ hệ thống |
| Ngưỡng xếp loại | Bộ chỉnh ngưỡng | Editor nhỏ: A ≥ 0.9, B ≥ 0.7, C ≥ 0.5, bắt buộc giảm dần |
| Chữ | Ô nhập nhiều dòng | |

**Điều kiện hiển thị (`visible_when`):** field chỉ hiện khi field khác đúng giá trị (ví dụ "Ngày kết thúc" chỉ hiện khi chế độ = "Ngày cố định"). Form phải tự ẩn/hiện — không reload trang.

### 4.3. Dry-run (bắt buộc trước khi lưu)

Bấm **"Xem trước ảnh hưởng"** → gọi `POST /api/rules/dry-run` → modal:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Ảnh hưởng của thay đổi này                                             │
│                                                                         │
│ Quy định: Đi muộn / về sớm                                             │
│ Thay đổi:  Số lần tối đa  2 → 3 lần/tháng                              │
│ Hiệu lực từ: 12/11/2026                                                  │
│                                                                         │
│ ● 12 đơn đang chờ duyệt sẽ hợp lệ (trước đây bị chặn)                  │
│ ● 3 nhân viên đã dùng 3 lượt/tháng → được hoàn 15 phút công             │
│ ● 2 bảng công tháng 10/2026 đã khóa → KHÔNG bị đụng                      │
│ ● 45 nhân viên sẽ nhận thông báo về quy định mới                         │
│                                                                         │
│ [ Áp dụng từ 12/11/2026 ]                          [ Hủy ]             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Cơ chế phân tích ảnh hưởng** — mỗi quy định có thể gắn một bộ phân tích (`impact_analyzer`):

| Bộ phân tích | Quy định dùng | Số liệu dry-run trả về |
|---|---|---|
| `quota` | `late_early` · `makeup` · `wfh` | Số đơn đang chờ bị ảnh hưởng · số nhân viên vượt quota · ước tính số phút công được hoàn lại · số bảng công đã khóa không bị đụng · số người sẽ nhận thông báo |
| `payroll` | `payroll_period` | Số bảng công đã khóa không bị đụng · số bảng công tạm tính được công bố lại |
| `approval` | `approval_flow` | Số đơn đang chờ duyệt bị ảnh hưởng · số bước duyệt thay đổi |
| `shift_times` | `shift_times` · `shift` | Số bảng công đã khóa không bị đụng · số ngày công bị ảnh hưởng |
| `share_account` | `share_account` | Số người dùng đang đăng nhập trên nhiều thiết bị · số yêu cầu thêm thiết bị đang chờ |
| `carryover` | `leave_carryover` | Số người có phép tồn bị ảnh hưởng · tổng số ngày phép bị thay đổi |
| `late_no_request` | `late_without_request` | Số phiếu công bị trừ lại do đổi cách làm tròn |

Với các quy định không có bộ phân tích → trả về thông báo chung: *"N quy định sẽ áp dụng từ ... cho N nhân viên thuộc phạm vi."*

### 4.4. Lịch sử & rollback

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Lịch sử: Đi muộn / về sớm — Toàn công ty                                │
│                                                                         │
│ v2  Đang áp dụng     2 lần/tháng · 60 phút    từ 12/11/2026             │
│     "Tăng quota vì đội Mobile cần hỗ trợ gấp"     [Xem trước] [Rollback] │
│                                                                         │
│ v1  Đã hết hiệu lực  2 lần/tháng · 45 phút    01/10/2026 → 11/11/2026  │
│     "HR điều chỉnh sau khảo sát"                 [Xem trước] [Rollback] │
│                                                                         │
│ v0  Đã hết hiệu lực  2 lần/tháng · 60 phút    01/08/2026 → 30/09/2026  │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Rollback** → mở dialog xin lý do → tạo phiên bản mới với giá trị của phiên bản cũ, hiệu lực từ ngày mai. **Không xóa lịch sử.**

---

## 5. Trang tra cứu cho nhân viên (C7) — cùng catalog

Đây là điểm hay nhất của thiết kế: **trang tra cứu không cần viết lại nội dung** — nó render `policy_template` với giá trị đang áp dụng.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Quy định nội bộ                        [Danh mục ▾] [Tìm kiếm...]    │
│                                                                         │
│ ĐI MUỘN / VỀ SỚM                                                        │
│ Bạn được tạo đơn đi muộn/về sớm 2 lần mỗi tháng, mỗi lần tối đa       │
│ 60 phút. Đơn phải gửi trước 08:00.                                     │
│                                                                         │
│ Hiệu lực từ 01/10/2026 · Phiên bản 2                                    │
│ Liên quan: Đơn từ · Bảng công                                           │
│                                                                         │
│ BỔ SUNG CHẤM CÔNG                                                       │
│ Đơn bổ sung chấm công tối đa 5 lần mỗi tháng và phải được gửi trong    │
│ vòng 3 ngày làm việc kể từ ngày bạn quên chấm công.                     │
│                                                                         │
│ PHÉP TỒN                                                                │
│ Phép năm chưa dùng của bạn được chuyển sang năm sau. Bạn dùng được      │
│ toàn bộ phép tồn đến 01/04, sau đó chỉ còn 5 ngày, và từ 01/07 phép    │
│ tồn của năm trước bằng 0.                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

**Điểm mạnh:** khi HR đổi quota, trang này **tự đổi theo** — không phải sửa lại tài liệu. Và nó cũng là nguồn cho command palette (Ctrl+K).

---

## 6. API

| Method | Đường dẫn | Ý nghĩa |
|---|---|---|
| GET | `/api/rules/catalog` | Danh sách quy định theo nhóm nghiệp vụ, kèm giá trị đang áp dụng, các ghi đè theo phạm vi và cờ "có phiên bản tương lai". Danh sách lựa chọn động đã được điền sẵn để giao diện không cần gọi thêm. |
| GET | `/api/rules?rule_key=&scope_type=&scope_ref_id=` | Phiên bản đang áp dụng và tất cả phiên bản (nếu yêu cầu kèm lịch sử). |
| POST | `/api/rules/dry-run` | Xem trước ảnh hưởng của một thay đổi — trả về số đơn bị ảnh hưởng, số nhân viên bị ảnh hưởng, ước tính phút công được hoàn, số bảng công đã khóa không bị đụng, số người sẽ nhận thông báo và tóm tắt. |
| POST | `/api/rules` | Tạo phiên bản mới — kiểm tra theo catalog (kiểu, khoảng giá trị, trường bắt buộc). |
| GET | `/api/rules/{rule_key}/history?scope_type=&scope_ref_id=` | Lịch sử các phiên bản của một quy định theo phạm vi. |
| POST | `/api/rules/{rule_key}/rollback` | Tạo phiên bản mới với giá trị của phiên bản được chọn. |
| GET | `/api/policies` | Trang tra cứu: render câu thông báo với giá trị đang áp dụng, theo phạm vi của người đang xem (toàn công ty + ghi đè của phòng ban họ). |

**Kiểm tra giá trị server-side theo catalog** (không tin giao diện):

| Trường hợp | Thông báo cho HR |
|---|---|
| Thiếu trường bắt buộc | "Thiếu trường: {nhãn hiển thị}" |
| Giá trị không phải số | "{nhãn hiển thị} phải là số" |
| Giá trị nhỏ hơn khoảng cho phép | "{nhãn hiển thị} không được nhỏ hơn {giá trị tối thiểu}" |
| Giá trị lớn hơn khoảng cho phép | "{nhãn hiển thị} không được lớn hơn {giá trị tối đa}" |
| Giá trị không thuộc danh sách lựa chọn | "{nhãn hiển thị} phải là danh sách" hợp lệ |

---

## 7. Ảnh hưởng tới lộ trình

| Việc | Khi nào | Ghi chú |
|---|---|---|
| **Định nghĩa catalog** (19 rule) | **D3**, kèm D4 | Làm sớm — từ D3 mọi rule đọc từ catalog, **không** hard-code trong service |
| Lưu trữ + versioning + rollback (BE) | D4 | Cùng lúc với quota engine |
| Dry-run analyzer (BE) | D6 | Cùng lúc C6 |
| **UI cấu hình** (FE) — form generic | **D10** | Đây là khối FE lớn nhất, cần chỗ trống |
| Trang tra cứu (C7) — render catalog | D10 | Dùng chung renderer → gần như miễn phí |
| Rule OKR vào catalog | D7–D9 | `okr_evaluation` |

**Lưu ý rủi ro:** UI cấu hình là khối lớn. Nếu trượt:
- **Cắt `rollback`** (giữ lịch sử chỉ để xem, không cho rollback) — vẫn giữ được 90% giá trị.
- **Cắt multi-select động** → dùng select 1 giá trị cho scope override (phòng ban đơn lẻ).
- **Không cắt:** form cơ bản, versioning, dry-run, trang tra cứu.

---

## 8. Acceptance criteria

- [ ] HR mở màn hình Cấu hình → thấy **tất cả 19 quy định** với giá trị hiện tại bằng ngôn ngữ tự nhiên
- [ ] Sửa 1 quy định → form đúng kiểu field theo catalog (số có đơn vị, boolean có switch, select có option)
- [ ] Field ẩn/hiện động theo `visible_when` không reload trang
- [ ] Chọn scope "Phòng ban Mobile" → lưu được, và chỉ Mobile bị ảnh hưởng (kiểm tra: nhân viên CA không đổi)
- [ ] Đặt ngày hiệu lực tương lai → rule mới hiện ở tab "Sắp áp dụng", rule cũ vẫn đang áp dụng
- [ ] Bấm "Xem trước ảnh hưởng" → hiện đúng số liệu (số đơn bị ảnh hưởng, số bảng công đã khóa không bị đụng)
- [ ] Lưu có `note` bắt buộc → ghi vào audit log
- [ ] Mở "Lịch sử" → thấy đủ các phiên bản với lý do + người sửa
- [ ] Rollback 1 phiên bản → tạo phiên bản mới với giá trị cũ, lịch sử không bị mất
- [ ] **Trang tra cứu hiển thị đúng giá trị đang áp dụng** — đổi rule xong, trang tra cứu đổi theo ngay
- [ ] Nhân viên không có quyền sửa → nút "Cấu hình" không hiện, API trả 403
- [ ] Giá trị mặc định của catalog khớp **đúng** cột "Quyết định của HR" ở Mục 7
- [ ] Service đọc rule **luôn** qua `resolve_rule()` — không còn chỗ nào hard-code quota

---

## 9. Chống dùng chung tài khoản — thiết kế chi tiết

> **Bối cảnh:** nhân viên A và B dùng chung tài khoản để chấm công hộ cho nhau.
> Đây là lỗ hổng thật — và **device registration đơn thuần không chặn được**, vì khi đó cả máy của A lẫn máy của B đều là thiết bị "đã đăng ký" hợp lệ.

### 9.1 Thẳng thắn về giới hạn

**Không có hệ thống chấm công nào chặn được gian lận cố ý tinh vi.** Ví dụ: A đứng cạnh B, B cầm điện thoại A và check-in hộ. GPS không phân biệt được người cầm máy. Ngay cả nhận diện khuôn mặt cũng chỉ chuyển bài toán sang mức độ khác, không xoá được.

**Điều hệ thống làm được — và đây là mục tiêu thật:**

> Biến gian lận từ *không tốn công gì, không ai biết* → thành *tốn công, dễ bị phát hiện, và HR có bằng chứng*.

Cộng với quyết định đã có của HR: **đi muộn không có đơn → trừ công theo đúng phút thực tế** → gian lận không mang lại lợi ích tài chính.

### 9.2 Lớp 1 — Chặn ở gốc (làm cho share account không đáng)

| Cơ chế | Chặn được gì | Mức hiệu quả |
|---|---|---|
| **SSO Google cá nhân + cảnh báo đăng nhập lạ** | Không share được account Google công ty — Google tự phát hiện và cảnh báo đăng nhập từ thiết bị lạ | ⭐⭐⭐⭐⭐ Mạnh nhất. Đây là lý do quyết định SSO của HR có giá trị chống gian lận, không chỉ tiện |
| **`max_checkin_per_day = 1`** | Chặn vector **"chia ca"**: 2 người share 1 account → chỉ 1 người được công 1 ngày | ⭐⭐⭐⭐ Chặn trực tiếp lỗ hổng |
| **`max_devices = 1`** | Muốn dùng máy thứ 2 phải xin HR duyệt → có dấu vết | ⭐⭐⭐⭐ |
| **Unique `(user_id, work_date)`** | Chặn 2 entry cùng ngày 1 account | ⭐⭐⭐⭐ Chặn ở tầng DB |
| **`device_confirm_required`** | Thêm thiết bị mới → chờ HR duyệt, không tự đăng ký được | ⭐⭐⭐ |
| **Quota tính theo người** | 2 người share → dùng chung quota → bị giới hạn nhiều hơn mức công bằng | ⭐⭐⭐ Kinh tế: làm gian lận không còn đáng |
| **Bắt buộc 2FA** | Chặn khi mật khẩu bị lộ | ⭐⭐⭐ |

**Điểm mấu chốt:** `max_checkin_per_day = 1` + `max_devices = 1` + quota theo người → **2 người share 1 tài khoản thì mỗi người chỉ công được nửa ngày**. Việc chia ca trở nên vô nghĩa về mặt kinh tế. Đây là rào chắn đáng giá nhất và gần như miễn phí.

### 9.3 Lớp 2 — Phát hiện bằng rule

Pattern cụ thể → truy vấn nhanh, miễn phí, và **giải thích được** cho HR:

| Mẫu nghi vấn | Mô tả |
|---|---|
| Check-in trùng | 2 entry cùng ngày từ 2 thiết bị, cách nhau < 30 phút |
| Xoay vòng thiết bị | 1 account nhưng check-in luân phiên giữa nhiều thiết bị (mỗi thiết bị dùng ~1/3 số ngày) |
| Chấm công "hoàn hảo" | Đúng giờ vào/ra mỗi ngày trong 30 ngày liên tiếp |
| Chỉ đi ngày trong tuần | Không nghỉ lễ, không nghỉ phép, không vắng |
| Cùng IP nhưng khác thiết bị | 2 người, 1 IP công ty |

**Mỗi cờ hiệu phải có lý do rõ ràng để HR hiểu:**

| Thuộc tính | Ý nghĩa |
|---|---|
| `flag` | Mã loại cờ hiệu — ví dụ `device_rotation`, `duplicate_checkin` |
| `severity` | Mức độ nghiêm trọng |
| `period` | Khoảng thời gian bị nghi vấn |
| `detail` | Mô tả cụ thể bằng ngôn ngữ nghiệp vụ — ví dụ "3 thiết bị, mỗi thiết bị dùng ~10 ngày, luân phiên theo ngày trong tuần" |
| `devices` | Danh sách thiết bị liên quan (tên máy · mã máy) |
| `suggested_action` | Gợi ý hành động cho HR — ví dụ "Kiểm tra với nhân viên xác nhận thiết bị đang dùng" |

**Nguyên tắc:** cờ hiệu **không bao giờ** tự động trừ công hay kỷ luật. Nó chỉ đưa lên danh sách để HR kiểm tra. Lý do: một cờ hiệu sai còn tệ hơn không có cờ hiệu — nó làm mất niềm tin vào hệ thống.

### 9.4 Lớp 3 — Minh bạch (rẻ nhất, hiệu quả bất ngờ)

**Hiển thị công khai danh sách thiết bị đang hoạt động**, cho cả người dùng lẫn HR:

```
Thiết bị đã đăng ký
┌────────────────────────────────────────────────────────┐
│ iPhone 15 · A1203          Đăng ký 01/08/2026         │
│ Đăng nhập gần nhất: 12/11/2026 09:41 · Hà Nội        │
│ ● Đang hoạt động                                        │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ Galaxy S23 · R5CT2          Đăng ký 28/10/2026         │
│ Đăng nhập gần nhất: 30/10/2026 08:52 · Hà Nội        │
│ ● Đang hoạt động                                        │
└────────────────────────────────────────────────────────┘
```

Khi A đăng nhập từ máy B → **cả hai đều thấy** "Thiết bị của Minh Hà đang hoạt động" (nếu 2 máy cùng lúc) hoặc thấy ngay thiết bị mới xuất hiện. Người biết là bị theo dõi thì ít gian lận hơn. Chi phí gần như 0.

**Kèm cảnh báo tức thì:**

```
🔔 Cảnh báo: Đăng nhập từ thiết bị mới
Bạn vừa đăng nhập từ "iPhone 13 · F2LQ7" — thiết bị này chưa từng
được đăng ký trước đây. Nếu không phải bạn, hãy đổi mật khẩu ngay
và báo cho HR.

[Không phải tôi]  [Đây là tôi — đăng ký thiết bị này]
```

### 9.5 Thứ **không** làm trong 13 ngày

| Ý tưởng | Vì sao không làm |
|---|---|
| Nhận diện khuôn mặt khi chấm công | Cần camera + model + hạ tầng; độ chính xác ngoài văn phòng thấp; xử lý ảnh cá nhân là rủi ro pháp lý |
| Đối chiếu sinh trắc học | Ngoài phạm vi hackathon |
| Ghi hình khi chấm công | Vấn đề quyền riêng tư lớn |
| Phân tích hành vi bằng mô hình dự đoán gian lận | Rule đã bắt được pattern rõ ràng; mô hình dự đoán thêm chi phí + độ không chắc chắn, không bắt được case tinh vi hơn |

### 9.6 Trả lời khi judge hỏi "2 người share tài khoản thì sao?"

> *"Câu hỏi rất đúng chỗ, và em cũng đã cân nhắc khi thiết kế. Nói thật: **không có hệ thống nào chặn được** trường hợp A đứng cạnh B rồi B cầm điện thoại A check-in hộ — GPS không phân biệt được người cầm máy.*
>
> *Nhưng em thiết kế để làm cho việc đó **không đáng làm**:*
>
> *Một — tài khoản chỉ được **check-in 1 lần/ngày** và **1 thiết bị**. Nên 2 người share 1 tài khoản thì mỗi người chỉ công được nửa ngày — chia ca không còn lợi nhuận.*
>
> *Hai — đăng nhập bằng **Google cá nhân của công ty** kèm cảnh báo đăng nhập lạ. Không share được account Google.*
>
> *Ba — **quota tính theo người** chứ không theo thiết bị.*
>
> *Bốn — hệ thống **phát hiện theo rule**: xoay vòng thiết bị, check-in trùng giờ, chấm công hoàn hảo 30 ngày liên tiếp. Đây là SQL query, không tốn token, và hiện lý do cụ thể để HR kiểm tra — không tự động kỷ luật.*
>
> *Năm — **minh bạch**: ai cũng thấy danh sách thiết bị đang hoạt động. Khi có người đăng nhập từ máy mới, cả hai đều nhận cảnh báo ngay.*
>
> *Và cuối cùng, theo đúng quyết định của HR: **đi muộn không có đơn thì trừ công theo đúng phút thực tế** — nên gian lận về mặt tài chính cũng không có lợi."*

### 9.7 Acceptance criteria

- [ ] Check-in lần 2 trong ngày → bị chặn, hiện "đã chấm công vào lúc …"
- [ ] 2 entry cùng `(user_id, work_date)` không tồn tại (unique constraint)
- [ ] Thêm thiết bị thứ 2 khi `max_devices = 1` → tạo 1 yêu cầu chờ HR duyệt, không chấm công được ngay
- [ ] Đăng nhập từ thiết bị mới → cả người dùng lẫn quản lý đều nhận cảnh báo
- [ ] Trang "Thiết bị đăng ký" hiển thị thiết bị + thời điểm đăng nhập gần nhất, ai cũng xem được
- [ ] Cờ hiệu `device_rotation` phát hiện đúng trường hợp luân phiên 3 thiết bị
- [ ] Cờ hiệu `duplicate_checkin` không báo trùng khi 1 người check-in lại do nhấn nhầm (cho phép ghi đè trong 5 phút, có audit)
- [ ] **Cờ hiệu không bao giờ tự ý trừ công hay kỷ luật** — chỉ hiển thị để HR review
- [ ] Mọi cờ hiệu đều có `detail` mô tả cụ thể + danh sách thiết bị liên quan
