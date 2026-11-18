# 03 — Bài toán 2: OKR (Performance Excellence Solution)

> Mục 4 tài liệu. Chu kỳ: *"Thiết lập mục tiêu → Cập nhật định kỳ → Review giữa năm → Đánh giá cuối năm → Tổng hợp"*.
>
> **Nguồn quy định thật:** `doc/OKR_doc.md` (quy trình + form đánh giá) · `doc/2026 OKR _ Guidance.pdf`
> (hướng dẫn + timeline) · `doc/2026 OKR Form (International)_ People Manager (1).xlsx - OKR Setting.csv`
> (danh mục objective chuẩn).
> Ba file này **thay đổi mô hình OKR** so với bản tài liệu gốc — xem §2.

## 1. Phạm vi MVP

| # | Tính năng | Ghi chú |
|---|---|---|
| O1 | HR cấu hình chu kỳ OKR (5 phase, mốc + hạn chót) | Tự nhắc trước hạn |
| O2 | **2 nhóm cố định Business + People** — không có template | Nhân viên tự nhập |
| O3 | Nhân viên tự nhập OKR → gửi | Wizard 2 bước |
| O4 | Quản lý duyệt / trả lại kèm góp ý | |
| O5 | Check-in tiến độ định kỳ theo từng KR | Hàng tháng (cấu hình được) · đính kèm evidence |
| O6 | Review giữa năm (nhận xét + điều chỉnh mục tiêu) | Audit trail · **QL mở cho NV sửa** |
| O7 | **Tự đánh giá cuối năm** (Box 1–4 theo form HR) | 3–5 ngày để nộp · đính kèm evidence |
| O8 | Quản lý: Duyệt điểm / Trả lại / Sửa điểm (bắt buộc lý do) | 3 nhánh |
| O9 | HR chốt & khóa + báo cáo + export Excel | Sau hạn chót tự khóa |
| O10 | Trường hợp đặc biệt (chuyển phòng, nhân viên mới, nghỉ việc) | |
| O11 | Phân tầng Công ty → Phòng ban → Cá nhân | Cây mục tiêu liên kết |
| **@@C6@@** | **Review OKR dạng bảng so sánh cả nhóm + điểm đề xuất theo công thức** | P1 |
| **C1/C2** | **Todo inbox + nhắc việc** (check-in đến hạn, chưa tạo OKR) | P0 — dùng chung |

> **Toàn bộ bài toán 2 làm bằng rule.** Điểm đề xuất cho review OKR là **công thức tính từ tiến độ KR** (minh bạch, manager kiểm tra được). Xem `docs/04-convenience-features.md` §5.

## 2. Quyết định đã chốt (từ `doc/OKR_doc.md` + Guidance PDF)

> **Ba file trong `doc/` đã chốt được nhiều thứ mà bản kế hoạch cũ để ngỏ.** Dưới đây là những chỗ
> **đã có quyết định** → implement theo, không cần hỏi lại.

| # | Quyết định | Nguồn | Thay đổi gì so với bản cũ |
|---|---|---|---|
| 1 | **2 nhóm objective: Business + People** | `OKR_doc.md` Box 2–3 | Bản cũ chỉ có 1 nhóm objective + KR |
| 2 | **Điểm chấm 1–5**, mỗi nhóm 1 điểm, **không có điểm lẻ** | `OKR_doc.md` Box 2–3 | Bản cũ: thang 0.0–1.0 |
| 3 | **Phần mềm tự tính điểm trung bình** | `OKR_doc.md` | Bản cũ: điểm từ tiến độ KR × trọng số |
| 4 | **Đính kèm file** — **chỉ ở check-in & bản chấm** (evidence / chi tiết bổ sung), không phải lúc tạo OKR | `OKR_doc.md` Box 2–3 | Bản cũ không có; lúc đầu đặt ở mục tiêu — nay chuyển sang check-in/đánh giá |
| 5 | **Box 4: Self proposal next year** | `OKR_doc.md` Box 4 | Bản cũ không có |
| 6 | **Timeline: Setup Q1 → Check-in Mar–Apr → Review Jun–Jul → Assessment Nov–Dec** | Guidance PDF p.20 | Bản cũ: phase trừu tượng, không có tháng |
| 7 | **Quy trình 5 bước** (tự đánh giá → QL đánh giá → HR tổng hợp → Giám đốc → bàn giao) | `OKR_doc.md` | Bản cũ: flow 3 nhánh duyệt điểm |
| 8 | **Quyền xem theo phạm vi thực tế** | `OKR_doc.md` Lưu ý | Bản cũ: chỉ 3 vai trò |
| 9 | **Bảng tổng hợp HR có 9 trường** (tên · code · vị trí · thời gian công tác · PB · tên QL · điểm công việc · điểm con người · điểm TB) | `OKR_doc.md` Bước 5 | Bản cũ: 4 widget tự do |
| 10 | **Danh mục objective tham khảo** theo form (2 nhóm) | OKR Form CSV | Chỉ để tham khảo — không có model template |

### 2.1 Mô hình 2 nhóm — Business & People

```
┌─ BOX 1 ─ Thông tin cá nhân ────────────────────────────────┐
│ Họ tên · Code NV · Chức danh · Band · Quản lý · Nhóm        │
│ Ngày vào làm việc · OKR năm 2026, 2027…                     │
└──────────────────────────────────────────────────────────────┘
┌─ BOX 2 ─ Business ──────────────────────────────────────────┐
│ Đầu việc tự do · KHÔNG giới hạn số chữ · KHÔNG giới hạn số  │
│ Chấm điểm 1–5 · KHÔNG có điểm lẻ                           │
└──────────────────────────────────────────────────────────────┘
┌─ BOX 3 ─ People ────────────────────────────────────────────┐
│ Đầu việc tự do · KHÔNG giới hạn số chữ · KHÔNG giới hạn số  │
│ Chấm điểm 1–5 · KHÔNG có điểm lẻ                           │
└──────────────────────────────────────────────────────────────┘
┌─ BOX 4 ─ Self proposal next year ───────────────────────────┐
│ Nhân viên tự đề xuất OKR năm tới + điểm cần cải thiện      │
│ (card riêng trên "OKR của tôi", kèm trạng thái)            │
└──────────────────────────────────────────────────────────────┘
        → Phần mềm TỰ TÍNH điểm trung bình (Business + People)
```

> **Đính kèm file không nằm ở lúc tạo OKR.** Khi tạo, nhân viên chỉ viết chữ.
> File đính kèm làm **evidence hoặc chi tiết bổ sung** thuộc về **check-in giữa kỳ / cuối kỳ**
> và **bản chấm** (ảnh chụp kết quả, báo cáo, tài liệu).

> **Điểm lẻ là gì và vì sao không có:** nếu một nhóm có nhiều đầu việc, HR chấm **1 điểm cho cả nhóm**
> (đánh giá tổng thể thành tựu của nhóm đó) — không chấm từng đầu việc rồi bình quân.
> Đây là điểm khác biệt lớn so với mô hình KR có trọng số: **đánh giá ở tầng nhóm, không ở tầng hạng mục**.

**Hệ quả thiết kế quan trọng:** mô hình này **không cần trọng số KR tổng = 100** — vì không có bình quân
theo trọng số. Thứ duy nhất cần "validate = 100" là trường hợp có **nhiều mục tiêu ngang hàng** ở tầng cá nhân.

#### 2.1.1. Mọi thứ đều TỰ DO — không có nhóm hay mục tiêu cố định

> **Quyết định (16/11/2026):** nhân viên tự khai **toàn bộ** — không có 4 nhóm Business cố định,
> không có 3 mục tiêu People cố định. Cấu trúc cấp trên chỉ là **tham khảo**.

