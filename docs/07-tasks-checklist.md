# 07 — Checklist triển khai theo tính năng

> **Cách dùng:** mỗi tính năng là 1 mục. Mỗi mục có **màn hình mockup** để team nhìn thấy
> sản phẩm phải ra sao, **tiêu chí nghiệm thu** để biết xong chưa, và **phụ thuộc** để biết
> làm sau cái gì.
> **Không viết theo ngày, không viết theo file/framework** — tech stack chốt sau, danh sách này
> không đổi theo stack.
>
> **Ưu tiên:** 🔴 **P0** = bắt buộc có · 🟡 **P1** = có thì tốt · ⚪ **P2** = làm được thì làm.
> **Cắt theo thứ tự ngược lại: P2 → P1 → P0. Không bao giờ cắt P0.**

---

## 0. Bản đồ: tính năng ↔ màn hình ↔ tài liệu

| # | Tính năng | Vai trò | Màn hình | Tài liệu chi tiết |
|---|---|---|---|---|
| **A. Vào hệ thống & tổ chức** |
| A1 | Đăng nhập theo vai trò | Tất cả | S01 | `docs/01` §3 |
| A2 | Cấu trúc điều hướng, 3 biến thể menu | Tất cả | S00 | `PLAN.md` §1.1 |
| A3 | Quản lý nhân viên | HR | S40 | `docs/01` §2 |
| A4 | Cây nhóm lồng nhau, số tầng tự do | HR | S41 | `docs/01` §2 |
| A5 | Nhật ký thay đổi | HR | S35 | `docs/01` §2 |
| A6 | Ủy quyền khi đi công tác | QL | S37 | `docs/01` §2 |
| **B. Chấm công — nhân viên** |
| B1 | Chấm công trên điện thoại (1 chạm) | NV | S05m | `docs/09` |
| B2 | Chấm công trên desktop | NV | S05 | `docs/02` §3 |
| B3 | Lịch công tháng | NV | S06 | `docs/02` §3 |
| B4 | Bảng công của tôi + chọn tháng + khiếu nại | NV | S11 | `docs/02` §5.1 |
| B5 | Thiết bị của tôi (đăng ký, thu hồi) | NV+HR | S27 | `docs/01` §2 |
| B6 | Thêm thiết bị (1 flow duy nhất) | NV+HR | S29 | `docs/01` §2.1 |
| **C. Đơn từ — nhân viên** |
| C1c | Tạo đơn đi muộn — prefill từ log chấm công | NV | S07 | `docs/02` §6 |
| C2c | Đơn bổ sung chấm công | NV | S31 | `docs/02` §6 |
| C3c | Đơn của tôi — lịch sử + trạng thái | NV | S08 | `docs/02` §5.1 |
| C4c | Xin nghỉ phép (8 loại) | NV | S30 | `docs/02` §2.3 |
| C5c | Đăng ký WFH | NV | S10 | `docs/02` §5.1 |
| C6c | Số dư phép | NV | S09 | `docs/02` §5.1 |
| **D. Đơn từ — quản lý & HR** |
| D1 | Duyệt đơn hàng loạt + chip lý do | QL | S12 | `docs/04` §C8 |
| D2 | Chi tiết đơn — timeline | QL | S13 | `docs/02` §5.2 |
| D3 | Lịch nhóm + cảnh báo xung đột | QL | S14 | `docs/02` §5.2 |
| D4 | Xử lý khiếu nại bảng công | HR | S33 | `docs/02` §5.3 |
| D5 | Sổ phép (ledger) | HR | S34 | `docs/02` §5.3 |
| **E. Bảng công & cấu hình — HR** |
| E1 | Bảng công & chốt — sửa tại chỗ, 45 cột | HR | S15 | `docs/04` §C4 · `docs/02` §2.1.3 |
| E2 | Bộ lọc + lưu view | HR | S15 | `docs/04` §C5 |
| E3 | Cấu hình quy định (19 luật) | HR | S16 | `docs/08` |
| E4 | Cấu hình 1 luật (form sinh tự động) | HR | S17 | `docs/08` |
| E5 | Dry-run ảnh hưởng + lịch sử phiên bản | HR | S18 | `docs/04` §C6 |
| E6 | Trang quy định tra cứu | Tất cả | S19 | `docs/04` §C7 |
| E7 | Ca làm việc & lịch nghỉ lễ | HR | S26 | `docs/02` §5.3 |
| E8 | Quản lý loại nghỉ | HR | S32 | `docs/02` §2.3 |
| E9 | Quản lý thiết bị (duyệt/thu hồi) | HR | S28 | `docs/01` §2 |
| **F. OKR** |
| F1 | Dashboard OKR | NV | S20 | `docs/03` §2 |
| F2 | Tạo OKR — tự nhập, 2 nhóm cố định | NV | S21 | `docs/03` §3 · `docs/04` §C17 |
| F3 | Check-in tiến độ | NV | S22 | `docs/03` §4 |
| F4 | Duyệt OKR đầu năm | QL | S42 | `docs/03` §5 |
| F5 | Review giữa năm | QL | S43 | `docs/03` §5 |
| F6 | Đánh giá cuối năm (form 4 box) | QL | S23 | `docs/03` §5 |
| F7 | Review OKR cả nhóm | QL | S24 | `docs/04` §C9 |
| F8 | Báo cáo OKR + cột Trạng thái | HR | S25 | `docs/03` §6 |
| F9 | Quản lý chu kỳ OKR | HR | S44 | `docs/03` §5 |
| **G. Tiện lợi dùng chung** |
| G1 | Todo inbox — màn hình mặc định | NV+QL | S02 | `docs/04` §C1 |
| G2 | Command palette Ctrl+K | Tất cả | S03 | `docs/04` §C3 |
| G3 | Thông báo & nhắc việc | Tất cả | S04, S04m | `docs/04` §C2 |
| G4 | Tuỳ chỉnh thông báo | Tất cả | S36 | `docs/04` §C12 |
| G5 | Báo cáo tự động theo lịch | HR | S39 | `docs/04` §C10 |
| G6 | Import Excel | HR | S39 | `docs/04` §C11 |

