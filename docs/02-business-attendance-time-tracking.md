# 02 — Bài toán 1: Chấm công (Smart Time Tracking Solution)

> Mục 6 tài liệu. *"Vì sao đây là phân hệ quan trọng nhất: Mọi dữ liệu ở đây đi thẳng vào bảng công và phiếu lương hằng tháng."*

## 1. Phạm vi MVP (phải chạy được trước D9)

| # | Tính năng | Ghi chú |
|---|---|---|
| M1 | HR cấu hình ca làm việc + lịch ngày lễ/năm | Bảng điều khiển cấu hình |
| M2 | Nhân viên chấm công vào/ra (web responsive mobile-first) | Một URL cho cả điện thoại + desktop, **không có app riêng**; có geofence + thiết bị đăng ký |
| M3 | Đơn đi muộn/về sớm + đơn bổ sung chấm công | Quota chặn server-side |
| M4 | Đơn nghỉ phép + số dư phép tự tính + luật phép tồn | Engine riêng, có unit test |
| M5 | Đăng ký WFH + báo cáo công việc + lịch nhóm | |
| M6 | Quản lý duyệt đơn (nháp 1, có lý do từ chối) | Dùng approval engine core |
| M7 | Bảng công tháng + khiếu nại 2 ngày + HR chốt & khóa | |
| M8 | Xuất bảng công chuẩn ra Excel | Không tính lương (theo Q7) |
| **C-cố** | **Tự động điền đơn đi muộn từ log chấm công thật** | Điền sẵn ngày + số phút chính xác |
| **C4** | **HR sửa thẳng ô sai trong bảng công + sửa hàng loạt** | |
| **C5** | **Bộ lọc mạnh + lưu view** | |
| **C6** | **Xác nhận khi lưu quy định** — hiện thay đổi gì · ngày hiệu lực · ai bị ảnh hưởng | |
| **C6** | **Trang quy định tra cứu** (quota, hạn nộp, luật phép tồn) | |
| **C7** | **Duyệt hàng loạt + chip lý do + chip điều kiện quyết định** | |

> **Toàn bộ bài toán 1 làm bằng rule** — tất định, truy vết được, giải thích được, không tốn phí. Xem `docs/04-business-convenience-features.md` §5.

## 2. Rule nghiệp vụ (lấy từ Mục 7 — quyết định của HR)

### 2.1 Bảng rule

> **Nguồn:** `doc/Rule chấm công.xlsx` — sheet *"Rule về chấm công (cho team)"*, do HR chốt.
> Đây là **quy định chính thức của công ty**, ưu tiên cao hơn diễn giải trong Mục 7 của PDF.

| Rule | Giá trị HR đã chốt | Cấu hình được ở đâu |
|---|---|---|
| **Giờ check-in** | **8h00 → 9h30** | `RuleConfig` scope=shift |
| **Giờ check-out** | **17h00 → 18h30** | `RuleConfig` scope=shift |
| **Giờ nghỉ trưa** | **12:00 → 13:00** (không tính vào giờ làm) | `RuleConfig` scope=shift |
| **Giờ làm đủ** | **8 tiếng/ngày** · **4 tiếng/nửa ngày** | `RuleConfig` scope=shift |
| **Ca linh hoạt** | Giờ check-in/ra có thể trong **khung linh hoạt** — miễn tổng giờ làm **đủ 8h** thì vẫn tính đủ 1 ngày công | `RuleConfig` scope=shift |
| **Ca ngoại lệ** | 7h30–16h30 · 7h00–16h00 · 10h00–19h00 … (fix cho một số đối tượng) | Ca cố định theo nhóm |
| **TH con < 1 tháng** | Đi làm **7 tiếng/ngày** | `RuleConfig` scope=position |
| **Chấm công ngoài mạng công ty** | **CHẶN** (ngoại lệ duy nhất: ngày WFH đã duyệt) | `attendance_security` |
| **Chấm công ngoài bán kính GPS** | **CHẶN** — bán kính mặc định **150m**, cấu hình được (50–5000m) | `attendance_security` |
| **GPS không xác định / sai số > 100m** | **CHẶN** kèm hướng dẫn đứng gần cửa sổ | `attendance_security` |
| **Chấm công offline** | **Cho phép**, cấu hình được — mặc định **24 giờ** | `attendance_security` |
| **Thiết bị thứ 3** | **Mặc định 2 thiết bị** — máy thứ 3 phải xin HR duyệt kèm lý do | `attendance_security` + `share_account` |
| **Xác thực khuôn mặt** | **BẮT BUỘC mỗi lần chấm công** — camera chụp ảnh, khớp hồ sơ đã đăng ký (≥ 85%) + liveness; không khớp/không đạt liveness → **CHẶN** | `attendance_security` |
| **Đơn từ (đi muộn/nghỉ/WFH/bổ sung)** | **Không cần GPS, không cần mạng công ty** — chỉ chấm công mới cần | — |
| Kỳ công | 01 → cuối tháng | HR Settings |
| Đi muộn/về sớm — quota | 2 lần/tháng | `RuleConfig` scope=global |
| Đi muộn/về sớm — thời lượng | 60 phút/lần | `RuleConfig` |
| Vượt quota đi muộn | **Không cho tạo đơn** | Hard rule, chặn server |
| Đi muộn không có đơn | **Trừ công theo đúng giờ làm việc thực tế** | Engine tổng hợp công |
| **Quên check in/out — quota** | **5 lần/tháng** | `RuleConfig` |
| **Quên check in/out — hạn nộp** | **Muộn nhất sau 03 ngày** kể từ ngày đăng ký | `RuleConfig` |
| **Quên check in/out — hậu quả** | **Không tính công** | Engine tổng hợp công |
| Bổ sung chấm công — hạn nộp | 3 ngày làm việc kể từ ngày quên chấm | `RuleConfig` |
| **WFH (remote) — quota** | **2 ngày/tuần** | `RuleConfig` scope=global |
| **WFH — chặn ngày thứ 3** | **Ngày remote thứ 3 trong tuần bị chặn** | `RuleConfig` |
| **WFH — đơn tối thiểu** | **0,5 ngày / đơn** | `RuleConfig` |
| **WFH — hạn đăng ký** | **Muộn nhất sau 03 ngày** kể từ ngày đăng ký | `RuleConfig` |
| **Đơn nghỉ phép — hạn đăng ký** | **Muộn nhất sau 03 ngày** kể từ ngày đăng ký | `RuleConfig` |
| **Đơn nghỉ ốm — hạn đăng ký** | **Muộn nhất sau 03 ngày** + **bắt buộc đính kèm giấy khám** | `RuleConfig` |
| **Đi muộn/về sớm — hạn đăng ký** | **Muộn nhất sau 03 ngày** kể từ ngày đăng ký | `RuleConfig` |
| Áp dụng chung | Không phân biệt nhóm/chức vụ | Mặc định global — **chỉ toàn công ty**, không ghi đè theo nhóm/chức vụ |
| Đơn cần HR duyệt thêm | **Nhóm CA + Mobile** — chỉ áp cho **đi muộn / bổ sung công / WFH** | `hr_approval` |
| **Duyệt đơn nghỉ phép** | **CHỈ quản lý trực tiếp duyệt — không chuyển HR**, không phụ thuộc nhóm | `approval_flow` |
| Xuất phiếu lương | Chỉ xuất bảng công chuẩn | Không tính lương |

> **Ca làm việc linh hoạt (flexible window):** giờ check-in/ra có thể nằm trong **khung linh hoạt** do HR cấu hình.
> Nếu **tổng giờ làm ≥ 8h** và **cả check-in lẫn check-out đều nằm trong khung linh hoạt** → **tính đủ 1 ngày công**,
> và **không phạt vì check-in muộn**. Nếu **tổng giờ làm < 8h** → tính theo **giờ thực tế** (không đủ 1 ngày công).
> VD: thời gian làm việc 8 tiếng, khung check-in 8h–10h, khung check-out 17h–19h → check-in 09:30, check-out 18:00
> → làm đủ 8h30 → **tính đủ 1 ngày công, không tính đi muộn**. Cấu hình chi tiết xem `docs/06-business-rule-builder.md` §3.1.8.

#### 2.1.1. Ba chi tiết dễ làm hỏng nghiệp vụ

**(a) Hạn 03 ngày — không phải "3 ngày làm việc".**
HR ghi rõ: *"Giờ đăng ký vào ngày thứ 3 phải trước giờ được bổ sung"* và cho ví dụ:
> *"cần bổ sung giờ checkin là 08:00 **thứ Sáu**, vậy deadline đăng ký là trước **08:00 Thứ Hai tuần sau**"*

→ **Chỉ giới hạn theo NGÀY — không yêu cầu giờ cụ thể** (quyết định chốt 18/11/2026). Hạn mặc định: nộp **trong vòng 3 ngày** kể từ ngày phát sinh; hết ngày thứ 3 là hạn cuối.

**Cách tính hạn và thông báo khi trễ:**

| Bước | Quy tắc |
|---|---|
| Tính ngày hạn | Ngày phát sinh + **N ngày lịch** (mặc định **3**, cấu hình được 0–15) |
| Giờ so sánh | **Không so giờ** — dùng hết ngày hạn là hạn cuối |
| Khi đã trễ | Báo rõ: *"Đã quá hạn nộp đơn. Hạn của ngày {dd/mm} là hết ngày {dd/mm} (sau {N} ngày)."* |
| Ví dụ | Đi muộn **thứ Sáu** → hạn nộp là **hết Chủ nhật** cùng tuần (nếu tính ngày lịch) hoặc hết **thứ Hai** (nếu tính ngày làm việc — cấu hình được) |

**(b) Nút SUBMIT chứ không phải Save.**
HR ghi rõ: *"Đăng ký qua portal cần ghi rõ số phút (≤ 30) và ấn nút **SUBMIT** thì đơn mới được ghi nhận. (Nhiều người chỉ ấn nút Save thì chỉ ở dạng **Nháp**)"*.

→ Mọi đơn có **2 trạng thái**: `draft` (đã lưu, chưa tính quota, **không** hiện cho quản lý) và `submitted` (mới tính quota + tạo task duyệt).
→ Nút "Lưu nháp" và "Gửi" tách biệt. Chỉ `submitted` mới bị trừ quota.

