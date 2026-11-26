/**
 * Kiểm tra mockup giao diện (mockups/redesign) hiển thị tốt ở nhiều bề rộng.
 *
 * Theo convention của tests/ui/test_todo_responsive.mjs:
 *   - test ở 320 / 360 / 390 / 414 / 768 / 1024 / 1440 px
 *   - không phần tử nào tràn ngang viewport
 *   - tiêu đề không bị cắt (truncate) trong card mobile
 *   - layout desktop giữ nguyên, layout mobile dùng bottom nav
 *
 * Chạy: node tests/ui/test_mockup_responsive.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.MOCKUP_BASE || 'http://127.0.0.1:8899';
const WIDTHS = [320, 360, 390, 414, 768, 1024, 1440];

const fail = (msg) => { console.error('FAIL ' + msg); process.exitCode = 1; };
const pass = (msg) => console.log('PASS ' + msg);

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const page = await browser.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(`${BASE}/index.html?v=${w}`, { waitUntil: 'load' });
  await page.waitForTimeout(250);

  // 1. Trang không tràn ngang
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  if (pageOverflow) {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    fail(`${w}px — trang tràn ngang (scrollWidth=${sw})`);
  }

  // 2. Khung app desktop cuộn ngang được (không cắt mất nội dung)
  const frames = await page.evaluate(() =>
    [...document.querySelectorAll('.frame')].map((f) => ({
      scrollW: f.scrollWidth,
      clientW: f.clientWidth,
      overflowX: getComputedStyle(f).overflowX,
    })),
  );
  frames.forEach((f, i) => {
    if (f.scrollW > f.clientW && f.overflowX !== 'auto' && f.overflowX !== 'scroll') {
      fail(`${w}px — frame ${i} bị cắt nội dung mà không cho cuộn (${f.scrollW}>${f.clientW}, overflowX=${f.overflowX})`);
    }
  });

  // 3. Khung mobile: không tràn, tiêu đề không bị cắt
  const phones = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.phone').forEach((p, i) => {
      const bad = [];
      p.querySelectorAll('*').forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible') {
          const t = (el.textContent || '').trim().slice(0, 30);
          if (t) bad.push(`${el.className || el.tagName}:"${t}"(${el.scrollWidth}>${el.clientWidth})`);
        }
      });
      // tiêu đề card bị cắt?
      const clipped = [...p.querySelectorAll('.mcard .mc-t h5')]
        .filter((h) => h.scrollWidth > h.clientWidth + 1)
        .map((h) => h.textContent.slice(0, 34));
      // text trên nền phải tương phản (màn login không có .pg → dùng tiêu đề form)
      const h3 = p.querySelector('.mbody h3.pg, .mlogin .form > div');
      // Tìm nền thực sự phía sau: dây chuyền cha cho tới khi gặp nền đục (không alpha)
      const realBg = (el) => {
        let e = el;
        while (e && e !== document.body) {
          const bg = getComputedStyle(e).backgroundColor;
          const m = bg.match(/rgba?\(([^)]+)\)/);
          if (m) {
            const p = m[1].split(',').map(Number);
            const alpha = p[3] === undefined ? 1 : p[3];
            if (alpha === 1) return bg;
          }
          e = e.parentElement;
        }
        return 'rgb(255,255,255)';
      };
      out.push({
        i, bad: [...new Set(bad)], clipped,
        h3color: h3 ? getComputedStyle(h3).color : null,
        h3bg: h3 ? realBg(h3) : null,
      });
    });
    return out;
  });

  if (phones.length === 0) fail(`${w}px — không tìm thấy khung mobile nào`);
  phones.forEach((p) => {
    if (p.bad.length) fail(`${w}px — phone ${p.i} tràn ngang: ${p.bad.slice(0, 3).join(' | ')}`);
    if (p.clipped.length) fail(`${w}px — phone ${p.i} tiêu đề bị cắt: ${p.clipped.join(' | ')}`);
    // tương phản tối thiểu 4.5:1 giữa tiêu đề và nền
    if (!p.h3color || !p.h3bg) return;   // màn không có tiêu đề để đo
    const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const [r1, g1, b1] = parse(p.h3color);
    const [r2, g2, b2] = parse(p.h3bg);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const l1 = L(r1, g1, b1), l2 = L(r2, g2, b2);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 4.5) fail(`${w}px — phone ${p.i} tiêu đề tương phản ${ratio.toFixed(2)}:1 (<4.5)`);
  });

  if (!pageOverflow && phones.length) pass(`${w}px — không tràn ngang, ${phones.length} khung mobile OK`);
}

// 4. Bottom nav không quá 5 mục
await page.setViewportSize({ width: 390, height: 900 });
await page.goto(`${BASE}/index.html?v=nav`, { waitUntil: 'load' });
const navCounts = await page.evaluate(() =>
  [...document.querySelectorAll('.bnav')].map((n) => n.querySelectorAll('a').length),
);
navCounts.forEach((n) => { if (n > 5) fail(`bottom nav có ${n} mục (>5)`); });
if (navCounts.length && navCounts.every((n) => n <= 5)) pass(`bottom nav ${navCounts.join('/')} mục — đều ≤5`);

// 5. Không lỗi console
if (consoleErrors.length) fail(`lỗi console: ${consoleErrors.slice(0, 3).join(' | ')}`);
else pass('không lỗi console');

await browser.close();
console.log(process.exitCode ? '\nKẾT QUẢ: CÓ LỖI' : '\nKẾT QUẢ: ĐẠT');
