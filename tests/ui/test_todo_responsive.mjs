/**
 * Trang "Cần làm" (S02) phải hiển thị tốt trên CẢ mobile lẫn desktop.
 *
 * Bối cảnh: card việc trước đây là 1 hàng ngang cố định (icon · tiêu đề · chip ·
 * nút hành động) → trên màn 390px tiêu đề bị cắt thành "B…", dòng 2 tràn ngang.
 *
 * Kiểm tra:
 *   1. MOBILE (390x844): mỗi card việc 2 dòng — tiêu đề KHÔNG bị cắt, dòng hành
 *      động KHÔNG tràn ngang (scrollWidth <= clientWidth).
 *   2. MOBILE: không phần tử nào tràn ngang viewport (trừ thanh cuộn ngang có chủ đích).
 *   3. MOBILE: tab rút gọn hiển thị, không tràn.
 *   4. DESKTOP (1440): card việc 1 hàng ngang như cũ, không tràn.
 *   5. Cả 2: không có lỗi console / request 4xx-5xx.
 *
 * Chạy (frontend :3000 hoặc :5173 + backend :8080):
 *   node tests/ui/test_todo_responsive.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.UI_BASE || 'http://localhost:5173';
const EMPLOYEE = '136ACT';

const fail = (msg) => {
  console.error('FAIL ' + msg);
  process.exit(1);
};
const pass = (msg) => console.log('PASS ' + msg);

const browser = await chromium.launch({ headless: true, channel: 'chromium' });

const login = async (page) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="text"], input[name="employeeCodeOrEmail"], input[placeholder*="Mã"], input[placeholder*="Email"]', EMPLOYEE);
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/todo', { timeout: 15000 });
  // Lời mời bật push che nội dung → bỏ qua nếu có.
  try {
    await page.waitForSelector('text=Bật thông báo đẩy?', { timeout: 4000 });
    await page.locator('button', { hasText: 'Để sau' }).first().click();
    await page.waitForTimeout(400);
  } catch { /* không có lời mời */ }
  await page.waitForSelector('h1:has-text("Cần làm")', { timeout: 15000 });
  await page.waitForTimeout(800);
};

/** Số phần tử có scrollWidth > clientWidth (tức là tràn ngang). */
const overflowing = (page, selector) =>
  page.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push({
          text: (el.innerText || '').slice(0, 60),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        });
      }
    }
    return out;
  }, selector);

