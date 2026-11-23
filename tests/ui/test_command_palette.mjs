/**
 * Command Palette Ctrl/⌘+K (CORE-CMD-01/02) — UI Playwright.
 *
 *   1. Employee mở palette, thấy hành động nhanh WFH + Đổi mật khẩu.
 *   2. Tìm không dấu "dieu" ra đúng quy định.
 *   3. ↑/↓ đổi lựa chọn, Enter mở đơn LEAVE; click WFH mở form WFH đúng loại.
 *   4. Chọn "Đổi mật khẩu" mở thẳng form đổi mật khẩu.
 *   5. Employee tìm "cau hinh" KHÔNG thấy Rule Engine; HR thì thấy.
 *   6. Kết quả nhân sự điều hướng đúng vai trò: Employee → /account/profile,
 *      HR → /admin/employees?search=<code>.
 *
 * Chạy (frontend :3000 + backend :8080):
 *   node tests/ui/test_command_palette.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const INPUT = 'input[placeholder^="Tìm nhân viên"]';

const fail = (msg) => {
  console.error('FAIL ' + msg);
  process.exit(1);
};
const pass = (msg) => console.log('PASS ' + msg);

const browser = await chromium.launch({ headless: true, channel: 'chromium' });

async function loginAs(page, code) {
  await page.goto(`${BASE}/login`);
  await page.fill(
    'input[name="employeeCodeOrEmail"], input[type="text"], input[placeholder*="Mã"], input[placeholder*="Email"]',
    code
  );
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/todo', { timeout: 15000 });
}

async function openPalette(page) {
  await page.locator('button[title^="Tìm kiếm chức năng nhanh"]').first().click();
  await page.waitForSelector(INPUT, { timeout: 5000 });
}

async function closePalette(page) {
  await page.keyboard.press('Escape');
  await page.waitForSelector(INPUT, { state: 'hidden', timeout: 5000 });
}

try {
  // ── Employee ───────────────────────────────────────────────────────────
  const empContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const emp = await empContext.newPage();
  await loginAs(emp, '136ACT');
  await emp.locator('button[title^="Tìm kiếm chức năng nhanh"]').first().waitFor();

  await emp.keyboard.press('Control+k');
  await emp.waitForSelector(INPUT, { timeout: 5000 });
  pass('Ctrl+K mở Command Palette');
  await closePalette(emp);

  await openPalette(emp);
  await emp.waitForSelector('text=Tạo đơn làm việc từ xa (WFH)', { timeout: 8000 });
  await emp.waitForSelector('text=Đổi mật khẩu', { timeout: 8000 });
  const defaultOptions = await emp.locator('[role="option"]').allTextContents();
  if (defaultOptions.length > 6) {
    fail(`Danh sách mặc định quá dài (${defaultOptions.length} mục) — chỉ nên ≤ 6`);
  }
  if (defaultOptions.some((t) => t.includes('Bảng công tổng hợp') || t.includes('Tuỳ chỉnh thông báo'))) {
    fail('Danh sách mặc định đang đổ cả danh mục màn hình: ' + JSON.stringify(defaultOptions));
  }
  pass(`Danh sách mặc định gọn ${defaultOptions.length} thao tác, không đổ toàn bộ danh mục`);

  await emp.fill(INPUT, 'dieu');
  await emp.waitForSelector('text=Quy định Đi muộn, về sớm', { timeout: 8000 });
  pass('Tìm không dấu "dieu" ra quy định đi muộn');

  // ↑/↓ + Enter: chọn hành động thứ 2 (SUBMIT_LEAVE).
  await closePalette(emp);
  await openPalette(emp);
  await emp.waitForSelector('text=Chấm công vào/ra ngay', { timeout: 8000 });
  await emp.waitForTimeout(700); // chờ debounce ổn định danh sách
  await emp.keyboard.press('ArrowDown');
  const second = emp.locator('[role="option"]').nth(1);
  if ((await second.getAttribute('aria-selected')) !== 'true') {
    fail('ArrowDown không chuyển lựa chọn trong palette');
  }
  await emp.keyboard.press('Enter');
  await emp.waitForSelector('text=Tạo Đơn Yêu Cầu Mới', { timeout: 8000 });
  const leaveType = await emp.locator('form select').first().inputValue();
  if (leaveType !== 'LEAVE') fail('Enter trên SUBMIT_LEAVE mở sai loại đơn: ' + leaveType);
  pass('↑/↓ + Enter mở đúng form nghỉ phép');
  await emp.getByRole('button', { name: 'Hủy', exact: true }).first().click();

  // Click WFH action.
  await openPalette(emp);
  await emp.fill(INPUT, 'wfh');
  await emp.waitForTimeout(700);
  await emp.locator('[role="option"]', { hasText: 'Tạo đơn làm việc từ xa (WFH)' }).first().click();
  await emp.waitForSelector('text=Tạo Đơn Yêu Cầu Mới', { timeout: 8000 });
  const wfhType = await emp.locator('form select').first().inputValue();
  if (wfhType !== 'WFH') fail('Chọn WFH mở sai loại đơn: ' + wfhType);
  pass('Chọn WFH mở form đơn WFH');
  await emp.getByRole('button', { name: 'Hủy', exact: true }).first().click();

  // Change password action.
  await openPalette(emp);
  await emp.fill(INPUT, 'doi mat khau');
  await emp.waitForTimeout(700);
  await emp.locator('[role="option"]', { hasText: 'Đổi mật khẩu' }).first().click();
  await emp.waitForSelector('text=Mật khẩu hiện tại', { timeout: 8000 });
  pass('Chọn "Đổi mật khẩu" mở thẳng form đổi mật khẩu');
  await emp.getByRole('button', { name: 'Huỷ' }).first().click();

  // Employee không thấy Rule Engine.
  await openPalette(emp);
  await emp.fill(INPUT, 'cau hinh');
  await emp.waitForTimeout(900);
  if ((await emp.getByText('Cấu hình quy định Rule Engine', { exact: false }).count()) > 0) {
    fail('Employee thấy màn hình Rule Engine (HR-only) trong palette');
  }
  pass('Employee không thấy Rule Engine');

  // User result → profile cá nhân.
  await emp.fill(INPUT, '136ACT');
  await emp.waitForTimeout(900);
  await emp.locator('[role="option"]', { hasText: '136ACT' }).first().click();
  await emp.waitForURL('**/account/profile', { timeout: 8000 });
  pass('Employee chọn kết quả nhân sự → /account/profile');

  // ── HR ─────────────────────────────────────────────────────────────────
  const hrContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const hr = await hrContext.newPage();
  await loginAs(hr, '01HR');

  await openPalette(hr);
  await hr.fill(INPUT, 'cau hinh');
  await hr.waitForTimeout(900);
  await hr.waitForSelector('text=Cấu hình quy định Rule Engine', { timeout: 8000 });
  pass('HR thấy Rule Engine trong palette');

  await hr.fill(INPUT, '136ACT');
  await hr.waitForTimeout(900);
  await hr.locator('[role="option"]', { hasText: '136ACT' }).first().click();
  await hr.waitForURL('**/admin/employees?search=136ACT', { timeout: 8000 });
  pass('HR chọn kết quả nhân sự → /admin/employees?search=136ACT');
} finally {
  await browser.close();
}

console.log('\nALL COMMAND PALETTE UI CHECKS PASSED');
