# 04 — Tính năng tiện lợi theo vai trò

> **Đây là phần quyết định điểm số theo tiêu chí UX.** Toàn bộ nghiệp vụ làm bằng rule — không dùng AI. 15 tính năng dưới đây là phần lớn giá trị người dùng cảm nhận.
> **Metric đánh giá:** *tiết kiệm được bao nhiêu thao tác, bao nhiêu lần mỗi tháng?*

### Danh mục 15 tính năng — nguồn sự thật cho mọi tài liệu khác

| ID | Tính năng | Màn hình | Nằm ở mục |
|---|---|---|---|
| C1 | Todo inbox | S02 | §1 |
| C2 | Nhắc việc tự động (3 kênh + chống spam) | S04, S04m | §1 |
| C3 | Command palette Ctrl+K | S03 | §1 |
| C4 | Sửa bảng công tại chỗ + sửa hàng loạt | S15 | §1 |
| C5 | Bộ lọc mạnh + lưu view | S15 | §1 |
| C6 | Trang quy định tra cứu | S19 | §3 |
| C7 | Duyệt hàng loạt + chip lý do | S12, S14 | §2 |
| C8 | Review OKR bảng so sánh nhóm | S24 | §2 |
| C9 | Onboarding tour + empty state có CTA | S36 | §3 |
| C10 | Trình cấu hình quy định | S16, S17, S32 | §3 |
| C11 | Chấm công tối ưu cho điện thoại | S05m | §4b |
| C12 | Nhắc việc theo từng actor (17×3) | S04m | §4b (chi tiết ở §C2) |
| C13 | Loại nghỉ cấu hình được | S30, S32 | §4b |
| C14 | Gợi ý kế thừa từ OKR quản lý | S21 | §4.1 |
| C15 | Tóm tắt báo cáo OKR | S25 | §4.2 |

> **ID là hợp đồng.** Mọi tài liệu, mockup, tên hàm trong code đều dùng chung bảng này.
> Ngoài 15 mục còn có **"C-cố"** (đơn từ điền sẵn tự động — `docs/02` §C-cố, màn hình S07), không thuộc hệ thống này.

---

## 1. Nhân viên — "Đừng để tôi quên, đừng để tôi tự tính"

### C1. Todo Inbox — 1 màn hình gom mọi việc đang chờ mình ⭐ P0

**Vấn đề:** Nhân viên có 4 nơi phải nhớ: chấm công, đơn từ, phép năm, OKR check-in. Họ phải tự nhớ hôm nay cần làm gì.

**Giải pháp:** Một trang "Cần làm" hiển thị **mọi việc đang chờ**, gắn nhãn lý do, kèm nút hành động 1 chạm. Đây là **trang mặc định sau khi đăng nhập** của nhân viên.

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

**Nguồn sinh ActionItem (tự động, không cần người dùng khai báo):**

| Nguồn | Điều kiện | Urgency |
|---|---|---|
| Chưa chấm công | Hôm nay là ngày làm việc, giờ vào đã qua 30 phút, chưa có `check_in` | `soon` |
| Chưa chấm công ra | Đã check-in, giờ ra đã qua 30 phút, chưa có `check_out` | `soon` |
| Quên chấm công hôm qua | Không có entry 2 ngày làm việc liên tiếp | `overdue` |
| Hạn nộp đơn bổ sung công sắp tới | Còn ≤ 1 ngày làm việc trong hạn 3 ngày | `soon` |
| Hạn nộp đơn bổ sung công quá hạn | Quá hạn | `overdue` |
| Phép tồn sắp hết hạn | Còn ≤ 30 ngày trước mốc 01/04 hoặc 01/07, còn dư phép | `soon` |
| WFH chưa gửi báo cáo công việc | Ngày WFH đã qua, chưa có `work_report` | `normal` |
| OKR check-in đến hạn | Phase check-in active, chưa check-in kỳ này | `soon` |
| OKR chưa tạo | Phase setup active, chưa có objective nào | `soon` |
| Bảng công chưa kiểm tra | Kỳ công vừa chốt, chưa mở xem | `normal` |
| Bảng công sắp hết hạn khiếu nại | Còn ≤ 1 ngày trong cửa sổ 2 ngày | `soon` |

**UI:**

```
┌─────────────────────────────────────────────────┐
│  Hôm nay, Thứ Tư 12/11          [3 việc]       │
│                                                  │
│  ⚠ OVERDUE          [Chấm công ra hôm qua]      │
│  Bạn chưa chấm công ra ngày 11/11 (Thứ Ba)     │
│                                  [Bổ sung công]   │
│                                                  │
│  ◷ SẮP ĐẾN HẠN      [Check-in OKR tháng 11]     │
│  2 Key Result đến hạn cập nhật tiến độ         │
│                                  [Cập nhật]      │
│                                                  │
│  ○ HÔM NAY         [Chấm công ra]              │
│  Ca 08:30 – 17:30 · Vào lúc 08:47               │
│                                  [Chấm công]     │
│                                                  │
│  ℹ LƯU Ý           Phép tồn 2025 hết hạn       │
│  5 ngày phép tồn sẽ mất vào 01/07              │
└─────────────────────────────────────────────────┘
```

