# ACT Hackathon 2026 — Kế hoạch tính năng
> Hệ thống Quản lý Nhân sự nội bộ: **Bài toán 1 — Chấm công** & **Bài toán 2 — OKR**
> Nguồn: `doc/ACT Hackathon 2026_Tai_lieu.pdf` (bản nháp 0.1, 27/10/2026)
> Tài liệu này nói về **tính năng**, không nói về code. Tech stack chốt sau — danh sách này không phụ thuộc stack.

---

## 0. Nguyên tắc chỉ đạo

### 0.1 Tiêu chí thắng cuộc: **ít thao tác nhất**

Người dùng thật (nhân viên, quản lý, HR) không quan tâm công nghệ — họ quan tâm **công việc của mình tốn bao nhiêu thao tác**. Vì vậy mọi tính năng trong hệ thống này đều được thiết kế theo một câu hỏi duy nhất: **nó giúp tiết kiệm bao nhiêu thao tác?**

**Metric duy nhất để đánh giá mọi tính năng:**

> *Tính năng này giúp người dùng tiết kiệm bao nhiêu thao tác, bao nhiêu lần mỗi tháng?*

| Vai trò | Việc lặp lại | Trước | Sau (mục tiêu) |
|---|---|---|---|
| **Nhân viên** | Chấm công vào/ra (2×/ngày) | ~4 chạm | **1 chạm** |
| **Nhân viên** | Báo đi muộn / về sớm | 5 field + tự tính phút + tìm ngày | **1 chạm** (prefill từ log thật) + chọn lý do |
| **Nhân viên** | Biết mình còn việc gì | nhớ trong đầu | **1 màn hình todo** |
| **Nhân viên** | Xem số phép còn lại | vào menu → số dư | **widget trên trang "Cần làm"** |
| **Nhân viên** | Xem bảng công của mình | không có | **chọn tháng, mặc định tháng hiện tại** |
| **Quản lý** | Duyệt 12 đơn/tuần | 12 lần duyệt | **2 lần** (bulk + chip lý do) |
| **Quản lý** | Biết ai vắng hôm nay | hỏi từng người | **lịch nhóm + cảnh báo xung đột** |
| **HR** | Tìm 1 quy định | google trong file pdf/docx | **Ctrl+K** |
| **HR** | Sửa 1 sai lệch bảng công | export → sửa Excel → import lại | **click vào ô → sửa tại chỗ** |
| **HR** | Đổi quota đi muộn | gọi API / sửa DB | **form trên UI + xem trước ảnh hưởng** |
| **HR** | Xuất bảng công ra phần mềm lương | tay làm từng bảng | **1 click** |

### 0.2 Không dùng AI cho nghiệp vụ — **một ngoại lệ: xác thực khuôn mặt**

Hệ thống **không dùng AI để ra quyết định nghiệp vụ**. Mọi tính năng (quota, phép, duyệt, điểm OKR, báo cáo) xử lý bằng rule engine + catalog cấu hình.

**Ngoại lệ duy nhất (yêu cầu 19/11/2026): xác thực khuôn mặt khi chấm công.** Camera trước chụp ảnh, kiểm tra liveness và so khớp **1:1** với hồ sơ đã đăng ký. Mô hình chỉ trả về **điểm khớp** — ngưỡng do HR cấu hình, kết quả cuối cùng vẫn là rule (đạt/không đạt), không suy đoán hành vi, không chấm điểm nhân sự.

Lý do (nói ngắn gọn khi pitch): dữ liệu ở đây đi thẳng vào **bảng lương** và **đánh giá nhân sự** — nơi một câu trả lời sai có hậu quả thật. Rule cho kết quả **tất định, truy vết được, giải thích được** ("vì sao bị chặn" luôn có câu trả lời cụ thể), chạy **tức thì** và **không tốn phí**. Khuôn mặt chỉ là **một lớp xác thực danh tính** — không thay thế bất kỳ rule nghiệp vụ nào.

| Nhu cầu | Giải pháp rule |
|---|---|
| Điền đơn đi muộn từ mô tả tự nhiên | Đọc **log chấm công** → điền sẵn ngày + số phút chính xác |
| Gợi ý điểm OKR | Công thức từ tiến độ đầu việc (tự tính từ giá trị ÷ mục tiêu) |
| Tra quy định | Command palette + trang quy định có ngày hiệu lực |
| Tóm tắt báo cáo | Mô tả sẵn theo mẫu câu, dựng từ dữ liệu đã tính |

### 0.3 Ba luật cứng

1. **Mọi quy định nghiệp vụ phải cấu hình được, không hard-code.** Quota, hạn chót, luật phép tồn, thang điểm → **bảng cấu hình có scope + ngày hiệu lực**. Đây là yêu cầu "độ phủ nghiệp vụ" rõ nhất trong tài liệu.
2. **Không phần mềm nào được làm người dùng mất thêm 1 thao tác để biết thông tin nào đó.** Thông tin phải hiện đúng lúc, đúng chỗ — không phải đi tìm.
3. **Mọi thao tác sửa dữ liệu công / điểm đều có nhật ký thay đổi.**

