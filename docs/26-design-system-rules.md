# 26 · Quy tắc Design System — 3 theme

Mọi màn hình dùng **cùng một bộ quy tắc**. Theme chỉ đổi **màu**, không đổi kích thước,
bố cục hay logic. Nguồn sự thật token: `hkt/frontend/src/index.css` + `tailwind.config.js`.

Theme: `ascend-clean` (sáng) · `midnight-rail` (mặc định) · `bento-studio` (tối).

---

## 1. Màu không mang nghĩa nghiệp vụ

Màu **accent** dùng cho *hành động / đang chọn / thương hiệu*.
Màu **status** (ok / warn / danger / info / wfh) dùng cho *trạng thái dữ liệu*, và chỉ
xuất hiện trên nút qua variant chuẩn `success` (duyệt) / `danger` (từ chối, xóa).

| Sai | Đúng |
|---|---|
| Nút "Vào ca" xanh lá, "Ra ca" đen | Cả hai dùng `accent` khi được chọn; chữ nói rõ vào/ra |
| Tab đang chọn xanh, tab khác đen | Mọi tab đang chọn dùng `accent-soft` + `accent-dark` |
| Nút "Duyệt" xanh lá tự ghép class | Nút "Duyệt" = `Button variant="success"`; mọi nút duyệt/xác nhận tích cực dùng chung một variant |

> Lý do: cùng một loại điều khiển phải trông giống nhau ở mọi màn. Nếu mỗi màn tự chọn
> xanh/đen/đỏ thì người dùng phải học lại giao diện từng trang, và theme tối dễ mất tương phản.

---

## 2. Nút (Button)

Dùng `components/common/Button.tsx`, không tự ghép class màu cho nút chuẩn.

| Variant | Dùng khi | Token |
|---|---|---|
| `primary` | Hành động chính của màn (Lưu, Gửi, Duyệt, Chấm công) | `bg-accent text-on-accent hover:bg-accent-hover` |
| `secondary` | Hành động phụ có nền (Tải lại, Xem thêm) | `bg-btn-secondary text-btn-secondary-ink` |
| `outline` | Hủy, quay lại, hành động trung tính | `border-line bg-surface text-ink hover:bg-canvas` |
| `danger` | Hành động xóa / từ chối không hoàn tác | `bg-status-danger text-on-danger hover:bg-danger-hover` |
| `success` | **Chỉ** hành động duyệt / xác nhận kết quả tích cực | `bg-status-ok text-on-ok` |
| `ghost` | Liên kết hành động trong bảng, toolbar | `text-ink-secondary hover:bg-canvas` |

- Một khu vực chỉ có **tối đa 1 nút `primary`**.
- Disabled: `disabled:opacity-50` (Button đã lo), không tự đổi sang màu xám cứng.
- Nút tròn lớn (chấm công) cũng là `primary`: dùng `accent` cho cả VÀO và RA.
- Không dùng `status-ok` làm nền nút; trạng thái thành công thể hiện ở badge/toast.

## 3. Tab & Segmented control

- **Tab dạng chip** (Cần làm, Duyệt đơn…): đang chọn `bg-accent-soft border-accent-line text-accent-dark`;
  chưa chọn `bg-surface border-line text-ink-secondary`.
- **Segmented control** (Vào ca / Ra ca, bộ lọc 2–4 lựa chọn): dùng
  `components/common/SegmentedControl.tsx`.
  - Container: `bg-canvas border-line rounded-xl p-1`.
  - Đang chọn: `bg-accent-soft text-accent-dark shadow-sm` — **giống nhau cho mọi option**.
  - Chưa chọn: `text-ink-muted hover:text-ink`.
  - Có `aria-pressed`, `role="group"`, `aria-label`.
- **Tab gạch chân** (chi tiết hồ sơ): chữ đang chọn `text-ink font-semibold`, gạch `border-accent`;
  chưa chọn `text-ink-muted`.
- Không đổi chiều cao tab/nút giữa các theme — chỉ đổi màu.

## 4. Badge / trạng thái

| Trạng thái | Token nền | Token chữ/viền |
|---|---|---|
| Thành công, đủ công, hợp lệ | `status-ok-soft` | `status-ok` / `status-ok-line` |
| Cảnh báo, chờ xác nhận, đi muộn | `status-warn-soft` | `status-warn` / `status-warn-line` |
| Lỗi, từ chối, quá hạn | `status-danger-soft` | `status-danger` / `status-danger-line` |
| Thông tin, trung tính | `status-info-soft` | `status-info` / `status-info-line` |
| WFH / làm từ xa | `status-wfh-soft` | `status-wfh` / `status-wfh-line` |
| Chưa có dữ liệu | `surface-secondary` | `ink-muted` |

Mỗi trạng thái có 3 sắc độ (`-soft`, mặc định, `-line`) để đạt **WCAG AA** trên cả nền sáng lẫn tối.
Không dùng palette literal (`emerald-*`, `rose-*`, `amber-*`, `sky-*`…) trong màn hình.

## 5. Form

- Input/select/textarea: `bg-surface border border-line rounded-lg text-ink`,
  focus `border-accent ring-[3px] ring-accent/20`.
- Placeholder `text-ink-muted`; lỗi `status-danger` + `status-danger-line`; gợi ý `ink-muted`.
- Nhãn luôn hiện phía trên field, không dùng placeholder thay nhãn.

## 6. Card, bảng, modal

- Card: `bg-surface border border-line rounded-2xl shadow-xs`; header dùng `ink`, mô tả `ink-muted`.
- Bảng: header `bg-canvas text-ink-muted uppercase`, dòng hover `bg-canvas-subtle`,
  viền `divide-line-soft`; bảng rộng giữ `overflow-x-auto` + cột đầu `sticky`.
- Modal: nền `bg-surface`, overlay `bg-ink/40`, tiêu đề `text-ink`, nút hủy `outline`, nút xác nhận `primary`.

## 7. Rail điều hướng

Dùng token `rail-*` (`rail-bg`, `rail-ink`, `rail-muted`, `rail-line`, `rail-hover`,
`rail-active`, `rail-active-bg`). Không hardcode `#101114`… vì `ascend-clean` dùng rail sáng.
Mục đang chọn: `bg-rail-active-bg text-rail-active border-rail-active`.

## 8. Theme & tương phản

- Mọi màu đi qua token (không hex/palette literal trong component).
- Chữ body ≥ 4.5:1, chữ lớn ≥ 3:1, ở **cả 3 theme**.
- `on-accent`, `on-ok`, `on-warn`, `on-danger`, `on-info`, `on-wfh` là màu chữ **đặt trên nền đậm**;
  không dùng `text-white` cứng.
- Theme không được đổi padding/margin/width/height. Rail giữ nguyên bề rộng.

## 9. Checklist trước khi merge một màn hình

- [ ] Không còn `emerald-|rose-|amber-|sky-|purple-|zinc-|slate-` trong file màn hình
- [ ] Nút chính dùng `Button variant="primary"`; tab/segmented đang chọn dùng `accent-soft`
- [ ] Badge/trạng thái dùng đúng cặp `status-*-soft` + `status-*`
- [ ] Kiểm tra 3 theme × 390px và 1440px: không tràn ngang, chữ đọc được
- [ ] `npx tsc --noEmit` + `npm run build` sạch
