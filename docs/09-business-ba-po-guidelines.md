# 10 — Tài liệu tính năng cho BA & PO

> **Đọc tài liệu này để biết hệ thống làm gì và vì sao.**
> Tài liệu cho dev (`docs/01`–`docs/09`) nằm ở chỗ khác — bản này không có tên hàm, không có cấu trúc bảng.
>
> **Cách dùng:** BA đọc phần 1–5 để hiểu nghiệp vụ. PO đọc phần 6 (backlog) + phần 7 (câu hỏi cần chốt).
> Khi có thay đổi, sửa **bảng ở phần 3 và phần 4** — đó là 2 bảng duy nhất cần cập nhật khi đổi nghiệp vụ.

---

## 1. Bài toán là gì

Công ty đang quản lý nhân sự bằng **file Excel + portal**. Hai hệ thống rời rạc, mỗi cái một vấn đề:

| Vấn đề hiện tại | Hệ quả |
|---|---|
| Chấm công tính tay trên Excel | Sai số, mất thời gian, không ai chịu trách nhiệm khi sửa |
| Đơn nghỉ/đi muộn nằm rải rác ở nhiều nơi | Nhân viên không biết đơn của mình ở đâu, quản lý không biết cần duyệt gì |
| OKR chạy bằng file chia sẻ | Không ai thấy mục tiêu chung của công ty, đánh giá cuối năm tốn hàng tuần |
| Quy định (quota, hạn nộp, luật phép) nằm trong đầu HR | HR trả lời cùng 1 câu hỏi 20 lần/ngày |

**Hệ thống mới** gộp 2 việc: **chấm công + đơn từ** (bài toán 1) và **OKR** (bài toán 2), trên **1 tài khoản chung**.

> **Điểm khác biệt cốt lõi so với phần mềm HR bán trên thị trường:**
> **Mọi quy định đều là dữ liệu cấu hình, không nằm trong code.** HR đổi quota đi muộn, đổi giờ làm việc,
> đổi luật phép tồn — bằng form, có ngày hiệu lực, có lịch sử, **rollback được**.
> Không phải sửa code rồi deploy.

---

## 2. Ai dùng, dùng để làm gì

| Vai trò | Dùng hệ thống để làm gì | Tần suất |
|---|---|---|
| **Nhân viên** | Chấm công (vào/ra), gửi đơn, xem số phép còn lại, viết & tự đánh giá OKR | **2 lần/ngày** + theo kỳ |
| **Trưởng nhóm / Quản lý** | Duyệt đơn, xem lịch nhóm, review OKR của nhóm | 1–2 lần/ngày |
| **HR** | Cấu hình ca/luật, duyệt đơn chế độ, tổng hợp bảng công, tổng hợp OKR, đánh giá cuối năm | Hằng ngày + theo tháng |
| **Ban điều hành** | Xem bảng tổng hợp OKR công ty | 1 lần/quý |

### 3 nguyên tắc thiết kế đã chốt

1. **Không phải đi làm thêm** — mọi thứ phải *ít thao tác hơn* hiện tại, không phải thêm chức năng.
2. **Mặc định hợp lý** — người dùng không phải chọn gì hết thì hệ thống vẫn chạy đúng.
3. **Không có bằng chứng sai** — mọi thay đổi dữ liệu công/điểm đều có ai-sửa-gì-lúc-nào.

---

## 3. Hành trình người dùng — Bài toán 1: Chấm công & đơn từ

### 3.1. Nhân viên chấm công (quan trọng nhất — 2 lần/ngày)

```
Mở app  →  thấy ngay nút lớn VÀO/RA + trạng thái hôm nay
        →  bấm 1 chạm
        →  hệ thống tự kiểm tra 4 thứ song song:
              thiết bị đã đăng ký · trong mạng công ty · trong bán kính văn phòng · đúng ca
        →  hiện kết quả từng bước (không đợi xong mới hiện)
        →  xanh + rung máy + thông báo
```

**Điểm cần giữ khi làm UI:**
- Màn hình này **chỉ có 2 thông tin** (giờ + trạng thái) và **1 nút**. Không form, không chọn ca.
- Mỗi bước kiểm tra **hiện ngay khi bắt đầu**, không đợi xong — để người dùng không tưởng treo.
- Nút phải **vừa tay** (112px) — nhân viên đi bộ, cầm túi, một tay.

**4 lớp kiểm tra — không đạt lớp nào là CHẶN, không phải cảnh báo:**

| Lớp | Quy tắc | Không đạt → |
|---|---|---|
| Thiết bị | Phải là máy đã đăng ký. **Hạn mức 1 máy, không ngoại lệ** | Chặn + nút [Đăng ký thiết bị] (chờ HR duyệt) |
| Mạng nội bộ | Phải trong Wi-Fi/IP công ty | **Chặn** + gợi ý nối Wi-Fi công ty |
| GPS | Phải trong **bán kính 150m** (cấu hình được 50–5000m) | **Chặn** + khoảng cách thật + bản đồ + [Đăng ký WFH] / [Thử lại] |
| GPS tin cậy | Sai số ≤ 100m (cấu hình được) | **Chặn** + "Đứng gần cửa sổ rồi thử lại" |