**Quy tắc:** item đã xong → ẩn khỏi inbox, vào mục "Đã xong" (giữ 7 ngày). Không có item → empty state có CTA: *"Hôm nay không có việc gì cần làm. Xem lịch công của tháng này →"*

**Tiết kiệm:** thay vì nhớ 4 nơi → **1 màn hình, 1 chạm**. Đây là tính năng được nhắc đầu tiên trong pitch vì ai cũng hiểu ngay.

---

### C2 + C12. Nhắc việc tự động — 3 kênh, đúng người ⭐ P0

**C2** = cơ chế nhắc (3 kênh, chống spam). **C12** = ma trận 17 sự kiện × 3 vai trò — ai nhận việc nào.

**Vấn đề:** Todo inbox chỉ hữu ích khi người dùng mở app. Nhắc việc phải tới đúng lúc — **và đúng người cần làm**.

#### Ba kênh, đúng vai trò

| Kênh | Khi nào | Ai nhận |
|---|---|---|
| **Push trong ứng dụng** | Ngay khi có việc mới phát sinh | Người liên quan |
| **Email digest** | 1 lần/ngày lúc 08:00, gom mọi việc chưa xong | Tất cả |
| **Badge đếm số** trên menu | Luôn hiện | Tất cả |

#### Ma trận nhắc việc theo actor

Đây là phần quan trọng nhất — **mỗi việc phải đến đúng người**, không phải đến cả công ty.

| # | Sự kiện | Nhân viên | Quản lý | HR | Kênh |
|---|---|---|---|---|---|
| 1 | **Chưa check-in** khi giờ vào đã qua 30′ | ✅ ngay | — | — | Push |
| 2 | **Chưa check-out** khi giờ ra đã qua 30′ | ✅ ngay | — | — | Push |
| 3 | **Quên chấm công** (thiếu entry 2 ngày làm việc liên tiếp) | ✅ overdue | ✅ (sau 3 ngày) | — | Push + badge |
| 4 | **Hạn nộp đơn bổ sung công sắp tới** (còn ≤ 1 ngày làm việc) | ✅ soon | — | — | Push |
| 5 | **Hạn nộp đơn bổ sung công đã quá hạn** | ✅ overdue | ✅ (sau 3 ngày) | ✅ (sau 5 ngày) | Push + badge |
| 6 | **Đơn chờ duyệt quá hạn** | — | ✅ overdue | ✅ (quá 2× SLA) | Push + email |
| 7 | **Đơn bị trả lại** | ✅ ngay | — | — | Push |
| 8 | **Phép tồn sắp hết hạn** (≤ 30 ngày trước 01/04 hoặc 01/07) | ✅ soon | — | — | Push |
| 9 | **Đơn WFH chưa gửi báo cáo công việc** cuối ngày WFH | ✅ ngay | — | — | Push |
| 10 | **Check-in OKR đến hạn** (còn ≤ 2 ngày) | ✅ soon | — | — | Push |
| 11 | **Chưa tạo OKR** trong phase setup | ✅ soon | ✅ (nhắc hết phase) | — | Push |
| 12 | **Tự chấm điểm OKR** đến hạn (phase final) | ✅ soon | ✅ nhắc hết phase | — | Push |
| 13 | **Objective bị trả lại** cần sửa & gửi lại | ✅ ngay | — | — | Push |
| 14 | **Bảng công vừa chốt** — cần kiểm tra & khiếu nại (2 ngày) | ✅ normal | — | — | Email digest |
| 15 | **Sắp hết hạn khiếu nại bảng công** (còn ≤ 1 ngày) | ✅ soon | — | — | Push |
| 16 | **Nhắc chốt bảng công** (ngày X hàng tháng) | — | — | ✅ | Email |
| 17 | **Nhắc mở khóa OKR khi hết hạn** | — | — | ✅ | Email |

#### Chính sách chống spam — điều quan trọng nhất của phần này

Nhắc nhiều quá thì bỏ qua, và khi bỏ qua thì hệ thống chết. Vì vậy:

**Chính sách nhắc việc — nhân viên:**

| Quy tắc | Giá trị | Vì sao |
|---|---|---|
| Số push tối đa/ngày | 3 | Chỉ vài việc mới đủ đáng nhắc |
| Giờ gửi email digest | 08:00 | Gom còn **1 email/ngày** lúc 8h sáng — không spam hộp thư |
| Khung giờ nghỉ | 21:00 – 07:00 | Không push trong khung giờ nghỉ |
| Cửa sổ chống trùng | 12 giờ | Cùng 1 việc, trong 12h chỉ nhắc 1 lần |
| Sau bao nhiêu ngày thì leo thang | 3 ngày | Quá 3 ngày → báo thêm cho quản lý |

**Chính sách nhắc việc — quản lý:**

| Quy tắc | Giá trị | Vì sao |
|---|---|---|
| Số push tối đa/ngày | 5 | Quản lý duyệt nhiều hơn nên nhiều hơn |
| Nhắc trước hạn | 3 ngày và 1 ngày | Nhắc trước hạn 3 ngày và 1 ngày |
| Đơn quá bao nhiêu lần SLA thì báo HR | 2 lần | Đơn quá 2× SLA → báo HR |