---

## 1. Cấu trúc điều hướng

**2 module tách biệt, dùng chung 1 khung.** Sidebar chia theo module, mỗi module một nhóm rõ ràng — người dùng luôn biết mình đang ở phần nào.

**Nav có đúng 3 biến thể** — nhân viên / quản lý / HR.

**Luật bắt buộc — mỗi variant là superset của variant nhỏ hơn:**

> **Nhân viên ⊂ Quản lý ⊂ HR.** Mỗi variant = variant nhỏ hơn + nhóm riêng của nó.
> Mọi mục của nhân viên phải có trong cả 2 variant còn lại — không được cắt bớt.

Lý do: nhân viên có thể lên quản lý, quản lý có thể được HR dùng chung tài khoản khi nghỉ phép.
Nav cắt mất item của người dùng = người dùng không tìm được chức năng của chính mình.

**Mọi mục trong nav phải dẫn tới một màn hình thật** — không mục "trang trắng", không mục chỉ để trông đầy.

### 1.1. Menu theo vai trò

```
NHÂN VIÊN (14 mục)                    ← variant gốc
HÔM NAY
  ☑ Cần làm                    [3]   ← trang mặc định sau đăng nhập
  🔔 Thông báo                  [5]
  ⚙ Tuỳ chỉnh thông báo
CHẤM CÔNG
  ◷ Chấm công
  ✎ Đơn của tôi            [1]
     ☘ Xin nghỉ phép · WFH
     ＋ Bổ sung chấm công
  ▦ Lịch công
  ☰ Số dư phép
  ▤ Bảng công của tôi
OKR
  ◎ OKR của tôi
  ＋ Tạo OKR
  ✦ Check-in      [2]
  📊 Báo cáo OKR
CHUNG
  📖 Quy định tra cứu          ← C6, P0
  📱 Thiết bị của tôi

QUẢN LÝ (17 mục) = NHÂN VIÊN + nhóm QUẢN LÝ
QUẢN LÝ
  ✓ Duyệt đơn                  [12]
  👥 Lịch nhóm
  ◎ Review OKR nhóm

HR (24 mục) = NHÂN VIÊN + nhóm HR
HR
  ▤ Bảng công & chốt
  ◈ Danh sách khiếu nại        ← S45, HR xử lý nhanh ngay trên bảng
  ☰ Bảng phép                  ← S46, nhìn 1 lần biết ai còn bao nhiêu
  ⚙ Cấu hình quy định
  🕐 Ca & lịch nghỉ lễ
  🗓 Chu kỳ OKR                ← S44, timeline 5 phase + thang điểm
  📋 Nhật ký thay đổi
  🔒 Quản lý thiết bị (HR)
  👤 Quản lý nhân viên          ← gán nhóm, đặt trưởng nhóm
  🌲 Cây quản lý               ← thấy ai duyệt cho ai, tìm điểm gãy
```

> **Vì sao có "Cây quản lý" nhưng KHÔNG có "Cây phân tầng OKR":** người dùng cần biết *ai duyệt mình*
> — việc đó đã có ở hộp thư duyệt (S12) + trang "Cần làm" (S02), không cần màn hình riêng.
> Còn phân tầng OKR thì chỉ có ở tầng Company (20%, nhân viên **copy xuống**, không phải cây) —
> nên chỉ cần 1 cảnh báo trong báo cáo HR (S25), không cần màn hình riêng.

**Quyết định quan trọng — trang mặc định là "Cần làm" chung, không phải dashboard module:**

Nhân viên không quan tâm việc đang chờ thuộc module nào. Họ chỉ quan tâm *"hôm nay có gì cần làm?"*.
Vì vậy trang đầu tiên sau đăng nhập là **một trang gom việc của cả 2 module** (chấm công + OKR), xếp theo
mức độ ưu tiên. Bấm vào module nào thì vào module đó — nhưng không ai bắt buộc phải đi qua đó.

> **Bài học rút ra từ bản mockup đầu:** mỗi màn hình vẽ lại nav một cách riêng lẻ, dẫn tới
> **11 biến thể nav khác nhau** và làm OKR bị rơi rác ở 3 chỗ khác nhau.
> Sửa bằng cách: chốt **1 cấu trúc nav duy nhất**, dùng chung cho **mọi** màn hình.

---

## 2. 15 tính năng tiện lợi (C1–C15)

> Nguồn sự thật: **`docs/04-business-convenience-features.md`**. Đây là phần quyết định điểm UX —
> mỗi tính năng đều trả lời *"giúp tiết kiệm bao nhiêu thao tác?"*
> Hệ thống ID là **MỘT** — dùng chung cho mọi tài liệu, mọi mockup, mọi tài liệu bàn giao.