**(c) Luồng duyệt theo team — không phải một luồng chung.**

| Team | Luồng duyệt |
|---|---|
| **Các team khác** | Chuyển **manager** duyệt · nếu manager chưa duyệt thì người gửi **rút được đơn** |
| **Team CA** | **Trưởng nhóm** duyệt lần 1 → **HR** duyệt lần 2 *(chỉ đơn đi muộn / bổ sung công / WFH)* |
| **Team Mobile** | **Trưởng nhóm** duyệt lần 1 → **HR** duyệt lần 2 *(chỉ đơn đi muộn / bổ sung công / WFH)* |
| **Mọi đơn nghỉ phép** | **Chỉ quản lý trực tiếp duyệt là đủ — không chuyển HR**, kể cả nghỉ dài ngày hay thai sản |

> **Không hardcode tên người duyệt.** Luồng gắn với **nhóm**; ai là trưởng nhóm lấy từ
> `Team.lead_id` — HR đổi trưởng nhóm là đổi người duyệt, không cần sửa code.
> Cấu hình trong rule `approval_flow` (scope=team). Xem `docs/01-business-shared-core.md` §Tổ chức linh hoạt.

→ Trong rule catalog: `hr_approval` với `teams = ["CA", "Mobile"]` — có thêm **bước duyệt đầu theo trưởng nhóm** thay vì manager. **Không áp dụng cho đơn nghỉ phép.**
→ Tính năng **rút đơn** (`cancel` trong khi chờ duyệt) phải có cho mọi đơn, không chỉ sau khi đã gửi.

### 2.1.2. Tám loại nghỉ thật của công ty

Từ bảng NOTE trong `doc/Rule chấm công.xlsx` (row 76–97) — **đây là danh mục chính thức, khớp 1–1 với cột tổng hợp trong bảng chấm công export**:

| Mã | Tên đầy đủ | Ghi chú rule |
|---|---|---|
| **NL** | Nghỉ lễ tết | Theo lịch Nhà nước đã set trước |
| **AL** | Nghỉ phép | Đăng ký muộn nhất sau 03 ngày · trừ phép năm |
| **S** | Nghỉ ốm | Đăng ký muộn nhất sau 03 ngày · **bắt buộc attach giấy khám** |
| **RO** | Nghỉ bù | Ngày làm bù cho ngày lễ |
| **CL** | Nghỉ việc riêng hưởng nguyên lương | |
| **ML** | Nghỉ thai sản | Nữ: **6 hoặc 7 tháng** tùy con đầu tiên hay con thứ 2 · **BHXH chi trả** · cần giấy tờ |
| **PL** | Nghỉ việc riêng khi có vợ sinh | Nam: 5 · 7 · 10 · 14 ngày… theo chế độ |
| **UP** | Nghỉ không lương | Case: nghỉ trong thời gian **thử việc** · **hết ngày phép** |

> **Vì sao phải đủ 8 loại:** bảng chấm công export của công ty có **cột riêng cho từng loại**
> (NL · AL · CL · S · BHXH · RO · UP · ML · PL). Nếu hệ thống thiếu 1 loại thì bảng export ra **lệch** với
> bảng HR đang dùng → HR phải map tay, và tính năng "xuất bảng công chuẩn" mất ý nghĩa.
>
> **Lưu ý:** con số **8** là số **cột** trong bảng công, **không phải** số loại nghỉ trong hệ thống.
> Ngoài 8 loại này còn có các loại nghỉ **không có cột riêng** (hiếu hỉ, tang gia, thai sản tách nam/nữ) —
> xem §2.3.

### 2.1.3. Bảng chấm công — cấu trúc thật (53 cột)

> **Nguồn:** `doc/Rule chấm công.xlsx` — sheet *"Mẫu bảng chấm công"*, tháng 10/2026, 68 nhân viên.
> Đối chiếu thêm: `doc/Pine team_T10.2026_Timekeeping Report.xlsx` — **cùng cấu trúc 53 cột**.
> Đây là **mẫu export thật** mà HR dùng hằng tháng → hệ thống phải xuất ra **đúng bảng này**.

**Bố cục:**

```
A  STT · B Mã NV · C Họ và Tên · D Chức vụ · E Nhóm/Team     ← 5 cột thông tin
F … AJ  = 31 cột ngày (1 → 31 tháng)                          ← 1 ký hiệu / ô
AK…BA = 17 cột tổng hợp                                      ← tính tự động
                                       ────────────────────────
                                       TỔNG: 53 cột (A → BA)
```

**17 cột tổng hợp (giữ nguyên đúng tên file HR):**

| Cột | Tên trong file | Ý nghĩa |
|---|---|---|
| AK | Quản lý trực tiếp | Mã NV của manager |
| AL | Làm việc tại nhà/R | Số ngày WFH (ký hiệu `R`) |
| AM | **Tổng ngày công** | Tổng công thực tế trong tháng |
| AN | Nghỉ lễ/ NL | Số ngày nghỉ lễ |
| AO | Ngày phép/AL | Số ngày phép năm |
| AP | Nghỉ chế độ/CL | Nghỉ việc riêng hưởng nguyên lương |
| AQ | Nghỉ ốm/S | Số ngày nghỉ ốm |
| AR | Nghỉ ốm BH | Nghỉ ốm do BHXH chi trả |
| AS | Nghỉ bù/RO | Số ngày nghỉ bù |
| AT | Nghỉ không lương/UP | Số ngày nghỉ không lương |
| AU | Nghỉ thai sản/ML | Số ngày thai sản |
| AV | Nghỉ việc riêng khi có vợ sinh/PL | Số ngày |
| AW | **Tổng/Total** | Tổng số ngày bị trừ |
| AX | Tổng số ngày phép còn lại | *(tính đến một mốc thời gian)* |
| AY | Số ngày làm việc thực tế | `=AM` (công thức trong file) |
| AZ | Số ngày phép sử dụng, nghỉ bù, nghỉ đặc biệt | `=SUM(AN,AO,AP,AQ,AS)` |
| BA | Số ngày nghỉ không hưởng lương | `=sum(AR,AT,AU,AV)` |

> **Công thức trong file (giữ nguyên khi implement) — đọc thẳng từ file Excel:**
> Cột **AZ** `=SUM(AN,AO,AP,AQ,AS)` → NL + AL + CL + S + RO → các ngày **có lương nhưng không đi làm**.
> Cột **BA** `=sum(AR,AT,AU,AV)` → BHXH + UP + ML + PL → các ngày **không hưởng lương**.
> Cột **AY** `=AM` → tổng ngày công = số ngày làm việc thực tế.
> Kiểm chứng trên dữ liệu thật (file Pine, dòng 7): `AM 21.0 + (NL 0 + AL 1 + CL 0 + S 0 + RO 0) = 22.0` = `AW/Tổng` ✔

#### Bảng tra cứu ký hiệu ô ngày (bắt buộc có trong UI)

Đây là bảng NOTE chính thức trong file (row 76–97). Ô ngày chỉ chứa **ký hiệu**, nên
**người dùng không đọc được** → hệ thống phải có **bảng tra cứu + tooltip** khi hover.

| Ký hiệu | Nghĩa | | Ký hiệu | Nghĩa |
|---|---|---|---|---|
| `1.00` | Đủ 1 ngày công | | `AL/UP` | Nửa ngày phép, nửa ngày không lương |
| `0.50` | Nửa ngày công | | `UP/AL` | Nửa ngày không lương, nửa ngày phép |
| `R` | Làm việc tại nhà (WFH) | | `R/AL` | Nửa ngày WFH, nửa ngày phép |
| `NL` | Nghỉ lễ tết | | `AL/R` | Nửa ngày phép, nửa ngày WFH |
| `AL` | Nghỉ phép | | `R/0.50` | Nửa ngày WFH, nửa ngày đi làm |
| `S` | Nghỉ ốm | | `0.50/R` | Nửa ngày đi làm, nửa ngày WFH |
| `RO` | Nghỉ bù | | `S/0.50` | Nửa ngày nghỉ ốm, nửa ngày đi làm |
| `CL` | Nghỉ riêng hưởng nguyên lương | | `0.50/S` | Nửa ngày đi làm, nửa ngày nghỉ ốm |
| `ML` | Nghỉ thai sản | | `S/R` | Nửa ngày nghỉ ốm, nửa ngày WFH |
| `PL` | Nghỉ riêng khi có vợ sinh | | `R/S` | Nửa ngày WFH, nửa ngày nghỉ ốm |
| `UP` | Nghỉ không lương | | `...../0.00` | Nửa ngày đăng ký chế độ, nửa ngày quên chấm công |
| | | | `0.00/.....` | Nửa ngày quên chấm công, nửa ngày đăng ký chế độ |

**Quy tắc đọc ô ngày `A/B`:**
- `A` = trạng thái **nửa ngày đầu** (buổi sáng), `B` = trạng thái **nửa ngày sau** (buổi chiều).
- `X/0.50` nghĩa là nửa ngày đầu = loại X, nửa ngày sau = nửa ngày đi làm.
- Ô có **1 ký hiệu đơn** = cả ngày thuộc loại đó (`1.00` = đủ ngày, `R` = cả ngày WFH).
- Ô trống = **chưa chấm công** (chưa có dữ liệu) — phân biệt với nghỉ lễ (có `NL`).

> **Vì sao phải giữ nguyên ký hiệu gốc:** HR đang đọc file này hằng tháng. Nếu hệ thống xuất ra
> "ngày nghỉ phép" thay vì `AL`, HR mất thời gian dịch lại. Giữ nguyên ký hiệu = **zero training**.

#### Cột ngày và cách lưu trạng thái

**Mô hình 1 ô = 1 người × 1 ngày** — lưu **trạng thái nửa ngày**, không lưu chuỗi ký hiệu.
Danh sách trường của ô công từng ngày (`TimesheetDay`) xem §3.2.

**Vì sao tách `morning`/`afternoon` thay vì lưu chuỗi `"R/0.50"`:**
1. **Tính tổng được ngay** — không cần parse chuỗi ở mọi nơi.
2. **Sửa tại chỗ (C4) chỉ cần sửa 1 phần ngày** — thay vì sửa cả chuỗi.
3. **Render ra ký hiệu gốc là 1 quy tắc thuần** → export khớp file HR 100%.