**Thứ tự ưu tiên khi vượt quota push:**

| Ưu tiên | Mức độ |
|---|---|
| 1 | `overdue` — quá hạn |
| 2 | `sla_breach` — vượt SLA |
| 3 | `soon` — sắp đến hạn |
| 4 | `normal` — bình thường |

**Khi vượt quota push trong ngày** → chỉ giữ lại theo `priority_order`, phần còn lại nằm trong email digest 08:00 hôm sau. Đây là hành vi đúng: việc quá hạn quan trọng hơn việc "sắp đến hạn".

#### Nhắc quản lý theo nhóm — không phải từng người

Quản lý không cần 30 notification riêng lẻ. Hệ thống gom:

```
🔔 3 nhân viên trong nhóm chưa chấm công hôm qua
   Minh Hà, Bình Nguyễn, Lan Phạm
   [Xem lịch nhóm]
```

```
🔔 5 đơn của bạn đã quá hạn duyệt (cũ nhất 3 ngày)
   3 đơn đi muộn · 1 đơn nghỉ phép · 1 đơn WFH
   [Duyệt ngay]
```

**Vì sao gom theo nhóm:** 1 notification thay 12 notification = người dùng không tắt thông báo.

#### Email digest — 1 email/ngày, gọn, có CTA

```
┌─────────────────────────────────────────────────────────────┐
│  ACT HR · Hôm nay 12/11/2026                                │
│  Bạn có 3 việc đang chờ                                     │
│                                                             │
│  ⚠ Quên chấm công ra ngày 11/11      [Bổ sung công]        │
│  ◷ Check-in OKR tháng 11 (còn 2 ngày)  [Check-in ngay]     │
│  ○ Chấm công ra hôm nay               [Chấm công]           │
│                                                             │
│  Nếu đã xử lý xong, bỏ qua email này.                      │
└─────────────────────────────────────────────────────────────┘
```

Không có email nào gửi ngoài 08:00 (trừ trường hợp khẩn cấp đã cấu hình).

#### Nguyên tắc: thông báo phải **hành động được**

Mọi notification đều có nút bấm đưa thẳng tới màn hình cần xử lý — không phải về trang chủ chung chung. Đây là khác biệt giữa "thông báo" và "thông báo rác".

#### Triển khai

Hệ thống **quét lại các điều kiện nhắc việc mỗi giờ**:

1. Duyệt lần lượt **17 quy tắc sinh thông báo** ở bảng ma trận nhắc việc theo actor → mỗi quy tắc trả về danh sách sự kiện phát sinh.
2. Với mỗi sự kiện: kiểm tra có nên gửi không — theo **chống trùng** (12 giờ) → **hạn mức push/ngày** → **khung giờ nghỉ**.
3. Sự kiện vượt qua cả 3 điều kiện → tạo thông báo trong hệ thống và **gửi push** (trừ khi đang trong khung giờ nghỉ).

> Phần còn lại của sự kiện bị loại do vượt hạn mức sẽ nằm trong **email digest 08:00 hôm sau** — không mất việc nào.

| Kênh | Cách gửi | Ghi chú |
|---|---|---|
| Push trong ứng dụng | Thông báo tới thiết bị đã đăng ký | Thiết bị đã cài ứng dụng → nhận push ngay khi có việc |
| Email | Gửi qua hàng đợi, không chặn màn hình | 1 digest lúc 08:00 + email cá nhân |
| Badge | Đếm số việc đang chờ | Không cần push, luôn hiện trên menu |

**Fallback khi chưa cài ứng dụng lên điện thoại:** mọi thông báo vẫn tới qua email digest 08:00 + badge số trên menu. Không mất thông tin nào.

**Tiết kiệm:** 4 việc phải tự nhớ → 0 việc phải nhớ. Đây là thứ nhân viên **cảm nhận đầu tiên**.
---

### C3. Command Palette (Ctrl+K) — tìm mọi thứ trong 1 ô ⭐ P0

**Vấn đề:** HR tìm 1 quy định trong file PDF, tìm 1 nhân viên trong 30 người, tìm 1 đơn. Mỗi thứ một nơi, tìm bằng mắt.

**Giải pháp:** Một ô tìm kiếm, gõ là ra. Đây là tính năng "tiện" đơn giản nhưng cực kỳ ấn tượng khi demo.

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

**Phạm vi tìm kiếm theo vai trò:**

| Vai trò | Tìm được |
|---|---|
| Nhân viên | Mình (hồ sơ, bảng công, đơn của mình, OKR của mình), **quy định liên quan đến mình** |
| Quản lý | Nhóm cấp dưới + quy định + tài liệu phòng ban |
| HR | Tất cả nhân viên, đơn, bảng công, **toàn bộ quy định & chính sách** |
| Admin | Tất cả + cấu hình hệ thống |

**Ví dụ gõ:**

| Gõ | Ra |
|---|---|
| `phep ton` | Quy định "Chuyển và hết hạn phép năm" + trang cấu hình phép tồn |
| `dieu` | "Đi muộn, về sớm — quota 2 lần/tháng, tối đa 60 phút" |
| `minh` | Nhân viên "Minh Hà" + đơn + OKR của Minh |
| `thang 11 mobile` | Bảng công tháng 11 của phòng Mobile |
| `okr` | Chu kỳ OKR 2026, mục tiêu "Tăng trưởng doanh thu" |