```
Company Objectives (20%)          ← MD / Ban điều hành đặt
   ↓  NV copy xuống (nếu muốn) — tham khảo, KHÔNG bắt buộc
Individual OKRs (80%)             ← nhân viên tự khai hoàn toàn
   ├── Business  (tự do)
   └── People    (tự do)
```

**Cơ chế "kế thừa mang tính tham khảo":**

| | Cách làm | Quyền |
|---|---|---|
| **Business objective của cấp trên** | Hiện trong form Tạo OKR dưới dạng **gợi ý có sẵn** — bấm 1 chạm để chép vào | Nhân viên **được thêm, bớt, sửa** tùy ý |
| **Mục tiêu công ty (20%)** | Danh sách công bố sẵn, NV copy xuống nếu liên quan | **Không bắt buộc** — không copy cũng OK |

**Vì sao không cố định:**
- HR không có cách nào biết trước mỗi người cần mấy mục tiêu People — mỗi vai trò khác nhau.
- Ép cố định sẽ tạo **việc rào nào cho mọi người** — và người ta điền cho có rồi, không phải để làm tốt.
- Form gốc của công ty cũng ghi rõ: People Objectives *"are mandatory from HR **but you can add new item if needed**"*
  — tức là **bổ sung**, không phải ràng buộc cứng.

**Cấu trúc cố định duy nhất:** mỗi nhóm (Business / People) chấm **1 điểm 1–5** và 2 nhóm đó
tạo thành điểm trung bình. Đó là điều HR cần để so sánh được giữa các bộ phận.

#### 2.1.2. Kế thừa mục tiêu — CHỈ ở tầng Company (20%)

> **Nguồn:** `doc/2026 OKR Form ... .csv` — *"1. Look at the Company and Business Unit Objectives.
> 2. Based on the Business Unit Objectives, define your Individual OKRs"*
> và *"allocate weighting"* — **Company 20% · Individual 80%**.

```
Company Objectives (20%)          ← MD / Ban điều hành đặt, NV COPY XUỐNG (tham khảo)
   ↓  (copy, không phải cây — NV không tạo mục tiêu cấp trên)
Individual OKRs (80%)             ← mỗi người tự khai
   ├── Business  (tự do)
   └── People    (tự do)
```

**Quyết định thiết kế quan trọng:**

| | Mô hình | Vì sao |
|---|---|---|
| **Company objective (20%)** | NV **copy xuống** nếu thấy liên quan — hoặc bỏ qua | Danh sách công ty đã công bố, NV chọn cái liên quan |
| **Business objective của manager** | Hiện dạng **gợi ý** trong form — NV copy hoặc tự viết | *"vì chính manager cũng phải làm OKR và mục tiêu business thì thường từ trên đưa xuống"* |
| **Individual objective (80%)** | Mỗi người tự khai | 80% là phần cá nhân tự chịu |

**Không cần "cây phân tầng"** — vì:
1. Company objective là **copy**, không phải liên kết đa tầng → không có cây để vẽ.
2. Cấp trên của một NV là **quản lý trực tiếp** — lấy từ cấu trúc nhóm, không cần UI riêng.
3. Mục tiêu kế thừa là **gợi ý có sẵn** — thuộc tính, không phải màn hình.

> **Vì sao "ai duyệt" thì không cần màn hình cây:** quyền duyệt đã chạy sẵn qua approval engine
> (manager trực tiếp → team lead → HR). Người dùng chỉ cần thấy *"việc của tôi đang chờ ai"*
> — đã có ở hộp thư duyệt (S12) và trang "Cần làm" (S02).

### 2.2 Thang điểm 1–5 & xếp loại

**Thang điểm & ngưỡng xếp loại (cấu hình được theo chu kỳ OKR):**

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `scale_min` | Điểm thấp nhất trong thang chấm | `1` — theo form HR |
| `scale_max` | Điểm cao nhất trong thang chấm | `5` — theo form HR |
| `grade_thresholds` | Ngưỡng điểm trung bình để sinh **xếp loại** | Ví dụ: `A ≥ 4.5` · `B ≥ 3.5` · `C ≥ 2.5` · dưới 2.5 là `D` |

| Điểm | Nghĩa | Xếp loại (ngưỡng mặc định, cấu hình được) |
|---|---|---|
| 5 | Vượt xuất | **A** ≥ 4.5 |
| 4 | Vượt kỳ vọng | **B** ≥ 3.5 |
| 3 | Đạt kỳ vọng | **C** ≥ 2.5 |
| 2 | Đạt một phần | **D** < 2.5 |
| 1 | Không đạt | |

> **Giữ nguyên xếp loại A/B/C/D** vì HR đã dùng khái niệm này — chỉ đổi **thang điểm** từ 0.0–1.0
> sang 1–5 cho khớp form. Ngưỡng vẫn cấu hình được trong `OkrCycle.grade_thresholds`.
>
> **Xếp loại chỉ để hiển thị/báo cáo.** Hệ thống **không quản lý lương** — không có luồng nào dùng
> A/B/C/D để tính lương, nên HR đổi ngưỡng tùy ý mà không ảnh hưởng dữ liệu tài chính.
>
> **Điểm trung bình chỉ tính từ 2 nhóm cá nhân** (Business + People của phần 80%).
> Phần **20% mục tiêu công ty không tham gia điểm TB** — nó chỉ là bối cảnh tham khảo (PO chốt 17/11/2026).

### 2.3 Timeline thật (Guidance PDF p.20)

```
        Q1 (Jan–Mar)          Mar–Apr            Jun–Jul              Nov–Dec
     ┌───────────────┐    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
     │  OKRs Setting │    │   Check-in   │   │    Review    │   │  Assessment  │
     │  NV tự set OKR│──▶│  NV update    │──▶│  QL feedback │──▶│  NV tự đánh  │
     │  QL duyệt     │    │  QL review    │   │  QL đánh giá  │   │  QL đánh giá  │
     │               │    │              │   │              │   │  HR tổng hợp │
     │               │    │              │   │              │   │  Giám đốc duyệt│
     │               │    │              │   │              │   │  Bonus        │
     └───────────────┘    └──────────────┘   └──────────────┘   └──────────────┘
                            Coaching & Feedback
```

**Ánh xạ sang 5 phase của hệ thống:**

| Phase | Mốc tháng | Việc | Ai làm |
|---|---|---|---|
| `setup` | Jan–Mar | NV tự set OKR (Business + People) → QL duyệt | NV → QL |
| `checkin` | Mar–Apr | NV cập nhật tiến độ qua form online | NV → QL |
| `midyear` | Jun–Jul | **Review giữa năm** — QL nhận xét, coaching | QL |
| `final` | Nov–Dec | **Đánh giá cuối năm** — 5 bước (xem §2.4) | NV → QL → HR → Giám đốc |
| `summary` | Sau final | HR tổng hợp, ban lãnh đạo duyệt chung, xuất Excel | HR |

> **Hạn chót là ngày, không phải tháng** — HR cấu hình `due_at` cụ thể trong cycle config.
> Job nhắc: `due_at - còn ≤ 3 ngày` → notification + email.

### 2.4 Quy trình đánh giá cuối năm — 5 bước (OKR_doc.md)

```
Bước 1  NV tự đánh giá          → đặt hạn ~3–5 ngày → đóng link → notify Manager
Bước 2  QL trực tiếp đánh giá     → đặt hạn 5 ngày → đóng link → notify các NV đã hoàn thành
Bước 3  HR thu thập toàn bộ đánh giá → cập nhật vào bảng tổng hợp chung theo mẫu
Bước 4  Giám đốc phần mềm + Giám đốc quản lý Công nghệ → đánh giá chung
Bước 5  HR bàn giao bảng tổng hợp OKR công ty (đủ thông tin theo bảng) + export Excel
```

