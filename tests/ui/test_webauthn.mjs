/**
 * Passkey e2e (Chromium Virtual Authenticator) — quản lý passkey & đăng nhập.
 *
 * Kiểm tra: đăng ký passkey ở trang Cài đặt → status liệt kê passkey → đăng xuất →
 * đăng nhập CHỈ bằng passkey → gỡ passkey qua API → đăng nhập lại phải thất bại.
 *
 * Passkey KHÔNG dùng cho chấm công: chấm công dùng thiết bị đã đăng ký + khuôn mặt.
 *
 * Chạy (frontend :3000 + backend :8080):
 *   node tests/ui/test_webauthn.mjs
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
  "delete from passkey_credentials where user_id=(select id from users where employee_code='" + EMPLOYEE + "')");
cleanup();

const browser = await chromium.launch({ headless: true, channel: 'chromium', ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}) });
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

// ── Đăng nhập mật khẩu → đăng ký passkey ở trang Passkey & bảo mật ──
await page.goto(`${BASE}/login`);
await page.fill('input[type="text"], input[name="employeeCodeOrEmail"], input[placeholder*="Mã"], input[placeholder*="Email"]', EMPLOYEE);
await page.fill('input[type="password"]', '123456');
await page.click('button[type="submit"]');
await page.waitForURL('**/todo', { timeout: 10000 });
pass('Đăng nhập ' + EMPLOYEE);

await page.goto(`${BASE}/account/passkey`);
await page.waitForSelector('text=Đăng nhập nhanh bằng Passkey', { timeout: 10000 });
await page.click('button:has-text("Đăng ký passkey")');
await page.getByText(/Đã đăng ký passkey/).waitFor({ timeout: 15000 });
pass('UI đăng ký passkey thành công');

const status = await page.evaluate(async () => {
  const token = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}').accessToken;
  const res = await fetch('/api/v1/webauthn/status', { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()).data;
});
if (!status?.hasPasskey) fail('status.hasPasskey phải = true sau đăng ký — ' + JSON.stringify(status));
if (!Array.isArray(status.credentials) || status.credentials.length !== 1) {
  fail('status.credentials phải có đúng 1 passkey — ' + JSON.stringify(status));
}
pass('status.hasPasskey = true, liệt kê 1 passkey');

// ── Đăng xuất → đăng nhập chỉ bằng passkey ─────────────────────
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/login`);
await page.waitForSelector('button:has-text("Đăng nhập bằng Passkey")', { timeout: 10000 });
await page.click('button:has-text("Đăng nhập bằng Passkey")');
await page.waitForURL('**/todo', { timeout: 15000 });
const session = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'));
if (session.employeeCode !== EMPLOYEE || !session.accessToken) {
  fail('Đăng nhập bằng passkey phải trả phiên của ' + EMPLOYEE + ' — ' + JSON.stringify(session));
}
pass('Đăng nhập bằng passkey thành công (' + session.employeeCode + ')');

// ── Gỡ passkey → đăng nhập lại phải thất bại ───────────────────
const removed = await page.evaluate(async (id) => {
  const token = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}').accessToken;
  const res = await fetch(`/api/v1/webauthn/credentials/${id}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}, status.credentials[0].id);
if (removed !== 200) fail('Gỡ passkey phải trả 200 — ' + removed);
pass('Gỡ passkey qua API');

await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/login`);
await page.click('button:has-text("Đăng nhập bằng Passkey")');
await page.waitForTimeout(2500);
if (page.url().includes('/todo')) fail('Passkey đã gỡ vẫn đăng nhập được');
if (await page.evaluate(() => localStorage.getItem('pulse_auth_user'))) {
  fail('Passkey đã gỡ nhưng vẫn tạo phiên đăng nhập');
}
pass('Passkey đã gỡ: đăng nhập bị chặn, không tạo phiên');

// ── Dọn dẹp ────────────────────────────────────────────────────
await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
await browser.close();
cleanup();
console.log('\nALL WEBAUTHN CHECKS PASSED');
