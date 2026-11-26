/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ─────────────────────────────────────────────────────────────
      // Toàn bộ màu đi qua CSS custom property để 3 template
      // (Ascend Clean / Midnight Rail / Bento Studio) đổi được runtime.
      //
      // Bắt buộc dùng đúng dạng `rgb(var(--x) / <alpha-value>)`:
      // - <alpha-value> để các class `bg-accent/20`, `border-line/60` hoạt động
      // - biến CSS lưu RGB không alpha: `--accent: 227 29 26` (KHÔNG phải #E31D1A)
      //
      // Nguồn sự thật của giá trị biến: src/index.css
      // ─────────────────────────────────────────────────────────────
      colors: {
        canvas: {
          DEFAULT: 'rgb(var(--canvas) / <alpha-value>)',
          subtle: 'rgb(var(--canvas-subtle) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          secondary: 'rgb(var(--surface-2) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          secondary: 'rgb(var(--ink-2) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          soft: 'rgb(var(--line-soft) / <alpha-value>)',
          subtle: 'rgb(var(--line-soft) / <alpha-value>)',
          hover: 'rgb(var(--line-hover) / <alpha-value>)',
          focus: 'rgb(var(--line-focus) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          dark: 'rgb(var(--accent-dark) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          line: 'rgb(var(--accent-line) / <alpha-value>)',
        },
        // Trạng thái nghiệp vụ — 5 nhóm màu, mỗi nhóm 3 sắc độ
        // (chữ/icon · nền badge · viền badge) để đạt WCAG AA ở cả nền sáng lẫn nền tối.
        status: {
          ok: 'rgb(var(--ok) / <alpha-value>)',
          'ok-soft': 'rgb(var(--ok-soft) / <alpha-value>)',
          'ok-line': 'rgb(var(--ok-line) / <alpha-value>)',
          warn: 'rgb(var(--warn) / <alpha-value>)',
          'warn-soft': 'rgb(var(--warn-soft) / <alpha-value>)',
          'warn-line': 'rgb(var(--warn-line) / <alpha-value>)',
          danger: 'rgb(var(--danger) / <alpha-value>)',
          'danger-soft': 'rgb(var(--danger-soft) / <alpha-value>)',
          'danger-line': 'rgb(var(--danger-line) / <alpha-value>)',
          info: 'rgb(var(--info) / <alpha-value>)',
          'info-soft': 'rgb(var(--info-soft) / <alpha-value>)',
          'info-line': 'rgb(var(--info-line) / <alpha-value>)',
          wfh: 'rgb(var(--wfh) / <alpha-value>)',
          'wfh-soft': 'rgb(var(--wfh-soft) / <alpha-value>)',
          'wfh-line': 'rgb(var(--wfh-line) / <alpha-value>)',
        },
        // Màu chữ ĐẶT trên nền màu đậm (badge, nút). Mỗi theme tự khai báo
        // vì nền sáng và nền tối cần màu chữ khác nhau.
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',
        'on-ok': 'rgb(var(--on-ok) / <alpha-value>)',
        'on-warn': 'rgb(var(--on-warn) / <alpha-value>)',
        'on-danger': 'rgb(var(--on-danger) / <alpha-value>)',
        'on-info': 'rgb(var(--on-info) / <alpha-value>)',
        'on-wfh': 'rgb(var(--on-wfh) / <alpha-value>)',
        // Nút secondary — mỗi theme tự chọn nền để nổi trên nền của mình.
        'btn-secondary': 'rgb(var(--btn-secondary-bg) / <alpha-value>)',
        'btn-secondary-ink': 'rgb(var(--btn-secondary-ink) / <alpha-value>)',
        'btn-secondary-hover': 'rgb(var(--btn-secondary-hover) / <alpha-value>)',
        'danger-hover': 'rgb(var(--danger-hover) / <alpha-value>)',
        // Rail điều hướng — tách riêng vì Midnight Rail có rail tối,
        // Ascend Clean có rail trắng, Bento Studio có rail tối đậm.
        rail: {
          DEFAULT: 'rgb(var(--rail-bg) / <alpha-value>)',
          ink: 'rgb(var(--rail-ink) / <alpha-value>)',
          'ink-2': 'rgb(var(--rail-ink-2) / <alpha-value>)',
          muted: 'rgb(var(--rail-muted) / <alpha-value>)',
          line: 'rgb(var(--rail-line) / <alpha-value>)',
          hover: 'rgb(var(--rail-hover) / <alpha-value>)',
          active: 'rgb(var(--rail-active) / <alpha-value>)',
          'active-bg': 'rgb(var(--rail-active-bg) / <alpha-value>)',
          'badge-bg': 'rgb(var(--rail-badge-bg) / <alpha-value>)',
          'badge-ink': 'rgb(var(--rail-badge-ink) / <alpha-value>)',
        },
      },
      boxShadow: {
        '2xs': '0 1px 2px rgb(var(--shadow) / 0.04)',
        xs: '0 1px 2px rgb(var(--shadow) / 0.06)',
        sm: '0 1px 3px rgb(var(--shadow) / 0.08), 0 1px 2px rgb(var(--shadow) / 0.04)',
        md: '0 4px 14px rgb(var(--shadow) / 0.07), 0 1px 2px rgb(var(--shadow) / 0.04)',
        lg: '0 12px 40px rgb(var(--shadow) / 0.14)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
