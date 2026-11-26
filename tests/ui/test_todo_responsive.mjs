/**
 * Trang "Cần làm" (S02) phải hiển thị tốt trên CẢ mobile lẫn desktop.
 *
 * Bố cục hiện tại (redesign mockup S02):
 *  - Bảng ưu tiên (approvals) dạng tile 2 cột mobile / 4 cột desktop
 *  - Card việc / card đơn: header (icon · tiêu đề · chip) + meta, dòng hành động riêng
 *  - Tabs (Việc của tôi / Duyệt đơn / Đã xong) nằm gọn 1 hàng ở 390px
 *
 * Kiểm tra:
 *   1. MOBILE 390 (nhân viên): tab không tràn, card việc render, nút hành động
 *      hiện đủ & bấm được, trang không tràn ngang.
 *   2. MOBILE 390 (manager): tab "Duyệt đơn" → 4 tile ưu tiên đọc được, card
 *      đơn + 3 nút hành động không tràn, bấm card mở modal chi tiết.
 *   3. DESKTOP 1440 (manager): 4 tile 1 hàng, card đơn render, không tràn ngang.
 *   4. Không có lỗi console / request 4xx-5xx.
 *
 * Chạy (frontend :3000 hoặc :5173 + backend :8080):
 *   node tests/ui/test_todo_responsive.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.UI_BASE || 'http://localhost:5173';
const EMPLOYEE = '136ACT';
const MANAGER = '05ACT';

const fail = (msg) => {
  console.error('FAIL ' + msg);
  process.exit(1);
};
const pass = (msg) => console.log('PASS ' + msg);

const browser = await chromium.launch({ headless: true, channel: 'chromium' });

const login = async (page, account) => {
  await page.goto(`${BASE}/login`);
  await page.fill(
    'input[type="text"], input[name="employeeCodeOrEmail"], input[placeholder*="Mã"], input[placeholder*="Email"]',
    account,
  );
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/todo', { timeout: 15000 });
  // Lời mời bật push che nội dung → bỏ qua nếu có.
  try {
    await page.waitForSelector('text=Bật thông báo đẩy?', { timeout: 4000 });
    await page.locator('button', { hasText: 'Để sau' }).first().click();
    await page.waitForTimeout(400);
  } catch {
    /* không có lời mời */
  }
  await page.waitForSelector('h1:has-text("Cần làm")', { timeout: 15000 });
  await page.waitForTimeout(800);
};

const trackErrors = (page, consoleErrors, networkErrors) => {
  const isNoise = (url) => url.includes('favicon.ico');
  page.on('console', (m) => {
    if (m.type() === 'error' && !isNoise(m.location()?.url || '')) consoleErrors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !isNoise(r.url())) networkErrors.push(`${r.status()} ${r.url()}`);
  });
};

const noPageOverflow = async (page, label) => {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (dims.scrollWidth > dims.clientWidth + 1) {
    fail(`${label}: trang tràn ngang (${dims.scrollWidth} > ${dims.clientWidth})`);
  }
  pass(`${label}: trang không tràn ngang (${dims.clientWidth}px)`);
};