---

## A. Vào hệ thống & tổ chức

### A1 · Đăng nhập theo vai trò 🔴 · S01
**Cần có:** màn hình đăng nhập, 4 nút vào nhanh (nhân viên / quản lý / HR / admin).
**Nghiệm thu:**
- [ ] Chọn vai trò → vào thẳng màn hình mặc định của vai trò đó
- [ ] Sai thông tin → báo lỗi rõ ràng, không vào được
- [ ] Phiên đăng nhập tự hết hạn → đưa về màn hình đăng nhập, **không mất dữ liệu đang làm dở**
**Phụ thuộc:** —

### A2 · Cấu trúc điều hướng 🔴 · S00
**Cần có:** 3 biến thể menu — Nhân viên ⊂ Quản lý ⊂ HR. Mọi mục của nhân viên phải có ở cả 2 bản còn lại.
**Nghiệm thu:**
- [ ] Menu đúng theo vai trò, không có mục "chết" (bấm vào phải tới màn hình thật)
- [ ] Trang mặc định sau đăng nhập = **"Cần làm"** (G1), không phải dashboard rỗng
- [ ] Trên điện thoại: 4 mục dưới cùng + menu cuộn được
**Phụ thuộc:** A1

### A3 · Quản lý nhân viên 🔴 · S40
**Cần có:** danh sách nhân viên, ai ở nhóm nào, ai duyệt cho ai, chuyển nhóm/quản lý.
**Nghiệm thu:**
- [ ] Lọc theo nhóm / chức danh / trạng thái
- [ ] Đổi quản lý của 1 nhân viên → **đơn đang chờ giao cho người mới**, không mất
- [ ] Thêm nhân viên mới → tự gán nhóm mặc định theo bộ gán ca
**Phụ thuộc:** A1

### A4 · Cây nhóm lồng nhau 🔴 · S41
**Cần có:** tạo nhóm, nhóm lồng nhau **không fix cứng số tầng** (có thể chỉ 2 tầng: công ty → nhóm).
**Nghiệm thu:**
- [ ] Tạo nhóm trong nhóm → hiển thị đúng cây, không giới hạn số tầng
- [ ] Nhóm không có trưởng → **vẫn hoạt động bình thường, không cảnh báo**
- [ ] Đổi trưởng nhóm → **đơn mới tự giao cho người mới** (đơn cũ giữ nguyên)
**Phụ thuộc:** A3