**Shortcut phân theo ngữ cảnh:** `/` mở tìm kiếm, `g c` → Chấm công, `g o` → OKR, `g t` → Bảng công. Nhưng tắt được.

**Tiết kiệm:** HR tìm quy định: 2 phút google trong file → **3 giây**.

---

### C4. Sửa thẳng trong bảng công — không cần export → sửa Excel → import ⭐ P0

**Vấn đề:** HR tìm 1 sai lệch trong bảng công. Cách duy nhất hiện nay: export Excel → sửa tay → import lại → đối chiếu. Cực kỳ dễ sai và mất dấu vết ai sửa.

**Giải pháp:** Click vào ô → gõ → lưu. **Có audit log, có nút hoàn tác, có lý do bắt buộc khi sửa cột nhạy cảm.**

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

**Nhóm cột nhạy cảm** (bắt buộc lý do khi sửa): `actual_hours`, `late_minutes`, `early_minutes`, `paid_leave_days`, `bhxh_leave_days`, `violations`.

**UI:**

```
┌──────────────────────────────────────────────────────────────┐
│ Bảng công 11/2026 · Mobile · [Sửa hàng loạt] [Xuất Excel]   │
│                                                              │
│ Họ tên      Chuẩn  Thực tế  Đi muộn  WFH  Phép  BHXH  Vi phạm│
│ Minh Hà      22      21.5     30'     2     0      0      0  │
│ Bình Nguyễn  22      22       0       0     0      0      0  │
│ ...                                                             │
│                                                              │
│ ⚠ 2 sai lệch được phát hiện tự động:                        │
│   • Minh Hà — thiếu 1 check-out ngày 05/11  [Xem] [Sửa]     │
│   • Bình Nguyễn — về sớm 45' không có đơn  [Xem] [Tạo đơn]  │
└──────────────────────────────────────────────────────────────┘
```

**Sửa hàng loạt (bulk edit):** tick nhiều dòng → chọn cột + giá trị → áp dụng 1 lần → nhập lý do chung → 1 audit log cho cả lô (kèm chi tiết từng dòng).

**Tiết kiệm:** HR sửa 1 sai lệch: 15 phút export/sửa/import → **20 giây**. Đây là tính năng HR đánh giá cao nhất.

---

### C5. Bộ lọc mạnh + lưu view ⭐ P0

**Vấn đề:** HR muốn xem "những người trong team Mobile tháng 11 có đi muộn" → filter 5 chiều (phòng ban × tháng × trạng thái × chỉ số × từ khóa), mỗi lần làm lại từ đầu.

**Giải pháp:** Bộ lọc dạng chip, chọn được nhiều chiều, và **lưu lại view** để tái sử dụng. Mỗi view lưu kèm URL chia sẻ được.

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

**View mặc định có sẵn (đã bỏ công sức sắp xếp):**

| Tên | Dùng cho |
|---|---|
| "Cần duyệt" | Tất cả vai trò duyệt |
| "Đi muộn tháng này" | HR |
| "WFH tuần này" | Quản lý |
| "Phép sắp hết hạn" | HR |
| "Chưa nộp OKR" | HR |
| "OKR cần review" | Quản lý |

**Tiết kiệm:** HR lọc lại cùng một báo cáo mỗi tháng: 3 phút → **1 click**.

---

## 2. Quản lý — "Đừng để tôi phải hỏi từng người"

### C7. Duyệt hàng loạt + chip lý do — P1

**Vấn đề:** 12 đơn chờ duyệt → 12 lần mở form, đọc, gõ lý do, bấm duyệt.

**Giải pháp:**

1. **Bulk approve**: tick nhiều đơn → duyệt 1 lần. Nếu có đơn cần HR duyệt thêm → tách riêng, chỉ duyệt 1 bước.
2. **Chip lý do**: lý do từ chối phổ biến là 1 chạm — "Vượt quota tháng này", "Cần bổ sung giấy tờ", "Trùng ngày đã xin phép", "Thời gian nghỉ không hợp lý".
3. **Điều kiện quyết định hiện sẵn**: mỗi đơn hiển thị kết quả check rule dưới dạng chip xanh/đỏ:
   - ✅ Trong quota (1/2 lượt tháng 11)
   - ✅ Trong giờ hạn nộp (2/3 ngày làm việc)
   - ❌ Trùng ngày đã nghỉ phép 05/11
   - ⚠ Nghỉ 5 ngày → cần HR duyệt thêm

4. **Sắp xếp theo rủi ro**: đơn nào có vấn đề rule nằm trên cùng.

**Tiết kiệm:** 12 đơn/tuần: 25 phút → **3 phút**.

### @@C6@@. Review OKR dạng bảng so sánh cả nhóm — P1

**Vấn đề:** Manager review 10 OKR của cấp dưới → mở từng objective, đọc từng KR, tự tính điểm. Rất lâu và dễ không nhất quán giữa các người.