try {
  // ── 1. MOBILE — nhân viên: việc của tôi ──────────────────────────────────
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const mobile = await mobileCtx.newPage();
  const mobileConsole = [];
  const mobileNetwork = [];
  trackErrors(mobile, mobileConsole, mobileNetwork);

  await login(mobile, EMPLOYEE);

  // 1a. Tab bar gọn 1 hàng: "Đã xong" không bị cắt.
  const tabs = await mobile.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Việc của tôi'));
    const strip = btn?.parentElement;
    if (!strip) return null;
    return {
      scrollWidth: strip.scrollWidth,
      clientWidth: strip.clientWidth,
      labels: Array.from(strip.querySelectorAll('button')).map((b) => b.innerText.trim().split('\n')[0]),
    };
  });
  if (!tabs) fail('MOBILE: không tìm thấy hàng tab');
  if (tabs.scrollWidth > tabs.clientWidth + 1) {
    fail(`MOBILE: hàng tab tràn ngang (${tabs.scrollWidth} > ${tabs.clientWidth})`);
  }
  pass(`MOBILE: ${tabs.labels.length} tab hiển thị gọn (${tabs.labels.join(' · ')})`);

  // 1b. Card việc render + nút hành động hiện đủ.
  const cardCount = await mobile.locator('[data-testid="todo-card"]').count();
  if (cardCount === 0) fail('MOBILE: không có card việc nào (data-testid="todo-card")');
  const actions = await mobile.evaluate(() => {
    // Card render cả bản mobile + bản desktop, bản còn lại bị `hidden` — chỉ đo bản đang hiện.
    return Array.from(document.querySelectorAll('[data-testid="todo-card"] button[aria-label]:not([aria-label^="Tuỳ chọn"])'))
      .map((b) => ({ label: b.getAttribute('aria-label'), visible: b.offsetParent !== null, h: b.getBoundingClientRect().height }))
      .filter((a) => a.visible);
  });
  if (actions.length === 0) fail('MOBILE: card việc không có nút hành động');
  if (actions.some((a) => !a.visible || a.h < 30)) fail(`MOBILE: nút hành động bị ẩn/quá nhỏ: ${JSON.stringify(actions.slice(0, 3))}`);
  pass(`MOBILE: ${cardCount} card việc, ${actions.length} nút hành động hiện đủ (vd "${actions[0].label}")`);

  await noPageOverflow(mobile, 'MOBILE');
  await mobile.screenshot({ path: 'tests/ui/screenshot_todo_mobile.png', fullPage: false });
  pass('MOBILE: lưu ảnh tests/ui/screenshot_todo_mobile.png');

  // ── 2. MOBILE — manager: tab duyệt đơn ───────────────────────────────────
  const mgrCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const mgr = await mgrCtx.newPage();
  const mgrConsole = [];
  const mgrNetwork = [];
  trackErrors(mgr, mgrConsole, mgrNetwork);

  await login(mgr, MANAGER);
  await mgr.locator('button', { hasText: 'Duyệt đơn' }).first().click();
  await mgr.waitForSelector('[data-testid="approval-card"]', { timeout: 15000 });
  await mgr.waitForTimeout(300);

  // 2a. 4 tile ưu tiên đọc được (không bị bóp hẹp).
  const tiles = await mgr.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((b) => ['Tất cả', 'Khẩn cấp', 'Sớm', 'Theo lịch'].some((l) => b.innerText.trim().startsWith(l)))
      .map((b) => ({ label: b.innerText.trim().split('\n')[0], w: b.getBoundingClientRect().width })),
  );
  if (tiles.length !== 4) fail(`MOBILE: cần 4 tile ưu tiên, thấy ${tiles.length}`);
  if (tiles.some((t) => t.w < 150)) fail(`MOBILE: tile ưu tiên bị bóp hẹp: ${JSON.stringify(tiles)}`);
  pass(`MOBILE: 4 tile ưu tiên rộng ${tiles.map((t) => Math.round(t.w)).join('/')}px`);

  // 2b. Card đơn: 3 nút hành động nằm gọn trong card.
  const cardActions = await mgr.evaluate(() => {
    const card = document.querySelector('[data-testid="approval-card"]');
    if (!card) return null;
    const cr = card.getBoundingClientRect();
    return Array.from(card.querySelectorAll('button'))
      .filter((b) => !b.getAttribute('aria-label'))
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { text: b.innerText.trim(), fits: r.right <= cr.right + 1 && r.width > 40, h: r.height };
      });
  });
  if (!cardActions || cardActions.length < 3) fail(`MOBILE: card đơn cần ≥3 nút, thấy ${JSON.stringify(cardActions)}`);
  if (cardActions.some((a) => !a.fits)) fail(`MOBILE: nút hành động tràn khỏi card: ${JSON.stringify(cardActions)}`);
  pass(`MOBILE: card đơn có ${cardActions.length} nút gọn trong card (${cardActions.map((a) => a.text).join(' · ')})`);

  // 2c. Bấm card mở modal chi tiết; tiêu đề dùng mã rút gọn (không phải UUID đầy đủ).
  await mgr.locator('[data-testid="approval-card"]').first().click({ position: { x: 150, y: 40 } });
  await mgr.waitForSelector('text=Chi tiết giải trình', { timeout: 5000 });
  const modalTitle = await mgr.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h3, h2')).find((h) => h.textContent.includes('Hồ Sơ Yêu Cầu'));
    return heading?.textContent.trim() || '';
  });
  if (!modalTitle.includes('#')) fail(`MOBILE: tiêu đề modal không dùng mã rút gọn: "${modalTitle}"`);
  pass(`MOBILE: modal chi tiết mở đúng ("${modalTitle}")`);
  await mgr.keyboard.press('Escape');

  await noPageOverflow(mgr, 'MOBILE (duyệt đơn)');

  // ── 3. DESKTOP — manager: duyệt đơn ──────────────────────────────────────
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktop = await desktopCtx.newPage();
  const desktopConsole = [];
  const desktopNetwork = [];
  trackErrors(desktop, desktopConsole, desktopNetwork);

  await login(desktop, MANAGER);
  await desktop.locator('button', { hasText: 'Duyệt đơn' }).first().click();
  await desktop.waitForSelector('[data-testid="approval-card"]', { timeout: 15000 });
  await desktop.waitForTimeout(300);

  // 3a. 4 tile ưu tiên nằm cùng 1 hàng.
  const tileTops = await desktop.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((b) => ['Tất cả', 'Khẩn cấp', 'Sớm', 'Theo lịch'].some((l) => b.innerText.trim().startsWith(l)))
      .map((b) => Math.round(b.getBoundingClientRect().top)),
  );
  if (tileTops.length !== 4 || new Set(tileTops).size !== 1) {
    fail(`DESKTOP: 4 tile ưu tiên không cùng 1 hàng: ${JSON.stringify(tileTops)}`);
  }
  pass('DESKTOP: 4 tile ưu tiên cùng 1 hàng');

  const desktopCards = await desktop.locator('[data-testid="approval-card"]').count();
  if (desktopCards === 0) fail('DESKTOP: không có card đơn nào');
  pass(`DESKTOP: render ${desktopCards} card đơn`);

  await noPageOverflow(desktop, 'DESKTOP');
  await desktop.screenshot({ path: 'tests/ui/screenshot_todo_desktop.png', fullPage: false });
  pass('DESKTOP: lưu ảnh tests/ui/screenshot_todo_desktop.png');

  // ── 4. LỖI CONSOLE / NETWORK ─────────────────────────────────────────────
  for (const [label, errs] of [
    ['MOBILE', mobileConsole],
    ['MOBILE (duyệt đơn)', mgrConsole],
    ['DESKTOP', desktopConsole],
  ]) {
    if (errs.length > 0) fail(`${label}: có lỗi console: ${JSON.stringify(errs.slice(0, 3))}`);
  }
  for (const [label, errs] of [
    ['MOBILE', mobileNetwork],
    ['MOBILE (duyệt đơn)', mgrNetwork],
    ['DESKTOP', desktopNetwork],
  ]) {
    if (errs.length > 0) fail(`${label}: có request lỗi: ${JSON.stringify(errs.slice(0, 5))}`);
  }
  pass('Không có lỗi console và không có request 4xx/5xx');

  console.log('\n✅ ALL TODO RESPONSIVE CHECKS PASSED');
} finally {
  await browser.close();
}