### A5 · Nhật ký thay đổi 🔴 · S35
**Cần có:** ai sửa gì, trường nào, giá trị cũ → mới, lý do, lúc nào.
**Nghiệm thu:**
- [ ] Mọi thao tác sửa dữ liệu công / điểm đều có dòng nhật ký
- [ ] Lọc theo người, theo đối tượng, theo khoảng thời gian
- [ ] Không sửa được dòng nhật ký (append-only)
**Phụ thuộc:** —

### A6 · Ủy quyền 🔴 · S37
**Cần có:** chọn người nhận, thời hạn, loại việc được ủy quyền.
**Nghiệm thu:**
- [ ] Trong thời hạn ủy quyền → người được ủy quyền duyệt được thay
- [ ] Hết hạn → tự động thu quyền lại
- [ ] Có thể thu hồi trước khi hết hạn
**Phụ thuộc:** A4

---

## B. Chấm công — nhân viên

### B1 · Chấm công trên điện thoại 🔴 · S05m
> Chi tiết đầy đủ: **`docs/09-mobile-punch.md`**. Đây là thao tác lặp lại nhiều nhất — và là thao tác người dùng ghét nhất nếu làm chậm.
**Nghiệm thu:**
- [ ] Mở app → màn hình chấm công hiện ngay, không qua menu
- [ ] Bấm 1 lần → kết quả trong **< 4 giây**, có phản hồi rung
- [ ] Từng bước kiểm tra hiện **ngay khi bắt đầu**, không đợi xong mới hiện
- [ ] **Ngoài mạng công ty → BỊ CHẶN**, có gợi ý nối Wi-Fi công ty (trừ ngày WFH đã duyệt)
- [ ] **Ngoài bán kính GPS → BỊ CHẶN**, hiện khoảng cách thật + bản đồ + 2 lối ra (WFH / Thử lại)
- [ ] **GPS không lấy được hoặc độ chính xác > 100m → BỊ CHẶN**, kèm hướng dẫn đứng gần cửa sổ
- [ ] Mất mạng → vẫn chấm được offline, đồng bộ lại sau, **có cờ cho HR**; quá hạn offline (mặc định 24h) → bị từ chối khi đồng bộ
- [ ] Bấm 2 lần liên tiếp → nút đổi trạng thái, **không tạo 2 entry**
- [ ] Màn hình chỉ có **2 thông tin + 1 nút**, không có form nào
- [ ] Cài được như app, mở ra thẳng màn hình chấm công, không bị notch che
**Phụ thuộc:** A1, B5

### B2 · Chấm công trên desktop 🔴 · S05
**Nghiệm thu:**
- [ ] Cùng bộ kiểm tra như B1, hiển thị trên desktop
- [ ] Nhân viên chưa chấm công ra hôm qua → hiện việc "Bổ sung công" với nút bấm 1 chạm
**Phụ thuộc:** B1

### B3 · Lịch công tháng 🔴 · S06
**Nghiệm thu:**
- [ ] Xem cả tháng trên 1 màn hình, màu theo trạng thái (đủ / muộn / WFH / phép / vắng)
- [ ] Chạm 1 ngày → xem chi tiết giờ vào/ra
- [ ] Có nút chuyển tháng (‹ ›)
**Phụ thuộc:** B1

### B4 · Bảng công của tôi 🔴 · S11
**Nghiệm thu:**
- [ ] **Có chọn tháng, mặc định = tháng hiện tại**; đổi tháng bằng dropdown hoặc nút ‹ ›; URL đổi theo `?month=YYYY-MM`
- [ ] Heatmap 30 ngày — nhìn 1 cái thấy ngay ngày nào có vấn đề
- [ ] Đủ **11 cột** số liệu, khớp với bảng điều khiển
- [ ] **Chỉ khiếu nại được sau khi HR công bố** (ngày 11 hàng tháng) — trước đó xem số tạm tính nhưng khoá nút khiếu nại
- [ ] Trong 2 ngày → khiếu nại được; quá 2 ngày → nút bị disable + giải thích
- [ ] Khiếu nại đã gửi → hiện trạng thái "HR đang xử lý"
- [ ] Chọn kỳ đã chốt → xem được nhưng chỉ đọc
- [ ] Lịch sử 12 tháng — kỳ đã chốt xem được, không khiếu nại được
**Phụ thuộc:** B1, D4