**Giải pháp:** 1 bảng tất cả objective trong nhóm:

```
┌───────────────────────────────────────────────────────────────────────┐
│ Review cuối năm 2026 · Nhóm Mobile (10 người)                        │
│                                                                        │
│ Tên          Objective          Tự chấm  Đề xuất*  Cảnh báo          │
│ Minh Hà     Tăng trưởng Q4        0.85     0.85      —                │
│ Bình Nguyễn Đổi mô hình CSKH      0.60     0.60      ⚠ KR2 tiến độ 0 │
│ Lan Phạm    Tối ưu vận hành        0.92     0.85      ⚠ tự chấm > đề xuất│
│ ...                                                                    │
│ [*] Đề xuất = điểm theo công thức từ tiến độ KR                     │
│                                                                        │
│ [Chấm toàn bộ 8 objective đã chọn]  [Duyệt hàng loạt]                 │
└───────────────────────────────────────────────────────────────────────┘
```

**"Đề xuất" tính bằng công thức:**

> **Điểm đề xuất là GỢI Ý cho manager, không phải điểm chấm chính thức.**
> Điểm cuối cùng theo mô hình HR là **chấm 1–5 ở tầng nhóm** (Business/People) — xem `docs/03` §5.1.
> Công thức dưới đây ánh xạ tiến độ KR sang **thang 1–5** để manager so sánh nhanh.

**Công thức tính điểm đề xuất (1–5):**

| Bước | Cách tính | Vì sao |
|---|---|---|
| 1. Tiến độ mỗi KR | Tỉ lệ hoàn thành của KR so với giá trị mục tiêu | Lấy từ số liệu đã có, không cần nhân viên tự chấm |
| 2. Điều chỉnh theo độ tin cậy | Tiến độ × (0.8 + 0.2 × mức độ tin cậy) | Tin cậy thấp → **giảm nhẹ**, nhưng **không** bị chấm 0 |
| 3. Trọng số theo KR | Điểm đã điều chỉnh × trọng số KR ÷ 100 | KR nặng hơn thì kéo điểm mục tiêu nhiều hơn |
| 4. Cộng lại | Tổng điểm các KR | Tổng trọng số mỗi mục tiêu = 100 nên tổng nằm trong khoảng 0–1 |
| 5. Ánh xạ sang thang 1–5 | Tổng × 4, làm tròn xuống, cộng thêm 1 | 0 → điểm 1 · 1 → điểm 5 |

> **Công thức minh bạch, manager thấy được lý do** — điểm đề xuất là **phép tính**, không phải suy luận.

**Cảnh báo rule:**
- Tiến độ không đổi ≥ 3 kỳ check-in
- `confidence` = 0.9 nhưng `progress` = 0 (mâu thuẫn tự báo)
- Lệch > 0.2 giữa tự chấm và điểm theo tiến độ
- Objective > 60% ngày trong kỳ không check-in

**Tiết kiệm:** manager review 10 OKR: 90 phút → **25 phút**, và nhất quán hơn giữa các người.

---

## 3. HR — "Trích xuất nhanh, sửa nhanh, không phải làm lại"

### C6. Trang quy định tra cứu — P0

**Vấn đề:** Quy định nằm rải rác trong file PDF/Word. Nhân viên hỏi HR, HR trả lời. Hoặc nhân viên đọc file 40 trang không tìm được đoạn cần.

**Giải pháp:** Trang tra cứu **được sinh tự động từ cùng catalog với C10** — không ai phải viết lại nội dung.

| Trường | Nội dung |
|---|---|
| Nội dung | Sinh từ mẫu câu chữ `policy_template` của catalog với giá trị đang áp dụng |
| Ví dụ thực tế | "Bạn đi muộn 45 phút thứ 2 trong tháng → còn 1 lượt" |
| Hiệu lực | Từ 01/11/2026 · Đã thay thế bởi bản 01/09/2026 |
| Liên quan | Đơn từ · Bảng công · Nghỉ phép |
| Nguồn | HR sửa · Phiên bản 3 |

**Ví dụ nội dung hiển thị:**

```
Đi muộn / về sớm
─────────────────────────────────────────
Bạn được tạo đơn đi muộn/về sớm 2 lần mỗi tháng, mỗi lần
tối đa 60 phút. Đơn phải gửi trước 08:00.

Hiệu lực từ 01/10/2026 · Phiên bản 2
```

> **Điểm mạnh thiết kế:** khi HR đổi quota 2 → 3 lần/tháng qua C10, trang này **tự đổi theo**. Tài liệu **được sinh ra từ** phần mềm chứ không phải viết tay rồi lệch dần. Chi tiết: `docs/06-business-rule-builder.md`.

**Trang này cũng là nguồn cho command palette (C3).**

### C10. Trình cấu hình quy định — HR sửa quota bằng form ⭐ P0

**Vấn đề:** Tài liệu yêu cầu *"các giới hạn được HR cấu hình trên hệ thống, không cố định trong phần mềm, và có ngày hiệu lực"*. Nếu không có màn hình cấu hình thì yêu cầu đó là giả — HR vẫn phải nhờ người khác sửa giúp.

