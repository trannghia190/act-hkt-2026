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
- Nếu GPS lệch (trong tòa nhà lệch 20–50m) → **cho chấm, chỉ ghi cờ** cho HR xem sau. Không chặn.
- Mất mạng → vẫn chấm được, đồng bộ lại sau. Nhưng **quá 24h thì không tin** (không ai chấm hộ người khác 3 ngày sau).
- Nút phải **vừa tay** (112px) — nhân viên đi bộ, cầm túi, một tay.

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
Bảng công tháng: 26 cột ngày + 19 cột tổng hợp
Mỗi ô ngày dùng KÝ HIỆU GỐC của công ty: R (WFH) · AL (phép) · S (ốm) · 1.00 · 0.50 · R/0.50 …
19 cột tổng hợp tự tính theo đúng công thức trong file gốc
HR sửa ô sai → click vào ô, sửa tại chỗ, có audit log, cột tổng hợp tự tính lại
Nhân viên xem bảng công của mình → có 2 ngày để khiếu nại
HR chốt & khóa → sau đó đơn duyệt muộn sẽ áp vào kỳ lương kế tiếp, không sửa kỳ đã chốt
```

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

---

## 4. Hành trình người dùng — Bài toán 2: OKR

### 4.1. Cấu trúc OKR (theo form đánh giá của công ty)

```
┌─ BOX 1 ─ Thông tin cá nhân (tự điền) ──────────────────┐
│ Họ tên · Mã NV · Chức danh · Band · Quản lý · Nhóm       │
└──────────────────────────────────────────────────────────┘
┌─ BOX 2 ─ Business ─────────────────────────────────────┐
│ Đầu việc TỰ DO — không giới hạn số lượng, không hạn chế  │
│ số chữ · có đính kèm file                                │
└──────────────────────────────────────────────────────────┘
┌─ BOX 3 ─ People ───────────────────────────────────────┐
│ Đầu việc TỰ DO — như trên                                 │
└──────────────────────────────────────────────────────────┘
┌─ BOX 4 ─ Self proposal next year ──────────────────────┐
│ Nhân viên tự đề xuất OKR năm tới + điểm cần cải thiện   │
└──────────────────────────────────────────────────────────┘
      → Phần mềm TỰ TÍNH điểm trung bình (Business + People)