- **Ngoại lệ duy nhất:** ngày **WFH đã duyệt** → được chấm ngoài mạng và ngoài bán kính.
- **Mất mạng → vẫn chấm được offline.** Đồng bộ lại khi có mạng. **Hạn offline mặc định 24 giờ** (cấu hình 1–72 giờ); quá hạn → entry bị từ chối, phải tạo đơn bổ sung công.
- **Đơn từ KHÔNG cần GPS, KHÔNG cần mạng công ty.** Chỉ chấm công mới cần — vì đơn được duyệt bởi con người, còn chấm công là tự động ghi nhận.

### 3.2. Nhân viên gửi đơn

| Loại đơn | Khi nào | Điều kiện phải đạt |
|---|---|---|
| **Đi muộn / về sớm** | Đến muộn hoặc về sớm | Tối đa **2 lần/tháng**, mỗi lần **≤ 60 phút** · đăng ký **trước 08:00** ngày cần · **bắt buộc nhập số phút** |
| **Bổ sung chấm công** | Quên chấm công | Tối đa **5 lần/tháng** · hạn nộp **3 ngày** kể từ ngày quên chấm · **bắt buộc nhập lý do** |
| **Nghỉ phép** | Nghỉ các loại | Đủ số dư phép · hạn đăng ký **3 ngày** · loại ốm **bắt buộc đính kèm giấy khám** |
| **Làm việc tại nhà (WFH)** | WFH | Tối đa **2 ngày/tuần** · **chặn ngày remote thứ 3** trong tuần · mỗi đơn **≥ 0,5 ngày** |

**3 chi tiết dễ làm hỏng nghiệp vụ (đã xác nhận với file của công ty):**

1. **Hạn 3 ngày là ngày LỊCH, và so với giờ cần bổ sung** — không phải 23:59.
   *"Cần bổ sung giờ check-in là 08:00 **thứ Sáu** → hạn đăng ký là trước **08:00 thứ Hai tuần sau**."*
   → Đăng ký lúc 09:00 thứ Sáu cho ngày cần 08:00 = **đã trễ**.
2. **Nút SUBMIT, không phải Save.** Bấm "Lưu nháp" → đơn ở trạng thái nháp: **không tính quota, không hiện cho quản lý**. Chỉ bấm "Gửi" mới tính quota và vào hộp thư duyệt.
3. **Không chấm công = không tính công.** Người quên chấm và không tạo đơn trong hạn → 0 công cho ngày đó.

### 3.3. Quản lý duyệt đơn

```
Hộp thư duyệt: 12 đơn chờ → lọc/quét chip điều kiện → duyệt hàng loạt
Mỗi đơn hiện chip kết quả kiểm tra: ✅ Trong quota · ✅ Trong giờ hạn nộp · ❌ Vượt 60 phút/lần
Từ chối → BẮT BUỘC chọn lý do (nút 1 chạm từ chip phổ biến)
```

**Luồng duyệt** (không phải một luồng chung cho tất cả):

| Nhóm | Luồng |
|---|---|
| Hầu hết các nhóm | **Quản lý trực tiếp** duyệt → xong. Người gửi **rút được đơn** nếu quản lý chưa duyệt |
| **CA** | **Trưởng nhóm** duyệt → **HR** duyệt |
| **Mobile** | **Trưởng nhóm** duyệt → **HR** duyệt |

> **Điểm cấu hình quan trọng:** luồng gắn với **nhóm**, không gắn với tên người.
> Đổi trưởng nhóm = đổi người duyệt, HR tự cấu hình được, **không sửa code**.

### 3.4. HR tổng hợp bảng công & chốt

```
Bảng công tháng: **53 cột** = 5 thông tin + 31 cột ngày + 17 cột tổng hợp (đúng file HR đang dùng)
Mỗi ô ngày dùng KÝ HIỆU GỐC của công ty: R (WFH) · AL (phép) · S (ốm) · 1.00 · 0.50 · R/0.50 …
17 cột tổng hợp tự tính theo đúng công thức trong file gốc (`AY=AM`, `AZ=SUM(AN,AO,AP,AQ,AS)`, `BA=sum(AR,AT,AU,AV)`)
HR sửa ô sai → click vào ô, sửa tại chỗ, có audit log, cột tổng hợp tự tính lại
Nhân viên xem bảng công của mình → **chọn tháng** (mặc định = tháng hiện tại)
HR **công bố bảng công giữa kỳ** (ngày 11) → mở cửa sổ khiếu nại 2 ngày (đến 13/11)
HR chốt & khóa → **kỳ đã khóa là bản cuối cùng**: đơn nhắm kỳ đó bị chặn từ lúc tạo, đơn đang chờ tự hủy. Không có điều chỉnh sau khóa.
```