| # | Tính năng | Vai trò | Ưu tiên | Màn hình | Spec |
|---|---|---|---|---|---|
| C1 | **Todo inbox** — 1 màn hình gom mọi việc đang chờ mình | NV + QL | **P0** | S02 | `docs/04` §C1 |
| C2 | **Nhắc việc tự động** — 3 kênh, đúng lúc, có chống spam | Tất cả | **P0** | S04, S04m | `docs/04` §C2 |
| C3 | **Command palette Ctrl+K** — tìm nhân viên / đơn / quy định / cấu hình | Tất cả | **P0** | S03 | `docs/04` §C3 |
| C4 | **Sửa bảng công tại chỗ** — click vào ô, không export → sửa Excel → import | HR | **P0** | S15 | `docs/04` §C4 |
| C5 | **Bộ lọc mạnh + lưu view** (vd "Mobile · T11 · đi muộn > 0") | HR | **P0** | S15 | `docs/04` §C5 |
| C6 | **Trang quy định tra cứu** — sinh tự động từ cùng catalog với C10 | Tất cả | **P0** | S19 | `docs/04` §C6 |
| C7 | **Duyệt hàng loạt + chip lý do** | QL | **P1** | S12, S14 | `docs/04` §C7 |
| C8 | **Review OKR dạng bảng so sánh cả nhóm** + điểm đề xuất theo rule | QL | **P1** | S24 | `docs/04` §C8 |
| C9 | **Onboarding tour** + trạng thái rỗng có CTA | Tất cả | **P2** | S36 | `docs/04` §C9 |
| **C10** | **Trình cấu hình quy định** — HR sửa quota/luật bằng form, có versioning + rollback + confirm khi lưu | HR | **P0** | S16, S17, S32 | `docs/04` §C10 · `docs/06` |
| **C11** | **Chấm công tối ưu cho điện thoại** — web responsive (không có app riêng), 1 chạm < 4s, **xác thực khuôn mặt qua camera**, rung, offline | NV | **P0** | S05m | **`docs/07-business-mobile-punch.md`** |
| **C12** | **Nhắc việc theo từng actor** — 17 sự kiện × 3 vai trò, chống spam | Tất cả | **P0** | S04m | `docs/04` §C12 |
| **C13** | **Loại nghỉ cấu hình được** — thêm/sửa loại mà không sửa code (3 tầng kế thừa) | HR | **P0** | S30, S32 | **`docs/02` §2.3** |
| **C14** | **Gợi ý kế thừa từ OKR quản lý** — bấm 1 chạm chép mục tiêu đã duyệt của quản lý | NV | **P0** | S21 | `docs/04` §4.1 |
| **C15** | **Tóm tắt báo cáo OKR** — dựng từ số liệu đã tính theo mẫu câu | HR | **P0** | S25 | `docs/04` §4.2 |

> Ngoài 15 mục này còn có **"C-cố"** — tự động điền đơn đi muộn từ log chấm công thật
> (`docs/02` §C-cố, màn hình S07). Nó không thuộc hệ thống C1–C15.
>
> **C10 + C6 là một thiết kế duy nhất:** một *catalog quy định* sinh ra cả form cấu hình (cho HR)
> lẫn trang tra cứu (cho nhân viên). Nhờ vậy đổi quota xong, nhân viên thấy quy định mới ngay —
> không có chuyện tài liệu lệch với phần mềm. Chi tiết: `docs/06-business-rule-builder.md`.

---

## 3. Thứ tự làm theo nhóm tính năng

> Chi tiết từng mục + tiêu chí nghiệm thu: **`docs/08-business-tasks-checklist.md`** (checklist theo tính năng).
> Thứ tự dưới đây là **thứ tự phụ thuộc**, không phải lịch theo ngày — chia ngày sẽ phụ thuộc số người.

| Bước | Nhóm tính năng | Mục | Vì sao đi trước |
|---|---|---|---|
| **1** | Nền tảng & tổ chức | A1–A5 | Mọi thứ khác cần biết *ai duyệt ai*, *quyền ai xem gì* |
| **2** | Chấm công — nhân viên | B1–B4 | Đây là thao tác lặp lại nhiều nhất (2×/ngày) — làm sớm để test sớm |
| **3** | Đơn từ — nhân viên | C1c–C6c | Đơn tạo ra dữ liệu cho bảng công |
| **4** | Cấu hình quy định | E3–E8 | **Phải có trước** khi tính công, để mọi rule cấu hình được |
| **5** | Bảng công & chốt | E1–E2, D4, E9–E10 | Gom đầu vào (chấm công + đơn) thành bảng công 53 cột · kèm danh sách khiếu nại (S45) & bảng phép (S46) |
| **6** | Duyệt đơn | D1–D3 | HR và quản lý bắt đầu dùng hệ thống |
| **7** | OKR | F1–F9 | Module thứ 2, độc lập với chấm công ngoài khung dùng chung |
| **8** | Tiện lợi dùng chung | G1–G4 | Cần cả 2 module xong mới "Cần làm" gom được đủ việc |
| **9** | Làm đẹp & bổ sung | G5–G6, A6, F7 | P1–P2 — làm được thì làm |

> **Điều kiện cắt:** nếu trượt tiến độ → cắt từ dưới lên (bước 9 → 8 → 7). **Không bao giờ cắt** các mục
> trong "Không bao giờ cắt" ở `docs/08`.

---