### B5 · Thiết bị của tôi 🔴 · S27
**Cần có:** đăng ký thiết bị, xem thiết bị đang đăng ký, thu hồi.
**Nghiệm thu:**
- [ ] **Max 1 thiết bị** — thiết bị thứ 2 phải được HR duyệt
- [ ] Nhân viên **tự thấy** mình đang chấm công trên bao nhiêu máy, ở đâu, lúc nào
- [ ] Nhân viên **không tự xoá được** thiết bị đang chờ duyệt
**Phụ thuộc:** A1

### B6 · Thêm thiết bị 🔴 · S29
**Nghiệm thu:**
- [ ] **Một flow duy nhất** cho cả "đăng ký lần đầu" và "thêm máy thứ 2" — không có 2 màn hình riêng
- [ ] Mặc định vẫn là 1 máy; muốn thêm máy phải có lý do
- [ ] Yêu cầu vào hàng chờ HR duyệt, có thời hạn hết hiệu lực
**Phụ thuộc:** B5, E9

---

## C. Đơn từ — nhân viên

> **Nguyên tắc chung cho mọi đơn từ:** gửi được **từ bất kỳ đâu** — **không cần GPS, không cần mạng công ty**.
> Chỉ **chấm công** mới cần vị trí + mạng nội bộ.
> Mọi đơn đều có **quota** hiển thị sẵn, **validate tức thì**, và **bắt buộc lý do khi bị từ chối**.

### C1c · Tạo đơn đi muộn — prefill 🔴 · S07
**Nghiệm thu:**
- [ ] Mở form → **ngày và giờ đã điền sẵn từ log chấm công thật** (nhân viên không gõ)
- [ ] Quota 2 lần/tháng → lần 3 **bị chặn ngay lúc tạo**, kèm số đã dùng
- [ ] "Lưu nháp" → **không trừ quota, không hiện cho quản lý**
- [ ] Nhân viên hỏi "vì sao bị chặn" → hiện đúng lý do theo rule
**Phụ thuộc:** B1

### C2c · Đơn bổ sung chấm công 🔴 · S31
**Nghiệm thu:**
- [ ] Hạn nộp tính theo **ngày làm việc**, hiện rõ hạn là ngày nào
- [ ] Quota 5 lần/tháng
- [ ] Bắt buộc lý do
**Phụ thuộc:** B1

### C3c · Đơn của tôi 🔴 · S08
**Nghiệm thu:**
- [ ] Lịch sử đơn + trạng thái rõ ràng (chờ duyệt / được duyệt / bị từ chối + lý do)
- [ ] Badge quota còn lại luôn hiển thị
- [ ] Nhân viên **không thấy đơn của đồng nghiệp** (trừ khi được cấu hình)
**Phụ thuộc:** C1c

### C4c · Xin nghỉ phép 🔴 · S30
**Nghiệm thu:**
- [ ] **8 loại nghỉ** hiện đúng, lấy từ cấu hình của HR (không hard-code)
- [ ] Đơn vị **ngày / nửa ngày**
- [ ] Hạn gửi + giấy tờ đều cấu hình được theo từng loại
- [ ] Số dư phép còn lại hiện ngay trong form
**Phụ thuộc:** E8, C6c

### C5c · Đăng ký WFH 🔴 · S10
**Nghiệm thu:**
- [ ] Đăng ký lẻ hoặc **lịch cố định** (thứ Sáu hằng tuần) tạo được nhiều tuần
- [ ] Quota 2 lần/tuần → lần 3 bị chặn
- [ ] Hạn đăng ký ≥ 1 ngày làm việc → báo rõ lý do khi vi phạm
- [ ] Vị trí cấm WFH → không tạo được đơn
- [ ] Ngày WFH đã duyệt → **chấm công được ngoài mạng và ngoài bán kính GPS** (ngoại lệ duy nhất)
**Phụ thuộc:** E7