> **Vì sao công bố giữa kỳ chứ không đợi cuối tháng:** nếu đợi 01/12 mới công bố thì lỗi chấm công
> ngày 05/11 phải chờ gần một tháng mới biết. Công bố ngày 11 → lỗi đầu tháng được khiếu nại
> ngay, HR xử lý trong 2 ngày. Cả 3 mốc (`publish_day`, `dispute_window_days`, `lock_delay_days`)
> đều cấu hình được trong rule `payroll_period`.

**Vì sao quan trọng:** bảng xuất ra **giống hệt** file HR đang dùng hàng tháng → HR không phải map tay.

### 3.5. 8 loại nghỉ

| Mã | Tên | Ghi chú |
|---|---|---|
| **NL** | Nghỉ lễ tết | Theo lịch nhà nước |
| **AL** | Nghỉ phép | Hạn 3 ngày · trừ phép năm |
| **S** | Nghỉ ốm | Hạn 3 ngày · **bắt buộc giấy khám** |
| **RO** | Nghỉ bù | Ngày làm bù cho ngày lễ |
| **CL** | Nghỉ riêng hưởng nguyên lương | |
| **ML** | Nghỉ thai sản | 6 hoặc 7 tháng tùy con thứ nhất |
| **PL** | Nghỉ riêng khi có vợ sinh | 5 · 7 · 10 · 14 ngày… |
| **UP** | Nghỉ không lương | Nghỉ trong thời gian thử việc · hết ngày phép |

**Mỗi loại đều cấu hình được**: hạn đăng ký · cần giấy tờ · giới hạn số ngày · có trừ phép năm không · số ngày cộng mỗi năm.
**HR thêm loại mới được mà không sửa code.**

### 3.6. Quy tắc phép (đã chốt với công ty)

```
Phép năm:      12 ngày/năm, cộng 1 ngày vào ngày 15 hàng tháng
Phép chức vụ:  Manager +3/năm  →  tổng 15 ngày/năm
Phép thâm niên: +1 ngày mỗi 2 năm, cộng đúng ngày tròn thâm niên
Phép thử việc:  2 ngày cho 2 tháng thử việc, cộng vào khi thành chính thức
Phép tồn:      trước 01/04 mang toàn bộ sang năm sau
               trước 01/07 chỉ giữ 5 ngày
               từ 01/07 tồn = 0
```

**Ngày vào làm ảnh hưởng tới lần cộng phép đầu tiên:**

| Ngày vào làm | Tháng vào | Kỳ cộng đầu tiên |
|---|---|---|
| 01/11/2026 (≤ 15) | được cộng 1 ngày | 15/11/2026 |
| **20/11/2026 (> 15)** | **không cộng** | **15/12/2026** |

> Quy tắc là **hoãn 1 kỳ cộng**, không phải mất đi 1 ngày phép.
> Tham số `leave_accrual.join_cutoff_day` (mặc định 15) — HR đổi được.

**Trang số dư phép** hiển thị card cho từng nguồn cộng (phép năm · phép tồn · **phép thâm niên** ·
**phép ốm** · phép chức vụ) kèm **note ngắn cách cộng phép** — để nhân viên tự hiểu, không phải hỏi HR.

---

## 4. Hành trình người dùng — Bài toán 2: OKR

### 4.1. Cấu trúc OKR (theo form đánh giá của công ty)

```
┌─ BOX 1 ─ Thông tin cá nhân (tự điền) ──────────────────┐
│ Họ tên · Mã NV · Chức danh · Band · Quản lý · Nhóm       │
└──────────────────────────────────────────────────────────┘
┌─ BOX 2 ─ Business ─────────────────────────────────────┐
│ Đầu việc TỰ DO — không giới hạn số lượng, không hạn chế  │
│ số chữ                                                 │
└──────────────────────────────────────────────────────────┘
┌─ BOX 3 ─ People ───────────────────────────────────────┐
│ Đầu việc TỰ DO — như trên                                 │
└──────────────────────────────────────────────────────────┘
┌─ BOX 4 ─ Self proposal next year ──────────────────────┐
│ Nhân viên tự đề xuất OKR năm tới + điểm cần cải thiện   │
│ → card riêng trên "OKR của tôi", có trạng thái           │
└──────────────────────────────────────────────────────────┘
      → Phần mềm TỰ TÍNH điểm trung bình (Business + People)
```

> **Đính kèm file không nằm ở lúc tạo OKR.** Lúc tạo chỉ viết chữ; file làm **evidence hoặc
> chi tiết bổ sung** đính kèm ở **check-in giữa kỳ / cuối kỳ** và ở **bản chấm**.

**3 quy tắc chấm điểm:**