> **Điểm khác biệt so với bản cũ:** bản cũ dừng ở "QL duyệt/trả lại/sửa điểm". Bản thật có thêm
> **bước HR tổng hợp** và **bước Giám đốc đánh giá chung** → cần mô hình **nhiều cấp duyệt**
> (không chỉ 1 quản lý). Đây là điểm "độ phủ nghiệp vụ" mà bản cũ thiếu.

**Mỗi bước có hạn chót riêng** → mỗi bước là 1 task trong approval engine, có SLA, có notify.

### 2.5 Bảng tổng hợp HR — 9 trường (OKR_doc.md Bước 5)

| # | Trường | Nguồn |
|---|---|---|
| 1 | Họ và Tên | `User.full_name` |
| 2 | Code nhân viên | `User.employee_code` |
| 3 | Vị trí | `Position.name` |
| 4 | **Thời gian công tác** tính từ ngày vào tới 31/12/2026 hoặc 2027 tùy chính | `User.start_date` → tự tính |
| 5 | Phòng ban | `Team.name` — nhóm của nhân viên (cây nhóm lồng nhau) |
| 6 | Tên quản lý | `User.manager_id` |
| 7 | **Điểm OKR công việc** | Box 2 (Business) |
| 8 | **Điểm OKR con người** | Box 3 (People) |
| 9 | **Điểm trung bình OKR** | Tự tính |
| + | Note | `OkrReview.comment` |

> **Cột "Thời gian công tác"** — người vào giữa năm chỉ được đánh giá cho phần thời gian đã làm.
> Hệ thống **tự tính** số tháng/thời gian làm việc thực tế → cần `User.start_date` chính xác.

### 2.6 Quyền xem & kế thừa — theo phạm vi thực tế (OKR_doc.md Lưu ý)

| Vai trò | Xem | Sửa |
|---|---|---|
| **Nhân viên** | OKR của **chính mình** | OKR của mình |
| **Cấp quản lý** | OKR của **toàn bộ nhóm mình quản lý** | OKR của cả nhóm |
| **Giám đốc phần mềm** | OKR của **toàn bộ nhóm phát triển phần mềm** | như vậy |
| **Giám đốc quản lý Công nghệ** | **OKR toàn công ty ACT** | toàn công ty |

> **Mở rộng so với 3 vai trò của hệ thống:** role `admin` trong RBAC hiện tại **chính là "Giám đốc quản lý
> Công nghệ"** (xem toàn công ty + sửa). Role `hr` = "Giám đốc phần mềm" (xem/sửa bộ phận phát triển phần mềm).
> Cần bổ sung **1 trường `scope_type`** vào `UserScope` để phân biệt "bộ phận" ↔ "toàn công ty".

### 2.7 Danh mục objective chuẩn (từ OKR Form CSV)

```
Business (công ty)                  People (đội ngũ)
1) Build a high performance culture  4) Team Leadership
2) Build High Trust Leader/ Team     5) ...
3) ...                               6) ...
```

> Form CSV của HR có sẵn danh mục objective theo 2 nhóm — **chỉ dùng làm tài liệu tham khảo** khi thiết kế
> form. Hệ thống **không có model template**: nhân viên tự nhập đầu việc trong 2 nhóm cố định Business / People
> (PO chốt 18/11/2026).

### 2.8 Các câu còn để ngỏ (chỉ 1 câu)

| Câu hỏi | Mặc định chọn | Cách thay đổi |
|---|---|---|
| OKR cập nhật định kỳ bao lâu một lần? | **Hàng tháng** | HR sửa trong cycle config |
| OKR có phân tầng không? | **Có: theo cây nhóm** (Công ty → Nhóm → Nhóm con → Cá nhân) | Bật/tắt trong cấu hình chu kỳ (`alignment_enabled`) |

> **Trong pitch nói rõ:** *"HR đã chốt form đánh giá 1–5 với 2 nhóm Business/People — tôi implement đúng
> form đó. Còn nhịp check-in thì để cấu hình được vì mỗi năm có thể khác."*

### 2.9 Vòng đời chỉnh sửa OKR — nộp là khoá, review là mở lại

> **Nguyên tắc:** OKR **nộp lên là đóng** — không ai sửa được cho tới khi quản lý **mở** trong
> đợt review. Đây là điều kiện để điểm chấm cuối năm có ý nghĩa: những gì được duyệt
> là những gì thực sự đã nộp, không phải những gì sửa sau khi biết điểm.

```
draft ──nộp──▶ submitted ──QL duyệt──▶ locked
                     │                      │
                     │ (giữa kỳ)            │ (cuối kỳ)
                     ▼                      ▼
                reopened  ──nộp lại──▶ locked
                     ▲
                     │ QL bấm "Mở cho nhân viên sửa" (đang review)
```

| Trạng thái | Ai sửa được | Mở khi nào | Đóng lại khi nào |
|---|---|---|---|
| `draft` | Nhân viên (chủ sở hữu) | Nhân viên tạo OKR ở phase setup | Nhân viên bấm **Nộp** |
| `submitted` | Không ai sửa — chờ duyệt | Nhân viên vừa nộp | Quản lý **duyệt** → `locked` |
| `locked` | Không ai sửa | QL duyệt xong | Chờ đến đợt review để mở lại |
| `reopened` | Nhân viên sửa/bổ sung + QL xem | QL bấm **"Mở cho nhân viên sửa"** khi đang review giữa kỳ hoặc cuối kỳ | Nhân viên **nộp lại** → `locked` |
| `returned` | Nhân viên sửa theo góp ý | QL trả lại kèm góp ý | Nhân viên bấm **Nộp lại** |

**Khoá theo từng phase:**

| Phase | Khi nào khoá | Mở lại khi nào | Ai mở |
|---|---|---|---|
| **Setup** (nộp → khoá) | NV nộp → QL duyệt → `locked` | Không mở lại trong phase này | — |
| **Midyear** (mở lại → sửa → nộp → khoá) | Khi vào đợt review giữa năm | QL bấm **"Mở cho nhân viên sửa"** trong đợt review | Quản lý |
| **Final** (mở lại → sửa → nộp → khoá) | Khi vào đợt đánh giá cuối năm | QL bấm **"Mở cho nhân viên sửa"** trong đợt đánh giá | Quản lý |

> **Trong đợt review giữa kỳ và cuối kỳ**, quản lý có thể mở cho nhân viên sửa **ngay cả khi
> đang review** — để nhân viên bổ sung phần thực tế mới phát sinh rồi nộp lại. Mọi lần mở lại,
> sửa, nộp lại đều ghi vào audit log (ai mở · mở lúc nào · ai sửa gì).

**Xoá mục — không xoá hẳn, luôn lưu vết + bắt buộc lý do:**

> Người dùng xoá một mục tiêu hoặc một đầu việc trong lúc được mở lại để sửa → hệ thống
> **không xoá hẳn bản ghi**. Mục đó được đánh dấu `deleted_at` + `delete_reason` và hiển thị
> **gạch ngang, ghi "đã xoá"** trong lịch sử để ai cũng thấy nó từng tồn tại và vì sao bị xoá.

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `deleted_at` | Lúc bị xoá | Trống nếu chưa xoá — **không xoá hẳn bản ghi** |
| `delete_reason` | Lý do xoá | **BẮT BUỘC** khi xoá — không có lý do thì không cho xoá |

- **Điểm của objective chỉ tính từ các mục chưa bị xoá** — mục đã xoá không cộng vào điểm,
  nhưng **vẫn hiện trong lịch sử** (gạch ngang + "đã xoá" + lý do).
- Khôi phục lại được: bấm "Khôi phục" → xoá `deleted_at` và `delete_reason`, giữ nguyên vết cũ trong audit log.

## 3. Vòng đời OKR (Mục 4.1)

