/**
 * Đăng nhập bằng Passkey (usernameless) end-to-end — Chromium Virtual Authenticator.
 *
 * Kiểm tra: đăng ký passkey qua UI (đang đăng nhập mật khẩu) → đăng xuất →
 * bấm "Đăng nhập bằng Passkey" ở trang login → nhận phiên JWT đúng nhân viên,
 * không cần gõ mã nhân viên/mật khẩu.
 *
 * Chạy (frontend :3000 + backend :8080):
 *   node tests/ui/test_passkey_login.mjs
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
  "delete from devices where device_fingerprint like 'passkey-%' and user_id=(select id from users where employee_code='"
  + EMPLOYEE + "')");
cleanup();

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

// ── Virtual authenticator (Touch ID/Face ID giả lập) ─────────────
const cdp = await context.newCDPSession(page);
await cdp.send('WebAuthn.enable');
const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
  options: {
    protocol: 'ctap2',
    transport: 'internal',
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  },
});
pass('Virtual authenticator đã bật');

// ── Đăng ký passkey bằng mật khẩu + UI thiết bị ─────────────────
await page.goto(`${BASE}/login`);
await page.fill('input[type="text"], input[name="employeeCodeOrEmail"], input[placeholder*="Mã"], input[placeholder*="Email"]', EMPLOYEE);
await page.fill('input[type="password"]', '123456');
await page.click('button:has-text("Đăng nhập"), button:has-text("ĐĂNG NHẬP")');
await page.waitForURL('**/todo', { timeout: 10000 });
const loginToken = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse_auth_user') || '{}').accessToken);
if (!loginToken) fail('Đăng nhập mật khẩu không lưu token');

await page.goto(`${BASE}/attendance/devices`);
await page.waitForSelector('text=Khóa thiết bị bằng Passkey', { timeout: 10000 });
await page.click('button:has-text("Đăng ký passkey")');
// Tự duyệt hay chờ HR duyệt phụ thuộc quota max_devices — cả hai đều là đăng ký thành công.
await page.waitForSelector('text=/Đã (đăng ký|ghi nhận) passkey|Không đăng ký/', { timeout: 15000 });
const regMessage = (await page.evaluate(() => {
  const p = [...document.querySelectorAll('p.text-xs')].find((el) => /passkey/i.test(el.textContent || ''));
  return p ? p.textContent.trim() : '';
})) || '(không đọc được thông báo)';
if (/^Không đăng ký/.test(regMessage)) fail('Đăng ký passkey lỗi: ' + regMessage);
pass('Đăng ký passkey qua UI: ' + regMessage);

const registered = await page.evaluate(async () => {
  const token = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}').accessToken;
  const res = await fetch('/api/v1/webauthn/status', { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()).data;
});
if (!registered?.hasPasskey) fail('status.hasPasskey phải = true trước khi đăng nhập — ' + JSON.stringify(registered));

// ── Đăng xuất → đăng nhập bằng passkey, không nhập gì ──────────
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/login`);
await page.waitForSelector('button:has-text("Đăng nhập bằng Passkey")', { timeout: 10000 });

await page.fill('input[type="text"], input[name="employeeCodeOrEmail"], input[placeholder*="Mã"], input[placeholder*="Email"]', '');
await page.fill('input[type="password"]', '');
await page.click('button:has-text("Đăng nhập bằng Passkey")');
await page.waitForURL('**/todo', { timeout: 15000 });
pass('Đăng nhập bằng passkey chuyển vào /todo');

const session = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'));
if (session.employeeCode !== EMPLOYEE) fail('Phiên passkey sai nhân viên — ' + JSON.stringify(session));
if (!session.accessToken) fail('Phiên passkey không có accessToken');
pass('Phiên passkey đúng nhân viên ' + EMPLOYEE);

const usable = await page.evaluate(async () => {
  const token = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}').accessToken;
  const res = await fetch('/api/v1/webauthn/status', { headers: { Authorization: `Bearer ${token}` } });
  return { code: res.status, body: (await res.json()).data };
});
if (usable.code !== 200 || !usable.body?.hasPasskey) {
  fail('Token từ passkey không gọi được API — ' + JSON.stringify(usable));
}
pass('Token từ passkey gọi được API');

const signatureCount = psql(
  "select coalesce(max(signature_count),0) from devices where device_fingerprint like 'passkey-%' and user_id="
  + "(select id from users where employee_code='" + EMPLOYEE + "')");
if (!(Number(signatureCount) > 0)) fail('signature_count phải tăng sau đăng nhập — ' + signatureCount);
pass('signature_count tăng sau đăng nhập passkey (' + signatureCount + ')');

// ── Dọn dẹp ────────────────────────────────────────────────────
await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
await browser.close();
cleanup();
console.log('\nALL PASSKEY LOGIN (UI) CHECKS PASSED');