**Quy tắc dựng lại ký hiệu ô ngày (đúng như file Excel gốc):**

| Tình huống | Ký hiệu xuất ra |
|---|---|
| Có cả `morning` và `afternoon` | `<morning>/<số giờ buổi chiều>` — ví dụ `R/0.50` |
| Chỉ có `morning` | `<morning>` — ví dụ `AL`, `R`, `NL` |
| Không có gì | Ô trống (chưa chấm công) |

### 2.2 Rule phép (Mục 6.4 + quyết định HR)

> **Nguồn:** sheet *"Rule về chấm công"*, mục **"Ngày phép"**.

```
Phép năm:              12 ngày/năm, cộng theo tháng vào ngày 15 hàng tháng
Phép chức vụ:          Manager +3 ngày/năm  →  tổng 15 ngày/năm
Phép thâm niên:        +1 ngày cho mỗi 2 năm thâm niên
                       (cộng vào đúng ngày tròn thâm niên)
Nhân viên thử việc:     có 2 ngày phép của 2 tháng thử việc,
                       nhưng CHỈ cộng khi trở thành nhân viên chính thức
```

**Quy tắc ngày vào làm — cộng phép hàng tháng (quan trọng, dễ tính sai):**

```
Mỗi tháng, vào ngày 15, cộng 1 ngày phép cho người ĐÃ vào làm từ ngày 15 trở về trước.

  Ngày vào làm ≤ 15  →  tháng đó ĐƯỢC cộng 1 ngày phép
  Ngày vào làm >  15  →  tháng đó KHÔNG cộng
                         kỳ cộng đầu tiên là ngày 15 của tháng kế tiếp

  VD: vào 20/11/2026
      → tháng 11/2026: KHÔNG cộng (dù đã qua ngày 15)
      → ngày 15/12/2026: +1 ngày phép  ← kỳ cộng đầu tiên
      → ngày 15/01/2027: +1 ngày phép  (bình thường)
```

> **Vì sao cần chốt rõ:** nếu hiểu sai thành "vào sau 15 thì mất luôn 1 tháng", nhân viên mới
> sẽ bị thiếu phép. Quy tắc là **hoãn 1 kỳ cộng**, không phải mất đi 1 ngày phép.
> Tham số `join_cutoff_day` (mặc định 15) trong rule `leave_accrual` — HR đổi được.

**Phép thâm niên — cộng đúng ngày tròn:**

```
Thâm niên = số năm làm việc (tính từ ngày vào làm).
Mỗi 2 năm thâm niên → +1 ngày phép, cộng VÀO ĐÚNG NGÀY TRÒN thâm niên.

  VD: vào 01/03/2021 → tròn thâm niên 2 năm: 01/03/2023
                            tròn thâm niên 4 năm: 01/03/2025
                            tròn thâm niên 6 năm: 01/03/2027
  Ngày cộng phép = đúng ngày đó, không phải ngày 15 tháng đó.
```

> **Vì sao tách khỏi "cộng đầu năm":** nếu gộp vào lần cộng ngày 15 thì người vào giữa năm
> sẽ bị tính sai mốc. Cộng đúng ngày tròn thâm niên thì công bằng cho tất cả.
> Tham số `leave_seniority.years_per_day` (mặc định 2).

**Luật clear phép (quan trọng — phải test kỹ):**

```
Trước 01/04 năm sau:  phép tồn được mang TOÀN BỘ sang năm sau
Trước 01/07 năm sau:  chỉ còn 05 ngày phép tồn được giữ lại
Sau  mốc 01/07:       số phép tồn của năm trước = 0
```

> Có case đặc biệt bảo lưu do đặc thù công việc → cần cơ chế **bảo lưu phép tồn thủ công** (HR giữ 1 phần không bị reset).

**Chi tiết dễ sót — "cộng đúng ngày tròn thâm niên":**
Phép thâm niên **không** cộng 1 lần đầu năm theo lệch tuổi, mà cộng **đúng ngày kỷ niệm** vào năm đó
(ví dụ nhân viên vào ngày 20/03/2021 → năm 2023, 2025, 2027… được cộng +1 ngày vào ngày 20/03).
Cần lưu `start_date` chính xác và tính theo ngày, không theo tháng.

**Chi tiết dễ sót — "phép của thử việc cộng khi thành chính thức":**
Nhân viên thử việc **được cộng trước** 2 ngày (cho 2 tháng thử việc) nhưng số đó **chưa được dùng**;
khi chính thức hoá thì mới "cộng vào" → không được tính 2 lần. Cơ chế: ghi transaction `type=accrue`
với `source_ref="probation_reserve"` ở thời điểm trở thành chính thức.

**Điều kiện cộng phép thử việc:**

| Điều kiện | Giá trị |
|---|---|
| Nhân viên đã hết thời gian thử việc | Có `probation_end_date` trong quá khứ |
| Trạng thái nhân viên | `active` (đã chính thức hoá) |
| Chưa cộng lần trước | `probation_leave_granted = false` |
| Khi đạt đủ | Ghi 1 dòng cộng **2 ngày** vào sổ phép, ghi chú *"Phép tồn thử việc — cộng khi chính thức hoá"*, đánh dấu đã cộng |

**Cấu trúc sổ phép (append-only ledger):**

**Sổ cái phép (append-only ledger)** — mọi thay đổi số dư đều là **1 dòng ghi thêm**, không sửa dòng cũ:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh dòng sổ | Khóa chính |
| `user_id` | Nhân viên sở hữu dòng sổ | Bắt buộc |
| `leave_type_id` | Loại nghỉ mà dòng này thuộc | Bắt buộc |
| `transaction_date` | Ngày phát sinh thay đổi số dư | — |
| `amount` | Số ngày **cộng/trừ** | Dương = cộng, âm = trừ; `0.5` = nửa ngày |
| `type` | Loại thay đổi | `accrue` (cộng phép) · `carryover` (phép tồn) · `grant` (cấp) · `deduct` (trừ khi dùng) · `expire` (hết hạn) · `adjust` (điều chỉnh) |
| `month_key` | Khoá tháng — dùng để tính **quota theo tháng** | Định dạng `"2026-11"` |
| `year_key` | Khoá năm — dùng cho **phép năm** | Định dạng `"2026"` |
| `source_ref` | Tham chiếu tới đơn nghỉ hoặc nguồn cộng | Trống nếu không có |
| `note` | Ghi chú | Tự do |
| `created_by` | Người tạo dòng sổ | — |

Số dư = `SUM(amount)` của các transaction liên quan đến năm hiện tại (theo `year_key`).
Hạn dùng phép tồn = `SUM(amount)` của các transaction có `type IN ('carryover','accrue')` **trừ đi** lượng đã dùng từ carryover... → cách đơn giản và chính xác hơn:

> **Mỗi lần cộng phép, ghi 1 transaction với `type` và `source_ref`. Khi dùng phép, trừ theo FIFO** (dùng phép cũ trước). Như vậy tự động đúng luật "phép tồn hết hạn".

**Cơ chế FIFO dùng phép:**

**Cơ chế FIFO dùng phép:**

| Bước | Hành động |
|---|---|
| 1 | Lấy các **lô phép còn dư** của nhân viên (theo loại nghỉ), sắp theo **ngày phát sinh** — cũ → mới |
| 2 | Với từng lô: lấy tối đa `số ngày cần dùng` nhưng không vượt quá phần còn dư của lô đó |
| 3 | Mỗi lần lấy → ghi 1 dòng **trừ** vào sổ phép, tham chiếu tới lô đã dùng |
| 4 | Nếu dùng hết các lô mà **vẫn còn thiếu** → chặn với thông báo **"Không đủ phép"** |

> Ưu tiên lô cũ trước là để tôn trọng luật hạn 01/04 và 01/07: phép cũ hết hạn trước nên phải dùng trước.

**Job tự động (chạy ngày 1 hàng tháng lúc 00:05):**

```
1. Cộng +1 ngày phép hàng tháng cho mọi user (ngày 15)
2. Chuyển phép tồn theo mốc 01/04 và 01/07
3. Ghi audit log cho từng thao tác
```

Với phép năm (12 ngày/năm): cấp 1 lần đầu năm. Với phép thâm niên/chức vụ: cộng 1 lần đầu năm (hoặc khi thay đổi chức vụ).

### 2.3 Loại nghỉ — cấu hình được, không hard-code

Tài liệu (Mục 6.4) mô tả loại nghỉ theo đặc tính (hưởng lương, đơn vị, giấy tờ…), và file Excel của
công ty dùng **8 loại** khớp 1–1 với cột bảng công. Nhưng **loại nghỉ là thứ hay thay đổi** — HR có thể
cần thêm loại mới (ví dụ "Nghỉ chăm con") mà không đợi sửa phần mềm.

> **Phân biệt rõ 2 khái niệm rất dễ nhầm:**
> - **8** = số **cột tổng hợp** trong bảng công (NL · AL · S · RO · CL · ML · PL · UP) — **cố định, không đổi**.
> - **Số loại nghỉ trong hệ thống** = **không cố định** — có thể nhiều hơn 8 vì có các loại **không có cột riêng**
>   (hiếu hỉ, tang gia, thai sản nam/nữ). Loại không có cột riêng thì **gộp vào cột tương ứng khi export**.
> - **Số cột bảng công = 53** — không đổi dù thêm bao nhiêu loại nghỉ.


**Nguyên tắc thiết kế:** *tạo sẵn một bộ loại nghỉ chuẩn, nhưng mọi loại đều chỉnh được bằng tham số, và HR
có thể thêm loại mới mà không cần sửa code.*

#### Cấu trúc 3 tầng kế thừa

Đây là điểm mấu chốt. Quy tắc cho nghỉ phép có **3 tầng**, tầng sau ghi đè tầng trước:

```
Tầng 1 — Rule chung toàn công ty (leave_type_defaults)
   "Mọi loại nghỉ: nộp trong vòng 3 ngày sau ngày bắt đầu nghỉ, cần 1 bước duyệt"
                          ↓ ghi đè
Tầng 2 — Tham số của từng loại nghỉ (LeaveType.parameter_values)
   "Nghỉ tang gia: không cần giấy tờ, quản lý duyệt"
                          ↓ ghi đè
Tầng 3 — Tham số riêng của một đơn (LeaveRequest.parameter_overrides)
   "Trường hợp này cần giấy tờ bổ sung"
```