### C6c · Số dư phép 🔴 · S09
**Nghiệm thu:**
- [ ] Card từng loại nghỉ, progress bar phép năm
- [ ] **Phép ốm** và **phép thâm niên** có card riêng
- [ ] **Cộng phép hàng tháng vào ngày 15**, chỉ người vào làm từ **ngày 15 trở về trước** mới cộng trong tháng đó (vào 20/11 → tháng 11 không cộng, kỳ đầu tiên là 15/12)
- [ ] **Phép thâm niên cộng đúng ngày tròn thâm niên**, không gộp vào lần cộng ngày 15
- [ ] Cảnh báo **phép tồn** theo luật (toàn bộ → 01/04; còn 5 ngày → 01/07; tồn = 0 từ 01/07)
- [ ] Ẩn "phép tồn" vào dòng phụ nhỏ, không làm rối màn hình
**Phụ thuộc:** E8

---

## D. Đơn từ — quản lý & HR

### D1 · Duyệt đơn 🔴 · S12
**Nghiệm thu:**
- [ ] Hộp thư duyệt liệt kê đơn chờ duyệt, lọc theo loại/ngày, badge "quá hạn"
- [ ] Mỗi đơn hiện **chip ✅/❌ điều kiện** ngay trên dòng, không phải mở mới thấy
- [ ] Từ chối mà bỏ trống lý do → **nút bị disable**
- [ ] Duyệt **12 đơn trong 3 phút**
- 🟡 *(C8)* Chip lý do để từ chối nhanh cùng loại
**Phụ thuộc:** C3c

### D2 · Chi tiết đơn 🔴 · S13
**Nghiệm thu:**
- [ ] Timeline đầy đủ: gửi → duyệt → kết quả, ai làm gì lúc nào
- [ ] Hiện chip điều kiện quyết định kết quả
- [ ] Có lịch sử chỉnh sửa
**Phụ thuộc:** D1

### D3 · Lịch nhóm 🔴 · S14
**Nghiệm thu:**
- [ ] Biết ai vắng mà **không phải hỏi ai**
- [ ] Cảnh báo xung đột lịch: *"thứ Sáu này 3/5 người đều WFH, đội sẽ thiếu người"*
- 🟡 *(C8)* Nhóm của tôi có cấu hình riêng: ai trong nhóm thấy được lịch của ai
**Phụ thuộc:** C5c

### D4 · Xử lý khiếu nại bảng công 🔴 · S33
**Nghiệm thu:**
- [ ] Đặt **3 cột cạnh nhau**: log chấm công gốc (không sửa được) · đơn từ liên quan · bảng công HR đang sửa
- [ ] **Gợi ý nguyên nhân theo rule** — ví dụ *"thiếu check-out và chưa tạo đơn bổ sung công"*
- [ ] 3 cách xử lý: sửa ô · tạo đơn bổ sung công · từ chối (bắt buộc lý do)
- [ ] Từ chối → nhân viên **nhận được thông báo**
- [ ] Chốt & khóa **chỉ chạy được khi mọi khiếu nại đã xử lý**
**Phụ thuộc:** E1, B4

### D5 · Sổ phép 🔴 · S34
**Nghiệm thu:**
- [ ] Mọi thay đổi số dư đều **truy vết được** — ai, lúc nào, vì lý do gì
- [ ] Lọc theo người, theo thời gian, theo loại nghỉ
**Phụ thuộc:** C4c

---

## E. Bảng công & cấu hình — HR