```
┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌────────────────┐   ┌──────────┐
│  SETUP      │──▶│  CHECK-IN    │──▶│ MID-YEAR      │──▶│ FINAL REVIEW   │──▶│ SUMMARY │
│  Thiết lập  │   │  Cập nhật    │   │ REVIEW        │   │ Đánh giá cuối  │   │ Tổng hợp│
│             │   │  định kỳ     │   │ Review giữa   │   │ năm            │   │          │
└─────────────┘   └──────────────┘   │ năm           │   └────────────────┘   └──────────┘
   NV tạo          NV cập nhật        │ Quản lý nhận  │   NV tự chấm điểm      HR chốt
   QL duyệt        (hàng tháng)        │ xét, điều chỉnh│   QL duyệt/trả lại/sửa  khóa
                                      └───────────────┘   điểm (có lý do)         + báo cáo
```

**Mỗi phase có:** `starts_at`, `due_at`, `status` (upcoming | active | closed | locked).

**Job nhắc hạn (hàng ngày 08:00):** người dùng có task pending trong phase đang active mà `due_at - còn ≤ 3 ngày` → notification + email. Cũng nhắc người duyệt khi đơn/điểm nằm quá hạn.

**Khóa tự động:** job ngày 00:00 → mọi phase có `due_at` đã qua chuyển `locked`. Chỉ HR có thể mở lại, **kèm lý do → audit log**.

## 4. Dữ liệu cần lưu

> Các bảng dưới đây là **dữ liệu nghiệp vụ** hệ thống phải lưu. Tên trường giữ nguyên để phát triển
> có thể ánh xạ sau; **ý nghĩa & ràng buộc** mới là phần đặc tả.

### 4.1 Chu kỳ OKR (`OkrCycle`)

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh chu kỳ | Khóa chính |
| `name` | Tên chu kỳ (vd "OKR 2026") | Bắt buộc |
| `year` | Năm của chu kỳ | Số năm |
| `setup_start` / `setup_due` | Mở đóng phase Thiết lập | Mốc tháng Jan–Mar |
| `checkin_start` / `checkin_due` | Mở đóng phase Cập nhật định kỳ | Mốc tháng Mar–Apr |
| `midyear_start` / `midyear_due` | Mở đóng phase Review giữa năm | Mốc tháng Jun–Jul |
| `final_start` / `final_due` | Mở đóng phase Đánh giá cuối năm | Mốc tháng Nov–Dec |
| `summary_start` / `summary_due` | Mở đóng phase Tổng hợp | Sau phase Đánh giá cuối năm |
| `scale_min` / `scale_max` | Thang điểm chấm | `1` → `5` — theo form HR |
| `checkin_interval` | Nhịp check-in | `weekly` · `monthly` (mặc định) · `quarterly` |
| `grade_thresholds` | Ngưỡng sinh **xếp loại** từ điểm TB | Ví dụ: A ≥ 4.5 · B ≥ 3.5 · C ≥ 2.5 |
| `alignment_enabled` | Bật/tắt tính năng phân tầng | Có/Không |
| `status` | Trạng thái chu kỳ | `draft` · `active` · `closed` |
| `created_by` | Người tạo chu kỳ | — |

### 4.2 Mục tiêu & đầu việc

**Mục tiêu (`Objective`)** — 1 objective = **1 nhóm điểm** (Business hoặc People).
Trong mô hình 2 nhóm của HR, điểm chấm thuộc về **nhóm**, không thuộc về từng đầu việc.
Nhóm được ghi ở trường `category: business|people` — mỗi objective thuộc **đúng 1 nhóm**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh mục tiêu | Khóa chính |
| `user_id` | Nhân viên sở hữu | Bắt buộc |
| `cycle_id` | Chu kỳ OKR thuộc về | Bắt buộc |
| `title` / `description` | Tên & mô tả mục tiêu | Tự do |
| `category` | Nhóm điểm — mỗi objective thuộc **đúng 1 nhóm** | `business` (Box 2) hoặc `people` (Box 3) |
| `status` | Trạng thái mục tiêu | `draft` · `submitted` · `approved` · `returned` · `in_progress` · `scored` · `locked` |
| `edit_state` | Trạng thái chỉnh sửa (quyền sửa) | `draft` (NV sửa được) · `submitted` (khoá — chờ duyệt) · `locked` (khoá) · `reopened` (QL mở cho NV sửa) · `returned` (NV sửa theo góp ý) — xem §2.9 |
| `deleted_at` | Lúc bị xoá | Trống nếu chưa xoá — **xoá mềm**, không xoá hẳn bản ghi |
| `delete_reason` | Lý do xoá | **BẮT BUỘC** khi xoá mục tiêu |
| `parent_objective_id` | Mục tiêu cấp trên (nếu có liên kết) | Trống nếu không liên kết — phân tầng: cá nhân → phòng ban → công ty |
| `level` | Cấp độ mục tiêu | `company` · `team` · `individual` |
| `team_id` | Nhóm sở hữu (phân tầng theo cây nhóm lồng nhau) | — |
| `submitted_at` / `approved_at` / `approved_by` | Lúc gửi · lúc duyệt · người duyệt | — |
| `locked_at` | Lúc bị khóa (sau hạn chót) | Trống nếu chưa khóa |
| `score` | Điểm cuối cùng đã chốt | `1` → `5`; trống nếu chưa chấm |
| `grade` | Xếp loại sinh từ điểm TB | `A` · `B` · `C` · `D`; trống nếu chưa chấm |
| `total_weight` | Tổng trọng số đầu việc | `100` khi có trọng số; trống nếu không áp dụng |

**Đầu việc (`OkrAchievement`)** — Box 2 / Box 3 ("Key achievements"). **KHÔNG mang trọng số,
KHÔNG mang điểm riêng** — cả nhóm chấm 1 điểm 1–5. Đây là khác biệt cốt lõi so với mô hình KR có trọng số:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh đầu việc | Khóa chính |
| `objective_id` | Nhóm chứa đầu việc này | Bắt buộc |
| `title` | Nội dung đầu việc | **Không hạn chế số chữ** (theo form HR) |
| `description` | Mô tả chi tiết | Tự do |
| `display_order` | Thứ tự hiển thị trong nhóm | Số nguyên |
| `progress` | Tiến độ trong phase check-in | `%` hoàn thành; trống nếu chưa check-in |
| `deleted_at` | Lúc bị xoá | Trống nếu chưa xoá — **xoá mềm**, không xoá hẳn bản ghi |
| `delete_reason` | Lý do xoá | **BẮT BUỘC** khi xoá đầu việc |
| `created_by` / `created_at` | Ai tạo · lúc tạo | — |

> **Không có đính kèm file ở mục tiêu/đầu việc.** File đính kèm làm evidence hoặc chi tiết bổ sung
> thuộc về **check-in** và **bản chấm** (xem §4.3) — lúc tạo OKR chỉ viết chữ, không tải file.

**Chỉ số đo (`KeyResult`)** — dùng cho **check-in tiến độ** và làm cơ sở tính **điểm đề xuất**
(§9 @@C6@@). Không phải nơi chấm điểm cuối năm:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh chỉ số | Khóa chính |
| `objective_id` | Mục tiêu sở hữu | Bắt buộc |
| `title` / `description` | Tên & mô tả chỉ số | — |
| `metric` | Đơn vị đo | `%` · `lượt` · `điểm` · `ngày`… |
| `start_value` | Giá trị đầu kỳ | Số |
| `target_value` | Giá trị mục tiêu | Số |
| `current_value` | Giá trị hiện tại | Số |
| `weight` | Trọng số của chỉ số | Tổng các chỉ số = `100` |
| `progress` | % hoàn thành | Tính tự động, có thể được ghi đè |
| `confidence` | Mức độ tin cậy | `0` → `1` |
| `self_score` | Điểm nhân viên tự chấm | `1` → `5`; trống nếu chưa chấm |
| `manager_score` | Điểm quản lý chấm | `1` → `5`; trống nếu chưa chấm |
| `manager_comment` | Nhận xét của quản lý | Tự do |
| `locked` | Đã khoá chỉ số | Có/Không |