**Vì sao cần 3 tầng — ví dụ thật:**
- "Nghỉ phép năm" và "Nghỉ hiếu hỉ" đều dùng hạn nộp 3 ngày → lấy từ tầng 1
- **"Nghỉ tang gia"** thì **không cần giấy tờ**, chỉ quản lý duyệt → tầng 2 ghi đè
- Trường hợp "Nghỉ ốm" nhưng công ty yêu cầu giấy từ ngày thứ 2 trong khi mặc định là từ ngày thứ 3 →
  HR đổi tham số của loại "Nghỉ ốm" ở tầng 2 (áp dụng cho mọi đơn nghỉ ốm)

> **Điểm quan trọng:** nếu chỉ có 1 tầng (rule chung) thì không thể có "nghỉ tang gia không cần giấy tờ"
> mà vẫn giữ "nghỉ ốm bắt buộc giấy khám từ ngày thứ 2". Đây là lý do phải có tầng 2, không phải chi tiết thừa.

#### Danh mục tham số — có schema, không phải JSON tự do

Tham số **không** lưu dạng JSON tự do (không validate được, HR dễ nhập sai tên field). Mỗi tham số có
một định nghĩa trong catalog, giống hệt `RuleField` của rule:

**Định nghĩa 1 tham số (mỗi tham số có 1 mục trong danh mục):**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `key` | Mã tham số, dùng để tra cứu | Không trùng trong danh mục |
| `label` | Nhãn hiển thị cho HR trong form cấu hình | Bắt buộc |
| `type` | Kiểu giá trị mà ô nhập nhận | `int` · `decimal` · `bool` · `time` · `select` · `multi_select` · `text` · `days` |
| `unit` | Đơn vị đo hiển thị cạnh ô nhập | Tùy chọn |
| `min` | Trị nhỏ nhất được phép nhập | Tùy chọn |
| `max` | Trị lớn nhất được phép nhập | Tùy chọn |
| `options` | Danh sách lựa chọn (dùng cho `select` / `multi_select`) | Tùy chọn |
| `help` | Gợi ý dưới ô nhập | Tùy chọn |
| `default` | Giá trị mặc định | Tùy chọn |
| `applies_to` | Nhóm tham số liên quan — dùng để **hiện/ẩn theo điều kiện** | Danh sách nhóm; mặc định rỗng = luôn hiện |

**Nhóm tham số chuẩn (dùng cho mọi loại nghỉ):**

| Nhóm | Tham số | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|---|
| **Cơ bản** | `paid` | bool | true | Hưởng lương không |
| | `payer` | select | company | `company` · `insurance` (BHXH) |
| | `unit` | select | full_day | `full_day` · `half_day` (cho phép nghỉ nửa ngày) |
| | `color` | text | #17604d | Màu hiển thị trên lịch & bảng công |
| **Hạn & duyệt** | `submit_within_days` | int | 3 | Nộp trong vòng N ngày kể từ ngày bắt đầu nghỉ (không yêu cầu giờ; 0–15) |
| | `mark_late_request` | bool | true | Đơn báo gấp bị gắn cờ cho quản lý |
| | `requires_manager_approval` | bool | true | Cần quản lý duyệt |
| **Giấy tờ** | `require_document` | bool | false | Cần giấy tờ |
| | `require_document_days` | int | 0 | Cần giấy tờ từ ngày thứ N (0 = từ ngày đầu) |
| | `document_types` | multi_select | [] | Loại giấy tờ chấp nhận |
| **Giới hạn** | `max_days_per_year` | int | 0 | Tối đa N ngày/năm (0 = không giới hạn) |
| | `max_consecutive_days` | int | 0 | Tối đa N ngày liên tiếp (0 = không giới hạn) |
| | `max_balance` | decimal | 0 | Trần số dư được cộng (0 = không giới hạn) |
| **Cộng phép** | `accrual_rule` | select | none | `none` · `annual` · `monthly` — loại này có được cộng phép không |
| | `accrual_days` | decimal | 0 | Số ngày cộng mỗi kỳ (nếu `accrual_rule` khác `none`) |
| **Hiển thị** | `show_in_balance` | bool | true | Có hiện ở trang số dư phép không |
| | `icon` | text | 🌴 | Icon trên card chọn loại nghỉ |

#### 8 loại nghỉ chuẩn có cột riêng — seed sẵn, nhưng đều chỉnh được

> **Lưu ý quan trọng:** con số **8** ở đây là số **cột tổng hợp trong bảng công** (NL · AL · S · RO · CL · ML · PL · UP),
> và cũng là số loại nghỉ **có cột riêng**. Bảng dưới đây vẫn giữ đúng **8 loại này**.
> Ngoài ra còn có **các loại nghỉ bổ sung không có cột riêng** (hiếu hỉ, tang gia, và tách thai sản nam/nữ) —
> xem bảng ngay dưới. Số loại nghỉ **cấu hình được** nhiều hơn 8 là **được phép**; điều không được phép là thêm
> cột mới vào bảng công — bảng export phải khớp **đúng 53 cột**.

| Mã | Loại | Mặc định quan trọng | Ghi chú |
|---|---|---|---|
| **NL** | Nghỉ lễ tết | không trừ phép năm · theo lịch nhà nước | Cột bảng công `NL` |
| **AL** | Phép năm | hưởng lương (công ty) · ngày/nửa ngày · cộng 12 ngày/năm | Trừ phép năm |
| **S** | Nghỉ ốm | công ty chi trả · **bắt buộc giấy khám** · không trừ phép năm | Cột `S` |
| **RO** | Nghỉ bù | ngày làm bù cho ngày lễ · không trừ phép | Cột `RO` |
| **CL** | Nghỉ riêng hưởng nguyên lương | hưởng lương · số ngày theo quy chế | Cột `CL` |
| **ML** | Thai sản | **BHXH chi trả** · cần giấy tờ | Cột `ML` |
| **PL** | Riêng khi có vợ sinh | nam: 5 · 7 · 10 · 14 ngày theo chế độ | Cột `PL` |
| **UP** | Không lương | không hưởng lương · thử việc · hết phép năm | Cột `UP` |

#### Loại nghỉ bổ sung — cấu hình được, nhưng KHÔNG có cột riêng trong bảng công

Đây là **loại nghỉ dùng để ghi nhận đơn**, không phải loại nghỉ có cột tổng hợp riêng:

| Loại | Mặc định quan trọng | Ghi chú |
|---|---|---|
| **Nghỉ hiếu hỉ** | không cần giấy tờ · **không trừ phép năm** | **Không có cột riêng trong bảng công** → gộp vào nhóm tương ứng (thường là `AL`) khi export |
| **Nghỉ tang gia** | được báo gấp (0 ngày) · không cần giấy tờ · **quản lý duyệt** | **Không có cột riêng trong bảng công** → gộp vào nhóm tương ứng (thường là `CL`) khi export |
| **Thai sản — nam** | **5 · 7 · 10 · 14 ngày** tùy chế độ · không hưởng lương · không trừ phép năm | Gộp vào cột `PL` |
| **Thai sản — nữ** | **6 hoặc 7 tháng** · **BHXH chi trả** · **cần giấy tờ** | Gộp vào cột `ML` |

> **Vì sao tách thai sản nam / nữ:** đây là **2 loại nghỉ riêng biệt** trong danh mục — quyền lợi, thời hạn và người chi trả khác nhau
> (nam: 5 · 7 · 10 · 14 ngày theo chế độ; nữ: 6 hoặc 7 tháng, BHXH chi trả). **Duyệt: chỉ quản lý trực tiếp.**
> Nhưng vì bảng công chỉ có **1 cột `ML`** và **1 cột `PL`**, nên khi export mỗi loại được **gộp vào cột tương ứng** —
> **số cột bảng công không đổi**.

#### HR thêm loại mới — không cần sửa code

```
HR → Cấu hình quy định → Loại nghỉ → [+ Thêm loại nghỉ]

┌────────────────────────────────────────────────────────────┐
│ Tên loại:  [ Nghỉ tang gia                                 ] │
│ Mô tả:     [ Nghỉ việc tang, không hưởng lương            ] │
│                                                            │
│ ┌── Nhóm tham số ────────────────────────────────────────┐ │
│ │ ☐ Cơ bản    ☐ Hạn & duyệt   ☐ Giấy tờ              │ │
│ │ ☐ Giới hạn  ☐ Cộng phép      ☐ Hiển thị              │ │
│ └────────────────────────────────────────────────────────┘│ │
│                                                            │
│ [Biểu mẫu] [Thêm từ loại có sẵn…]                        │
└────────────────────────────────────────────────────────────┘
```

**"Thêm từ loại có sẵn"** là điểm quan trọng: HR copy "Nghỉ phép năm" → đổi tên → tinh chỉnh tham số,
thay vì nhập lại từ đầu. Mất khoảng 30 giây.

#### Cấu trúc lưu trữ

**Loại nghỉ — tên và tham số do HR cấu hình, không hard-code:**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh loại nghỉ | Khóa chính |
| `name` | Tên loại nghỉ hiển thị | Bắt buộc, không trùng tên |
| `description` | Mô tả loại nghỉ | Tự do |
| `color` | Màu hiển thị trên lịch & bảng công | Mã màu |
| `icon` | Icon trên card chọn loại nghỉ | Ký tự/biểu tượng |
| `parameter_values` | Tham số đã chọn — **chỉ chứa những tham số thực sự khác mặc định** | Danh sách cặp tham số · giá trị |
| `is_active` | Loại nghỉ còn được dùng không | Có/Không; loại đã dùng thì không cho ẩn nếu còn đơn |
| `is_system` | Loại chuẩn seed sẵn | `true` → **không cho xoá, chỉ cho sửa** |
| `display_order` | Thứ tự hiển thị trong danh sách | Số nguyên |
| `created_by` / `created_at` / `updated_at` | Ai tạo · lúc tạo · lúc sửa lần cuối | — |