### E1 · Bảng công & chốt 🔴 · S15
**Nghiệm thu:**
- [ ] Đủ **45 cột** (26 cột ngày + 19 cột tổng hợp) theo mẫu `doc/Rule chấm công.xlsx`
- [ ] Ô ngày dùng **ký hiệu gốc** của công ty (R · AL · S · 1.00 · R/0.50) — export ra khớp file HR 100%
- [ ] **Click vào ô để sửa tại chỗ**; sửa cột nhạy cảm (công thực tế · đi muộn · phép · vi phạm) **bắt buộc có lý do**
- [ ] Sửa hàng loạt — tick nhiều dòng, 1 audit log cho cả lô
- [ ] Cảnh báo sai lệch tự động (thiếu check-out, về sớm không có đơn) + nút [Sửa] / [Tạo đơn]
- [ ] **Chốt & khóa** có bước xác nhận; sau khi khóa thì **không sửa được nữa**
- [ ] Xuất Excel ra đúng 45 cột + ký hiệu gốc, đúng kỳ 01 → cuối tháng
**Phụ thuộc:** B1, C1c, C2c

### E2 · Bộ lọc + lưu view 🔴 · S15
**Nghiệm thu:**
- [ ] Lọc "Mobile · 11/2026 · đi muộn > 0" → **lưu lại, mở lại bằng 1 click**
- [ ] View đã lưu có thể chia sẻ bằng link
- [ ] Nhiều bộ lọc cùng lúc, hiện dạng chip để gỡ
**Phụ thuộc:** E1

### E3 · Cấu hình quy định 🔴 · S16
> Chi tiết: **`docs/08-rule-builder.md`**. 19 luật — **mọi luật đều có mặt trong đây**, không có luật nào chỉ nằm trong tài liệu.
**Nghiệm thu:**
- [ ] Thấy đủ **19 quy định** với giá trị đúng theo "Quyết định của HR" ở Mục 7
- [ ] Mọi thay đổi có **ngày hiệu lực** và **lịch sử phiên bản**
- [ ] Có thể ghi đè giá trị theo nhóm / chức danh
- [ ] **Rollback được** về phiên bản cũ, có lý do
**Phụ thuộc:** —

### E4 · Cấu hình 1 luật 🔴 · S17
**Nghiệm thu:**
- [ ] Form **sinh tự động từ catalog** — thêm 1 luật mới không phải sửa form
- [ ] Chỉ hiện trường liên quan (ví dụ chỉ hiện "hạn offline" khi bật "cho phép offline")
- [ ] Nhân viên thấy **cùng nội dung** ở trang tra cứu → không có chuyện tài liệu lệch phần mềm
**Phụ thuộc:** E3

### E5 · Dry-run ảnh hưởng 🔴 · S18
**Nghiệm thu:**
- [ ] Xem trước ảnh hưởng **trước khi lưu**, có số liệu cụ thể
- [ ] Biết **bảng công nào đã khóa → không bị đụng**
- [ ] Lịch sử phiên bản xem được + rollback
**Phụ thuộc:** E3

### E6 · Trang quy định tra cứu 🔴 · S19
**Nghiệm thu:**
- [ ] Nhân viên mở ra thấy **quy định đang áp dụng với mình**, bằng ngôn ngữ tự nhiên
- [ ] Nội dung **tự sinh từ cùng nguồn** với form cấu hình của HR
- [ ] Đổi quota xong, nhân viên **thấy ngay** quy định mới
**Phụ thuộc:** E3

### E7 · Ca làm việc & lịch nghỉ lễ 🔴 · S26
**Nghiệm thu:**
- [ ] Giờ vào/ra, giờ nghỉ trưa, đủ 8h/ngày · 4h/nửa ngày — đều cấu hình được
- [ ] **Bộ gán ca**: nhóm + chức danh → ca
- [ ] Ca ngoại lệ (7h30–16h30 · 7h00–16h00 · 10h00–19h00) gán cho nhóm, cần HR duyệt
- [ ] Lịch nghỉ lễ theo năm — thêm ngày lễ không cần sửa code
**Phụ thuộc:** —

### E8 · Quản lý loại nghỉ 🔴 · S32
**Nghiệm thu:**
- [ ] **Thêm loại nghỉ mới không cần sửa code**
- [ ] Mỗi loại tự cấu hình: hưởng lương, trừ phép năm, đơn vị ngày/nửa ngày, cần giấy tờ, hạn gửi
- [ ] Loại nghỉ có **3 tầng kế thừa** (nhóm → loại → trường hợp riêng)
**Phụ thuộc:** —

