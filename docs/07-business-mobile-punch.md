# 09 — Thiết kế chấm công trên điện thoại

> **Nguyên tắc:** nhân viên chấm công **2 lần/ngày, trên điện thoại, khi đang đứng ở cửa văn phòng**.
> Đây là thao tác lặp lại nhiều nhất trong toàn hệ thống — và là thao tác mà người dùng **ghét nhất** nếu làm chậm.
> Mục tiêu: **1 chạm, < 3 giây, không cần tìm đâu đó.**

---

## 1. Ràng buộc thật của mobile

| Ràng buộc | Hệ quả thiết kế |
|---|---|
| Điện thoại thường bị khóa màn hình, đang cầm tay, có thể phải tay kia cầm túi | Nút phải **to**, ở **vị trí dễ chạm** (không phải góc trên cùng) |
| Mạng công ty Wi-Fi yếu / chập chờn ở tầng cao | Phải có **trạng thái pending** + tự retry, không báo lỗi ngay |
| GPS trong tòa nhà bị lệch 20–50m | Bán kính geofence ≥ 150m, và **hiện khoảng cách thật** chứ không chỉ "ngoài văn phòng" |
| 1 người có thể quên mở app | Nút chấm công phải **ở màn hình chính**, không sâu trong menu |
| Sáng/tối khác nhau, làm việc ngoài trời | Tương phản cao, nút lớn, trạng thái đọc được bằng mắt (không chỉ màu) |

---

## 2. Màn hình chấm công — thiết kế 1 chạm

### 2.1. Bố cục

```
┌─────────────────────────────────┐
│                                 │
│         09:41                   │  ← giờ lớn, tabular-nums
│   Thứ Tư, 12/11/2026            │
│                                 │
│  ● Trong văn phòng  ● Mạng OK   │  ← 3 trạng thái, luôn hiện
│                                 │
│         ╭───────────╮           │
│         │           │           │
│         │    VÀO    │           │  ← nút tròn Ø 112px, ngay giữa
│         │           │           │
│         ╰───────────╯           │
│                                 │
│    Ca 08:30 – 17:30             │
│    Hết giờ nghỉ 12:00–13:30     │
│                                 │
└─────────────────────────────────┘
```

**Quyết định cụ thể:**

| Yếu tố | Chọn | Vì sao |
|---|---|---|
| Vị trí nút | **Giữa màn hình, hơi dưới** | Vùng chạm tự nhiên của ngón cái khi cầm 1 tay |
| Kích thước | **Ø 112px** | ≥ 44px (Apple HIG) × 2.5 — tránh bấm nhầm khi đi nhanh |
| Nhãn | **"VÀO" / "RA"** | 1 từ, đọc được trong 0.3s, không phải "Check in" |
| Màu nút | Xanh đậm `#17604d` | Khác rõ nền, tương phản 6.4:1 (WCAG AA) |
| Khi đã chấm công | Nút đổi thành **"RA"** viền mờ + "Vào lúc 08:47" | Không bao giờ bấm nhầm 2 lần |
| Trạng thái chặn | Nút **chuyển màu đỏ + viền đậm** | Trạng thái đọc được bằng màu + hình, không chỉ màu |

### 2.2. Haptic feedback — thứ làm nó "cảm" như bấm nút thật

```javascript
navigator.vibrate?.(30);              // bấm: 30ms
navigator.vibrate?.([15, 40, 15]);     // thành công: 2 nhịp ngắn
navigator.vibrate?.([50, 60, 50]);     // lỗi: 2 nhịp dài
```

Không có haptic thì nút tròn 112px vẫn cảm giác "chạm vào hình", không phải "bấm nút".

### 2.3. Màn hình đang chờ (quan trọng ở nơi Wi-Fi yếu)

Khi bấm VÀO, hệ thống phải kiểm tra 4 thứ: thiết bị · mạng nội bộ · GPS · ca làm việc.
**Không được để nhân viên đứng đợi 5 giây không biết chuyện gì xảy ra.**

```
┌─────────────────────────────────┐
│                                 │
│            ◠                     │  ← spinner
│         Đang ghi nhận…          │
│                                 │
│    ✓ Thiết bị hợp lệ            │  ← từng bước hiện dần
│    ✓ Trong mạng công ty          │
│    ⠙ Đang xác thựnh vị trí…     │
│                                 │
└─────────────────────────────────┘
```

**Quy tắc:** hiển thị từng bước kiểm tra ngay khi bắt đầu, **không đợi xong mới hiện**. Nhân viên biết nó đang làm gì và mất bao lâu.

**Kết quả từng bước quyết định chấm được hay không — và đều là CHẶN, không phải cảnh báo:**