**Giải pháp:** Một **catalog quy định** (19 quy định) sinh ra **hai bề mặt** từ cùng một nguồn:
1. **Trang cấu hình** cho HR — một mẫu form dùng chung, điền theo các trường của catalog, có lịch sử phiên bản, ngày hiệu lực, hoàn tác, xem trước ảnh hưởng.
2. **Trang tra cứu** cho nhân viên (C6) — sinh nội dung từ mẫu câu chữ trong catalog với giá trị đang áp dụng.

**Chi tiết đầy đủ: `docs/06-business-rule-builder.md`.** Tóm tắt giao diện:

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
│ │                                                      [ Cấu hình ]      │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ...                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

Khi bấm **"Cấu hình"** → panel chọn scope (toàn công ty / phòng ban / chức danh), nhập giá trị, chọn ngày hiệu lực, ghi lý do → **"Xem trước ảnh hưởng"** → lưu.

**Tiết kiệm:** HR đổi quota: phải nhờ người khác sửa giúp → **30 giây trên màn hình, có xem trước ảnh hưởng**. Và đây là khoảnh khắc demo mạnh nhất: đổi quota **ngay trên sân khấu**, nhân viên bên cạnh thấy quy định mới ngay.

### C9. Onboarding tour + empty state có CTA — P2

- Người dùng mới vào → tour 3 bước trên màn hình chính (bỏ qua được, không hiện lại).
- **Mọi empty state phải có CTA** — không bao giờ để màn hình trống chết:
  - "Chưa có đơn nào" → [+ Tạo đơn đầu tiên]
  - "Chưa có nhân viên trong phòng ban" → [Mời nhân viên] hoặc [Nhập từ Excel]
  - "Chưa có OKR" → [Tạo OKR đầu tiên]

---

## 4. Gợi ý & tóm tắt — bằng rule, không dùng AI

> Hệ thống **không có lớp AI**. Hai chỗ từng được đề xuất dùng AI nay đã thay bằng rule.

### 4.1. Gợi ý kế thừa từ OKR của quản lý (C14)

**Ý tưởng:** nhân viên tự nhập OKR (2 nhóm **Business** & **People** cố định), nhưng **mục tiêu business
thì thường từ trên đưa xuống**. Thay vì bắt nhân viên nghĩ lại từ đầu, form hiện **OKR đã được duyệt của
quản lý trực tiếp** để bấm 1 chạm chép vào.

**Cơ chế:**
- Hệ thống đọc OKR **đã được duyệt** của quản lý trực tiếp trong cùng chu kỳ.
- Hiện dưới đúng nhóm tương ứng (Business → Business, People → People) dạng **gợi ý có sẵn** + nút **[Chép]**.
- Nhân viên **được thêm, bớt, sửa** tùy ý — gợi ý chỉ mang tính tham khảo.
- Không có mẫu mục tiêu riêng, không có màn hình quản lý mẫu — chỉ đọc dữ liệu sẵn có.

**Ràng buộc:**
- Chỉ gợi ý trong **cùng nhóm** — không trộn Business với People.
- **Không tự động điền** — phải bấm chép, để nhân viên chủ động.
- Quản lý chưa có OKR đã duyệt → **không hiện gợi ý** (không bịa nội dung).
- Nhân viên vẫn có thể viết hoàn toàn mới — gợi ý không bắt buộc.

**Tiết kiệm:** thay vì nghĩ lại mục tiêu mà cấp trên đã có → **1 chạm chép**.

### 4.2. Tóm tắt báo cáo OKR cho HR (C15)

Mỗi widget báo cáo đi kèm **mô tả sẵn theo template**, dựng từ số liệu đã tính:

```
📊 Báo cáo OKR 2026
• 26/30 nhân viên đã nộp OKR (87%)
• Điểm trung bình toàn công ty: 0.78 — xếp loại B (Đạt)
• Phòng ban thấp nhất: Chăm sóc khách hàng (0.61)
• Còn 14 objective chưa check-in đủ kỳ → xem danh sách
```

**Ràng buộc:** số liệu do engine tính, câu chữ do template dựng sẵn → **không có nguy cơ bịa số liệu**,
và luôn kèm link tới từng widget nguồn để HR kiểm chứng.

---

## 4b. Ba tính năng P0 được định nghĩa ở tài liệu khác

> Ba mục này **đã có màn hình và đã có spec ở tài liệu chuyên dụng**. `docs/04` là nơi tập trung
> toàn bộ 15 tính năng nên ở đây chỉ liệt kê ngắn — **không lặp lại spec**, tránh 2 nơi 1 ý kiến.

### C11. Chấm công tối ưu cho điện thoại — 1 chạm, < 4 giây ⭐ P0

**Vấn đề:** nhân viên chấm công **2 lần/ngày** trên điện thoại — đây là thao tác lặp lại nhiều nhất
trong toàn hệ thống, và là thao tác người dùng **ghét nhất** nếu làm chậm.

**Yêu cầu cốt lõi:** màn hình chỉ có **2 thông tin** (giờ + trạng thái xác thực) và **1 nút**.
Không form, không chọn ca, không nút "Xác nhận" thêm.