**Tự đề xuất năm sau (`OkrSelfProposal`)** — Box 4 ("Self proposal next year"):

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh tự đề xuất | Khóa chính |
| `objective_id` | Mục tiêu gắn với | Bắt buộc |
| `proposal` | Nội dung nhân viên tự đề xuất OKR năm tới | Tự do |
| `improvement_area` | Điểm cần cải thiện | Tự do |
| `status` | Trạng thái tự đề xuất | `not_started` (chưa viết) · `draft` (đang viết) · `submitted` (đã nộp) |
| `created_at` | Lúc tạo | — |

> **Card "Self proposal năm sau"** hiển thị trên trang **OKR của tôi** (một card riêng, không chỉ nằm
> trong form đánh giá cuối năm) — kèm trạng thái: **chưa viết / đang viết / đã nộp**, để nhân viên
> luôn thấy mình đã làm phần này hay chưa mà không phải chờ tới cuối năm.

### 4.3 Đánh giá & check-in

**Bản chấm (`OkrAssessment`)** — form đánh giá cuối năm (4 box). Bản chấm của **1 nhân viên trong 1 kỳ đánh giá**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh bản chấm | Khóa chính |
| `objective_id` | Mục tiêu được chấm | Bắt buộc |
| `cycle_id` | Chu kỳ đánh giá | Bắt buộc |
| `review_type` | Loại đánh giá | `midyear` (giữa năm) · `final` (cuối năm) |
| `employee_name` | Họ tên | **Box 1 — chụp lúc chấm**, không đổi theo thời gian |
| `employee_code` | Mã nhân viên | Box 1 — snapshot lúc chấm |
| `position` | Chức danh | Box 1 — snapshot lúc chấm |
| `band` | Band | Box 1 — snapshot lúc chấm |
| `manager_name` | Tên quản lý | Box 1 — snapshot lúc chấm |
| `department` | Phòng ban | Box 1 — snapshot lúc chấm |
| `start_date` | Ngày vào làm | Box 1 — snapshot lúc chấm |
| `business_score` | **Điểm nhóm Business** | Box 2 — giá trị `1` → `5`; trống nếu chưa chấm |
| `people_score` | **Điểm nhóm People** | Box 3 — giá trị `1` → `5`; trống nếu chưa chấm |
| `average_score` | **Điểm trung bình OKR** | **Tự tính** = (Business + People) ÷ 2; trống nếu một nhóm chưa chấm |
| `attachments` | File đính kèm làm evidence hoặc chi tiết bổ sung (ảnh chụp kết quả, báo cáo, tài liệu) | Danh sách file — **chỉ ở bản chấm**, không phải lúc tạo OKR |
| `self_proposal_id` | Tự đề xuất năm sau | Box 4 — trỏ tới bản tự đề xuất; trống nếu không có |
| `grade` | **Xếp loại** | `A` · `B` · `C` · `D` — sinh tự động từ `average_score`; trống nếu chưa chấm |
| `created_by` / `created_at` | Ai chấm · lúc chấm | — |

**Check-in (`OkrCheckIn`)** — lần cập nhật tiến độ định kỳ:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh lần check-in | Khóa chính |
| `objective_id` | Mục tiêu | Bắt buộc |
| `key_result_id` | Chỉ số được cập nhật | Bắt buộc |
| `period` | Kỳ check-in | `"2026-11"` (theo tháng) hoặc `"2026-W45"` (theo tuần) |
| `previous_value` | Giá trị kỳ trước | Số |
| `new_value` | Giá trị mới | Số |
| `progress_snapshot` | Tiến độ tại thời điểm check-in | `%` hoàn thành |
| `note` | Ghi chú | Tự do |
| `confidence` | Mức độ tin cậy | `0` → `1` |
| `attachments` | File đính kèm làm evidence hoặc chi tiết bổ sung (ảnh chụp kết quả, báo cáo, tài liệu) | Danh sách file — tuỳ chọn |
| `created_at` / `created_by` | Lúc check-in · ai check-in | — |

> **Lịch sử check-in không ghi đè** — mỗi lần check-in là 1 dòng riêng, giữ nguyên giá trị cũ.

**Đợt review (`OkrReview`)** — ghi nhận hành động của người đánh giá:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh đợt review | Khóa chính |
| `objective_id` | Mục tiêu được review | Bắt buộc |
| `review_type` | Loại review | `midyear` · `final` |
| `reviewer_id` | Người đánh giá | Bắt buộc |
| `comment` | Nhận xét | Bắt buộc khi **trả lại** hoặc **sửa điểm** |
| `action` | Hành động | `approve` (duyệt điểm) · `return` (trả lại chấm lại) · `adjust` (sửa điểm) |
| `adjustments` | Thay đổi Objective/KR giữa năm | Danh sách thay đổi — có audit |
| `attachments` | File đính kèm làm evidence hoặc chi tiết bổ sung (ảnh chụp kết quả, báo cáo, tài liệu) | Danh sách file — tuỳ chọn |
| `score_override_reason` | Lý do sửa điểm | **BẮT BUỘC** khi hành động là `adjust` |
| `created_at` | Lúc review | — |

### 4.4 Người đánh giá, phân tầng & báo cáo

**Phân công người đánh giá (`OkrAssignment`)** — chụp snapshot tại thời điểm gán để xử lý
"chuyển phòng / đổi quản lý giữa năm" một cách minh bạch:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh phân công | Khóa chính |
| `objective_id` | Mục tiêu được gán | Bắt buộc |
| `reviewer_id` | Người đánh giá | Bắt buộc |
| `reviewer_role` | Vai trò người đánh giá | `manager` · `hr` |
| `assigned_at` | Lúc gán | — |
| `is_current` | Đang là người đánh giá hiện hành | Có/Không — giữ **cả lịch sử** các lần gán cũ |
| `reassigned_from_id` | Lần gán trước đó | Trỏ về phân công cũ khi tái phân công |
| `reassign_reason` | Lý do tái phân công | Bắt buộc khi tái phân công |
| `reassigned_by` | Người thực hiện tái phân công | — |

**Phân tầng (`OkrAlignment`)** — liên kết objective cấp dưới với objective cấp trên:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh liên kết | Khóa chính |
| `child_objective_id` | Mục tiêu cấp dưới | Bắt buộc |
| `parent_objective_id` | Mục tiêu cấp trên | Bắt buộc |
| `created_at` | Lúc tạo liên kết | — |

**Ảnh chụp báo cáo (`OkrReportSnapshot`)** — kết quả báo cáo đã **đóng băng**:

| Trường | Ý nghĩa | Ràng buộc / giá trị |
|---|---|---|
| `id` | Định danh ảnh chụp | Khóa chính |
| `cycle_id` | Chu kỳ OKR | Bắt buộc |
| `generated_at` | Lúc tạo báo cáo | — |
| `generated_by` | Người tạo báo cáo | — |
| `payload` | Nội dung kết quả báo cáo đã đóng băng | Dữ liệu báo cáo |

## 5. Điểm OKR — công thức & quy trình duyệt

### 5.1 Tính điểm theo mô hình 2 nhóm (thang 1–5)

> Theo `doc/OKR_doc.md`: mỗi nhóm (Business · People) được chấm **1 điểm 1–5**,
> **phần mềm tự tính điểm trung bình**. Không có điểm lẻ.

**Cách tính điểm trung bình (`average_score`):**