| | |
|---|---|
| **Chấm ở tầng nhóm** | Mỗi nhóm (Business / People) chấm **1 điểm trên thang 1–5** |
| **Không có điểm lẻ** | Chỉ 1 · 2 · 3 · 4 · 5. Không nhận 2.5, không nhận 0 |
| **Điểm TB do máy tính** | (Business + People) ÷ 2 — không có ô nhập tay |
| **Xếp loại** | A ≥ 4.5 · B ≥ 3.5 · C ≥ 2.5 · D < 2.5 (HR đổi được ngưỡng) |

> **Vì sao chấm ở tầng nhóm, không chấm từng đầu việc:** nếu nhóm có 3 đầu việc thì chấm **1 điểm cho cả nhóm** —
> đánh giá tổng thể thành tựu của nhóm đó. Đây là điểm khác biệt lớn so với mô hình KR có trọng số.

### 4.2. Phân bổ 20% / 80%

| Phần | Ai đặt | Nhân viên làm gì |
|---|---|---|
| **Company Objectives — 20%** | Ban điều hành công bố | **Copy xuống** nếu thấy liên quan — hoặc bỏ qua. Không bắt buộc. |
| **Individual Objectives — 80%** | Nhân viên | Tự khai hoàn toàn |

**Kế thừa mang tính tham khảo:** objective business của **quản lý** hiện trong form Tạo OKR dưới dạng **gợi ý có sẵn** — bấm 1 chạm để chép vào, hoặc bỏ qua và tự viết. Nhân viên **được thêm, bớt, sửa** tùy ý.

**Điểm TB chỉ tính phần cá nhân 80%** — gồm Business + People. Phần 20% mục tiêu công ty **không** tham gia điểm trung bình (PO chốt 17/11/2026).

> **Không có "cây phân tầng OKR".** Lý do: Company objective là *copy* chứ không phải liên kết đa tầng → không có cây để vẽ.
> Cấp trên của một nhân viên là **quản lý trực tiếp** — lấy từ cấu trúc nhóm, không cần màn hình riêng.
> Người dùng chỉ cần biết *"việc của tôi đang chờ ai"* — đã có ở hộp thư duyệt và trang "Cần làm".

### 4.3. Timeline & quy trình đánh giá

```
Q1 (Jan–Mar)      SETUP       NV tự set OKR → QL duyệt
Mar–Apr            CHECK-IN    NV cập nhật tiến độ (hàng tháng)
Jun–Jul            REVIEW      QL nhận xét + điều chỉnh mục tiêu (coaching)
Nov–Dec            ASSESSMENT  Đánh giá cuối năm — 5 bước
```

**Vòng đời chỉnh sửa — nộp là khoá, review là mở lại:**

```
draft ──nộp──▶ submitted ──QL duyệt──▶ locked
                     │                      │
                     │ (giữa kỳ)            │ (cuối kỳ)
                     ▼                      ▼
                reopened  ──nộp lại──▶ locked
                     ▲
                     │ QL bấm "Mở cho nhân viên sửa" (đang review)
```

- **Setup**: NV nộp → QL duyệt → **khoá**, không ai sửa được nữa.
- **Giữa kỳ & cuối kỳ**: QL bấm **"Mở cho nhân viên sửa"** → NV sửa/bổ sung → nộp lại → **khoá**.
- **Xoá mục** → vẫn **lưu vết** (gạch ngang + "đã xoá") và **bắt buộc có lý do**; điểm chỉ tính mục chưa bị xoá.

**Quy trình đánh giá cuối năm — 5 bước, mỗi bước có hạn chót riêng:**

| Bước | Ai | Việc | Hạn |
|---|---|---|---|
| 1 | Nhân viên | Tự đánh giá (4 box) | 3–5 ngày |
| 2 | Quản lý trực tiếp | Đánh giá lại (chấm 1–5) | 5 ngày |
| 3 | HR | Thu thập toàn bộ → bảng tổng hợp chung | Theo cấu hình |
| 4 | Giám đốc | Đánh giá chung vào bảng tổng hợp | Theo cấu hình |
| 5 | HR | Bàn giao bảng tổng hợp OKR công ty + export Excel | Theo cấu hình |

**Bảng tổng hợp HR — 9 trường** (đúng mẫu file HR):
họ và tên · mã NV · vị trí · **thời gian công tác** (tự tính từ ngày vào làm) · nhóm · tên quản lý ·
điểm công việc · điểm con người · điểm trung bình (+ note).

### 4.4. Quyền xem

| Vai trò | Xem | Sửa |
|---|---|---|
| Nhân viên | OKR của **chính mình** | OKR của mình |
| Quản lý | OKR của **toàn bộ nhóm mình quản lý** | OKR của cả nhóm |
| HR (Giám đốc phần mềm) | OKR của **nhóm phát triển phần mềm** | như vậy |
| Ban điều hành (Giám đốc quản lý Công nghệ) | **Toàn công ty ACT** | toàn công ty |

### 4.5. 3 trường hợp đặc biệt