**Đơn nghỉ phép — mang theo tham số đã chốt tại thời điểm gửi:**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh đơn | Khóa chính |
| `user_id` | Nhân viên gửi đơn | Bắt buộc |
| `leave_type_id` | Loại nghỉ của đơn | Bắt buộc |
| `start_date` | Ngày bắt đầu nghỉ | Bắt buộc |
| `end_date` | Ngày kết thúc nghỉ | ≥ `start_date` |
| `days` | Số ngày nghỉ | Hỗ trợ nửa ngày (`0.5`) |
| `is_half_day` | Đơn nửa ngày | Có/Không |
| `reason` | Lý do nghỉ | Bắt buộc khi loại nghỉ yêu cầu |
| `attachments` | File kèm theo (giấy khám…) | Danh sách file |
| `applied_parameters` | **Snapshot** tham số đã áp dụng cho đơn này — để không đổi theo sau khi HR sửa cấu hình | Danh sách cặp tham số · giá trị |
| `submitted_at` | Thời điểm gửi | Trống nếu còn nháp |
| `decided_at` | Thời điểm có kết quả duyệt | Trống nếu chưa duyệt |

**Vì sao cần `applied_parameters` (snapshot):** nếu HR đổi "nghỉ ốm cần giấy tờ từ ngày thứ 2" thành
"từ ngày thứ 3" **vào tháng 3**, thì các đơn tháng 1 đã gửi không được đổi theo — lịch sử phải giữ
nguyên trạng thái lúc gửi. Nếu không có snapshot, báo cáo lương tháng 1 sẽ bị tính sai.

#### Resolve 3 tầng

**Quy tắc gộp 3 tầng:**

| Thứ tự | Tầng | Nguồn | Ví dụ |
|---|---|---|---|
| 1 | Rule chung toàn công ty | Tham số mặc định của hệ thống | "Mọi loại nghỉ: nộp trong vòng 3 ngày, cần 1 bước duyệt" |
| 2 | Tham số của từng loại nghỉ | `parameter_values` của loại nghỉ | "Nghỉ tang gia: không cần giấy tờ" |
| 3 | Tham số riêng của một đơn | `applied_parameters` của đơn | "Trường hợp này cần giấy tờ bổ sung" |

> **Tầng sau ghi đè tầng trước — nhưng chỉ ghi đè những tham số thực sự được chỉ định** (không ghi đè bằng giá trị rỗng/mặc định).

**Hiển thị cho nhân viên:** form xin nghỉ chỉ hiện **phần tham số liên quan** với loại đã chọn —
VD chọn "Nghỉ ốm" thì hiện ô upload giấy tờ, không hiện các tham số của loại khác. Nhân viên không
cần biết hệ thống có bao nhiêu tham số.

#### Lưu ý về số dư phép

Các loại có `accrual_rule = none` (ốm, thai sản, tang) **không trừ vào số dư phép năm** — vì chúng
không lấy từ quỹ phép năm. Khi duyệt, engine ghi vào sổ phép với `type` tương ứng để kế toán đối chiếu,
nhưng **không ảnh hưởng** số dư phép năm. Đây là chỗ dễ sai — ghi rõ ở đây để không ai implement
nhầm.


### 2.4 Rule WFH (Mục 6.5)

| Hạng mục | Cài đặt |
|---|---|
| Hình thức | Theo ngày hoặc **nửa ngày** (chọn buổi sáng/chiều); đăng ký từng ngày, **không lặp tuần** |
| Quota | 2 ngày/tuần; nửa ngày tính **0.5 ngày** |
| Địa điểm | **Không giới hạn địa điểm WFH** |
| Hạn đăng ký | ≥ 1 ngày làm việc; đơn gấp vẫn tạo được nhưng gắn cờ `is_late_request` |
| Chấm công trong ngày WFH | Được phép chấm **ngoài mạng công ty VÀ ngoài bán kính GPS** — đây là **ngoại lệ duy nhất**; ngày khác cả 2 đều **chặn** |
| Báo cáo công việc | Bắt buộc nhập tóm tắt cuối ngày WFH (nếu bật) |
| Trên bảng công | WFH cả ngày = `R` (1 công); WFH nửa ngày = `R/0.50` (0.5 công); cột `wfh_days` cộng 0.5/1 |

### 2.5 Rule đi muộn không có đơn

Theo quyết định HR: **"Tính theo đúng giờ làm việc thực tế"**.

| Trường hợp | Cách tính |
|---|---|
| **Đi muộn** | Số phút = `giờ check-in` − `giờ vào` — chỉ tính khi check-in **sau** giờ vào; **không tính** ngày nghỉ/lễ |
| **Về sớm** | Số phút = `giờ ra` − `giờ check-out` — chỉ tính khi check-out **trước** giờ ra |
| **Có đơn được duyệt** | Dùng **số phút ghi trong đơn** |
| **Không có đơn** | **Trừ đúng số phút thực tế** (theo quyết định HR) |

Lưu ý: HR nói "trừ công theo đúng giờ làm việc thực tế" → nghĩa là `công thực tế = giờ làm việc chuẩn - phút đi muộn/về sớm thực tế`.

### 2.6 Đơn từ — chốt triển khai 20/11/2026
* **Đi muộn/về sớm:** 1 ngày; chọn Đi muộn (sửa giờ vào) hoặc Về sớm (sửa giờ ra) + giờ thực tế; số phút chỉ tính khi **giờ vào > `checkInEnd`** hoặc **giờ ra < `checkOutStart`** (vào/ra trong khung = không muộn); giới hạn `late_early.max_minutes` (cấu hình, mặc định 60) áp cả ô chọn giờ lẫn server; hạn nộp `submit_within_days` (3 ngày). Duyệt → cập nhật `attendance_logs`.
* **Bổ sung chấm công:** 1 ngày, chỉ hôm nay hoặc quá khứ trong `makeup.deadline_working_days` (mặc định 3), không cho ngày tương lai; chọn Giờ vào/Giờ ra + giờ thực tế; **không nhập thời lượng**; quota 5 lần/tháng; duyệt → cập nhật `attendance_logs`.
* **Nghỉ phép:** cả ngày hoặc nửa ngày (0.5, chọn buổi sáng/chiều + khung giờ làm còn lại theo ca); lưu `end_date` thật; file đính kèm bắt buộc theo loại nghỉ (`requires_attachment`), cho **nhiều file**ảnh/PDF ≤10MB, lưu bytea trong `request_attachments`; server chặn duyệt nếu thiếu giấy tờ.
* **WFH:** không giới hạn địa điểm, không lặp tuần; cả ngày chọn khoảng ngày (mỗi ngày làm việc = 1 đơn, quota 2/tuần) hoặc nửa ngày 0.5 (1 ngày, sáng/chiều); bảng công ghi `R` / `R/0.50`.
* **Danh sách đơn của tôi:** phân trang server-side, lọc server-side theo loại/trạng thái/khoảng ngày/lý do; hiện Ngày áp dụng (1 ngày hoặc khoảng), Ngày tạo, tên loại nghỉ; nút Xem chi tiết (kèm file) và Sửa đơn khi chờ duyệt/bị từ chối (`PUT /requests/{id}` → quay lại PENDING, xoá quyết định cũ).

## 3. Dữ liệu cần lưu

> Các bảng dưới đây là **dữ liệu nghiệp vụ** hệ thống phải lưu. Tên trường giữ nguyên để phát triển
> có thể ánh xạ sau; **ý nghĩa & ràng buộc** mới là phần đặc tả.

### 3.1 Cấu hình

**Ca làm việc (`Shift`)**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh ca | Khóa chính |
| `name` | Tên ca hiển thị (vd "Ca hành chính") | Bắt buộc |
| `start_time` | Giờ vào ca | — |
| `end_time` | Giờ ra ca | > `start_time` |
| `break_start` | Bắt đầu giờ nghỉ trưa | Mặc định 12:00 |
| `break_end` | Kết thúc giờ nghỉ trưa | Mặc định 13:00 — **không tính vào giờ làm** |
| `is_flexible` | Ca linh hoạt (giờ vào/ra không cố định) | Có/Không — mặc định Không |
| `flexible_checkin_from` | Khung linh hoạt — giờ check-in từ | Mặc định 08:00 — chỉ hiện khi `is_flexible` = Có |
| `flexible_checkin_to` | Khung linh hoạt — giờ check-in đến | Mặc định 10:00 — chỉ hiện khi `is_flexible` = Có |
| `flexible_checkout_from` | Khung linh hoạt — giờ check-out từ | Mặc định 17:00 — chỉ hiện khi `is_flexible` = Có |
| `flexible_checkout_to` | Khung linh hoạt — giờ check-out đến | Mặc định 19:00 — chỉ hiện khi `is_flexible` = Có |
| `grace_minutes` | Số phút được phép trễ miễn phép | Số phút |
| `work_days` | Các ngày trong tuần thuộc ca linh hoạt | Danh sách thứ Hai → Chủ Nhật |
| `total_required_hours` | Số giờ làm bắt buộc mỗi ngày | Mặc định 8 (nửa ngày = 4) |

**Bộ gán ca (`ShiftAssignment`)**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bộ gán ca | Khóa chính |
| `name` | Tên bộ gán ca | Bắt buộc |
| `shift_id` | Ca được gán | Bắt buộc |
| `team_id` | Nhóm được gán ca | — |
| `position_id` | Chức danh được gán ca | — |

> **Phân biệt 3 khái niệm:** `Team` = **nhóm** (đơn vị phối hợp & duyệt đơn) · `Shift` = **ca** (giờ vào/ra) ·
> `ShiftAssignment` = **bộ gán ca** (nhóm + chức danh → ca).

**Ngày lễ / ngày nghỉ (`Holiday`)**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh ngày | Khóa chính |
| `date` | Ngày cụ thể | Không trùng ngày đã khai |
| `name` | Tên ngày (vd "Tết Nguyên Đán") | Bắt buộc |
| `is_working_day` | Ngày này có làm việc hay không | Có/Không — ngày lễ mặc định không làm |
| `year` | Năm của ngày | — |
| `day_type` | Phân loại | `holiday` (lễ) · `weekend` (cuối tuần) · `leave` (nghỉ) |

