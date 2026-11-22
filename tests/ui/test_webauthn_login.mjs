/**
 * Passkey LOGIN end-to-end (Chromium Virtual Authenticator).
 *
 * Kiểm tra: đăng ký passkey qua UI → đăng xuất → đăng nhập lại CHỈ bằng passkey
 * (không gõ mật khẩu) → phiên đúng nhân viên. Máy chưa có passkey phải báo lỗi
 * và giữ nguyên trang đăng nhập.
 *
 * Chạy (frontend :3000 + backend :8080):
 *   node tests/ui/test_webauthn_login.mjs
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const BASE = 'http://localhost:3000';
const EMPLOYEE = '136ACT';

const fail = (msg) => {
  console.error('FAIL ' + msg);
  process.exit(1);
};
const pass = (msg) => console.log('PASS ' + msg);

const psql = (sql) => execFileSync('psql', ['-h', '127.0.0.1', '-d', 'pulse_db', '-tAc', sql], { encoding: 'utf8' }).trim();
const cleanup = () => psql(
  "delete from devices where device_fingerprint like 'passkey-%' and user_id=(select id from users where employee_code='" + EMPLOYEE + "')");
cleanup();

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const cdp = await context.newCDPSession(page);
await cdp.send('WebAuthn.enable');
const opts = {
  protocol: 'ctap2',
  transport: 'internal',
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  automaticPresenceSimulation: true,
};

const loginWithPassword = async () => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="text"], input[name="employeeCodeOrEmail"], input[placeholder*="Mã"], input[placeholder*="Email"]', EMPLOYEE);
  await page.fill('input[type="password"]', '123456');
  // Nút passkey cũng chứa chữ "Đăng nhập" → chọn đúng nút submit của form mật khẩu.
  await page.click('button[type="submit"]');
  await page.waitForURL('**/todo', { timeout: 10000 });
};

const clickPasskeyLogin = async () => {
  await page.goto(`${BASE}/login`);
  await page.click('button:has-text("Đăng nhập bằng Passkey")');
};

// ── 0. Máy CHƯA có passkey → đăng nhập passkey phải thất bại ─────
const { authenticatorId: emptyAuth } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: opts });
await clickPasskeyLogin();
await page.waitForTimeout(2500);
if (page.url().includes('/todo')) fail('Đăng nhập passkey phải thất bại khi máy chưa đăng ký passkey');
const leaked = await page.evaluate(() => localStorage.getItem('pulse_auth_user'));
if (leaked) fail('Máy chưa đăng ký passkey nhưng vẫn có phiên đăng nhập: ' + leaked.slice(0, 120));
pass('Máy chưa có passkey: đăng nhập bị chặn, không tạo phiên');
await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: emptyAuth });

// ── 1. Đăng ký passkey (đăng nhập mật khẩu trước) ───────────────
const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: opts });
await loginWithPassword();
pass('Đăng nhập mật khẩu ' + EMPLOYEE);
await page.goto(`${BASE}/attendance/devices`);
await page.waitForSelector('text=Khóa thiết bị bằng Passkey', { timeout: 10000 });
await page.click('button:has-text("Đăng ký passkey")');
// Máy còn hạn mức → duyệt ngay; vượt hạn mức (max_devices) → chờ HR duyệt.
// Đăng nhập passkey không đòi duyệt, nên cả hai trạng thái đều hợp lệ cho test này.
await page.waitForSelector('text=/Đã đăng ký passkey cho thiết bị này|Đã ghi nhận passkey/', { timeout: 15000 });
pass('Đăng ký passkey qua UI');

// ── 2. Đăng xuất rồi đăng nhập chỉ bằng passkey ─────────────────
await page.evaluate(() => localStorage.clear());
await clickPasskeyLogin();
await page.waitForURL('**/todo', { timeout: 15000 });
pass('Đăng nhập bằng passkey thành công (không nhập mật khẩu)');

const session = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'));
if (session.employeeCode !== EMPLOYEE) fail('Phiên passkey sai nhân viên: ' + JSON.stringify(session.employeeCode));
if (!session.accessToken) fail('Phiên passkey thiếu accessToken');
pass('Phiên passkey đúng nhân viên và có accessToken');

const me = await page.evaluate(async () => {
  const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
  const res = await fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${u.accessToken}` } });
  return { code: res.status, body: await res.json().catch(() => ({})) };
});
if (me.code !== 200) fail('accessToken passkey không dùng được cho API, me=' + JSON.stringify(me));
pass('accessToken passkey gọi API hợp lệ');

// ── Dọn dẹp ─────────────────────────────────────────────────────
await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
await browser.close();
cleanup();
console.log('\nALL WEBAUTHN LOGIN CHECKS PASSED');