| Tình huống | Xử lý |
|---|---|
| **Chuyển nhóm / đổi quản lý giữa năm** | Chụp người đánh giá lúc gửi → giữ nguyên. Có thể đổi kèm lý do, có vết. |
| **Nhân viên mới vào giữa năm** | Tạo OKR cho phần còn lại, **mục tiêu tự scale** theo thời gian còn lại, có nhãn "điều chỉnh". Cột "thời gian công tác" tính đúng phần thực tế. |
| **Nghỉ việc trước kỳ đánh giá** | Ẩn khỏi báo cáo xếp loại, **không tính** vào phân bố điểm, nhưng **giữ lịch sử**. |

---

## 5. 15 tính năng tiện lợi (C1–C15)

> **Đây là bảng duy nhất cần cập nhật khi thêm/bớt tính năng.**
> Mỗi tính năng gắn với 1 màn hình trong `mockups/index.html` để team review.

| ID | Tính năng | Ai dùng | Màn hình | Ưu tiên |
|---|---|---|---|---|
| **C1** | **Todo inbox** — 1 màn hình gom mọi việc đang chờ, xếp theo mức độ ưu tiên | NV, QL | S02 | P0 |
| **C2** | **Nhắc việc tự động** — 3 kênh (push · email 8h · badge), chống spam | Tất cả | S04 | P0 |
| **C3** | **Command palette Ctrl+K** — tìm mọi thứ trong 1 ô | Tất cả | S03 | P0 |
| **C4** | **Sửa thẳng ô sai trong bảng công** — click vào ô sửa, có audit, bắt buộc lý do với cột nhạy cảm | HR | S15 | P0 |
| **C5** | **Bộ lọc đa chiều + lưu view** — lọc chip, lưu & chia sẻ bằng URL | HR, QL | S15 | P0 |
| **C6** | **Trang quy định tra cứu** — nhân viên tự tra, sinh tự động từ cùng nguồn với form cấu hình | Tất cả | S19 | P0 |
| **C7** | **Duyệt hàng loạt + chip lý do + chip điều kiện** | QL | S12, S14 | P1 |
| **C8** | **Review OKR bảng so sánh cả nhóm** + điểm đề xuất theo công thức | QL | S24 | P1 |
| **C9** | **Onboarding tour + mọi empty state có CTA** — không màn hình nào trống chết | Tất cả | S36 | P2 |
| **C10** | **Trình cấu hình quy định** — HR sửa quota/luật bằng form, có versioning + rollback + **confirm khi lưu** | HR | S16, S17, S32 | P0 |
| **C11** | **Chấm công tối ưu điện thoại** — 1 chạm < 4s, haptic, offline | NV | S05m | P0 |
| **C12** | **Nhắc việc theo từng actor** — 17 sự kiện × 3 vai trò, đúng người, chống spam | Tất cả | S04m | P0 |
| **C13** | **Loại nghỉ cấu hình được** — thêm/sửa loại mà không sửa code (3 tầng kế thừa) | HR | S30, S32 | P0 |
| **C14** | **Gợi ý kế thừa từ OKR quản lý** — bấm 1 chạm chép mục tiêu đã duyệt của quản lý | NV | S21 | P0 |
| **C15** | **Tóm tắt báo cáo OKR** — dựng từ số liệu đã tính, kèm link tới nguồn | HR | S25 | P0 |

> **Ngoài 15 mục này** còn "C-cố" — tự động điền đơn đi muộn từ log chấm công thật (S07).
> Không thuộc hệ thống đánh số C1–C15.

### 19 quy định cấu hình được (không hard-code)

HR đổi tất cả bằng form, có ngày hiệu lực + rollback:

| Nhóm | Quy định |
|---|---|
| **Đơn từ** | Đi muộn/về sớm · Bổ sung chấm công · WFH · Nhóm cần HR duyệt thêm · Luồng duyệt đơn |
| **Chấm công** | Kiểm tra khi chấm công · Chống dùng chung tài khoản · Giờ làm việc · Ca & bộ gán ca · Đi muộn không có đơn · Kỳ công & khiếu nại |
| **Nghỉ phép** | Mặc định chung mọi loại · Thời hạn & điều kiện xin nghỉ · Cách cộng phép · Phép thâm niên · Phép theo chức vụ · Phép tồn |
| **Khác** | Chính sách nhắc việc · Cách đánh giá OKR |

---

## 6. Backlog theo ưu tiên

### P0 — Bắt buộc có (đây là bản nộp)