**Văn phòng / địa điểm chấm công (`OfficeLocation`)**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh địa điểm | Khóa chính |
| `name` | Tên địa điểm | Bắt buộc |
| `address` | Địa chỉ | — |
| `latitude` / `longitude` | Toạ độ | Bắt buộc |
| `radius_meters` | Bán kính cho phép chấm công | Mặc định 150m, cấu hình 50–5000m |
| `ip_ranges` | Dải IP thuộc mạng nội bộ công ty | Danh sách dải IP |

**Cấu hình rule nghiệp vụ (`RuleConfig`)** — có ngày hiệu lực, không cố định trong hệ thống:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh rule | Khóa chính |
| `rule_key` | Mã rule | `late_early_quota` · `wfh_quota` · `makeup_quota` · `leave_accrual` · `payroll_period` · `hr_approval` · `attendance_security` · `approval_flow` · … |
| `scope_type` | Rule áp dụng cho phạm vi nào | `global` (toàn công ty) · `team` (nhóm) · `position` (chức danh) · `group` |
| `scope_ref_id` | Đối tượng cụ thể trong phạm vi | Trống nếu `global` |
| `value` | Giá trị của rule | Ví dụ: số lượt tối đa 2, số phút tối đa 60 |
| `effective_from` | Ngày bắt đầu có hiệu lực | — |
| `effective_to` | Ngày kết thúc hiệu lực | Trống = còn hiệu lực |
| `created_by` | Người tạo rule | — |

### 3.2 Ghi nhận chấm công

**Lần chấm công (`TimeEntry`)**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh lần chấm công | Khóa chính |
| `user_id` | Nhân viên chấm công | Bắt buộc |
| `work_date` | Ngày công | — |
| `shift_id` | Ca áp dụng cho ngày đó | — |
| `check_in_at` / `check_out_at` | Thời điểm vào / ra | Chỉ có giờ vào nếu quên chấm công ra |
| `check_in_method` | Cách chấm công | `mobile_web` · `desktop_web` · `kiosk` (tất cả đều là web responsive, không có app native) |
| `device_id` | Thiết bị đã đăng ký | Trống nếu không xác định |
| `face_check_status` | Kết quả đối chiếu khuôn mặt | `passed` \| `failed` \| `pending_sync` (offline, chờ đối chiếu) \| `not_required` |
| `face_match_score` | Điểm tương đồng khuôn mặt | 0–100; null nếu chưa kiểm tra |
| `face_liveness_passed` | Vượt kiểm tra liveness | Có/Không |
| `face_checked_at` | Thời điểm đối chiếu khuôn mặt | — |
| `face_attempts` | Số lần thử trong phiên chấm công | 1 – `face_max_attempts` (mặc định 3) |
| `check_in_ip` | Địa chỉ IP lúc chấm công | — |
| `check_in_lat` / `check_in_lng` | Toạ độ lúc chấm công | Trống nếu không lấy được GPS |
| `check_in_network_ok` | Có trong mạng nội bộ công ty không | Có/Không — `false` ngoài mạng → **chặn** (trừ ngày WFH đã duyệt) |
| `check_in_within_geofence` | Có nằm trong bán kính GPS không | Có/Không — `false` → **chặn** (trừ ngày WFH đã duyệt) |
| `check_in_is_wfh_day` | Ngày chấm công có phải WFH đã duyệt không | Có/Không — `true` → **ngoại lệ duy nhất** được chấm ngoài mạng & ngoài GPS |
| `total_work_minutes` | Tổng phút làm việc thực tế | **Đã trừ** giờ nghỉ trưa |
| `status` | Trạng thái chấm công trong ngày | `normal` · `late` · `early` · `absent` (vắng) · `incomplete` (thiếu giờ vào/ra) · `leave` (nghỉ) · `wfh` |
| `late_minutes` | Số phút đi muộn | Số phút |
| `early_minutes` | Số phút về sớm | Số phút |
| `source` | Nguồn gốc | `punch` · `request` · `import` |
| `note` | Ghi chú | Tự do |

**Bảng công tổng hợp tháng (`Timesheet`)**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bảng công | Khóa chính |
| `user_id` | Nhân viên | Bắt buộc |
| `year` / `month` | Kỳ công | Kỳ = 01 → cuối tháng |
| `period_start` / `period_end` | Ngày bắt đầu / kết thúc kỳ công | — |
| `standard_days` | Số ngày làm việc chuẩn trong kỳ | — |
| `actual_days` | Số ngày làm việc thực tế | — |
| `actual_hours` / `standard_hours` | Số giờ thực tế / chuẩn | — |
| `wfh_days` | Số ngày làm việc tại nhà | — |
| `late_count` / `late_minutes` | Số lần đi muộn / tổng phút đi muộn | — |
| `early_count` / `early_minutes` | Số lần về sớm / tổng phút về sớm | — |
| `paid_leave_days` | Số ngày nghỉ **có lương** | — |
| `unpaid_leave_days` | Số ngày nghỉ **không lương** | — |
| `bhxh_leave_days` | Số ngày nghỉ do **BHXH chi trả** | — |
| `holiday_days` | Số ngày nghỉ lễ | — |
| `violations` | Số lần vi phạm | — |
| `makeup_count` | Số đơn **bổ sung công** đã dùng | — |
| `status` | Trạng thái kỳ công | `draft` (nháp) · `published` (**đã công bố** — mở cửa sổ khiếu nại) · `reviewing` · `locked` (**đã chốt & khóa**) |
| `locked_at` / `locked_by` | Thời điểm khóa và người khóa | Trống nếu chưa khóa |
| `published_at` | Thời điểm HR **công bố** | Trống nếu chưa công bố — **chỉ khiếu nại được** sau mốc này |
| `dispute_deadline` | Hạn cuối để khiếu nại | = `published_at` + số ngày cửa sổ khiếu nại (theo rule kỳ công) |

**Ô công từng ngày (`TimesheetDay`)** — 1 ô = 1 người × 1 ngày; lưu **trạng thái nửa ngày**, không lưu chuỗi ký hiệu:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh ô ngày | Khóa chính |
| `timesheet_id` | Bảng công tổng hợp tháng mà ô này thuộc về | Bắt buộc |
| `work_date` | Ngày công mà ô này đại diện | 1 ngày trong kỳ công |
| `morning` | Trạng thái **nửa ngày đầu** (buổi sáng) | `work` · `R` · `AL` · `S` · `RO` · `CL` · `ML` · `PL` · `UP` · `NL` · trống = chưa chấm công |
| `afternoon` | Trạng thái **nửa ngày sau** (buổi chiều) | Cùng bộ ký hiệu như `morning`; để trống = **đủ ngày** (ký hiệu buổi sáng áp dụng cho cả ngày) |
| `morning_hours` | Số giờ công của buổi sáng | `0.5` cho nửa ngày; trống = cả ngày |
| `afternoon_hours` | Số giờ công của buổi chiều | `0.5` cho nửa ngày; trống = cả ngày |
| `source` | Nguồn gốc dữ liệu của ô | `punch` (chấm công thật) · `request` (từ đơn) · `import` (nhập từ file) · `manual` (HR sửa tay) |
| `note` | Ghi chú kèm theo ô | Tự do |

> **Quy tắc dựng lại ký hiệu ô ngày (đúng như file Excel gốc):** có cả `morning` và `afternoon` → `<morning>/<số giờ buổi chiều>`
> (vd `R/0.50`) · chỉ có `morning` → `<morning>` (vd `AL`, `R`, `NL`) · không có gì → ô trống (chưa chấm công).
> Chi tiết về lý do tách `morning`/`afternoon` — xem §2.1.3.

### 3.3 Đơn từ

**Đơn từ (`Request`)**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh đơn | Khóa chính |
| `user_id` | Người gửi | Bắt buộc |
| `request_type` | Loại đơn | `late_early` (đi muộn/về sớm) · `makeup` (bổ sung chấm công) · `leave` (nghỉ phép) · `wfh` |
| `status` | Trạng thái đơn | `draft` (đã lưu nháp, **không** tính quota, **không** hiện cho quản lý) · `submitted` (đã gửi, tính quota + tạo việc duyệt) · `approved` · `rejected` · `returned` (trả lại) · `cancelled` (đã rút) |
| `start_date` / `end_date` | Khoảng ngày của đơn | — |
| `minutes` | Số phút đi muộn/về sớm | Chỉ dùng cho `late_early`; tối đa 60 phút/lần |
| `reason` | Lý do | Bắt buộc với đơn bổ sung công & khi quản lý từ chối |
| `attachments` | File kèm theo | Danh sách file |
| `is_late_request` | Đơn gấp (đăng ký muộn) | Có/Không — gắn cờ cho quản lý |
| `related_entry_id` | Lần chấm công liên quan | Chỉ dùng cho `makeup` |
| `created_at` / `submitted_at` / `decided_at` | Lúc tạo / lúc gửi / lúc có kết quả | — |

**Loại nghỉ (`LeaveType`)** — tên + tham số do HR cấu hình, không cố định. Chi tiết ở §2.3.

**Đơn nghỉ phép (`LeaveRequest`)** — mang snapshot tham số đã chốt lúc gửi. Chi tiết ở §2.3.

**Số dư phép (`LeaveBalance`)** — bản ghi tổng hợp số dư, **nguồn sự thật là sổ phép**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh | Khóa chính |
| `user_id` | Nhân viên | Bắt buộc |
| `leave_type_id` | Loại nghỉ | Bắt buộc |
| `year` | Năm của số dư | — |
| `accrued` | Tổng đã cộng trong năm | Số ngày |
| `used` | Tổng đã dùng trong năm | Số ngày |
| `carried_over` | Phép tồn mang sang từ năm trước | Số ngày |
| `expired` | Phép tồn đã hết hạn | Số ngày |
| `updated_at` | Lúc cập nhật gần nhất | — |

**Sổ phép (`LeaveTransaction`)** — xem §2.2.

**Lịch WFH (`WfhSchedule`)**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh lịch WFH | Khóa chính |
| `user_id` | Nhân viên đăng ký | Bắt buộc |
| `date` | Ngày WFH | — |
| `is_half_day` | WFH nửa ngày | Có/Không |
| `recurrence` | Lặp lại | `none` (đăng ký lẻ) · `weekly` (lịch cố định hằng tuần) |
| `weekday` | Thứ trong tuần (với lịch cố định) | Trống nếu đăng ký lẻ |
| `status` | Trạng thái | `submitted` · `approved` · `rejected` · `returned` |
| `work_report` | Báo cáo công việc cuối ngày WFH | Bắt buộc nếu bật yêu cầu báo cáo |
| `approved_by` / `approved_at` | Người duyệt và lúc duyệt | — |