| Điểm | Yêu cầu |
|---|---|
| Nút | Tròn Ø **112px**, ở giữa màn hình (vùng chạm tự nhiên khi cầm 1 tay) |
| Xác thực | **4 bước chạy song song** (thiết bị · mạng nội bộ · GPS · ca) — **hiện từng bước ngay khi bắt đầu** |
| Phản hồi rung | Rung ngay khi bấm · thành công 2 nhịp ngắn · lỗi 2 nhịp dài |
| Chấm công khi offline | Lưu lại trên máy, đồng bộ lại khi có mạng, đánh dấu `synced_offline`; **chặn** nếu offline quá 24h |
| GPS | Bán kính ≥ **150m**; độ chính xác GPS > 100m → vẫn cho chấm công, đánh dấu `low_gps_accuracy` |
| Cài đặt trên điện thoại | Chạy như ứng dụng độc lập (có biểu tượng riêng, mở thẳng màn hình chấm công, không hiện thanh địa chỉ) |

**Tiết kiệm:** ~4 chạm + tìm menu → **1 chạm, < 4 giây**.

> **Spec đầy đủ:** `docs/07-business-mobile-punch.md` · **Màn hình:** S05m

### C12. Nhắc việc theo từng actor — 17 sự kiện × 3 vai trò ⭐ P0

**Vấn đề:** nếu mọi thông báo đều về cho tất cả, người dùng sẽ tắt thông báo — và hệ thống chết.

**Yêu cầu cốt lõi:** mỗi sự kiện có **đúng một đích** (hoặc có quy tắc leo thang rõ ràng). Ma trận
17 sự kiện × 3 vai trò nằm ở **§C2 phía trên**.

**Cơ chế leo thang (không spam):**
- Nhân viên quên chấm công → nhắc nhân viên ngay
- Quá **3 ngày** → báo thêm **quản lý** (`escalate_after_days`)
- Đơn duyệt quá **2× SLA** → báo thêm **HR** (`escalate_to_hr_after_sla_multiplier`)
- Quản lý có nhiều việc cùng loại → **gom thành 1 notification** (3 nhân viên chưa chấm công → 1 cái)

**Ràng buộc:** 3 push/ngày (quản lý 5) · quiet hours 21:00–07:00 · dedupe 12h · khi vượt quota thì giữ
theo `priority_order = [overdue, sla_breach, soon, normal]`, phần còn lại vào email digest 08:00.

**Tuỳ chỉnh:** người dùng **tắt/bật được TẤT CẢ loại thông báo**, theo từng kênh (push / email) —
kể cả nhắc việc quá hạn và nhắc hạn duyệt (PO chốt 17/11/2026). Tắt thông báo **không** làm mất việc:
việc vẫn nằm trong trang "Cần làm" và vẫn tính vào badge.

**Tiết kiệm:** 4 việc phải tự nhớ → **0 việc phải nhớ**.

> **Spec đầy đủ:** §C2 phía trên · **Màn hình:** S04m

### C13. Loại nghỉ cấu hình được — HR tự thêm được, không cần nhờ IT ⭐ P0

**Vấn đề:** tài liệu yêu cầu *"các giới hạn được HR cấu hình trên hệ thống, không cố định trong phần mềm"*.
Loại nghỉ khác nhau chỉ khác **tham số**, không khác cấu trúc.

**Yêu cầu cốt lõi:** mô hình **3 tầng kế thừa**:

| Tầng | Nội dung | Lưu ở đâu |
|---|---|---|
| (1) Quy định mặc định chung toàn công ty | Tham số nền cho mọi loại nghỉ | Catalog tham số quy định |
| (2) Tham số riêng của từng loại nghỉ | Chỉ những tham số khác mặc định | `LeaveType.parameter_values` |
| (3) Ghi đè của một đơn cụ thể | Ghi đè cho riêng đơn đó | `LeaveRequest.override_values` |

**Ràng buộc cứng:**
- Tham số nằm trong **catalog có schema** — **không** dùng cấu trúc tự do.
- `parameter_values` chỉ chứa field **thực sự khác mặc định** → gộp 3 tầng không bị ghi đè nhầm.
- Đơn lưu **ảnh chụp `applied_parameters`** → đổi cấu hình sau không làm sai lịch sử báo cáo lương.
- Loại `accrual_rule = none` (ốm, thai sản, tang) **không trừ số dư phép năm** — nhưng vẫn ghi vào sổ phép.
- Có sẵn 5 loại chuẩn; **HR thêm loại mới không cần nhờ IT**.

**Tiết kiệm:** HR thêm loại nghỉ mới: phải nhờ IT sửa & triển khai → **1 form, hiệu lực ngay**.

> **Spec đầy đủ:** `docs/02-business-attendance-time-tracking.md` §2.3 · **Màn hình:** S30, S32

---

## 5. Các tính năng từng đề xuất — và vì sao rule thay thế tốt hơn