```

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

## 5. 18 tính năng tiện lợi (C1–C18)

> **Đây là bảng duy nhất cần cập nhật khi thêm/bớt tính năng.**
> Mỗi tính năng gắn với 1 màn hình trong `mockups/index.html` để team review.

| ID | Tính năng | Ai dùng | Màn hình | Ưu tiên |
|---|---|---|---|---|
| **C1** | **Todo inbox** — 1 màn hình gom mọi việc đang chờ, xếp theo mức độ ưu tiên | NV, QL | S02 | P0 |
| **C2** | **Nhắc việc tự động** — 3 kênh (push · email 8h · badge), chống spam | Tất cả | S04 | P0 |
| **C3** | **Command palette Ctrl+K** — tìm mọi thứ trong 1 ô | Tất cả | S03 | P0 |
| **C4** | **Sửa thẳng ô sai trong bảng công** — click vào ô sửa, có audit, bắt buộc lý do với cột nhạy cảm | HR | S15 | P0 |
| **C5** | **Bộ lọc đa chiều + lưu view** — lọc chip, lưu & chia sẻ bằng URL | HR, QL | S15 | P0 |
| **C6** | **Dry-run** — xem trước ảnh hưởng trước khi áp quy định | HR | S18 | P0 |
| **C7** | **Trang quy định tra cứu** — nhân viên tự tra, sinh tự động từ cùng nguồn với form cấu hình | Tất cả | S19 | P0 |
| **C8** | **Duyệt hàng loạt + chip lý do + chip điều kiện** | QL | S12, S14 | P1 |
| **C9** | **Review OKR bảng so sánh cả nhóm** + điểm đề xuất theo công thức | QL | S24 | P1 |
| **C10** | **Báo cáo tự động theo lịch** — đặt lịch, tự sinh & gửi kèm Excel | HR | S39 | P2 |
| **C11** | **Import Excel** — map cột → preview → validate → import, có báo cáo lỗi | HR | S39 | P2 |
| **C12** | **Onboarding tour + mọi empty state có CTA** — không màn hình nào trống chết | Tất cả | S36 | P2 |
| **C13** | **Trình cấu hình quy định** — HR sửa quota/luật bằng form, có versioning + rollback + dry-run | HR | S16, S17, S32 | P0 |
| **C14** | **Chấm công tối ưu điện thoại** — 1 chạm < 4s, haptic, offline | NV | S05m | P0 |
| **C15** | **Nhắc việc theo từng actor** — 17 sự kiện × 3 vai trò, đúng người, chống spam | Tất cả | S04m | P0 |
| **C16** | **Loại nghỉ cấu hình được** — thêm/sửa loại mà không sửa code (3 tầng kế thừa) | HR | S30, S32 | P0 |
| **C17** | **Gợi ý Key Result từ template** — form điền sẵn nội dung mẫu HR khai báo | NV | S21 | P0 |
| **C18** | **Tóm tắt báo cáo OKR** — dựng từ số liệu đã tính, kèm link tới nguồn | HR | S25 | P0 |

> **Ngoài 18 mục này** còn "C-cố" — tự động điền đơn đi muộn từ log chấm công thật (S07).
> Không thuộc hệ thống đánh số C1–C18.

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
| 5 | Bảng công 45 cột + ký hiệu gốc + sửa tại chỗ + chốt & khóa | S15 |
| 6 | 8 loại nghỉ cấu hình được + số dư tự tính + luật phép tồn | S30, S32, S34 |
| 7 | Trình cấu hình quy định (form + versioning + rollback + dry-run) | S16–S18 |
| 8 | Todo inbox + nhắc việc theo actor + command palette | S02, S03, S04, S04m |
| 9 | OKR: 2 nhóm, thang 1–5, form 4 box, quy trình 5 bước, bảng tổng hợp 9 trường | S20–S25, S42–S46 |
| 10 | Quản lý nhân viên + cây quản lý (thấy ai duyệt cho ai) | S40, S41 |

### P1 — Nên có
C8 duyệt hàng loạt (đã có UI, cần nối API) · C9 bảng so sánh review OKR · Team OKR board (S46)

### P2 — Có thì tốt, không có cũng nộp
C10 báo cáo tự động · C11 import Excel · C12 onboarding tour

> **Thứ tự cắt nếu trượt tiến độ:** bỏ C12 → C11 → C10 → C9 → C8.
> **Không bao giờ cắt:** bảng công + chốt & khóa · 4 loại đơn từ · trình cấu hình quy định · todo inbox · OKR 2 nhóm 1–5.

---

## 7. Câu hỏi cần PO chốt

> **Đây là phần quan trọng nhất của tài liệu này.** Mỗi câu đều đang **chờ trả lời** —
> đã có mặc định để demo không bị kẹt, nhưng cần xác nhận trước khi build tiếp.

| # | Câu hỏi | Mặc định hiện tại | Ảnh hưởng nếu đổi |
|---|---|---|---|
| 1 | **Phần 20% mục tiêu công ty** khi NV copy xuống — có được tính vào điểm TB không, hay chỉ tham khảo tới khi HR duyệt? | Chỉ tham khảo, **không tính** vào điểm TB | Nếu tính → cần thêm trường + luồng duyệt 20% |
| 2 | **4 nhóm Business cố định** — đã bỏ theo quyết định "mọi thứ tự do". Nếu HR muốn so sánh giữa các bộ phận thì cần cố định lại. Còn giữ hay không? | Tự do | Ảnh hưởng lớn tới form đánh giá + bảng tổng hợp |
| 3 | **3 mục tiêu People** — có bắt buộc phải đủ 3 mục tiêu không, hay tùy? | Tự do, không bắt buộc | Validate form + cách tính điểm TB khi thiếu nhóm |
| 4 | **Xếp loại A/B/C/D** — ngưỡng mặc định 4.5 / 3.5 / 2.5 đúng chưa? Có dùng xếp loại trong bảng lương không? | 4.5 / 3.5 / 2.5 | Chỉ hiển thị, không ảnh hưởng engine |
| 5 | **Chấm công ngoài mạng công ty** — chặn hay chỉ cảnh báo? (hiện: cảnh báo) | Cảnh báo, vẫn ghi công | Rủi ro gian lận |
| 6 | **GPS lệch** (trong tòa nhà lệch 20–50m) — cho chấm + ghi cờ, hay chặn? Bán kính hiện 150m | Cho chấm + ghi cờ `low_gps_accuracy` | Chặn → nhân viên chấm công hụt |
| 7 | **Chấm công offline** — cho phép bao lâu? (hiện: 24h) | 24 giờ | Rủi ro chấm hộ |
| 8 | **Đăng ký thiết bị thứ 2** — 1 máy mặc định, xin thêm máy phải HR duyệt. Có ngoại lệ nào không? | Không có ngoại lệ, HR duyệt | Ảnh hưởng quy trình đổi máy |
| 9 | **Bảng công bị khóa** — đơn duyệt sau khi chốt thì áp vào kỳ lương kế tiếp. Có cần hiện "điều chỉnh" riêng không? | Có, ghi vào kỳ hiện tại | Báo cáo lương |
| 10 | **Thông báo** — cho tắt từng loại chưa, hay bắt buộc nhận việc quá hạn? | Tắt được trừ việc quá hạn | Trải nghiệm & tuân thủ |

---

## 8. Tiêu chí nghiệm thu

### Theo vai trò

**Nhân viên**
- [ ] Mở app → thấy nút lớn VÀO/RA ngay, không phải đi qua menu
- [ ] Bấm 1 chạm → có kết quả trong 4 giây, thấy từng bước kiểm tra lần lượt
- [ ] Ngoài mạng công ty → có giải thích rõ, không phải lỗi chung chung
- [ ] Đơn đi muộn vượt quota → bị chặn ngay lúc tạo, kèm số đã dùng
- [ ] Bấm "Lưu nháp" → đơn không trừ quota, không hiện cho quản lý
- [ ] Hạn 3 ngày tính đúng theo **giờ cần bổ sung**
- [ ] Thấy số phép còn lại ngay trên trang "Cần làm"
- [ ] Xem bảng công của mình → thấy bộ lọc "Cần duyệt" riêng cho mình
- [ ] OKR: chấm 1–5 mỗi nhóm, điểm TB tự tính, không có ô nhập tay

**Quản lý**
- [ ] Hộp thư duyệt hiện chip ✅/❌ điều kiện ngay trên từng đơn
- [ ] Duyệt hàng loạt 12 đơn trong 3 phút
- [ ] Từ chối mà bỏ trống lý do → nút bị disable
- [ ] Đơn của nhóm mình → thấy đơn của đồng nghiệp cùng nhóm (nếu được cấu hình)
- [ ] Review OKR: cả nhóm trên 1 bảng, có cột điểm đề xuất
- [ ] Đổi quản lý của 1 nhân viên → đơn đang chờ giao cho người mới

**HR**
- [ ] Đổi quota đi muộn 2 → 3 lần/tháng bằng form, có ngày hiệu lực
- [ ] Xem trước ảnh hưởng trước khi lưu, có số liệu cụ thể
- [ ] Rollback được về phiên bản cũ, có lý do
- [ ] Bảng công export ra **đúng 45 cột + ký hiệu gốc** như file công ty
- [ ] Sửa 1 ô bảng công → có audit log ghi field, giá trị cũ/mới, lý do, ai, lúc nào
- [ ] Thêm loại nghỉ mới không cần sửa code
- [ ] Bảng tổng hợp OKR có đủ 9 trường, cột thời gian công tác tự tính
- [ ] Đổi trưởng nhóm → đơn mới tự giao cho người mới

### Chất lượng chung
- [ ] Mọi thao tác sửa dữ liệu công / điểm đều có audit log
- [ ] Không màn hình nào trống trơn — luôn có CTA
- [ ] Chạy được trên điện thoại (375px) và desktop
- [ ] Nhân viên không tự cấu hình được bất cứ gì

---

## 9. Tài liệu liên quan

| Cần đọc | File |
|---|---|
| Quy định gốc của công ty (nguồn sự thật) | `doc/Rule chấm công.xlsx` · `doc/OKR_doc.md` · `doc/2026 OKR _ Guidance.pdf` |
| Quy trình OKR & form đánh giá | `doc/OKR_doc.md` |
| Mockup để review (48 màn hình) | `mockups/index.html` |
| Bản đồ tính năng tổng thể | `PLAN.md` |
| Chi tiết cho dev | `docs/01`–`docs/09` |