try {
  // ── 1. MOBILE ────────────────────────────────────────────────────────────
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const mobile = await mobileCtx.newPage();
  const consoleErrors = [];
  const networkErrors = [];
  // favicon.ico không tồn tại trong dev server → 404 vô hại, không liên quan giao diện.
  const isNoise = (url) => url.includes('favicon.ico');
  mobile.on('console', (m) => {
    if (m.type() === 'error' && !isNoise(m.location()?.url || '')) consoleErrors.push(m.text());
  });
  mobile.on('response', (r) => {
    if (r.status() >= 400 && !isNoise(r.url())) networkErrors.push(`${r.status()} ${r.url()}`);
  });

  await login(mobile);

  const cardCount = await mobile.locator('div.rounded-xl.border-l-\\[3px\\]').count();
  if (cardCount === 0) fail('Không tìm thấy card việc nào trên trang "Cần làm"');
  pass(`MOBILE: trang render ${cardCount} card việc`);

  // 1a. Tiêu đề KHÔNG bị cắt (truncate cắt thành "B…").
  const truncated = await mobile.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('div.rounded-xl.border-l-\\[3px\\] .sm\\:hidden div.text-\\[13px\\]'));
    return titles
      .filter((t) => t.scrollWidth > t.clientWidth + 1)
      .map((t) => ({ text: t.innerText.slice(0, 50), scrollWidth: t.scrollWidth, clientWidth: t.clientWidth }));
  });
  if (truncated.length > 0) fail(`Tiêu đề việc bị cắt trên mobile: ${JSON.stringify(truncated)}`);
  pass('MOBILE: tiêu đề mọi việc hiển thị đầy đủ (không bị cắt "B…")');

  // 1b. Dòng hành động (chip + hạn + nút) KHÔNG tràn ngang.
  const rowOverflow = await mobile.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('div.rounded-xl.border-l-\\[3px\\] .sm\\:hidden > div:last-child'));
    return rows
      .filter((r) => r.scrollWidth > r.clientWidth + 1)
      .map((r) => ({ text: (r.innerText || '').slice(0, 60), scrollWidth: r.scrollWidth, clientWidth: r.clientWidth }));
  });
  if (rowOverflow.length > 0) fail(`Dòng hành động tràn ngang trên mobile: ${JSON.stringify(rowOverflow)}`);
  pass('MOBILE: dòng hành động (chip + hạn + nút) không tràn ngang');

  // 1c. Nút hành động phải bấm được (nhãn rút gọn vẫn có title/aria-label đầy đủ).
  const actionInfo = await mobile.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div.rounded-xl.border-l-\\[3px\\] .sm\\:hidden button'))
      .filter((b) => b.getAttribute('aria-label'));
    return btns.map((b) => ({
      label: b.getAttribute('aria-label'),
      visibleText: b.innerText.trim(),
      visible: b.offsetParent !== null,
    }));
  });
  if (actionInfo.length === 0) fail('Không tìm thấy nút hành động nào trên mobile');
  if (actionInfo.some((b) => !b.visible)) fail('Có nút hành động bị ẩn trên mobile');
  pass(`MOBILE: ${actionInfo.length} nút hành động hiện đủ & có aria-label đầy đủ (vd: "${actionInfo[0].label}")`);

  // 1d. Không có phần tử nào tràn ra ngoài viewport.
  const wide = await mobile.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll('main *'))
      .filter((el) => el.getBoundingClientRect().right > vw + 1)
      .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 50), right: Math.round(el.getBoundingClientRect().right) }))
      .slice(0, 5);
  });
  if (wide.length > 0) fail(`Có phần tử tràn ra ngoài viewport mobile: ${JSON.stringify(wide)}`);
  pass('MOBILE: không phần tử nào tràn ra ngoài khung ngang 390px');

  // 1e. Tab rút gọn hiển thị và cuộn được.
  const tabText = await mobile.locator('button', { hasText: 'Việc Của Tôi' }).first().innerText();
  if (!tabText.includes('Việc Của Tôi')) fail(`Tab mobile hiển thị sai: "${tabText}"`);
  pass(`MOBILE: tab hiển thị rút gọn "${tabText.replace(/\n/g, ' ')}"`);

  // 1f. Không tràn ngang ở cấp trang (tab strip cố ý cuộn ngang).
  const pageOverflow = await mobile.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (pageOverflow.scrollWidth > pageOverflow.clientWidth + 1) {
    fail(`Trang tràn ngang: scrollWidth=${pageOverflow.scrollWidth} > clientWidth=${pageOverflow.clientWidth}`);
  }
  pass(`MOBILE: trang không tràn ngang (${pageOverflow.scrollWidth}px)`);

  await mobile.screenshot({ path: 'tests/ui/screenshot_todo_mobile.png', fullPage: false });
  pass('MOBILE: lưu ảnh tests/ui/screenshot_todo_mobile.png');

  // ── 2. DESKTOP ───────────────────────────────────────────────────────────
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktop = await desktopCtx.newPage();
  const desktopConsole = [];
  const desktopNetwork = [];
  desktop.on('console', (m) => {
    if (m.type() === 'error' && !isNoise(m.location()?.url || '')) desktopConsole.push(m.text());
  });
  desktop.on('response', (r) => {
    if (r.status() >= 400 && !isNoise(r.url())) desktopNetwork.push(`${r.status()} ${r.url()}`);
  });

  await login(desktop);

  // 2a. Card việc phải là 1 hàng ngang (bản desktop hiển thị, bản mobile ẩn).
  const layout = await desktop.evaluate(() => {
    const card = document.querySelector('div.rounded-xl.border-l-\\[3px\\]');
    if (!card) return null;
    const desk = card.querySelector('.sm\\:flex');
    const mob = card.querySelector('.sm\\:hidden');
    return {
      desktopVisible: desk ? getComputedStyle(desk).display !== 'none' : false,
      mobileHidden: mob ? getComputedStyle(mob).display === 'none' : false,
      desktopOverflow: desk ? desk.scrollWidth > desk.clientWidth + 1 : null,
    };
  });
  if (!layout) fail('Không tìm thấy card việc trên desktop');
  if (!layout.desktopVisible) fail('Bản 1 hàng ngang của card không hiện trên desktop');
  if (!layout.mobileHidden) fail('Bản 2 dòng của card vẫn hiện trên desktop');
  if (layout.desktopOverflow) fail('Card desktop bị tràn ngang');
  pass('DESKTOP: card việc 1 hàng ngang, không tràn');

  // 2b. Nhãn nút hành động đầy đủ (không rút gọn) trên desktop.
  const desktopLabel = await desktop.evaluate(() => {
    const card = document.querySelector('div.rounded-xl.border-l-\\[3px\\]');
    // Nút hành động = nút có aria-label KHÔNG bắt đầu bằng "Tuỳ chọn khác".
    const btn = Array.from(card?.querySelectorAll('.sm\\:flex button[aria-label]') || [])
      .find((b) => !b.getAttribute('aria-label').startsWith('Tuỳ chọn khác'));
    return btn ? btn.innerText.trim() : '';
  });
  if (!desktopLabel) fail('Không tìm thấy nút hành động trên desktop');
  pass(`DESKTOP: nhãn nút đầy đủ "${desktopLabel.replace(/\n/g, ' ')}"`);

  // 2c. Không tràn ngang ở cấp trang.
  const deskPage = await desktop.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (deskPage.scrollWidth > deskPage.clientWidth + 1) {
    fail(`Trang desktop tràn ngang: ${JSON.stringify(deskPage)}`);
  }
  pass('DESKTOP: trang không tràn ngang');

  await desktop.screenshot({ path: 'tests/ui/screenshot_todo_desktop.png', fullPage: false });
  pass('DESKTOP: lưu ảnh tests/ui/screenshot_todo_desktop.png');

  // ── 3. LỖI CONSOLE / NETWORK ─────────────────────────────────────────────
  for (const [label, errs] of [['MOBILE', consoleErrors], ['DESKTOP', desktopConsole]]) {
    if (errs.length > 0) fail(`${label}: có lỗi console: ${JSON.stringify(errs.slice(0, 3))}`);
  }
  for (const [label, errs] of [['MOBILE', networkErrors], ['DESKTOP', desktopNetwork]]) {
    if (errs.length > 0) fail(`${label}: có request lỗi: ${JSON.stringify(errs.slice(0, 5))}`);
  }
  pass('Không có lỗi console và không có request 4xx/5xx ở cả 2 kích thước');

  console.log('\n✅ ALL TODO RESPONSIVE CHECKS PASSED');
} finally {
  await browser.close();
}