## 4. Rủi ro & cách xử lý

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| Tính năng nhiều, làm không kịp | Cao | Cắt theo bảng ở §2 + điều kiện cắt trong `docs/08`. P0 là bảo vệ tuyệt đối |
| Bảng công lệch file HR thật | Cao | Dùng **chính file `doc/Pine team_T10.2026_Timekeeping Report.xlsx`** làm chuẩn — **53 cột** + ký hiệu gốc. Đây là điểm chống sai tuyệt đối |
| Quy định hard-code rồi quên cấu hình | Cao | **19 luật** trong catalog + form cấu hình + trang tra cứu sinh từ **cùng một nguồn** |
| Không ai dùng vì phải tìm nhiều | Trung bình | Nav 3 variant là superset · trang mặc định "Cần làm" · Ctrl+K · widget số phép |
| Gian lận chấm công hộ | Trung bình | **4 lớp ở §4.1** (gồm xác thực khuôn mặt) — **thành thật về giới hạn**, không hứa chặn được tất cả |
| Chấm công trong tòa nhà bị GPS lệch → chặn nhầm | Trung bình | Bán kính **150m** (cấu hình được 50–5000m) · sai số > 100m thì coi như chưa xác định được vị trí và hướng dẫn ra gần cửa sổ |
| Wi-Fi công ty yếu ở tầng cao | Thấp | Cho phép chấm **offline** (mặc định 24h, cấu hình được) + đồng bộ lại, có cờ cho HR |
| Nhân viên dùng nhiều máy | Thấp | Mặc định 2 máy · máy thứ 3 cần HR duyệt · có lý do · không "ngoại lệ" |

### 4.1. Chống dùng chung tài khoản (R10) — 4 lớp
> **Không có hệ thống nào chặn được** gian lận cố ý tinh vi (A đứng cạnh B, B cầm điện thoại A check-in hộ).
> Mục tiêu thật: biến gian lận từ *không tốn công gì* → thành *tốn công, dễ bị phát hiện, HR có bằng chứng*.

| Lớp | Cơ chế | Chặn được gì |
|---|---|---|
| **1 — Chặn ở gốc** | Tối đa **1 lần check-in/ngày** | Chặn "chia ca": 2 người share 1 account → chỉ 1 người công 1 ngày |
| | **Mặc định 2 máy**, máy thứ 3 cần HR duyệt | Không dùng 3 máy để chấm hộ |
| | Đăng nhập bằng **tài khoản nội bộ** (HR cấp, bắt buộc đổi mật khẩu lần đầu) + cảnh báo đăng nhập lạ | Không có mật khẩu dùng chung lâu dài |
| | Mỗi ngày chỉ 1 dòng chấm công/người | Chặn 2 entry cùng ngày |
| | Quota tính **theo người** | Share → dùng chung quota → không đáng |
| **2 — Quản lý thiết bị (HR)** | Hộp thư duyệt đăng ký mới · **thu hồi** khi máy mất/bị trộm · tự thu hồi sau 90 ngày không dùng · chỉ nhận yêu cầu từ mạng nội bộ công ty | Đóng lỗ hổng khi máy bị trộm; tránh thiết bị lạ ngoài văn phòng |
| | **Yêu cầu thêm thiết bị** — mặc định 2 máy, HR duyệt yêu cầu (có lý do) thì được dùng thêm; gỡ máy thứ 3 → tự về 2 | Rủi ro có kiểm soát: vẫn giữ 1 check-in/ngày nên 2 người share vẫn chỉ công 1 người/ngày |
| **3 — Sinh trắc học** | **Camera trước + khuôn mặt khớp hồ sơ (≥ 85%) + liveness** ở mỗi lần chấm; chưa đăng ký → chưa chấm được | Người khác cầm máy đã đăng ký vẫn không qua được bước khuôn mặt |
| **4 — Minh bạch** | Trang "Thiết bị đăng ký" + trạng thái hồ sơ khuôn mặt ai cũng xem được | Chi phí ~0, hiệu quả bất ngờ |

**Thêm thiết bị (mặc định 2 máy — không có khái niệm "ngoại lệ"):**
- Mặc định **2 máy**. Muốn dùng 3 máy → nhân viên gửi **yêu cầu thêm thiết bị** (kèm lý do) → HR duyệt.
- Hạn mức được **suy ra từ danh sách thiết bị đang hoạt động** — không có bảng riêng, không thể lệch với thực tế.
- Nhân viên **tự gỡ** máy thứ 3 → hạn mức **tự động về 2 máy**, không cần ai xử lý.
- HR có thể đặt hạn cho máy được duyệt; hết hạn → tự thu hồi + thông báo.
- Nhân viên **không tự cấp được** máy thêm — mọi máy thêm đều phải qua HR duyệt.

**Nguyên tắc "không để nhân viên mất công"** (điều kiện để giới hạn 2 máy dùng được):
- Đổi máy → duyệt = **thay thế** thiết bị cũ, lịch sử chấm công cũ giữ nguyên.
- Nhân viên đã check-in bằng máy cũ rồi đổi máy giữa ngày → cho **ghi đè giờ ra** mà không cần chờ duyệt.
- Máy mất/bị trộm → HR **thu hồi** ngay lập tức (chặn chấm công trên máy đó), lịch sử cũ vẫn giữ.
- Thiết bị không dùng 90 ngày → tự thu hồi + nhắc nhân viên đăng ký lại.