### E9 · Quản lý thiết bị 🔴 · S28
**Nghiệm thu:**
- [ ] Duyệt đăng ký mới / thu hồi thiết bị mất
- [ ] Thấy thiết bị nào đang chấm công hộ (nhiều máy cùng lúc) → **cảnh báo**
- [ ] Mọi thao tác đều vào nhật ký thay đổi
**Phụ thuộc:** B5

---

## F. OKR

> **Nguyên tắc chung cho OKR:** **2 nhóm cố định** (Business · People) · nhân viên **tự nhập** ·
> **không có template** · chấm điểm **1–5 mỗi nhóm** · **điểm TB tự tính** (không có ô nhập tay) ·
> **không dùng cây phân tầng** — chỉ cần biết *ai duyệt mình*.

### F1 · Dashboard OKR 🔴 · S20
**Nghiệm thu:**
- [ ] Thấy rõ **việc cần làm** với OKR (chấm, cập nhật, chờ duyệt)
- [ ] Hiện điểm hiện tại của 2 nhóm
- [ ] Phần **20% mục tiêu công ty** hiện rõ nhưng **không tính vào điểm TB**
**Phụ thuộc:** A1

### F2 · Tạo OKR 🔴 · S21
**Nghiệm thu:**
- [ ] **2 nhóm cố định** Business / People, **tự nhập** từng đầu việc
- [ ] **Gợi ý kế thừa từ OKR quản lý** — bấm 1 chạm để chép mục tiêu đã duyệt (C17)
- [ ] Đính kèm file
- [ ] Gửi → quản lý **duyệt / trả lại kèm góp ý**
**Phụ thuộc:** F1

### F3 · Check-in tiến độ 🔴 · S22
**Nghiệm thu:**
- [ ] Check-in **hàng tháng** theo từng KR: giá trị, tiến độ, mức độ tin cậy
- [ ] **Prefill giá trị lần trước**
- [ ] Có mốc hạn, tự nhắc trước hạn
**Phụ thuộc:** F2

### F4 · Duyệt OKR đầu năm 🔴 · S42
**Nghiệm thu:**
- [ ] Quản lý duyệt hoặc trả lại **2 nhóm**
- [ ] Trả lại → có góp ý, nhân viên thấy và sửa
**Phụ thuộc:** F2

### F5 · Review giữa năm 🔴 · S43
**Nghiệm thu:**
- [ ] Nhận xét, điều chỉnh mục tiêu
- [ ] **Audit trail** — thay đổi gì, lúc nào, ai
**Phụ thuộc:** F2

### F6 · Đánh giá cuối năm 🔴 · S23
**Nghiệm thu:**
- [ ] Form **4 box** (kết quả · điều chỉnh · khó khăn · bài học)
- [ ] **Chấm 1–5 mỗi nhóm**; **điểm TB tự tính** — không có ô nhập tay
- [ ] Lưu **cả điểm tự chấm và điểm quản lý** để đối chiếu
- [ ] Xếp loại A/B/C/D **chỉ để hiển thị** — không dùng cho lương
**Phụ thuộc:** F3, F4

### F7 · Review OKR cả nhóm 🟡 · S24
**Nghiệm thu:**
- [ ] **1 bảng** thay vì mở từng objective
- [ ] Có **cột điểm đề xuất** theo rule
**Phụ thuộc:** F3

### F8 · Báo cáo OKR 🔴 · S25
**Nghiệm thu:**
- [ ] Bảng tổng hợp đủ **9 trường**, cột thời gian công tác **tự tính**
- [ ] Có **cột Trạng thái** — đủ theo dõi ai chấm/chưa chấm/chờ QL (**không cần màn hình kanban riêng**)
- [ ] Có **tóm tắt báo cáo** dựng từ số liệu đã tính (C18)
- [ ] Xuất Excel
**Phụ thuộc:** F6

### F9 · Quản lý chu kỳ OKR 🔴 · S44
**Nghiệm thu:**
- [ ] **Timeline 5 phase** theo mốc tháng thật
- [ ] HR set hạn chót theo ngày, tự nhắc trước hạn
- [ ] Cấu hình thang điểm, xếp loại
- [ ] Sau hạn chót → tự khóa, chỉ HR mở lại được
**Phụ thuộc:** —