| Bước | Không đạt → hiện gì |
|---|---|
| Thiết bị | "Thiết bị này chưa được đăng ký" + nút [Đăng ký thiết bị] |
| Mạng nội bộ | "Bạn đang ngoài mạng công ty" + gợi ý nối Wi-Fi công ty |
| **GPS ngoài bán kính** | **Chặn** — hiện khoảng cách thật + bản đồ + đề xuất WFH |
| GPS không lấy được (> 2s) hoặc accuracy quá kém | **Chặn** — "Không xác định được vị trí" + nút [Thử lại] |
| Ca làm việc | Không có ca hôm nay → chặn, báo "Hôm nay bạn không có ca" |

> **Quyết định PO (16/11/2026):** ngoài mạng công ty → **chặn**. Ngoài bán kính GPS cấu hình → **chặn**.
> Không có đường vòng "chấm rồi HR xác minh sau" — vì như vậy là cho phép chấm từ nhà.
> **Ngoại lệ duy nhất: ngày WFH đã được duyệt** — ngày đó được chấm ngoài mạng và ngoài bán kính.

### 2.4. Offline — trường hợp mạng chết

Nhân viên vẫn phải vào được văn phòng dù Wi-Fi chết.

```
┌─────────────────────────────────┐
│  ⚠ Không có mạng công ty         │
│                                 │
│  Bạn có thể chấm công khi mạng  │
│  trở lại. Vị trí vẫn được ghi  │
│  nhận.                         │
│                                 │
│  [Chấm công &amp; ghi nhận offline]     │
│  [Hủy]                          │
└─────────────────────────────────┘
```

Cơ chế: lưu entry vào **IndexedDB** trên máy, đồng bộ lại khi có mạng, gắn cờ `synced_offline` để HR thấy.

**Quyết định PO (16/11/2026):**
- Offline **được phép**, và **cấu hình được** trong rule `attendance_security`.
- Mặc định: **24 giờ**. HR đổi được (min 1h, max 72h).
- Quá hạn → entry bị **từ chối** khi đồng bộ, nhân viên phải tạo đơn bổ sung công.

> **Vì sao vẫn cho offline dù đã chặn ngoài mạng:** mất mạng là sự cố kỹ thuật, không phải nhân viên
> trốn chấm công. Nhưng cửa sổ offline phải ngắn — đủ để Wi-Fi công ty chập chờn, không đủ để chấm hộ
> người khác từ xa nhiều ngày.

---

## 3. PWA — phải "cài được" và mở ra là thấy

| Yếu tố | Yêu cầu |
|---|---|
| Manifest | `display: standalone`, `theme_color: #17604d`, icon 192 + 512, `orientation: portrait` |
| Service worker | Cache app shell (HTML/CSS/JS) để mở được offline |
| iOS | `apple-mobile-web-app-capable`, `apple-touch-icon` 180×180, `viewport-fit=cover` |
| Safe area | `env(safe-area-inset-*)` — tránh notch và thanh home indicator |
| Install prompt | Hiện nút **"Thêm vào màn hình chính"** sau khi dùng 2 lần (không hỏi ngay lúc mới vào — gây khó chịu) |
| Haptic | `navigator.vibrate` |

**Sau khi cài PWA, mở app = thẳng màn hình chấm công**, không qua splash/đăng nhập lại (JWT lưu trong localStorage, refresh token trong httpOnly cookie).

---

## 4. Xác thực vị trí — hiển thị khoảng cách thật

Thay vì báo chung chung "ngoài văn phòng", hiện **khoảng cách cụ thể** và vị trí trên bản đồ:

```
┌─────────────────────────────────┐
│ ⚠ Ngoài bán kính văn phòng      │
│                                 │
│   Vị trí của bạn:  1,2 km       │
│   Bán kính cho phép: 150 m       │
│                                 │
│   [Bản đồ: vòng tròn + marker]  │
│                                 │
│   Đề xuất:                      │
│   [Đăng ký WFH hôm nay]         │
│   [Thử lại]                      │
└─────────────────────────────────┘
```

**Quy tắc bán kính:** mặc định **150m** — cấu hình được trong rule `attendance_security` (min 50m, max 5000m).
Nhỏ hơn thì báo sai trong tòa nhà (GPS lệch 20–50m); lớn hơn thì mất tác dụng chống gian lận.

**Ngoài bán kính → CHẶN** (quyết định PO). Màn hình không chỉ báo lỗi mà cho người dùng 2 lối ra hợp lệ:
[Đăng ký WFH hôm nay] (nếu vị trí của bạn được phép WFH) hoặc [Thử lại] (nếu GPS vừa lệch tạm thời).

**Về độ chính xác GPS:** nếu `accuracy > 100m`, vị trí **không đủ tin cậy để xác nhận** → coi như
không xác định được vị trí và **chặn**, kèm hướng dẫn *"Đứng gần cửa sổ hoặc ra ngoài trời rồi thử lại"*.
Không cho chấm kèm cờ `low_gps_accuracy` — vì như vậy là mở đường vòng qua kiểm tra vị trí.