| # | Hạng mục | Màn hình |
|---|---|---|
| 1 | Chấm công trên điện thoại (1 chạm, haptic, offline) | S05m, S05 |
| 2 | Đăng nhập + 4 vai trò + phân quyền theo nhóm | S01 |
| 3 | Đơn từ 4 loại + quota chặn server + 2 trạng thái nháp/gửi | S07–S10, S31 |
| 4 | Luồng duyệt theo nhóm (trưởng nhóm → HR) + rút đơn | S12, S13, S14 |
| 5 | Bảng công 53 cột + ký hiệu gốc + sửa tại chỗ + chốt & khóa | S15 |
| 6 | 8 loại nghỉ cấu hình được + số dư tự tính + luật phép tồn | S30, S32, S34 |
| 7 | Trình cấu hình quy định (form + versioning + rollback + confirm khi lưu + lịch sử thay đổi) | S16, S17 |
| 8 | Todo inbox + nhắc việc theo actor + command palette | S02, S03, S04, S04m |
| 9 | OKR: 2 nhóm, thang 1–5, form 4 box, quy trình 5 bước, bảng tổng hợp 9 trường + cột Trạng thái | S20–S25, S42–S44 |
| 10 | Quản lý nhân viên + cây quản lý (thấy ai duyệt cho ai) | S40, S41 |

### P1 — Nên có
C7 duyệt hàng loạt (đã có UI, cần nối API) · @@C6@@ bảng so sánh review OKR

### P2 — Có thì tốt, không có cũng nộp
C10 báo cáo tự động · C11 import Excel · C9 onboarding tour

> **Thứ tự cắt nếu trượt tiến độ:** bỏ C9 → C11 → C10 → @@C6@@ → C7.
> **Không bao giờ cắt:** bảng công + chốt & khóa · 4 loại đơn từ · trình cấu hình quy định · todo inbox · OKR 2 nhóm 1–5.

---

## 7. Quyết định PO — đã chốt toàn bộ

> **Cập nhật 17/11/2026: tất cả câu hỏi đã có đáp án.** Không còn điểm nào chờ quyết định.

| # | Vấn đề | Quyết định | Ghi chú triển khai |
|---|---|---|---|
| 1 | **Chấm công ngoài mạng công ty** | **CHẶN** | Ngoại lệ duy nhất: ngày WFH đã duyệt. Không có "chấm rồi HR xác minh sau". |
| 2 | **GPS ngoài bán kính cho phép** | **CHẶN** | Bán kính mặc định **150m** (cấu hình 50–5000m). Sai số GPS > 100m cũng chặn. |
| 3 | **Chấm công offline** | **Cho phép, cấu hình được** — mặc định **24 giờ** | Hạn chỉnh 1–72 giờ. Quá hạn → entry bị từ chối khi đồng bộ. |
| 4 | **Đăng ký thiết bị thứ 3** | **Không ngoại lệ** | **Mặc định 2 máy.** Máy thứ 3 phải gửi yêu cầu kèm lý do → HR duyệt. |
| 5 | **Đơn từ có cần GPS/mạng công ty không** | **KHÔNG** | Chỉ chấm công mới cần. Đơn gửi từ đâu cũng được — người duyệt quyết định. |
| 6 | **OKR: nhóm Business/People cố định** | **Bỏ** — nhân viên tự khai hoàn toàn | Cấu trúc cấp trên chỉ mang tính **tham khảo** (gợi ý để chép, không bắt buộc). |
| 7 | **Cây phân tầng OKR** | **Không làm màn hình riêng** | Người dùng chỉ cần biết *ai duyệt mình* — đã có ở hộp thư duyệt + "Cần làm". |
| 8 | **Phần 20% mục tiêu công ty** | **KHÔNG tính vào điểm TB** | Điểm TB chỉ = (Business + People) ÷ 2 của phần cá nhân 80%. |
| 9 | **Xếp loại A/B/C/D có dùng cho lương?** | **Không** — hệ thống không quản lý lương | Xếp loại chỉ để hiển thị/báo cáo; HR đổi ngưỡng tùy ý, không ảnh hưởng dữ liệu lương. |
| 10 | **Bảng công đã khóa** | **Không có điều chỉnh sau khóa** | Kỳ đã chốt là bản cuối cùng: đơn nhắm kỳ đó **chặn khi tạo**, đơn đang chờ **tự hủy**. Bỏ model điều chỉnh. |
| 11 | **Thông báo** | **Tắt/bật được TẤT CẢ loại** | Kể cả nhắc việc quá hạn và nhắc hạn duyệt. Tắt không làm mất việc — vẫn nằm trong "Cần làm". |
| 12 | **Quản lý template OKR** | **Bỏ** | 2 nhóm Business/People đã cố định, nhân viên tự nhập từng đầu việc — không có gì để làm template. Gợi ý duy nhất: chép từ OKR của quản lý (C14). |
| 13 | **Bảng công của tôi — có chọn tháng không?** | **CÓ, mặc định = tháng hiện tại** | Dropdown + nút ‹ ›; URL `?month=YYYY-MM`. Kỳ đã chốt → chỉ đọc, không khiếu nại được. |
| 14 | **Khi nào mở cửa sổ khiếu nại?** | **Sau khi HR công bố — ngày 11 hàng tháng** | Cửa sổ 2 ngày (đến 13/11). Công bố giữa kỳ để lỗi đầu tháng được khiếu nại ngay, không chờ 01/12. HR chốt & khóa sau 3 ngày kết thúc kỳ (03/12). Cả 3 mốc cấu hình được trong rule `payroll_period`. |
| 15 | **Ủy quyền khi quản lý vắng** | **BỎ** | Không có model `Delegation`. Khi quản lý vắng, task duyệt giao cho `manager_id` hiện tại → trưởng nhóm → HR theo scope. |
| 16 | **Cờ hiệu bất thường (rule phát hiện xoay vòng thiết bị, check-in hoàn hảo…)** | **BỎ** | Không suy đoán hành vi nhân viên. Chỉ giữ: giới hạn thiết bị · quản lý thiết bị · minh bạch · nhật ký thay đổi. |
| 17 | **Quy định có áp dụng riêng cho từng nhóm không?** | **Cấu hình chỉ áp dụng toàn công ty** | Rule mặc định **global** — cùng một bộ quy định cho toàn công ty. Không chia rule theo nhóm/chi nhánh. |
| 18 | **Xem trước ảnh hưởng (dry-run) khi lưu quy định?** | **BỎ dry-run — thay bằng confirm khi lưu** | Bấm "Lưu" → hộp thoại xác nhận nội dung sẽ áp dụng → xác nhận mới lưu. Ít màn hình hơn, ít thao tác hơn. |
| 19 | **Ca làm việc có bắt buộc cố định không?** | **Ca linh hoạt trong khung** | HR đặt **khung giờ** (vd 8h00–18h00); nhân viên chọn giờ vào/ra trong khung. Ca cố định vẫn là 1 lựa chọn cấu hình được. |
| 20 | **Sau khi nộp OKR thì còn sửa được không?** | **Khoá — mở lại ở review giữa kỳ/cuối kỳ** | Nộp là khoá. QL bấm **"Mở cho nhân viên sửa"** trong đợt review giữa kỳ & cuối kỳ → NV sửa/bổ sung → nộp lại → khoá. Mọi lần mở đều có audit log. |
| 21 | **Xoá mục tiêu/đầu việc thì có mất hẳn không?** | **Không — xoá mềm, bắt buộc lý do** | Mục bị xoá vẫn còn, hiện **gạch ngang + "đã xoá"** kèm lý do trong lịch sử. Điểm chỉ tính từ mục chưa bị xoá. |
| 22 | **Đính kèm file làm evidence ở đâu?** | **Chỉ ở check-in giữa kỳ/cuối kỳ và bản chấm** | Lúc **tạo OKR không có đính kèm** ở từng mục. File evidence (ảnh chụp kết quả, báo cáo, tài liệu) đính kèm ở check-in và đánh giá. |
| 23 | **Thêm màn hình danh sách khiếu nại + bảng phép cho HR?** | **CÓ — thêm 2 màn hình** | S45 **Danh sách khiếu nại** (HR xử lý nhanh ngay trên bảng) · S46 **Bảng phép** (xem 1 lần biết ai còn bao nhiêu). |
| 24 | **Bảng công có bao nhiêu cột?** | **53 cột** | Khớp đúng file export thật của công ty — có ký hiệu gốc, không tự diễn giải. |

