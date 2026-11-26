# 26 · Quy tắc Design System — theo mockup `mockups/redesign`

Mọi màn hình dùng **cùng một ngôn ngữ thị giác** lấy từ mockup đã duyệt:
`mockups/redesign/index.html` (3 hướng A/B/C) và các màn chi tiết trong
`mockups/redesign/screens/`.

- **Nguồn style:** mockup là chuẩn về màu, bo góc, chiều cao, kiểu chữ, thứ bậc nút.
- **Nguồn token trong code:** `hkt/frontend/src/index.css` + `tailwind.config.js`.
- **Theme:** `ascend-clean` (sáng) · `midnight-rail` (mặc định) · `bento-studio` (tối).
- Theme chỉ đổi **màu**, không đổi kích thước / bố cục / logic.

---

## 1. Map mockup → code

| Mockup (`index.html`) | Trong app |
|---|---|
| `.btn-primary` | `<Button variant="primary">` — đỏ brand, chữ `on-accent`, đổ bóng nhẹ |
| `.btn-sec` | `<Button variant="secondary">` — nền `surface`, viền `line`, chữ `ink` |
| `.btn-ghost` | `<Button variant="outline">` — nền `surface`, viền `line`, chữ `ink-secondary` |
| `.btn-quiet` | `<Button variant="ghost">` — không nền/viền, chữ `ink-secondary` |
| `.chip.on` | Tab/filter đang chọn: nền `ink`, chữ `canvas` |
| `.tag-red / -amber / -green / -blue / -gray` | `<Badge>` với `status-*-soft` + `status-*` |
| `.card` (`--card-bg`, `--sd-line`) | `bg-surface border border-line rounded-xl/2xl` |
| `.sitem.on` | `bg-rail-active-bg text-rail-active` + vạch 3px `accent` |
| `--brand` | `accent` · `--brand-soft` → `accent-soft` · `--brand-line` → `accent-line` |
| `--sd-ink / ink-2 / muted` | `ink / ink-secondary / ink-muted` |
| `--sd-line / line-strong / hover` | `line / line-hover / canvas-subtle` |
| Font | Inter (body) · Plus Jakarta Sans (tiêu đề) · JetBrains Mono (số, mã) |

Kích thước chuẩn theo mockup:

| Thành phần | Chiều cao | Bo góc | Chữ |
|---|---|---|---|
| Nút chuẩn | **36px** | **10px** | 13px · 600 |
| Nút trong dòng task/bảng | 32px | 9px | 12.5px · 600 |
| Chip lọc | **31px** | pill (`999px`) | 12.5px · 550 |
| Segmented | ô 34px trong khung p-4px | khung 12px · ô 9px | 12px · 700 |
| Tag/badge | theo nội dung | **6px** | 11px · 600 |
| Card | — | 13–14px | tiêu đề 13.8–15px · 600 |
| Rail | rộng **252px** | item 9px | 13.5px · 500 |

---

## 2. Màu & ngữ nghĩa

| Vai trò | Token | Ghi chú |
|---|---|---|
| Hành động chính, thương hiệu | `accent` (+ `accent-hover`, `accent-soft`, `accent-line`) | Nút primary, nút chấm công, focus ring |
| **Đang chọn trong bộ lọc/tab/segmented** | `ink` (nền) + `canvas` (chữ) | Giống `.chip.on` của mockup — **không** dùng accent cho chip |
| Điều hướng đang chọn | `rail-active-bg` + `rail-active` | Rail, sidebar |
| Trạng thái dữ liệu | `status-ok / warn / danger / info / wfh` | Chỉ badge, toast, icon, viền cảnh báo |
| Chữ / nền / viền | `ink*`, `surface*`, `canvas*`, `line*` | Không dùng palette literal |

**Ngoại lệ có chủ đích theo mockup chấm công** (`screens/checkin.html`):
segmented **Vào ca** đang chọn dùng `status-ok` + `on-ok`; **Ra ca** dùng `ink` + `canvas`.
Nút chấm công lớn vẫn là `primary` (đỏ brand) cho cả hai. Không tự chế cặp màu khác.

> Màu xanh/đỏ/vàng **không** dùng để trang trí nút điều hướng. Chỉ dùng khi
> mockup của chính màn đó quy định hoặc khi đó là trạng thái dữ liệu.

---

## 3. Nút (Button)

Dùng `components/common/Button.tsx`, không tự ghép class màu cho nút chuẩn.

| Variant | Dùng khi | Style |
|---|---|---|
| `primary` | Hành động chính: Lưu, Gửi, Duyệt, Chấm công | `bg-accent text-on-accent hover:bg-accent-hover shadow-sm` |
| `secondary` | Hành động phụ: Tải lại, Xuất file, Xem thêm | `border-line bg-surface text-ink hover:bg-canvas-subtle` |
| `outline` | Hủy, quay lại, hành động trung tính | `border-line bg-surface text-ink-secondary hover:text-ink` |
| `ghost` | Liên kết hành động trong bảng/toolbar | `text-ink-secondary hover:bg-canvas` |
| `danger` | Xóa / từ chối không hoàn tác | `bg-status-danger text-on-danger` |

- **Không có variant `success`**: mockup không dùng nút xanh lá. Duyệt/xác nhận = `primary`.
- Một khu vực chỉ có **tối đa 1 nút `primary`** (trừ danh sách mỗi dòng có 1 hành động chính,
  giống `.task-act` trong mockup).