> **Không có lớp suy đoán hành vi.** Hệ thống **không** tự phân tích pattern để gắn nhãn nhân viên.
> Chỉ 4 lớp trên: **chặn ở gốc · quản lý thiết bị · sinh trắc học · minh bạch**.
> Khuôn mặt chỉ dùng để **xác thực 1:1** khi chấm công — không suy đoán thái độ, không chấm điểm nhân sự.

---

## 5. Ma trận độ phủ nghiệp vụ (đối chiếu tài liệu)

> Mỗi dòng mục **6.1–6.7** và **4.1–4.4** phải có trạng thái ✅ hoặc ⚠️ có chủ ý.

### Bài toán 1 — Chấm công & Đơn từ (Mục 6)

| Mục | Yêu cầu trong tài liệu | Tính năng | Trạng thái |
|---|---|---|---|
| 6.1 | Chấm công vào/ra qua app di động hoặc web | **Web responsive** (cùng URL cho điện thoại + desktop, **không có app riêng**), **1 chạm**, **camera xác thực khuôn mặt** + liveness | ✅ |
| 6.1 | Chỉ hợp lệ khi kết nối mạng nội bộ công ty | IP allowlist + heartbeat + cờ `network_ok` | ✅ |
| 6.1 | Chống chấm công hộ — chỉ trên thiết bị đã đăng ký | Device registration, **mặc định 2 thiết bị** (máy thứ 3 cần HR duyệt) | ✅ |
| 6.1 | Kiểm tra GPS quanh văn phòng | Geofence theo văn phòng | ✅ |
| 6.1 | HR định nghĩa ca: giờ vào/ra/nghỉ trưa, cố định hoặc linh hoạt, gán ca cho nhóm | `Shift` + `ShiftAssignment` + `is_flexible` | ✅ |
| 6.1 | Lịch ngày lễ, ngày nghỉ do HR cấu hình theo năm | `Holiday` theo năm | ✅ |
| 6.2 | Giới hạn đi muộn/về sớm cấu hình được, có ngày hiệu lực | `RuleConfig` có `effective_from/to` | ✅ |
| 6.2 | Quota 2 lần/tháng, 60 phút/lần | Đúng quyết định HR | ✅ |
| 6.2 | Có thể áp dụng mức khác nhau cho từng nhóm | Rule theo `scope` | ✅ |
| 6.2 | Nhân viên luôn thấy số lượt còn lại trong tháng | Endpoint quota + badge trên form | ✅ |
| 6.2 | Vượt quota → **không cho tạo đơn** | Chặn ở server, không chỉ ở UI | ✅ |
| 6.3 | Đơn bổ sung chấm công: quota 5 lần/tháng | Đúng quyết định HR | ✅ |
| 6.3 | Hạn nộp: 3 ngày làm việc kể từ ngày quên chấm | Tính theo ngày làm việc, **cấu hình được** | ✅ |
| 6.3 | Bắt buộc ghi lý do | Validate server-side | ✅ |
| 6.3 | Quản lý duyệt | Approval engine | ✅ |
| 6.3 | *(bổ sung)* Hạn nộp cấu hình được + cho phép nộp quá hạn nếu HR duyệt | Rule `makeup` | ✅ |
| 6.4 | *(bổ sung)* Hạn gửi đơn nghỉ phép (ngày làm việc) | Rule `leave_request` | ✅ |
| 6.4 | *(bổ sung)* Loại nghỉ cần giấy tờ từ ngày thứ mấy | Rule `leave_request` | ✅ |
| 6.4 | *(bổ sung)* Giới hạn ngày nghỉ liên tiếp | Rule `leave_request` | ✅ |
| 6.4 | Mỗi loại nghỉ có cấu hình riêng (hưởng lương, đơn vị, giấy tờ) | `LeaveType` 5 loại + "không lương" | ✅ |
| 6.4 | *(bổ sung)* Loại nghỉ **tùy chỉnh/thêm mới được**, không cần sửa code | Catalog tham số + 3 tầng kế thừa | ✅ |
| 6.4 | Số dư phép tự động, nhân viên xem số ngày còn lại | `LeaveBalance` + sổ `LeaveTransaction` | ✅ |
| 6.4 | Cộng phép theo tháng (ngày 15) hay đầu năm | HR chọn được; mặc định theo tháng ngày 15 | ✅ |
| 6.4 | Phép tồn chuyển sang năm sau & hết hạn khi nào | Đúng luật 01/04 → 01/07 → 0 | ✅ |
| 6.4 | Nghỉ BHXH chi trả đánh dấu riêng trên bảng công | Cột `bhxh_leave_days` riêng | ✅ |
| 6.4 | Phép thâm niên +1/2 năm; phép chức vụ manager +3 | Rule `leave_seniority` + `leave_position_bonus` | ✅ |
| 6.5 | Đăng ký WFH: ngày/nửa ngày, lẻ hoặc lịch cố định | `WfhSchedule` (one-off / recurring) | ✅ |
| 6.5 | Quota 2 lần/tuần, theo nhóm/vị trí; vị trí cấm WFH | Rule theo scope + `Position.allow_wfh` | ✅ |
| 6.5 | Hạn đăng ký ≥1 ngày làm việc; đơn gấp được nhưng đánh dấu | Validate + cờ `is_late_request` | ✅ |
| 6.5 | Chấm công ngoài mạng công ty trong ngày WFH đã duyệt | Exception khi có WFH approved | ✅ |
| 6.5 | Báo cáo công việc cuối ngày WFH | Trường `wfh_report` | ✅ |
| 6.5 | Ngày WFH tính công bình thường nhưng đánh dấu riêng | Cột `wfh_days` riêng | ✅ |
| 6.5 | Quản lý xem lịch WFH và nghỉ phép của cả nhóm | **Lịch nhóm + cảnh báo xung đột** | ✅ |
| 6.6 | Quy trình duyệt chung: quota check → manager duyệt/từ chối (có lý do) | Approval engine + quota check lúc tạo | ✅ |
| 6.6 | Một số loại đơn cần HR duyệt thêm | Rule `hr_approval` (nhóm CA+Mobile) — **chỉ đơn đi muộn / bổ sung công / WFH**. **Đơn nghỉ phép chỉ quản lý duyệt** | ✅ |
| 6.6 | Kết quả tự động cập nhật vào bảng công + thông báo | Event → cập nhật `TimeEntry`/`Timesheet` | ✅ |
| 6.7 | Bảng công: công chuẩn, công thực tế, WFH, đi muộn/về sớm (lần + phút), nghỉ có/không lương, BHXH, vi phạm | Đủ **53 cột** (khớp mẫu export thật) | ✅ |
| **Excel** | **Rule chấm công chính thức**: giờ vào 8h00–9h30 · ra 17h00–18h30 · nghỉ trưa 12:00–13:00 · đủ 8h/ngày, 4h/nửa ngày | Rule `shift_times` scope=shift | ✅ Đã chốt |
| **Excel** | **Ca ngoại lệ** 7h30–16h30 · 7h00–16h00 · 10h00–19h00 | Ca cố định theo nhóm | ✅ Đã chốt |
| **Excel** | **TH con nhỏ < 1 tháng** → 7 tiếng/ngày | Rule scope=position | ✅ Đã chốt |
| **Excel** | **8 loại nghỉ** NL·AL·S·RO·CL·ML·PL·UP (khớp cột export) | Seed 8 loại + `param_catalog` | ✅ Đã chốt |
| **Excel** | **WFH**: 2 ngày/tuần · chặn ngày thứ 3 · đơn tối thiểu 0,5 ngày | Rule `wfh` | ✅ Đã chốt |
| **Excel** | **Nút SUBMIT** (Save = nháp, không tính quota) | `Request.status = draft\|submitted` | ✅ Đã chốt |
| **Excel** | **Luồng duyệt theo team**: team CA & Mobile có bước duyệt trưởng nhóm riêng → HR | Rule `approval_flow` scope=team (cấu hình theo nhóm, **không hardcode tên**) | ✅ Đã chốt |
| **Excel** | **Hạn 03 ngày so với giờ cần bổ sung** (08:00 T6 → 08:00 T2) | `check_makeup_deadline()` | ✅ Đã chốt |
| **Excel** | **Phép thử việc 2 ngày** cộng khi chính thức hoá | `accrue_probation_leave()` | ✅ Đã chốt |
| 6.7 | Kỳ công 01 → cuối tháng | Đúng quyết định HR | ✅ |
| 6.7 | Nhân viên xem bảng công & khiếu nại trong 2 ngày | `TimesheetDispute` + cửa sổ 2 ngày | ✅ |
| 6.7 | HR xử lý khiếu nại → chốt & khóa | `status: open→reviewing→locked` | ✅ |
| 6.7 | Xuất bảng công chuẩn (không tính lương) | Excel export đúng format | ✅ |
| 6.7 | *(bổ sung)* HR xử lý khiếu nại với dữ liệu gốc để đối chiếu | Màn hình 3 cột so sánh (S33) | ✅ |
| 6.7 | *(bổ sung)* **Danh sách khiếu nại — xử lý nhanh ngay trên bảng** | `TimesheetDispute` + màn hình danh sách (S45) | ✅ Đã chốt (PO 18/11/2026) |
| 6.4 | *(bổ sung)* **Bảng phép — nhìn 1 lần biết ai còn bao nhiêu** | `LeaveBalance` + màn hình bảng phép (S46) | ✅ Đã chốt (PO 18/11/2026) |
| 6.7 | *(bổ sung)* Nhật ký thay đổi — ai sửa gì, lúc nào, vì lý do gì | `AuditLog` + màn hình tra cứu (S35) | ✅ |
| 6.4 | *(bổ sung)* Sổ phép append-only, truy vết được mọi thay đổi số dư | `LeaveTransaction` + màn hình sổ phép (S34) | ✅ |
| 6.7 | Đơn duyệt sau khi khóa | **Kỳ đã khóa là cuối cùng — chặn đơn từ lúc tạo, đơn đang chờ tự hủy; không có model điều chỉnh** | ✅ |
| Q7 | Kỳ công = 01 → cuối tháng | ✅ | ✅ |
| Q7 | Vượt quota đi muộn/về sớm → không cho tạo đơn | ✅ | ✅ |
| Q7 | Đi muộn không có đơn → trừ công theo đúng giờ làm việc thực tế | Trừ đúng số phút thực tế | ✅ |
| Q7 | Quota: WFH 2/tuần, bổ sung công 5/tháng, đi muộn 2/tháng | ✅ | ✅ |
| Q7 | Rule áp dụng chung, không phân biệt nhóm/chức vụ | **Chỉ áp dụng toàn công ty (global)** — không ghi đè theo nhóm/chức danh | ✅ |
| Q7 | Đơn cần HR duyệt thêm: Team CA + Mobile | Rule `hr_approval` — chỉ cho đi muộn / bổ sung công / WFH; **nghỉ phép không chuyển HR** | ✅ |
| Q7 | Đăng nhập bằng tài khoản Google của công ty | **Đã đổi 19/11/2026 → tài khoản nội bộ (Non-SSO)**: HR cấp tài khoản → email kích hoạt → bắt buộc đổi mật khẩu → đăng ký khuôn mặt; **vai trò tự xác định — không chọn vai trò** | ✅ |