| Tính năng từng đề xuất | Thay bằng gì | Vì sao tốt hơn |
|---|---|---|
| **NL → đơn từ** | **Tự động điền từ log chấm công thật** (C-cố) | Hệ thống **đã biết** bạn check-in lúc 8:47 → đơn muộn 27 phút, ngày hôm qua. Chính xác hơn 100%, miễn phí, tức thì. |
| **Copilot duyệt đơn** | **Chip điều kiện quyết định** (C7) | Rule check quota/hạn nộp/trùng ngày/thiếu giấy tờ → hiện chip ✅/❌ cạnh đơn. Rõ ràng, miễn phí, không bao giờ sai. |
| **Gợi ý điểm OKR** | **Điểm đề xuất theo công thức** (@@C6@@) | Điểm suy ra từ tiến độ là **phép tính**, không phải suy luận. Công thức minh bạch, manager kiểm tra được. |
| **Check-in assist** | **Điền sẵn giá trị lần trước** | Nhân viên thấy đúng giá trị kỳ trước → sửa con số. 90% giá trị, tốn 0 chi phí suy luận. |
| **Phát hiện bất thường chấm công** | **Quy tắc kiểm tra trực tiếp** | Đếm theo mẫu hành vi (check-in đúng giờ 30 ngày liên tiếp, cùng IP khác thiết bị) → nhanh, miễn phí, giải thích được. |
| **Chatbot tra quy định** | **Command palette + trang quy định** (C3, C6) | Tìm bằng từ khóa trong nội dung đã lập chỉ mục → nhanh, chính xác, có ngày hiệu lực. |
| **Gợi ý soạn OKR** | **Gợi ý kế thừa từ OKR của quản lý** (§4.1) | Đọc đúng OKR đã duyệt của cấp trên → chính xác, miễn phí, tức thì. |
| **Tóm tắt báo cáo** | **Template câu chữ từ số liệu đã tính** (§4.2) | Không có nguy cơ bịa số liệu; luôn dẫn link về nguồn. |

**Kết luận:** toàn bộ nghiệp vụ là bài toán quy tắc. Quy tắc cho kết quả **tất định, truy vết được,
giải thích được** — đúng những gì cần cho dữ liệu đi thẳng vào bảng lương và đánh giá nhân sự.

> **Ghi chú để sau này:** nếu sau này cần thêm AI, đặt nó thành một **phân hệ riêng biệt** —
> không đụng vào các phân hệ chấm công / OKR — và **mọi** tính năng phải có **cơ chế quy tắc thay thế**
> để tắt đi thì hệ thống vẫn chạy hoàn chỉnh.


## 6. Checklist triển khai

> **Đủ 18/18.** Thứ tự dưới đây là thứ tự làm, không phải thứ tự ID.

- [ ] **C1**: Todo Inbox — gom mọi việc đang chờ từ các phân hệ, mỗi việc có 1 nút hành động, là trang mặc định sau đăng nhập
- [ ] **C2**: nhắc việc tự động — 3 kênh (push · email digest 08:00 · badge) + chính sách chống spam
- [ ] **C3**: Command Palette — chỉ mục tìm kiếm gộp mọi loại thực thể, cập nhật theo khi tạo/sửa, có phím tắt
- [ ] **C4**: sửa tại chỗ trong bảng công + bắt buộc lý do cho cột nhạy cảm + sửa hàng loạt + nút hoàn tác
- [ ] **C5**: bộ lọc chip đa chiều + `SavedView` + 6 view mặc định có sẵn + URL chia sẻ
- [ ] **C6**: Dry-run — hộp thoại "Xem trước ảnh hưởng" (tích hợp trong C10)
- [ ] **C6**: trang quy định tra cứu, **sinh từ cùng catalog với C10**, có ví dụ & ngày hiệu lực
- [ ] **C7**: duyệt hàng loạt + chip lý do + chip điều kiện quyết định + sắp xếp theo rủi ro
- [ ] **@@C6@@**: bảng so sánh review nhóm + điểm đề xuất theo công thức + cảnh báo rule
- [ ] **C10**: báo cáo tự động theo lịch — đặt lịch, người nhận, tham số lọc
- [ ] **C11**: import Excel (map cột → preview → validate → báo cáo lỗi)
- [ ] **C9**: onboarding tour + CTA cho mọi empty state
- [ ] **C10**: catalog 19 quy định + lịch sử phiên bản + rollback + xem trước ảnh hưởng + form cấu hình dùng chung (xem `docs/06-business-rule-builder.md`)
- [ ] **C11**: chấm công tối ưu cho điện thoại — nút Ø 112px, phản hồi rung, chấm công khi offline, 4 bước xác thực song song (xem `docs/07-business-mobile-punch.md`)
- [ ] **C12**: ma trận 17 sự kiện × 3 vai trò + leo thang (3 ngày → QL, 2× SLA → HR) + gom thông báo cho quản lý
- [ ] **C13**: catalog tham số loại nghỉ + 3 tầng kế thừa + ảnh chụp `applied_parameters` (xem `docs/02` §2.3)
- [ ] **C14**: gợi ý kế thừa — form Tạo OKR hiện OKR đã duyệt của quản lý trực tiếp (cùng nhóm), bấm 1 chạm để chép; NV sửa tùy ý
- [ ] **C15**: tóm tắt báo cáo dựng từ số liệu đã tính theo template câu chữ

**Đo lại:** trước khi nộp, đếm số thao tác thực tế cho từng dòng ở §1 của `PLAN.md` và ghi kết quả vào pitch.