---

## G. Tiện lợi dùng chung

### G1 · Todo inbox 🔴 · S02
**Cần có:** 1 màn hình gom **việc của CẢ 2 module** (chấm công + OKR).
**Nghiệm thu:**
- [ ] **Trang mặc định sau khi đăng nhập**
- [ ] Phân loại mức độ: **overdue / sắp đến hạn / hôm nay / lưu ý**
- [ ] Mỗi việc có **1 nút hành động** — không phải menu
- [ ] **Số phép còn lại hiện ngay** trên trang này
- [ ] Nhân viên **không cần nhớ** việc đang chờ nằm ở module nào
**Phụ thuộc:** A2

### G2 · Command palette 🔴 · S03
**Nghiệm thu:**
- [ ] `Ctrl+K` → tìm **nhân viên / đơn / quy định / cấu hình**
- [ ] Gõ tiếp là ra kết quả, không phải bấm "tìm"
- [ ] Từ kết quả → đi thẳng tới màn hình đích
**Phụ thuộc:** A2

### G3 · Thông báo & nhắc việc 🔴 · S04, S04m
**Nghiệm thu:**
- [ ] **3 kênh**: trong app · email · push
- [ ] **Đúng người, đúng lúc** — ma trận 17 sự kiện × 3 vai trò
- [ ] **Chống spam**: gộp thông báo cùng loại, có quiet hours
- [ ] Tắt thông báo **không làm mất việc** khỏi trang "Cần làm"
**Phụ thuộc:** G1

### G4 · Tuỳ chỉnh thông báo 🔴 · S36
**Nghiệm thu:**
- [ ] **Tắt/bật được TẤT CẢ loại** thông báo
- [ ] Chọn kênh nhận (trong app / email / push) cho từng loại
- [ ] Đặt **giờ yên lặng**
- [ ] Nhân viên **tự cấu hình được phần của chính mình** — không cấu hình được gì khác
- ⚪ *(C12)* Onboarding tour + trạng thái rỗng có CTA
**Phụ thuộc:** G3

### G5 · Báo cáo tự động theo lịch ⚪ · S39
**Nghiệm thu:**
- [ ] HR đặt lịch: báo cáo nào, gửi cho ai, ngày nào trong tháng
- [ ] Có bản xem trước trước khi lên lịch
**Phụ thuộc:** E1

### G6 · Import Excel ⚪ · S39
**Nghiệm thu:**
- [ ] Map cột → preview → validate trước khi nhập
- [ ] Lỗi dòng nào báo **dòng nào**, không phải "import thất bại"
**Phụ thuộc:** E1

---

## Điều kiện cắt (nếu trượt tiến độ)

**Cắt theo thứ tự, không đụng danh sách trước:**

1. ⚪ G6 Import Excel → ⚪ G5 Báo cáo tự động → ⚪ G4 Tuỳ chỉnh thông báo
2. 🟡 F7 Review OKR cả nhóm → 🟡 A6 Ủy quyền → 🟡 B6 Thêm thiết bị
3. ❌ Rollback trong E5 (giữ lịch sử chỉ để xem) → ❌ multi-select động trong E3 (dùng select 1 giá trị)
4. ❌ Lịch cố định WFH (giữ đăng ký lẻ) → ❌ Phụ lục nghỉ chi tiết trong D5

**Không bao giờ cắt:**
- ❌ **E1 Bảng công 45 cột + chốt + khóa + export Excel** (khớp file HR)
- ❌ **B1 Chấm công điện thoại 1 chạm < 4s**
- ❌ **G1 Todo inbox** · **G2 Command palette** · **G3 Thông báo**
- ❌ **E3 + E4 + E6 Cấu hình quy định + trang tra cứu** (cùng một catalog)
- ❌ **F6 Đánh giá cuối năm** + lưu cả điểm tự chấm lẫn điểm quản lý
- ❌ **Quota chặn server-side** (không chặn ở UI)
- ❌ **A5 Nhật ký thay đổi** cho mọi thao tác sửa dữ liệu
- ❌ **Rule cấu hình được trong DB** — không hard-code