### Bài toán 2 — OKR (Mục 4)

| Mục | Yêu cầu trong tài liệu | Tính năng | Trạng thái |
|---|---|---|---|
| 4.1 | Chu kỳ: thiết lập / cập nhật / review giữa năm / đánh giá cuối năm / tổng hợp | `OkrCycle` 5 phase cấu hình được | ✅ |
| 4.1 | HR cấu hình mốc và hạn chót cho từng năm | Mỗi phase có `start`/`due` | ✅ |
| 4.1 | Hệ thống tự nhắc nhân viên và quản lý trước hạn | Scheduler + notification | ✅ |
| 4.2 | **2 nhóm cố định** Business/People; nhân viên tự nhập đầu việc | `Objective.category` | ✅ |
| 4.2 | ~~Template theo nhóm/cấp bậc~~ | **Bỏ** — không template (PO 18/11/2026) | ✅ |
| 4.3 B1 | Nhân viên tự nhập OKR và gửi | Wizard 2 bước | ✅ |
| 4.3 B2 | Quản lý duyệt hoặc trả lại kèm góp ý | 2 hành động, trả lại bắt buộc lý do | ✅ |
| 4.3 B3 | Nhân viên cập nhật tiến độ định kỳ trong năm | Check-in theo từng KR | ✅ |
| 4.3 B4 | Quản lý review giữa năm: nhận xét, điều chỉnh | Sửa Objective/KR có audit trail | ✅ |
| 4.3 B5 | Nhân viên tự chấm điểm từng Key Result | Form tự chấm | ✅ |
| 4.3 B6 | Quản lý: Duyệt điểm / Trả lại / Sửa điểm (**bắt buộc ghi lý do**) | 3 nhánh, validate lý do | ✅ |
| 4.3 B7 | HR kiểm tra, chốt và khóa kết quả; xuất báo cáo | Lock + report + export | ✅ |
| 4.3 | Lưu cả điểm tự chấm và điểm quản lý để đối chiếu | `self_score` + `manager_score` hiển thị cạnh nhau | ✅ |
| 4.3 | Sau hạn chót OKR bị khóa; chỉ HR mở lại được | Cron khóa + `reopen` chỉ HR | ✅ |
| 4.3 | **Nộp OKR là khoá** — không ai sửa được tới khi được mở | `Objective.edit_state` = `submitted`/`locked` | ✅ Đã chốt (PO 18/11/2026) |
| 4.3 | **Review giữa kỳ & cuối kỳ: QL mở cho NV sửa/bổ sung rồi nộp lại** | `edit_state` = `reopened` → `locked`, có audit log | ✅ Đã chốt (PO 18/11/2026) |
| 4.3 | **Xoá mục → vẫn lưu vết + bắt buộc lý do** | `deleted_at` + `delete_reason`; điểm chỉ tính mục chưa xoá | ✅ Đã chốt (PO 18/11/2026) |
| 4.3 | Báo cáo: tiến độ nộp theo PB, danh sách chưa nộp, phân bố điểm, xuất Excel | 4 báo cáo | ✅ |
| 4.4 | Chuyển phòng / đổi quản lý giữa năm → ai đánh giá? | Chụp reviewer lúc gửi + reassign có lý do | ✅ |
| 4.4 | Nhân viên mới vào giữa năm → có làm OKR phần còn lại? | Cho phép, tự scale theo thời gian còn lại | ✅ |
| 4.4 | Nghỉ việc trước kỳ đánh giá | Ẩn khỏi báo cáo, chỉ tính OKR đã gửi | ✅ |
| **OKR-doc** | **2 nhóm objective: Business + People** | `Objective.category` + `OkrAchievement` | ✅ Đã chốt |
| **OKR-doc** | **Điểm 1–5 mỗi nhóm, không có điểm lẻ, phần mềm tự tính điểm TB** | `OkrAssessment.business_score/people_score/average_score` | ✅ Đã chốt |
| **OKR-doc** | **Đính kèm file làm evidence** — **chỉ ở check-in & bản chấm**, không phải lúc tạo OKR | `OkrCheckIn.attachments` + `OkrAssessment.attachments` + `OkrReview.attachments` | ✅ Đã chốt (PO 18/11/2026) |
| **OKR-doc** | **Box 4 — Self proposal next year** (+ điểm cần cải thiện) | `OkrSelfProposal` + card trên "OKR của tôi" (có trạng thái) | ✅ Đã chốt |
| **OKR-doc** | **Quy trình 5 bước** (NV tự đánh giá → QL → HR tổng hợp → Giám đốc → bàn giao) | 5 task approval, mỗi bước 1 hạn chót | ✅ Đã chốt |
| **OKR-doc** | **Bảng tổng hợp HR 9 trường** (tên · code · vị trí · thời gian công tác · PB · tên QL · điểm CV · điểm con người · điểm TB) | `OkrAssessment` + báo cáo tổng hợp | ✅ Đã chốt |
| **OKR-doc** | **Quyền xem theo phạm vi**: NV chỉ mình · QL cả PB · Giám đốc PM toàn công ty | `UserScope.scope_type` + `visible_user_ids()` | ✅ Đã chốt |
| **Guidance** | **Timeline thật**: Setup Q1 → Check-in Mar–Apr → Review Jun–Jul → Assessment Nov–Dec | Mốc tháng mặc định cho 5 phase | ✅ Đã chốt |
| **Form CSV** | **Danh mục objective tham khảo** theo 2 nhóm | Chỉ dùng làm tài liệu — không model template | ✅ Đã chốt |
| Q7 | OKR cập nhật định kỳ bao lâu một lần | **Mặc định hàng tháng** (cấu hình được trong cycle config) | ✅ Đã chốt — HR đổi được trong 1 click |
| Q7 | Thang điểm | **1–5**, 2 nhóm Business/People, điểm TB tự tính — **chỉ dùng điểm, không xếp loại** | ✅ Đã chốt |
| Q7 | OKR có phân tầng không | **Có: theo cây nhóm** — số tầng tự do (cấu hình được) | ✅ Đã chốt |