- Disabled: `disabled:opacity-50` — Button đã lo, không tự đổi sang xám cứng.
- Nút tròn lớn (chấm công) dùng `accent`, chữ `on-accent`.
- Icon trong nút 15px, stroke 2–2.2; không dùng emoji làm icon.

---

## 4. Tab, chip & segmented control

**Tab/filter dạng chip** (giống `.chips` trong mockup):

- Cao 31px, bo pill, viền `line`, nền `surface`, chữ `ink-secondary`.
- Đang chọn: `bg-ink border-ink text-canvas` (đảo màu), **không** dùng `accent-soft`.
- Số đếm trong chip dùng `font-mono text-[10.5px] opacity-65`.
- Trên mobile: hàng chip cuộn ngang (`overflow-x-auto`, ẩn scrollbar), không xuống dòng.

**Segmented control** (Vào ca / Ra ca, bộ lọc 2–4 lựa chọn):

- Dùng `components/common/SegmentedControl.tsx`.
- Khung: `bg-canvas border-line rounded-xl p-1 gap-1`; ô cao 34px, bo 9px.
- Đang chọn mặc định: `bg-ink text-canvas` — cùng style chip.
- Chỉ truyền `tone` khi mockup màn đó quy định (`ok` cho Vào ca, `accent` khi thật cần).
- Chưa chọn: `text-ink-muted`, hover `text-ink`.
- Có `role="group"`, `aria-label`, `aria-pressed`.

**Tab gạch chân** (chi tiết hồ sơ): chữ đang chọn `text-ink font-semibold`, gạch `border-accent`;
chưa chọn `text-ink-muted`.

Không đổi chiều cao tab/nút giữa các theme — chỉ đổi màu.

---

## 5. Badge / trạng thái

| Trạng thái | Nền | Chữ |
|---|---|---|
| Thành công, đủ công, hợp lệ | `status-ok-soft` | `status-ok` |
| Cảnh báo, chờ xác nhận, đi muộn | `status-warn-soft` | `status-warn` |
| Lỗi, từ chối, quá hạn | `status-danger-soft` | `status-danger` |
| Thông tin, trung tính | `status-info-soft` | `status-info` |
| WFH / làm từ xa | `status-wfh-soft` | `status-wfh` |
| Chưa có dữ liệu | `surface-secondary` | `ink-muted` |

Tag bo **6px**, chữ 11px/600, padding 2.5px × 8px, **không viền** — giống `.tag` trong mockup.
Dùng `status-*-line` cho viền khối cảnh báo (alert), không dùng cho badge.
Mỗi trạng thái có 3 sắc độ (`-soft`, mặc định, `-line`) để đạt **WCAG AA** ở cả nền sáng và tối.
Không dùng palette literal (`emerald-*`, `rose-*`, `amber-*`, `sky-*`…) trong màn hình.

---

## 6. Form

- Input/select/textarea: `bg-surface border border-line rounded-[10px] text-ink`,
  focus `border-accent ring-[3px] ring-accent/20`.
- Placeholder `text-ink-muted`; lỗi `status-danger` + `status-danger-line`; gợi ý `ink-muted`.
- Nhãn luôn hiện phía trên field, không dùng placeholder thay nhãn.
- Chiều cao input chuẩn 36–40px; không đổi giữa các theme.

## 7. Card, bảng, modal

- Card: `bg-surface border border-line rounded-xl` (13–14px), padding 14–18px; header `ink`, mô tả `ink-muted`.
- Bảng: header 10.5px, chữ hoa, tracking rộng, màu `ink-muted`; dòng hover `canvas-subtle`;
  ô số/mã dùng `font-mono`; bảng rộng giữ `overflow-x-auto` + cột đầu `sticky`.
- Modal: nền `surface`, overlay `ink/40`, tiêu đề `ink`, nút hủy `outline`, nút xác nhận `primary`.

## 8. Rail điều hướng

Rộng **252px** ở mọi theme. Dùng token `rail-*` (`rail-bg`, `rail-ink`, `rail-muted`,
`rail-line`, `rail-hover`, `rail-active`, `rail-active-bg`). Không hardcode `#101114`…
vì `ascend-clean` dùng rail sáng.

Mục đang chọn: `bg-rail-active-bg text-rail-active` + vạch 3px `accent` bên trái; item bo 9px.

## 9. Theme & tương phản

- Mọi màu đi qua token; không hex/palette literal trong component.
- Chữ body ≥ 4.5:1, chữ lớn ≥ 3:1, ở **cả 3 theme**.
- `on-accent`, `on-ok`, `on-warn`, `on-danger`, `on-info`, `on-wfh` là màu chữ **đặt trên nền đậm**;
  không dùng `text-white` cứng.
- Theme không được đổi padding/margin/width/height. Rail giữ nguyên bề rộng.

## 10. Checklist trước khi merge một màn hình

- [ ] Không còn `emerald-|rose-|amber-|sky-|purple-|zinc-|slate-` trong file màn hình
- [ ] Nút chính dùng `Button variant="primary"`; không dùng variant `success` (không tồn tại)
- [ ] Tab/chip đang chọn dùng `bg-ink text-canvas`; segmented theo đúng `tone` của mockup
- [ ] Badge/trạng thái dùng đúng cặp `status-*-soft` + `status-*`, bo 6px
- [ ] So màn thật với mockup tương ứng trong `mockups/redesign/` (nếu có)
- [ ] Kiểm tra 3 theme × 390px và 1440px: không tràn ngang, chữ đọc được
- [ ] `npx tsc --noEmit` + `npm run build` sạch
