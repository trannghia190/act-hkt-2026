# ACT HR — Mockup giao diện 2026 (3 hướng thiết kế)

Tài liệu dự thảo giao diện mới cho ACT HR, dựa trên nhận diện **Ascend Technology**.
**Chưa áp dụng vào mã nguồn** — đây là bản mockup để chọn hướng trước khi implement.

## Xem

```bash
cd mockups/redesign && python3 -m http.server 8899
# mở http://localhost:8899/index.html
```

## Public ra internet

```bash
./scripts/share-mockup.sh          # foreground (Ctrl+C để tắt)
./scripts/share-mockup.sh daemon   # chạy nền, sống sau khi đóng terminal
./scripts/share-mockup.sh url      # in URL hiện tại
./scripts/share-mockup.sh stop     # tắt
```

Script tự chọn provider theo thứ tự **ngrok → cloudflare**, và tự chuyển sang
cloudflare nếu ngrok bị 403 (hết quota tháng).

> **Lưu ý về máy này:** tài khoản ngrok đã **hết quota tháng** — tunnel vẫn mở
> được nhưng mọi request trả `403 ERR_NGROK_727`. Script tự phát hiện và chuyển
> provider. Muốn dùng ngrok thật sự thì cần nạp thêm credit tại
> https://dashboard.ngrok.com/billing.

## Ba hướng thiết kế

| | Hướng | Tóm tắt | Khi nào chọn |
|---|---|---|---|
| **A** | **Ascend Clean** | Sidebar trắng, hairline, shadow nhẹ 1 tầng, đỏ Ascend dùng có kiểm soát | An toàn nhất — hội đồng giám khảo & người dùng thực tế |
| **B** | **Midnight Rail** | Rail tối neutral (#101114) + canvas sáng, active state đỏ | Cô lập tốt vùng điều hướng, nhiều dữ liệu |
| **C** | **Bento Studio** | Toàn nền tối, Bento grid 12 cột, đỏ phát sáng #FF5147 | Wow-factor cao nhất khi demo/trình bày |

Mỗi hướng có 2 màn hình minh hoạ dùng **nguyên vẹn nghiệp vụ hiện có** (Cần làm · OKR · Bảng công · Đăng nhập).

## Logo Ascend

Đã tách từ `doc/ascend_logo_1.png` + `doc/ascend_logo_2.png` sang `assets/`:

| File | Dùng ở đâu |
|---|---|
| `ascend_mark.png` | App icon, favicon (161×157, nền trong suốt) |
| `ascend_wordmark.png` | Chữ "ascend" đơn lẻ |
| `ascend_lockup.png` | Sidebar — mark + wordmark ngang (nền sáng) |
| `ascend_lockup_white.png` | Sidebar — bản trắng (nền tối) |
| `ascend_logo_2_transparent.png` | Lockup "ascend TECHNOLOGY" — bản nền trong suốt |
| `ascend_logo_2_white.png` | Lockup "ascend TECHNOLOGY" — bản trắng cho nền tối |

> `ascend_logo_2.png` gốc có **nền trắng đục** — đã tách alpha bằng cách loại pixel gần trắng.
> Không dùng `filter: brightness(0) invert(1)` cho logo này (sẽ biến thành ô vuông trắng).

## Màu — trích từ logo

| Token | Mã | Ghi chú |
|---|---|---|
| `brand` | `#E31D1A` | Đỏ Ascend (mark). Nền nút + chữ trắng = **4.71:1** ✓ AA |
| `brand-hover` | `#C21815` | Trạng thái hover |
| `brand-ink` | `#C21815` | Chữ đỏ trên nền đỏ nhạt `#FDECEA` = **5.35:1** ✓ AA |
| `brand-soft` | `#FDECEA` | Nền badge/tag đỏ |
| `ink` | `#17171A` | Text chính |
| `ink-muted` | `#6B6C6F` | Text phụ trên nền trắng = **5.25:1** ✓ AA |
| `line` | `#ECECEF` | Viền |
| `canvas` | `#FAFAFB` | Nền trang |
| `neutral-logo` | `#6E6F72` | Xám trong wordmark "TECHNOLOGY" |
| `brand-dark` | `#FF5147` | Đỏ trên nền tối (hướng C) |

**Lưu ý đổi từ hệ hiện tại:** `accent` (xanh lục `#17604d`) → `brand` (đỏ Ascend).
Token đã map 1–1 sang `hkt/frontend/tailwind.config.js` — xem khối code trong mục *Palette* của mockup.

## Typography

- **Inter** — UI/body (thay `-apple-system`)
- **Plus Jakarta Sans** — heading, số KPI (`font-display`)
- **JetBrains Mono** — số liệu bảng, mã, badge (thay `font-mono`)

## Đã kiểm tra

- Tương phản WCAG AA (4.5:1 body / 3:1 large) — audit tự động trên cả 3 hướng ✓
- Không tràn ngang trong khung mockup (1440px và 390px) ✓
- Không phải emoji làm icon — toàn bộ SVG inline ✓
- Tap target ≥ 32px ✓

## Bước tiếp theo (nếu chốt hướng)

1. Copy `assets/*.png` → `hkt/frontend/public/brand/`
2. Đổi token trong `tailwind.config.js` + `src/index.css`
3. Thêm font vào `index.html`
4. Thay `ActHktLogo.tsx` → component mới dùng logo Ascend
5. Refactor `Sidebar.tsx` / `Header.tsx` theo hướng đã chọn
6. Kiểm thử lại: contrast, keyboard nav, mobile bottom nav, command palette