> **Ba quyết định #1–#3 là thay đổi hành vi so với bản trước** (từ "cảnh báo" → "chặn").
> Đã cập nhật `docs/07-business-mobile-punch.md`, `docs/06-business-rule-builder.md`, `docs/02` và mockup S05/S05m.
>
> **Quyết định #15–#24** là vòng chốt mới: **bỏ** ủy quyền (#15) · **bỏ** cờ hiệu bất thường (#16) ·
> quy định chỉ áp dụng toàn công ty (#17) · bỏ dry-run, thay bằng confirm khi lưu (#18) ·
> ca linh hoạt trong khung (#19) · OKR khoá edit sau khi nộp, mở lại ở review giữa kỳ/cuối kỳ (#20) ·
> xoá mục OKR vẫn lưu vết + bắt buộc lý do (#21) · đính kèm evidence chỉ ở check-in/đánh giá (#22) ·
> thêm màn hình danh sách khiếu nại + bảng phép (#23) · bảng công 53 cột (#24).

## 8. Tiêu chí nghiệm thu

### Theo vai trò

**Nhân viên**
- [ ] Mở app → thấy nút lớn VÀO/RA ngay, không phải đi qua menu
- [ ] Bấm 1 chạm → có kết quả trong 4 giây, thấy từng bước kiểm tra lần lượt
- [ ] **Ngoài mạng công ty → bị chặn**, có gợi ý nối Wi-Fi công ty (không phải lỗi chung chung)
- [ ] **Ngoài bán kính GPS → bị chặn**, hiện khoảng cách thật + 2 lối ra (WFH / Thử lại)
- [ ] Ngày WFH đã duyệt → chấm được ngoài mạng và ngoài bán kính
- [ ] Đơn từ gửi được từ bất kỳ đâu — không cần GPS, không cần mạng công ty
- [ ] Đơn đi muộn vượt quota → bị chặn ngay lúc tạo, kèm số đã dùng
- [ ] Bấm "Lưu nháp" → đơn không trừ quota, không hiện cho quản lý
- [ ] Hạn 3 ngày tính đúng theo **giờ cần bổ sung**
- [ ] Thấy số phép còn lại ngay trên trang "Cần làm"
- [ ] Xem bảng công của mình → thấy bộ lọc "Cần duyệt" riêng cho mình
- [ ] **Bảng công của tôi có chọn tháng, mặc định = tháng hiện tại**; chọn kỳ đã chốt thì chỉ xem được, không khiếu nại được
- [ ] OKR: chấm 1–5 mỗi nhóm, điểm TB tự tính, không có ô nhập tay
- [ ] **Nộp OKR xong thì không sửa được** — chỉ khi QL mở ở đợt review giữa kỳ/cuối kỳ mới sửa & nộp lại được
- [ ] **Xoá mục tiêu/đầu việc → phải nhập lý do**, mục vẫn còn trong lịch sử (gạch ngang + "đã xoá")
- [ ] **Trang "OKR của tôi" hiện card Self proposal năm sau** kèm trạng thái (chưa viết / đang viết / đã nộp)
- [ ] **Check-in giữa kỳ/cuối kỳ đính kèm được file** làm evidence (ảnh chụp kết quả, báo cáo, tài liệu)

**Quản lý**
- [ ] Hộp thư duyệt hiện chip ✅/❌ điều kiện ngay trên từng đơn
- [ ] Duyệt hàng loạt 12 đơn trong 3 phút
- [ ] Từ chối mà bỏ trống lý do → nút bị disable
- [ ] Đơn của nhóm mình → thấy đơn của đồng nghiệp cùng nhóm (nếu được cấu hình)
- [ ] Review OKR: cả nhóm trên 1 bảng, có cột điểm đề xuất
- [ ] **Trong đợt review giữa kỳ / cuối kỳ, bấm "Mở cho nhân viên sửa"** → nhân viên sửa & nộp lại được
- [ ] Đổi quản lý của 1 nhân viên → đơn đang chờ giao cho người mới

**HR**
- [ ] Đổi quota đi muộn 2 → 3 lần/tháng bằng form, có ngày hiệu lực
- [ ] Bấm "Lưu" → **hiện hộp thoại xác nhận** nội dung sẽ áp dụng; xác nhận mới lưu (không có màn hình dry-run riêng)
- [ ] Rollback được về phiên bản cũ, có lý do
- [ ] Bảng công export ra **đúng 53 cột + ký hiệu gốc** như file công ty
- [ ] Sửa 1 ô bảng công → có audit log ghi field, giá trị cũ/mới, lý do, ai, lúc nào
- [ ] Thêm loại nghỉ mới không cần sửa code
- [ ] **Mặc định 2 thiết bị/người** — thiết bị thứ 3 phải gửi yêu cầu kèm lý do → HR duyệt
- [ ] **Màn hình Danh sách khiếu nại** — xử lý nhanh ngay trên bảng
- [ ] **Màn hình Bảng phép** — nhìn 1 lần biết ai còn bao nhiêu phép
- [ ] Bảng tổng hợp OKR có đủ 9 trường, cột thời gian công tác tự tính
- [ ] Bảng tổng hợp có **cột Trạng thái** — đủ theo dõi ai chấm/chưa chấm/chờ QL, **không cần màn hình kanban riêng**
- [ ] Đổi trưởng nhóm → đơn mới tự giao cho người mới

### Chất lượng chung
- [ ] Mọi thao tác sửa dữ liệu công / điểm đều có audit log
- [ ] Không màn hình nào trống trơn — luôn có CTA
- [ ] Chạy được trên điện thoại (375px) và desktop
- [ ] Nhân viên không tự cấu hình được bất cứ gì (trừ tuỳ chỉnh thông báo của chính mình)
- [ ] Tắt/bật được **mọi loại** thông báo — tắt không làm mất việc khỏi trang "Cần làm"
- [ ] Kỳ công đã khóa không bao giờ bị sửa — đơn nhắm kỳ đó bị chặn từ lúc tạo

---

## 9. Tài liệu liên quan

| Cần đọc | File |
|---|---|
| Quy định gốc của công ty (nguồn sự thật) | `doc/Rule chấm công.xlsx` · `doc/OKR_doc.md` · `doc/2026 OKR _ Guidance.pdf` |
| Quy trình OKR & form đánh giá | `doc/OKR_doc.md` |
| Mockup để review (45 màn hình) | `mockups/index.html` |
| Bản đồ tính năng tổng thể | `PLAN.md` |
| Chi tiết cho dev | `docs/01`–`docs/09` |