> **Đánh đổi đã chấp nhận:** trong tòa nhà GPS có thể lệch 20–50m → bán kính 150m đủ rộng để không chặn nhầm.
> Nếu thực tế vẫn chặn nhầm, HR **tăng bán kính** trong rule — không sửa code.

---

## 5. Thao tác 1 chạm — đường đi ngắn nhất tới kết quả

| Bước | Thao tác của nhân viên | Thời gian |
|---|---|---|
| 1 | Mở app (từ home screen) | 1.0s |
| 2 | Bấm nút VÀO | 0.3s |
| 3 | Xác thực tự động (4 bước song song) | 1.5–2.5s |
| 4 | Xanh + haptic + toast "Đã chấm công lúc 09:41" | — |

**Tổng: < 4 giây, 1 cú bấm thật.**

### Những gì phải KHÔNG có trên màn hình này

- ❌ Không có form (không chọn ca, không chọn giờ — hệ thống tự biết)
- ❌ Không có "Xác nhận" thêm 1 nút (bấm VÀO là xong)
- ❌ Không có menu, không có tab bar ở màn hình này
- ❌ Không hiện danh sách 30 ngày chấm công (chuyển sang màn hình riêng khi cần)
- ❌ Không hiện cảnh báo dài dòng ở trạng thái bình thường — chỉ hiện khi có vấn đề

> **Nguyên tắc:** màn hình chấm công chỉ có **2 thông tin** (giờ + trạng thái xác thực) và **1 nút**. Mọi thứ khác ở màn hình khác.

---

## 6. Trạng thái ngày làm việc — công khai trước khi bấm

Nhân viên cần biết hôm nay ca gì, đã chấm công chưa, còn thiếu gì — mà không phải đợi tới lúc bấm mới biết.

```
┌─────────────────────────────────┐
│  Hôm nay                        │
│                                 │
│  ✓ Vào   08:47                 │
│  ○ Ra    chưa chấm              │
│                                 │
│  Ca: Hỗ trợ CSKH · 08:30–17:30 │
│  Hết giờ nghỉ trưa 12:00–13:30 │
│                                 │
│  [Bấm để xem tháng]             │
└─────────────────────────────────┘
```

---

## 7. Accessibility — nút lớn cũng phải dùng được

| Yêu cầu | Cách làm |
|---|---|
| Đọc bằng màn hình đọc | `aria-label` mô tả đầy đủ: *"Chấm công vào, ca 08:30 đến 17:30, đã xác thực vị trí trong văn phòng"* |
| Vùng chạm | Ø 112px — vượt xa chuẩn 44px |
| Tương phản | ≥ 4.5:1 cho chữ, ≥ 3:1 cho viền nút |
| Không chỉ dựa vào màu | Mỗi trạng thái có **ký hiệu + chữ** (✓ / ⚠ / ✕), không chỉ màu xanh–đỏ |
| Tăng cỡ chữ | Dùng `rem` cho toàn bộ màn hình, hỗ trợ browser zoom 200% |
| Không rung nếu tắt | Tôn trọng `prefers-reduced-motion` |

---

## 8. Acceptance criteria

- [ ] Mở app → màn hình chấm công hiện ngay (không qua menu)
- [ ] Bấm nút 1 lần → ghi nhận thành công trong < 4 giây, có haptic
- [ ] Nút đủ lớn để bấm bằng 1 tay, không bấm nhầm khi đi nhanh
- [ ] Mỗi bước kiểm tra hiện **ngay khi bắt đầu**, không đợi xong mới hiện
- [ ] Mất mạng → vẫn chấm công được offline, đồng bộ lại sau, có cờ cho HR; quá hạn offline (mặc định 24h) → bị từ chối khi đồng bộ
- [ ] **Ngoài mạng công ty → BỊ CHẶN**, hiện gợi ý nối Wi-Fi công ty (trừ ngày WFH đã duyệt)
- [ ] **Ngoài bán kính GPS → BỊ CHẶN**, hiện khoảng cách thật + bản đồ + 2 lối ra (WFH / Thử lại)
- [ ] **GPS không lấy được hoặc accuracy > 100m → BỊ CHẶN** kèm hướng dẫn đứng gần cửa sổ
- [ ] Ngày WFH đã duyệt → chấm được ngoài mạng và ngoài bán kính (ngoại lệ duy nhất)
- [ ] Bán kính và hạn offline đổi được trong rule `attendance_security`, không sửa code
- [ ] Bấm 2 lần liên tiếp → nút đổi trạng thái, không tạo 2 entry
- [ ] Màn hình chỉ có 2 thông tin + 1 nút, không có form nào
- [ ] PWA cài được, mở ra thẳng màn hình chấm công, có safe-area + haptic
- [ ] Đọc bằng màn hình đọc nghe được đủ thông tin; trạng thái không chỉ phân biệt bằng màu
- [ ] Chạy được trên iPhone Safari và Android Chrome ở kích thước 375px