| Trường hợp | Kết quả |
|---|---|
| `business_score` và `people_score` đều đã chấm | `average_score` = (điểm Business + điểm People) ÷ 2 — **phần mềm tự tính**, người dùng không nhập trực tiếp |
| Một trong hai nhóm **chưa chấm** | `average_score` = **trống** (chưa có điểm trung bình) |

**Cách sinh xếp loại (`grade`):**

| Bước | Quy tắc |
|---|---|
| 1 | Nếu `average_score` trống → `grade` trống (chưa xếp loại) |
| 2 | So `average_score` với ngưỡng **A → B → C** theo thứ tự giảm dần |
| 3 | Điểm trung bình ≥ ngưỡng nào → lấy **xếp loại** tương ứng (`A`, `B` hoặc `C`) |
| 4 | Không đạt ngưỡng nào của A/B/C → `D` |

**Bảng điểm 1–5 → nhãn (hiển thị cho người dùng):**

| Điểm | Nhãn |
|---|---|
| 5 | Vượt xuất |
| 4 | Vượt kỳ vọng |
| 3 | Đạt kỳ vọng |
| 2 | Đạt một phần |
| 1 | Không đạt |

**Vì sao vẫn giữ tiến độ KR & trọng số?**
Vì form HR dùng **"Key achievements"** (đầu việc) chứ không phải KR có trọng số — nhưng hệ thống vẫn
cần **tiến độ** để phục vụ **check-in định kỳ** (nhân viên cập nhật tiến độ trong phase Mar–Apr).
→ Mô hình: **điểm đánh giá = chấm ở tầng nhóm (1–5)**; **tiến độ = theo đầu việc/KR (%, trọng số 100)**.
Hai thứ khác nhau, không trộn.

> **Cảnh báo khi implement:** đừng dùng công thức cũ "tiến độ KR × trọng số" để tính điểm cuối năm —
> công thức đó thuộc về mô hình KR-trọng-số, **không phải** mô hình form HR. Công thức đó chỉ dùng cho
> **điểm đề xuất** ở màn hình review (§8 @@C6@@).

**Điểm tự chấm và điểm quản lý lưu song song** (Mục 4.3 yêu cầu rõ: *"Hệ thống lưu cả điểm tự chấm và điểm của quản lý để đối chiếu"*).

### 5.2 Quy trình duyệt — 5 bước, mỗi bước 1 task

Theo `doc/OKR_doc.md` Bước 1–5 (§2.4). Mỗi bước là **1 task approval engine** có hạn chót + notify:

| Bước | Ai | Việc | Hạn | Task approval |
|---|---|---|---|---|
| 1 | NV | Tự đánh giá (4 box) | ~3–5 ngày | `okr_self_assess` |
| 2 | QL trực tiếp | Đánh giá lại (chấm 1–5, có lý do nếu lệch) | 5 ngày | `okr_manager_assess` |
| 3 | HR | Thu thập → bảng tổng hợp chung | Theo config | `okr_hr_aggregate` |
| 4 | Giám đốc | Đánh giá chung vào bảng tổng hợp | Theo config | `okr_director_review` |
| 5 | HR | Bàn giao bảng tổng hợp OKR công ty + export Excel | Theo config | `okr_hr_publish` |

**Ba nhánh xử lý ở bước 2 (quản lý)** — giữ nguyên tinh thần Mục 4.3 bước 6:

```
┌─ [ Duyệt điểm ] ─────────────────────────────────┐
│  Điểm quản lý = điểm tự chấm                        │
│  Assessment → "scored"                              │
└─────────────────────────────────────────────────────┘

┌─ [ Trả lại chấm lại ] ─────────────────────────────┐
│  Bắt buộc nhập lý do                                │
│  Assessment → "returned" → NV sửa & tự chấm lại    │
│  Tạo OkrReview mới (giữ vết audit cũ)              │
└─────────────────────────────────────────────────────┘

┌─ [ Sửa điểm ] ─────────────────────────────────────┐
│  Bắt buộc nhập lý do (score_override_reason)       │
│  Điểm quản lý ≠ điểm tự chấm → hiện cả hai cạnh nhau│
│  Assessment → "scored"                              │
└─────────────────────────────────────────────────────┘
```

**Hiển thị đối chiếu (điểm cộng UX):** thanh so sánh 2 cột — *Điểm tự chấm* vs *Điểm quản lý* — kèm lý do nếu lệch. Không cần báo cáo riêng.

### 5.3 Validate

- **Điểm chỉ nhận giá trị 1–5**, không nhận số lẻ, không nhận 0 (chưa chấm = để trống).
- Điểm trung bình **tự tính** — người dùng không nhập tay.
- Tổng trọng số KR (cho check-in) **phải = 100** → lỗi → form không cho submit, highlight ô sai.
- **Phải có ít nhất 1 đầu việc** trong mỗi nhóm Business/People → form không cho gửi nếu rỗng.
- Box 4 (self proposal) **không bắt buộc**, nhưng nếu có thì phải kèm điểm cần cải thiện.

## 6. Trường hợp đặc biệt (Mục 4.4)

| Tình huống | Cách xử lý |
|---|---|
| **Chuyển phòng / đổi quản lý giữa năm** | `OkrAssignment` chụp reviewer tại thời điểm gửi. Khi sơ đồ tổ chức đổi, **giữ nguyên reviewer cũ** cho các objective đã gửi. Cho phép HR/manager **reassign** kèm lý do (`reassign_reason`) → audit log đầy đủ, hiển thị "Reviewer: A (gốc) → B (tái phân công ngày X)". |
| **Nhân viên mới vào giữa năm** | Cho phép tạo OKR cho phần còn lại. Hệ thống **tự scale** giá trị mục tiêu theo tỉ lệ thời gian còn lại (`target_value × remaining_days / total_days`) và **ghi chú** điều chỉnh. Hiển thị badge "OKR điều chỉnh cho nhân viên mới". |
| **Nghỉ việc trước kỳ đánh giá** | `User.status = inactive` → ẩn khỏi báo cáo xếp loại, không tính vào phân bố điểm, nhưng **giữ lại lịch sử** (audit). Không cho gửi objective mới. |

## 7. Màn hình

### 7.1 Nhân viên

| Màn hình | Nội dung | Ghi chú UX | Mockup |
|---|---|---|---|
| **Dashboard OKR** | 2 nhóm Business & People cạnh nhau, phase hiện tại, đếm ngược hạn chót, điểm TB tự tính | "Bạn còn 5 ngày để check-in tháng 11" | **S20** |
| **Danh sách OKR** | Card mỗi nhóm: tiến độ %, số đầu việc, trạng thái, mục tiêu cha theo cây nhóm | Sắp xếp theo deadline | S20 |
| **Tạo OKR** | **Wizard 2 bước**: ① Điền 2 nhóm (Business + People) + Box 4 self proposal ② Gửi duyệt | Tự nhập từng đầu việc · **không có trọng số** · có gợi ý từ quản lý | **S21** |
| **Chi tiết nhóm** | Danh sách đầu việc, progress bar, lịch sử check-in, timeline review | Nút "Check-in" nổi bật khi đến kỳ | S20 |
| **Modal check-in** | 1 form nhẹ: giá trị mới (đã điền sẵn kỳ trước), mức độ tin cậy, ghi chú | Ghi chú gợi ý nếu có | **S22** |
| **Tự đánh giá (Bước 1)** | Form 4 box: Box 1 tự điền · Box 2 Business · Box 3 People · Box 4 self proposal | Chấm 1–5 mỗi nhóm, **điểm TB tự tính** | S23 |
| **Kết quả đánh giá** | Điểm tự chấm vs điểm quản lý, điểm TB, xếp loại, lý do nếu lệch | | S23 |

### 7.2 Quản lý

