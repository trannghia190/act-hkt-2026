/**
 * Kiểm tra 3 template màu (Ascend Clean / Midnight Rail / Bento Studio) và hiển thị
 * responsive. Chạy được KỂ CẢ khi backend :8080 tắt — chỉ cần frontend chạy, vì
 * token màu là CSS custom property toàn cục (đọc được ngay trên trang /login).
 *
 * Kiểm tra:
 *   1. Mỗi theme khai báo đủ token (--canvas, --accent, --ok, --on-accent...).
 *   2. Tương phản WCAG AA cho các cặp "chữ trên nền" quan trọng (≥ 4.5:1).
 *   3. Trang không tràn ngang ở 320 / 390 / 768 / 1440 px (cả 3 theme).
 *   4. Áp theme từ localStorage lúc boot (chống nháy trắng) — index.html set sẵn.
 *   5. Không có lỗi JS (pageerror) — bỏ qua lỗi mạng do backend tắt.
 *
 * Chạy (frontend đang chạy, ví dụ :3000):
 *   node tests/ui/test_theme_responsive.mjs
 *   UI_BASE=http://localhost:5173 node tests/ui/test_theme_responsive.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.UI_BASE || 'http://localhost:3000';
const THEMES = ['ascend-clean', 'midnight-rail', 'bento-studio'];
const WIDTHS = [320, 390, 768, 1440];

// Token bắt buộc phải có ở mọi theme.
const REQUIRED = [
  'canvas', 'surface', 'ink', 'ink-2', 'ink-muted', 'line',
  'accent', 'accent-hover', 'accent-soft', 'accent-line',
  'ok', 'ok-soft', 'warn', 'warn-soft', 'danger', 'danger-soft', 'info', 'info-soft',
  'on-accent', 'on-ok', 'on-warn', 'on-danger', 'on-info',
];

// Cặp chữ/nền BẮT BUỘC đạt AA cho text thường.
const CRITICAL = [
  ['ink', 'canvas'], ['ink', 'surface'], ['ink-muted', 'surface'],
  ['on-accent', 'accent'], ['on-ok', 'ok'], ['on-warn', 'warn'],
  ['on-danger', 'danger'], ['on-info', 'info'],
  ['ok', 'ok-soft'], ['warn', 'warn-soft'], ['danger', 'danger-soft'], ['info', 'info-soft'],
];
// Nên đạt nhưng chỉ cảnh báo. Chữ đỏ trên nền đỏ nhạt dùng `accent-dark`
// (đậm hơn `accent`) để đạt AA; `accent` thuần chỉ dùng cho nền nút/chữ trắng.
const ADVISORY = [['accent-dark', 'accent-soft'], ['ink-2', 'surface']];

let failed = 0;
const fail = (m) => { console.error('FAIL ' + m); failed++; };
const pass = (m) => console.log('PASS ' + m);
const warn = (m) => console.log('WARN ' + m);

const toRGB = (s) => (s.match(/[\d.]+/g) || []).map(Number).slice(0, 3);
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const page = await browser.newPage();

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 20000 }).catch((e) => {
  console.error('FAIL không mở được ' + BASE + '/login — ' + e.message);
  process.exit(1);
});

// ---- 1 + 2: token & tương phản cho từng theme --------------------------------
for (const theme of THEMES) {
  const tokens = await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    const cs = getComputedStyle(document.documentElement);
    const read = (name) => cs.getPropertyValue('--' + name).trim();
    const names = [
      'canvas', 'surface', 'ink', 'ink-2', 'ink-muted', 'line',
      'accent', 'accent-hover', 'accent-soft', 'accent-line',
      'ok', 'ok-soft', 'warn', 'warn-soft', 'danger', 'danger-soft', 'info', 'info-soft',
      'on-accent', 'on-ok', 'on-warn', 'on-danger', 'on-info',
    ];
    const out = {};
    for (const n of names) out[n] = read(n);
    return out;
  }, theme);

  const missing = REQUIRED.filter((n) => !tokens[n] || toRGB(tokens[n]).length < 3);
  if (missing.length) fail(`${theme}: thiếu/sai token → ${missing.join(', ')}`);
  else pass(`${theme}: đủ ${REQUIRED.length} token`);

  for (const [fg, bg] of CRITICAL) {
    if (!tokens[fg] || !tokens[bg]) continue;
    const r = contrast(toRGB(tokens[fg]), toRGB(tokens[bg]));
    if (r < 4.5) fail(`${theme}: ${fg} trên ${bg} = ${r.toFixed(2)}:1 (<4.5)`);
  }
  pass(`${theme}: tương phản các cặp chính ≥ 4.5:1`);

  for (const [fg, bg] of ADVISORY) {
    if (!tokens[fg] || !tokens[bg]) continue;
    const r = contrast(toRGB(tokens[fg]), toRGB(tokens[bg]));
    if (r < 4.5) warn(`${theme}: ${fg} trên ${bg} = ${r.toFixed(2)}:1 (<4.5, badge nhỏ)`);
  }
}

// ---- 3: responsive cho từng theme -------------------------------------------
for (const theme of THEMES) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await page.waitForTimeout(120);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (overflow) {
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      fail(`${theme} @${w}px — tràn ngang (scrollWidth=${sw})`);
    }
  }
  pass(`${theme}: không tràn ngang @ ${WIDTHS.join('/')}px`);
}

// ---- 4: áp theme từ localStorage lúc boot (index.html) -----------------------
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => { try { localStorage.setItem('act_theme', 'bento-studio'); } catch {} });
await page.goto(`${BASE}/login`, { waitUntil: 'load' });
const booted = await page.evaluate(() => document.documentElement.dataset.theme);
if (booted === 'bento-studio') pass('boot: áp theme từ localStorage (không nháy trắng)');
else fail(`boot: mong 'bento-studio' nhưng được '${booted}'`);
await page.evaluate(() => { try { localStorage.removeItem('act_theme'); } catch {} });

// ---- 5: lỗi JS --------------------------------------------------------------
// Bỏ qua lỗi mạng (backend :8080 tắt) — chỉ bắt exception JS thật.
const realErrors = pageErrors.filter((e) => !/Failed to fetch|NetworkError|ECONNREFUSED|fetch/i.test(e));
if (realErrors.length) fail(`lỗi JS: ${realErrors.slice(0, 3).join(' | ')}`);
else pass('không có lỗi JS (bỏ qua lỗi mạng do backend tắt)');

await browser.close();
console.log(failed ? `\nKẾT QUẢ: ${failed} LỖI` : '\nKẾT QUẢ: ĐẠT');
process.exit(failed ? 1 : 0);