### 3.4 Khiếu nại bảng công

**Khiếu nại (`TimesheetDispute`)**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh khiếu nại | Khóa chính |
| `timesheet_id` | Bảng công bị khiếu nại | Bắt buộc |
| `user_id` | Người khiếu nại | Bắt buộc |
| `reason` | Lý do khiếu nại | Bắt buộc |
| `status` | Trạng thái khiếu nại | `open` (đang mở) · `resolved` (đã xử lý) · `rejected` (bị từ chối) |
| `resolution` | Cách đã xử lý | — |
| `resolved_by` / `resolved_at` | Người xử lý và lúc xử lý | — |
| `created_at` | Thời điểm tạo khiếu nại | — |

> **Kỳ đã chốt là bản cuối cùng** — không có bản ghi điều chỉnh sau khóa.
> Đơn nhắm tới kỳ đã khóa → **chặn khi tạo**; đơn đang chờ bị khóa → **tự hủy**.

## 4. Màn hình

### 4.1 Nhân viên — Mobile-first

| Màn hình | Nội dung | Ghi chú UX |
|---|---|---|
| **Chấm công** (trang chủ) | 1 nút lớn VÀO/RA, **camera trước hiển thị trực tiếp + khung khuôn mặt**, trạng thái hôm nay, ca đang làm, thông báo check | Nút to, phản hồi rung (nếu trình duyệt hỗ trợ), hiện rõ "bạn đang ở ngoài văn phòng" nếu GPS lệch; trạng thái khuôn mặt (khớp/không khớp) hiện ngay |
| **Đăng ký khuôn mặt** | Chụp 3 góc + liveness → lưu vector đặc trưng; hiện trạng thái đã đăng ký | Chỉ đăng ký trong mạng công ty; HR reset được kèm lý do |
| **Lịch công tháng** | Grid 31 ngày, màu theo trạng thái (đủ/đi muộn/nghỉ/WFH/vắng) | Chạm 1 ngày → chi tiết |
| **Đơn từ** | Danh sách + nút "+" nhanh cho 4 loại | Badge quota còn lại luôn hiển thị |
| **Tạo đơn** | Form ngắn, validate tức thì, hiện lý do bị chặn | "Bạn đã dùng 2/2 lượt đi muộn tháng này" |
| **Số dư phép** | Card từng loại nghỉ + **thẻ Tổng phép còn lại = phép năm + phép tồn**; lịch sử phép **có bộ lọc theo loại phép / năm** | Nhân viên không phải tự cộng; lọc "Phép năm" để xem riêng cách dùng phép năm |
| **Đăng ký WFH** | Chọn ngày / lịch cố định, quota, cảnh báo đăng gấp | |
| **Bảng công** | **Chọn tháng** (mặc định = tháng hiện tại): **lịch tháng dạng ô vuông** (mỗi ngày 1 ô, xếp theo tuần T2→CN) + bảng số liệu + nút khiếu nại | Trạng thái "còn N ngày để khiếu nại" đếm ngược (chỉ sau khi HR công bố ngày 11); kỳ đã chốt → chỉ đọc |

### 4.2 Quản lý

| Màn hình | Nội dung |
|---|---|
| **Hộp thư duyệt duyệt** | Danh sách đơn chờ duyệt, filter theo loại/ngày, badge "quá hạn" |
| **Chi tiết đơn** | Timeline (gửi → duyệt → kết quả), lịch sử, chip điều kiện quyết định (C7) |
| **Lịch nhóm** | Lịch WFH + nghỉ phép của cả nhóm, cảnh báo "hôm nay 3/5 người nghỉ" |
| **Bảng công nhóm** | Tổng hợp theo tháng, drill-down từng người |

### 4.3 HR

| Màn hình | Nội dung |
|---|---|
| **Cấu hình** | Tabs: Ca làm việc · Bộ gán ca (nhóm + chức danh → ca) · Lịch nghỉ lễ · Rule & quota · Loại nghỉ · Văn phòng (geofence + IP) |
| **Bảng công & chốt** | Grid toàn công ty theo tháng, đếm trạng thái, nút Chốt & Khóa (có confirm), export Excel |
| **Xử lý khiếu nại** | Danh sách dispute đang mở, so sánh bảng công vs đơn từ, giải quyết |
| **Sổ phép** | Bảng ledger phép của mọi người, audit |

## 5. Tính năng tiện lợi

> Chi tiết đầy đủ: `docs/04-business-convenience-features.md`. Ở đây chỉ mô tả phần thuộc bài toán 1.

### C-cố. Tự động điền đơn đi muộn từ log chấm công thật ⭐

**Ý tưởng:** Hệ thống **đã biết** nhân viên check-in lúc mấy giờ → chỉ cần tính, không cần ai đoán.

**Nội dung đơn được sinh sẵn:**

| Trường | Giá trị điền sẵn | Ghi chú |
|---|---|---|
| Loại đơn | Đi muộn / về sớm | — |
| Ngày | Ngày cần bổ sung | Lấy từ lần chấm công của ngày đó |
| Số phút | **Số phút đi muộn thật** (vd 27 phút) | Chính xác tuyệt đối — đọc từ log chấm công |
| Lý do | Để trống | Nhân viên chọn từ chip lý do gợi ý |

**Chip lý do gợi ý:** *Kẹt xe giao thông* · *Tắc đường* · *Họp bất trợ* · *Sự cố máy* · *Đi làm việc khác địa điểm*

> **Chỉ sinh đơn khi có dấu hiệu đi muộn** — nếu ngày đó không có lần chấm công bị đánh dấu đi muộn
> thì không hiện nút "Tạo đơn đi muộn".

**UI:** nút "Tạo đơn đi muộn" trên màn hình chấm công → form **đã điền sẵn ngày + số phút thật**, chỉ cần chọn lý do từ chip → Gửi.

> **Vì sao chính xác tuyệt đối:** Hệ thống đọc log chấm công → ngày và số phút là dữ liệu thật, không phải suy đoán. Nhân viên không phải gõ tay.

### C4. Sửa thẳng ô sai trong bảng công + sửa hàng loạt ⭐

**Ô nào sửa được:** HR click vào **ô ngày** (ký hiệu `R/0.50`, `AL`, `1.00`…) hoặc **ô tổng hợp** →
đổi trực tiếp. Mỗi lần sửa → `TimesheetEdit` ghi lại field, giá trị cũ/mới, lý do, ai sửa, lúc nào.

**Bắt buộc lý do** khi sửa **cột nhạy cảm** — tức là mọi cột tổng hợp ảnh hưởng lương:

| Nhóm | Cột |
|---|---|
| Tổng công | `AM` (Tổng ngày công), `AY` (Số ngày làm việc thực tế), `AW` (Tổng) |
| Nghỉ có lương | `AN` (NL) · `AO` (AL) · `AP` (CL) · `AQ` (S) · `AS` (RO) |
| Nghỉ không lương | `AR` (BH) · `AT` (UP) · `AU` (ML) · `AV` (PL) |
| Chấm công | `AL` (WFH/R) · `AK` (Quản lý trực tiếp) |

> **Sửa ô ngày** = sửa đúng ký hiệu công của ô đó (1 người × 1 ngày) → **17 cột tổng hợp tự tính lại**.
> Cột tổng hợp là **chỉ đọc** — HR không sửa tay từng cột, chỉ sửa ô ngày.
> **Ô đã sửa hiện màu đỏ** trên lưới để nhìn là biết; mọi lần sửa bắt buộc lý do + ghi nhật ký thay đổi.

### C5. Bộ lọc đa chiều + lưu view

Lọc theo: phòng ban × tháng × trạng thái × chỉ số (đi muộn / WFH / phép / vi phạm) × từ khóa. Lưu view để tái dùng, chia sẻ bằng URL.

### C6. Xác nhận khi lưu quy định

Đổi quota đi muộn 2 → 3 lần/tháng: bấm **"Lưu"** → hiện hộp thoại xác nhận gồm **thay đổi gì** (2 → 3 lần/tháng) · **ngày hiệu lực** (12/11/2026) · **ai bị ảnh hưởng** (toàn công ty — 45 nhân viên nhận thông báo). Bấm **"Áp dụng từ 12/11/2026"** để lưu, **"Hủy"** để quay lại. Muốn hoàn tác thì vào **"Lịch sử thay đổi"** và rollback.

### C6. Trang quy định tra cứu

Render từ `RuleConfig` + `Document`: "Đi muộn / về sớm — 2 lần/tháng, tối đa 60 phút, nộp trong vòng 3 ngày kể từ ngày đi muộn. Hiệu lực từ 01/11/2026 · Phiên bản 3". Kèm ví dụ thực tế.

### C7. Duyệt hàng loạt + chip lý do + chip điều kiện

Mỗi đơn hiển thị kết quả check rule dạng chip ✅/❌ ngay trên danh sách:

```
Minh Hà — Đi muộn 27' ngày 11/11
✅ Trong quota (1/2 lượt tháng 11)    ✅ Trong giờ hạn nộp
❌ Trùng ngày đã xin phép 11/11       ✓ Nghỉ 5 ngày — quản lý duyệt là đủ
```

Duyệt nhiều đơn cùng lúc; lý do từ chối bằng 1 chạm từ chip phổ biến.

## 6. Acceptance criteria