---


---

## 6. Tài liệu chi tiết

| File | Nội dung |
|---|---|
| **`mockups/index.html`** | **Mở bằng trình duyệt — mockup + mô tả 45 màn hình (S00–S46, gồm 2 bản mobile). Tài liệu chính để team review & bình luận.** |
| **`docs/08-business-tasks-checklist.md`** | **Checklist theo TÍNH NĂNG** — mỗi mục có màn hình mockup + tiêu chí nghiệm thu + phụ thuộc |
| `docs/01-business-shared-core.md` | Auth, RBAC, tổ chức, approval engine, notification, nhật ký thay đổi, action center |
| `docs/02-business-attendance-time-tracking.md` | Bài toán 1: rule nghiệp vụ, màn hình, acceptance criteria |
| `docs/03-business-okr-performance.md` | Bài toán 2: vòng đời OKR, màn hình, acceptance criteria |
| `docs/04-business-convenience-features.md` | **15 tính năng tiện lợi theo vai trò** (C1–C15) + spec chi tiết |
| `docs/05-business-data-model.md` | Mô hình dữ liệu + ERD + seed data |
| `docs/06-business-rule-builder.md` | **Trình cấu hình quy định** — catalog 19 luật, versioning, rollback, trang tra cứu |
| `docs/07-business-mobile-punch.md` | **Chấm công trên điện thoại (web responsive, không cần app)** — 1 chạm < 4s, **camera + khuôn mặt + liveness**, rung, offline, accessibility |
| `docs/09-business-ba-po-guidelines.md` | **Tài liệu cho BA & PO** — hành trình người dùng, 15 tính năng, quyết định đã chốt, tiêu chí nghiệm thu |

---

## 7. Definition of Done

Một tính năng chỉ được coi là **xong** khi:

- [ ] **Có mockup trong `mockups/index.html`** và đã được team review
- [ ] Có **tiêu chí nghiệm thu** tick hết trong `docs/08`
- [ ] Chặn/quota được kiểm tra ở **tầng nghiệp vụ**, không chỉ ở giao diện
- [ ] Mọi thao tác sửa dữ liệu công / điểm đều có **nhật ký thay đổi**
- [ ] Giao diện có đủ 3 trạng thái: **đang tải / rỗng (có CTA) / lỗi**
- [ ] Có **dữ liệu mẫu** mô tả được tình huống thật
- [ ] Chạy được trên **điện thoại (375px)** và desktop
- [ ] **Mọi quy định liên quan đều sửa được trên UI** — không còn chỗ nào phải gọi API tay để đổi rule
- [ ] Judge có thể tự thao tác được mà không cần hướng dẫn