| Màn hình | Nội dung | Mockup |
|---|---|---|
| **Duyệt OKR đầu năm** | Danh sách objective cấp dưới (2 nhóm), duyệt / trả lại kèm góp ý | **S42** |
| **Review giữa năm** | Xem check-in, viết nhận xét (coaching), điều chỉnh mục tiêu (có audit) | **S43** |
| **Đánh giá cuối năm** | Form 4 box, chấm 1–5 mỗi nhóm, sửa điểm (bắt buộc lý do), 3 nhánh hành động | **S23** |
| **Review OKR cả nhóm** | 1 bảng tất cả nhóm, điểm đề xuất theo công thức, cảnh báo rule, chấm hàng loạt | **S24** |

### 7.3 HR

| Màn hình | Nội dung | Mockup |
|---|---|---|
| **Quản lý chu kỳ** | Timeline 5 phase (theo mốc tháng thật — §2.3), set hạn chót theo ngày, thang điểm 1–5, xếp loại, bật phân tầng | **S44** |
| **Bảng tổng hợp OKR** | **9 trường theo `OKR_doc.md` Bước 5** — tên · code · vị trí · thời gian công tác · nhóm · tên QL · điểm công việc · điểm con người · điểm TB (+ Note), **cộng cột Trạng thái** (đã chấm / chờ QL chấm / chưa tự đánh giá) để theo dõi tiến độ — **thay cho màn hình kanban riêng**. Export Excel | **S25** |
| **Tiến độ nộp** | 4 widget: tiến độ nộp theo nhóm · danh sách chưa nộp · phân bố điểm · xếp loại | **S25** |
| **Bàn giao (Bước 5)** | Màn hình xem bảng tổng hợp + nút export Excel bàn giao cho ban lãnh đạo | **S25** |
>
> **Cột "Thời gian công tác"** (trường 4 của bảng tổng hợp) — tính từ `User.start_date` tới 31/12
> của năm đánh giá. Người vào giữa năm chỉ được đánh giá cho phần thời gian đã làm → hệ thống
> **tự tính**, không để HR gõ tay.

## 8. Tính năng tiện lợi

> Chi tiết: `docs/04-convenience-features.md` §2.

### @@C6@@. Review OKR dạng bảng so sánh cả nhóm + điểm đề xuất theo công thức ⭐ P1

**Vấn đề:** Manager review 10 objective → mở từng cái, đọc từng KR, tự tính điểm. Lâu và không nhất quán giữa các người.

**Giải pháp:** 1 bảng tất cả objective của nhóm, kèm cột "đề xuất" tính bằng **công thức minh bạch**:

> **Lưu ý:** điểm đề xuất này là **gợi ý cho manager**, **KHÔNG phải** điểm cuối cùng.
> Điểm cuối cùng theo mô hình HR là **chấm 1–5 ở tầng nhóm** (§5.1). Công thức dưới đây
> ánh xạ tiến độ sang **thang 1–5** để manager so sánh nhanh.

**Công thức tính điểm đề xuất (1–5) — minh bạch, manager kiểm tra được:**

| Bước | Quy tắc |
|---|---|
| 1 | Với **từng chỉ số (KR)** của mục tiêu: lấy **tiến độ** (`0` → `1`) |
| 2 | **Điều chỉnh nhẹ theo độ tin cậy**: `tiến độ × (0.8 + 0.2 × độ tin cậy)` |
| 3 | **Gia quyền theo trọng số**: nhân với `trọng số / 100` rồi cộng dồn lại thành tổng |
| 4 | **Ánh xạ tổng (0 → 1) sang thang 1–5**: nhân 4, làm tròn xuống, cộng 1 |

> **Đây là GỢI Ý cho manager, KHÔNG phải điểm chấm chính thức.**
> Điểm cuối cùng theo mô hình HR vẫn là **chấm 1–5 ở tầng nhóm** (§5.1).

```
┌───────────────────────────────────────────────────────────────────────┐
│ Review cuối năm 2026 · Nhóm Mobile (10 người)                        │
│                                                                        │
│ Tên          Objective           Tự chấm  Đề xuất*  Cảnh báo           │
│ Minh Hà     Tăng trưởng Q4         0.85     0.85     —                │
│ Bình Nguyễn Đổi mô hình CSKH       0.60     0.60     ⚠ KR2 tiến độ 0  │
│ Lan Phạm    Tối ưu vận hành         0.92     0.85     ⚠ tự chấm > đề xuất│
│                                                                        │
│ [*] Đề xuất tính từ tiến độ KR theo công thức                        │
│                                                                        │
│ [Chấm các mục đã chọn (8)]  [Duyệt hàng loạt]                        │
└───────────────────────────────────────────────────────────────────────┘
```

**Cảnh báo (rule):**
- Tiến độ không đổi ≥ 3 kỳ check-in
- `confidence` = 0.9 nhưng `progress` = 0 (mâu thuẫn tự báo)
- Lệch > 0.2 giữa tự chấm và điểm theo tiến độ
- Objective > 60% ngày trong kỳ không check-in

**Tiết kiệm:** review 10 OKR: 90 phút → **25 phút**, và nhất quán hơn.

### Prefill check-in — nhớ giá trị lần trước

Check-in mở form → **đã điền sẵn giá trị kỳ trước** + gợi ý mức độ tin cậy dựa trên biến động lịch sử. Nhân viên sửa con số, xong.

> Đây là 90% giá trị của việc "gợi ý check-in", tốn 0 token.

### C1/C2 — Todo inbox & nhắc việc cho OKR

Nguồn sinh việc (dùng chung `ActionItem`):
- Phase setup active mà nhân viên chưa tạo objective → "Tạo OKR"
- Phase check-in active mà chưa check-in kỳ này → "Check-in tháng 11"
- Phase final active mà chưa tự chấm → "Tự chấm điểm"
- Objective bị trả lại → "Sửa và gửi lại"
- Review quá hạn → quản lý nhận nhắc

### Gợi ý kế thừa từ OKR của quản lý (rule-based)

**Không có AI, không có template** — nhưng nhân viên vẫn có gợi ý để không phải nghĩ lại từ đầu.

**Cơ chế:** form Tạo OKR đọc **OKR đã được duyệt của quản lý trực tiếp** trong cùng chu kỳ, hiện dưới
đúng nhóm tương ứng (Business → Business, People → People) kèm nút **[Chép]**. Nhân viên bấm để chép
rồi sửa, hoặc viết hoàn toàn mới.

**Ràng buộc:**
- Chỉ gợi ý trong cùng nhóm — không trộn Business với People.
- Không tự động điền — phải bấm chép.
- Quản lý chưa có OKR đã duyệt → không hiện gợi ý (không bịa nội dung).
- Gợi ý chỉ mang tính **tham khảo**; nhân viên được thêm/bớt/sửa tùy ý.

> **Vì sao đủ:** phần khó của việc viết OKR không phải là "viết câu" — mà là **biết mục tiêu nào
> đo lường được**. Mục tiêu đó thường đã có ở cấp trên. Chép xuống rồi chỉnh là nhanh nhất, và
> **không cần HR duy trì một bộ template** phải cập nhật mỗi năm.

**Tóm tắt báo cáo cho HR (rule-based):** mỗi widget báo cáo đi kèm **mô tả sẵn theo mẫu câu**,
dựng từ số liệu đã tính:

```
📊 Báo cáo OKR 2026
• 26/30 nhân viên đã nộp OKR (87%)
• Điểm trung bình toàn công ty: 0.78 — xếp loại B (Đạt)
• Phòng ban thấp nhất: Chăm sóc khách hàng (0.61)
• Còn 14 objective chưa check-in đủ kỳ → xem danh sách
```

Số liệu do engine tính, câu chữ do mẫu câu dựng sẵn → **không có nguy cơ bịa số liệu**.