**Chấm công**
- [ ] Chấm công vào/ra thành công, hiển thị giờ + trạng thái ngay
- [ ] Check-in ngoài khung 8h00–9h30 hoặc check-out ngoài 17h00–18h30 → gắn cờ đi muộn/về sớm, **không chặn** (chỉ đơn mới cần quota)
- [ ] Nghỉ trưa 12:00–13:00 **không tính** vào giờ làm
- [ ] Ca linh hoạt bật: check-in 09:30 · check-out 18:00 (tổng ≥ 8h, cả 2 mốc trong khung) → **tính đủ 1 ngày công, không tính đi muộn**
- [ ] Ca linh hoạt bật: tổng giờ làm < 8h → **tính theo giờ thực tế**, không đủ 1 ngày công
- [ ] Ca ngoại lệ (7h30–16h30 · 7h00–16h00 · 10h00–19h00) áp dụng đúng nhóm được gán
- [ ] Thử việc có con nhỏ < 1 tháng → yêu cầu 7 tiếng/ngày
- [ ] Chấm công ngoài mạng công ty (và không phải ngày WFH đã duyệt) → **CHẶN**, hiện gợi ý nối Wi-Fi công ty
- [ ] Chấm công từ thiết bị chưa đăng ký → bị từ chối, hướng dẫn đăng ký
- [ ] **Camera trước hiển thị ngay trên màn hình chấm công**, kèm khung khuôn mặt + trạng thái khớp
- [ ] **Khuôn mặt khớp hồ sơ ≥ 85% + liveness đạt** → chấm công thành công, chạy song song với thiết bị/mạng/GPS/ca
- [ ] **Khuôn mặt không khớp hoặc không đạt liveness → CHẶN**, hiện điểm khớp + số lần thử còn lại; hết 3 lần → hướng dẫn liên hệ HR
- [ ] **Chưa đăng ký khuôn mặt → chưa chấm công được**, hiện nút "Đăng ký khuôn mặt" (3 góc + liveness, chỉ trong mạng công ty)
- [ ] HR reset hồ sơ khuôn mặt kèm lý do → nhân viên đăng ký lại; mọi lần reset có audit log
- [ ] Ảnh chụp không lưu thô lâu dài — chỉ lưu vector đặc trưng; offline thì ảnh chờ đồng bộ rồi xoá
- [ ] Đăng ký **máy thứ 3** (mặc định 2 thiết bị) → tạo yêu cầu chờ HR duyệt, bắt buộc có lý do
- [ ] Ngoài geofence → **CHẶN** (không phải cảnh báo), hiện khoảng cách thật + bản đồ + 2 lối ra (WFH / Thử lại); bán kính cấu hình được, mặc định 150m
- [ ] GPS sai số > 100m (cấu hình được) → **CHẶN** kèm hướng dẫn đứng gần cửa sổ
- [ ] Mất mạng hoàn toàn → **chấm được offline**, hạn đồng bộ cấu hình được (mặc định 24h); quá hạn → entry bị từ chối, phải tạo đơn bổ sung công
- [ ] Ngày WFH đã duyệt → chấm được **ngoài mạng và ngoài bán kính GPS**, bảng công đánh dấu `R`
- [ ] Đơn từ (mọi loại) gửi được **từ bất kỳ đâu** — không cần GPS, không cần Wi-Fi công ty

**Đơn từ**
- [ ] Tạo đơn đi muộn thứ 3 trong tháng → bị chặn, hiện "đã dùng 2/2 lượt"
- [ ] Đơn đi muộn 90 phút → bị chặn (giới hạn 60 phút/lần)
- [ ] Đơn bổ sung công quá hạn (3 ngày lịch, so với **giờ cần bổ sung**) → bị chặn với thông báo đúng mốc
- [ ] Đơn bổ sung công thiếu lý do → form không submit được
- [ ] Bấm "Lưu nháp" → đơn ở trạng thái `draft`, **không** tính quota, **không** hiện cho quản lý
- [ ] Bấm "Gửi" → đơn `submitted`, mới tính quota + tạo task duyệt
- [ ] Đơn nghỉ phép vượt số dư → bị chặn, hiện số dư
- [ ] WFH đăng ký ngày thứ 3 trong tuần → bị chặn
- [ ] WFH đơn dưới 0,5 ngày → bị chặn
- [ ] WFH đăng trong ngày → gắn cờ "đơn gấp", quản lý thấy cờ đỏ
- [ ] Quản lý từ chối → bắt buộc nhập lý do, nhân viên nhận thông báo
- [ ] Đơn của team cấu hình "trưởng nhóm → HR" → trưởng nhóm duyệt lần 1 → HR duyệt lần 2
- [ ] Đổi trưởng nhóm → đơn mới tự giao cho trưởng nhóm mới (đơn đang chờ giữ người đã giao)
- [ ] Đơn chờ duyệt → người gửi **rút được đơn**

**Nghỉ phép**
- [ ] Ngày 15 mỗi tháng tự cộng +1 ngày phép (job chạy đúng)
- [ ] **NV vào làm sau ngày 15 → tháng đó KHÔNG cộng**; kỳ cộng đầu tiên là ngày 15 tháng sau
- [ ] **Phép thâm niên cộng đúng ngày tròn thâm niên** (không gộp vào lần cộng ngày 15)
- [ ] Trang số dư hiện card **phép ốm** (số ngày đã nghỉ + yêu cầu giấy khám từ ngày thứ 2)
- [ ] Trang số dư có **note cách cộng phép** để nhân viên tự hiểu, không phải hỏi HR
- [ ] Manager có +3 ngày phép chức vụ (tổng 15 ngày/năm)
- [ ] Thâm niên +1 ngày mỗi 2 năm, cộng **đúng ngày tròn thâm niên**
- [ ] Phép thử việc 2 ngày chỉ được cộng khi chính thức hoá, không tính 2 lần
- [ ] Mốc 01/04: toàn bộ phép năm cũ chuyển sang dùng được
- [ ] Mốc 01/07: chỉ còn 5 ngày phép năm trước; từ 01/07 tồn = 0
- [ ] Phép tồn bảo lưu thủ công không bị reset
- [ ] Bảng công tách riêng: nghỉ có lương / không lương / BHXH
- [ ] Seed đủ **8 loại nghỉ có cột riêng** (NL · AL · S · RO · CL · ML · PL · UP), mỗi loại 1 dòng cấu hình
- [ ] Có thêm loại nghỉ **không có cột riêng**: hiếu hỉ, tang gia, thai sản nam, thai sản nữ — mỗi loại 1 dòng cấu hình, không thêm cột mới vào bảng công
- [ ] Nghỉ hiếu hỉ / tang gia → không cần giấy tờ; hạn nộp tính theo ngày (mặc định 3 ngày)
- [ ] Thai sản nam → 5 · 7 · 10 · 14 ngày theo chế độ · Thai sản nữ → 6 hoặc 7 tháng, BHXH chi trả
- [ ] **Mọi đơn nghỉ phép chỉ 1 bước duyệt: quản lý trực tiếp** — không chuyển HR
- [ ] Khi export bảng công, hiếu hỉ / tang gia / thai sản nam / thai sản nữ **gộp vào cột tương ứng** — bảng vẫn **đúng 53 cột**

**Bảng công & export**
- [ ] Bảng công có đủ 53 cột, ô ngày hiển thị **ký hiệu gốc** (R/AL/S/1.00/0.50/R÷0.50…)
- [ ] Hover ô ngày → hiện tooltip giải thích ký hiệu (bảng tra cứu 22 dòng)
- [ ] 17 cột tổng hợp **tự tính** theo đúng công thức file gốc: `AY=AM`, `AZ=SUM(AN,AO,AP,AQ,AS)`, `BA=sum(AR,AT,AU,AV)`
- [ ] Export Excel ra **file giống hệt** mẫu `doc/Rule chấm công.xlsx` (tiêu đề merge 2 tầng, ký hiệu gốc)
- [ ] Sửa ô ngày → cột tổng hợp tự tính lại; sửa thẳng cột tổng hợp → bắt buộc có lý do + ghi audit
- [ ] Tạo đơn nhắm tới ngày thuộc kỳ đã khóa → **chặn khi tạo**, báo "Kỳ này đã chốt"
- [ ] Đơn đang chờ mà kỳ bị khóa trong lúc chờ → **tự hủy** + thông báo cho người gửi
- [ ] Kỳ đã khóa **không bao giờ bị sửa** — không có bản ghi điều chỉnh, không áp vào kỳ sau

**WFH**
- [ ] Quota 2 lần/tuần → lần 3 bị chặn
- [ ] Đăng lịch cố định (thứ Sáu hằng tuần) tạo được nhiều tuần

**Bảng công**
- [ ] Bảng công có đủ **53 cột** (5 thông tin + 31 ngày + 17 tổng hợp) theo mẫu `doc/Rule chấm công.xlsx`
- [ ] **Chọn tháng** trên bảng công của tôi: mặc định = tháng hiện tại; đổi tháng bằng dropdown hoặc nút ‹ ›; URL `?month=YYYY-MM`
- [ ] Chọn kỳ đã chốt → xem được nhưng chỉ đọc (nút khiếu nại bị disable)
- [ ] HR công bố bảng công **giữa kỳ** (ngày 11) → mở cửa sổ khiếu nại 2 ngày; trước đó xem số tạm tính nhưng không khiếu nại được
- [ ] Nhân viên khiếu nại trong 2 ngày → được, sau 2 ngày → bị chặn
- [ ] HR chốt → khóa; đơn mới tạo sau đó vào kỳ hiện tại, không sửa kỳ đã chốt
- [ ] Export Excel đúng **53 cột + ký hiệu gốc** (R/AL/S/…), đúng kỳ 01 → cuối tháng — khớp file `Pine team_T10.2026_Timekeeping Report.xlsx`

**Tiện lợi**
- [ ] Nhân viên thấy đủ việc đang chờ trên 1 màn hình, mỗi việc có 1 nút hành động
- [ ] Quên chấm công hôm qua → có việc "bổ sung công" với nút bấm 1 chạm
- [ ] Đơn đi muộn → form điền sẵn **ngày + số phút thật** từ log chấm công
- [ ] HR sửa được 1 ô sai trong bảng công trực tiếp, có audit log + lý do bắt buộc cho cột nhạy cảm
- [ ] HR lọc + lưu được view "Mobile · T11 · đi muộn > 0", mở lại bằng 1 click
- [ ] Đổi quota → bấm "Lưu" hiện hộp thoại xác nhận (thay đổi gì · ngày hiệu lực · ai bị ảnh hưởng), và rollback được từ "Lịch sử thay đổi"
- [ ] Tìm quy định "đi muộn" bằng Ctrl+K ra ngay, có ngày hiệu lực
- [ ] Manager duyệt nhiều đơn 1 lần, lý do từ chối bằng chip 1 chạm
- [ ] Mỗi đơn hiển thị chip ✅/❌ kết quả check rule ngay trên danh sách