### Các tính năng đã cắt — và thay bằng gì

| Tính năng từng đề xuất | Thay bằng gì |
|---|---|
| Gợi ý điểm OKR | **Điểm đề xuất** theo công thức minh bạch — manager kiểm tra được (§8 @@C6@@) |
| Check-in assist | Prefill giá trị lần trước — 90% giá trị, 0 token |
| Phát hiện OKR rủi ro | Rule so sánh tiến độ / confidence / lịch sử check-in |
| Gợi ý viết KR | Gợi ý kế thừa từ OKR đã duyệt của quản lý (C14) |
| Tóm tắt báo cáo | Mẫu câu dựng từ số liệu đã tính |
| Viết nhận xét review | Manager tự viết — nhận xét cá nhân là việc của người, không nên để máy viết hộ |


## 9. Acceptance criteria

**Chu kỳ OKR**
- [ ] HR tạo được cycle với đủ 5 phase + hạn chót (mốc tháng mặc định theo timeline thật: Q1 → Mar-Apr → Jun-Jul → Nov-Dec)
- [ ] Nhân viên nhận notification nhắc trước hạn 3 ngày
- [ ] Sau `due_at`, objective tự khóa; chỉ HR mở lại được (kèm lý do → audit log)
- [ ] **Nộp lên là khoá** · review giữa kỳ & cuối kỳ **mở lại được** cho NV sửa (xem §2.9)
- [ ] Seed sẵn danh mục objective chuẩn từ OKR Form CSV (2 nhóm Business/People)

**Mô hình 2 nhóm & thang điểm**
- [ ] Mỗi objective thuộc **đúng 1 nhóm**: Business **hoặc** People
- [ ] Nhân viên tạo OKR → có **cả 2 nhóm**, mỗi nhóm ≥ 1 đầu việc (không cho gửi nếu rỗng)
- [ ] Đầu việc cho phép **không hạn chế số chữ**
- [ ] Lúc **tạo OKR không có đính kèm file** ở mục tiêu/đầu việc
- [ ] **Check-in giữa kỳ & cuối kỳ** và **bản chấm** cho phép **đính kèm file** làm evidence / chi tiết bổ sung
- [ ] Điểm chỉ nhận **1–5**, không nhận số lẻ, không nhận 0
- [ ] **Điểm trung bình do phần mềm tự tính** — không có ô nhập tay
- [ ] Xếp loại A/B/C/D tự sinh từ điểm TB theo ngưỡng cấu hình được
- [ ] Box 4 (self proposal năm sau) hiển thị được, kèm "điểm cần cải thiện"
- [ ] **Trang "OKR của tôi" hiện card Self proposal năm sau với trạng thái** (chưa viết / đang viết / đã nộp)

**Vòng đời chỉnh sửa OKR**
- [ ] **Nộp lên là khoá** — sau khi nộp, không ai sửa được mục tiêu/đầu việc cho tới khi được mở lại
- [ ] Trong đợt **review giữa kỳ**, QL bấm **"Mở cho nhân viên sửa"** → NV sửa/bổ sung được, nộp lại → khoá lại
- [ ] Tương tự cho **đánh giá cuối kỳ** — mở lại → sửa → nộp → khoá
- [ ] Mọi lần mở lại / sửa / nộp lại đều có **audit log** (ai mở, mở lúc nào, ai sửa gì)
- [ ] **Xoá mục → vẫn lưu vết + bắt buộc lý do**: mục bị xoá không mất hẳn — hiện **gạch ngang, ghi "đã xoá"** kèm lý do trong lịch sử
- [ ] **Không có lý do xoá thì không cho xoá**
- [ ] **Điểm objective chỉ tính từ các mục chưa bị xoá**

**Quy trình**
- [ ] Tạo OKR tự nhập 2 nhóm, tổng trọng số KR (nếu có) phải = 100 (không cho submit nếu sai)
- [ ] Manager duyệt → trạng thái "đã duyệt"; trả lại → bắt buộc góp ý, NV sửa & gửi lại
- [ ] Check-in theo từng KR, lưu lịch sử (không ghi đè giá trị cũ)
- [ ] Review giữa năm (Jun–Jul): sửa KR được, có audit trail ai sửa gì
- [ ] **Bước 1**: NV tự đánh giá trong ~3–5 ngày → đóng link → notify manager
- [ ] **Bước 2**: QL đánh giá trong 5 ngày → đóng link → notify các NV đã hoàn thành
- [ ] **Bước 3**: HR thu thập toàn bộ đánh giá → bảng tổng hợp chung
- [ ] **Bước 4**: Giám đốc đánh giá chung vào bảng tổng hợp
- [ ] **Bước 5**: HR bàn giao bảng tổng hợp OKR công ty + export Excel
- [ ] Manager: **Duyệt điểm** / **Trả lại** / **Sửa điểm** — cả 3 nhánh hoạt động
- [ ] **Sửa điểm bắt buộc có lý do** — thiếu lý do thì **không cho lưu**
- [ ] Hệ thống lưu **cả 2 loại điểm** và hiển thị đối chiếu cạnh nhau
- [ ] HR chốt & khóa; báo cáo 4 loại; export Excel

**Bảng tổng hợp HR (9 trường)**
- [ ] Bảng tổng hợp có đủ: họ tên · code NV · vị trí · **thời gian công tác** · nhóm · tên QL · điểm công việc · điểm con người · điểm TB (+ note)
- [ ] **Cột Trạng thái** — đã chấm / chờ QL chấm / chưa tự đánh giá: đủ để theo dõi tiến độ, **không cần màn hình kanban riêng** (PO 18/11/2026)
- [ ] Cột "thời gian công tác" **tự tính** từ ngày vào làm tới 31/12 — không để HR gõ tay
- [ ] NV vào giữa năm → thời gian công tác tính đúng phần thực tế

**Quyền xem theo phạm vi**
- [ ] NV chỉ xem được OKR của chính mình
- [ ] Cấp quản lý xem + sửa được OKR toàn bộ bộ phận mình quản lý
- [ ] HR (Giám đốc phần mềm) xem + sửa được OKR bộ phận phát triển phần mềm
- [ ] Admin (Giám đốc quản lý Công nghệ) xem + sửa được OKR **toàn công ty**
- [ ] URL ngoài phạm vi → 403, không rò dữ liệu

**Trường hợp đặc biệt**
- [ ] Nhân viên chuyển phòng giữa năm → reviewer cũ vẫn giữ, có thể reassign kèm lý do
- [ ] Nhân viên mới vào giữa năm → tạo OKR được, target tự scale theo thời gian còn lại, có badge điều chỉnh
- [ ] Nhân viên nghỉ việc → ẩn khỏi báo cáo, không tính phân bố điểm, lịch sử còn nguyên

**Phân tầng**
- [ ] Công ty → Phòng ban → Cá nhân hiển thị thành cây, drill-down được
- [ ] Objective cá nhân liên kết được lên objective phòng ban

**Tiện lợi**
- [ ] Mở form check-in → **giá trị kỳ trước đã điền sẵn**
- [ ] Todo inbox hiện "chưa tạo OKR" / "check-in đến hạn" / "tự chấm chưa làm" / "bị trả lại"
- [ ] Manager review 10 objective trên 1 bảng, có cột điểm đề xuất theo công thức
- [ ] Cảnh báo rule: tiến độ đứng yên ≥3 kỳ, confidence cao nhưng progress = 0, lệch >0.2
- [ ] Chấm hàng loạt các objective đã chọn trong bảng review
- [ ] Gợi ý điểm hiển thị cạnh ô nhập, manager vẫn phải nhập điểm thật
- [ ] Tóm tắt báo cáo dựng từ số liệu đã tính theo mẫu câu có sẵn
