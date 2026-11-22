/**
 * WebAuthn/Passkey end-to-end (Chromium Virtual Authenticator).
 *
 * Kiểm tra: đăng ký passkey qua UI → status hasPasskey → ký assertion thật →
 * server verify → chấm công không kèm passkey bị chặn ở lớp THIẾT BỊ.
 *
 * Chạy (frontend :3000 + backend :8080):
 *   node tests/ui/test_webauthn.mjs
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8080/api/v1';
const EMPLOYEE = '136ACT';

const fail = (msg) => {
  console.error('FAIL ' + msg);
  process.exit(1);
};
const pass = (msg) => console.log('PASS ' + msg);

const psql = (sql) => execFileSync('psql', ['-h', '127.0.0.1', '-d', 'pulse_db', '-tAc', sql], { encoding: 'utf8' }).trim();
const cleanup = () => psql(
  "delete from devices where device_fingerprint like 'passkey-%' and user_id=(select id from users where employee_code='136ACT')");
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

// ── Đăng nhập ───────────────────────────────────────────────────
await page.goto(`${BASE}/login`);
// Dấu "thiết bị này đã đăng ký passkey" nằm ở localStorage — xóa để chạy lại test sạch.
await page.evaluate(() => Object.keys(localStorage)
  .filter((k) => k.startsWith('pulse_passkey_device_'))
  .forEach((k) => localStorage.removeItem(k)));
await page.fill('input[type="text"], input[name="employeeCodeOrEmail"], input[placeholder*="Mã"], input[placeholder*="Email"]', EMPLOYEE);
await page.fill('input[type="password"]', '123456');
await page.click('button:has-text("Đăng nhập"), button:has-text("ĐĂNG NHẬP")');
await page.waitForURL('**/todo', { timeout: 10000 });
pass('Đăng nhập ' + EMPLOYEE);

// ── Đăng ký passkey qua UI ──────────────────────────────────────
await page.goto(`${BASE}/attendance/devices`);
await page.waitForSelector('text=Khóa thiết bị bằng Passkey', { timeout: 10000 });
await page.click('button:has-text("Đăng ký passkey")');
await page.getByText(/Đã (đăng ký passkey cho thiết bị này|ghi nhận passkey)/)
  .waitFor({ timeout: 15000 });
pass('UI đăng ký passkey thành công');

// ── Thiết bị đã đăng ký → nút khóa, danh sách gắn nhãn "Thiết bị hiện tại" ──
await page.reload();
await page.waitForSelector('text=Khóa thiết bị bằng Passkey', { timeout: 10000 });
const registeredBtn = page.locator('button', { hasText: 'Đã đăng ký thiết bị này' });
await registeredBtn.waitFor({ timeout: 10000 });
if (!(await registeredBtn.isDisabled())) fail('Nút đăng ký passkey phải bị khóa khi thiết bị này đã đăng ký');
await page.waitForSelector('text=Thiết bị hiện tại', { timeout: 10000 });
pass('Thiết bị đã đăng ký: nút khóa + nhãn "Thiết bị hiện tại"');

// Vượt hạn mức thiết bị → passkey mới chờ HR duyệt; duyệt để có thể test assertion.
const pendingPasskey = psql(
  `select id from devices where device_fingerprint like 'passkey-%' ` +
  `and user_id=(select id from users where employee_code='${EMPLOYEE}') and is_approved=false limit 1`);
if (pendingPasskey) {
  const hrLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeCodeOrEmail: '01HR', password: '123456' }),
  }).then((r) => r.json());
  const approve = await fetch(`${API}/admin/devices/${pendingPasskey}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hrLogin.data.accessToken}` },
    body: '{}',
  });
  if (!approve.ok) fail('HR duyệt passkey thất bại — ' + (await approve.text()));
  pass('HR đã duyệt passkey (tài khoản đã đủ hạn mức thiết bị)');
}

const token = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse_auth_user') || '{}').accessToken);
if (!token) fail('Không lấy được token từ phiên đăng nhập');

const status = await page.evaluate(async () => (await (await fetch('/api/v1/webauthn/status', {
  headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('pulse_auth_user') || '{}').accessToken}` },
})).json()).data);
if (!status.hasPasskey) fail('status.hasPasskey phải = true sau đăng ký — ' + JSON.stringify(status));
pass('status.hasPasskey = true');

// ── Ký assertion thật + server verify ──────────────────────────
const verifyResult = await page.evaluate(async (tok) => {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` };
  const optRes = await fetch('/api/v1/webauthn/assert/options', { method: 'POST', headers });
  const opt = (await optRes.json()).data;
  if (!opt?.options?.publicKey) throw new Error('Thiếu assert options: ' + JSON.stringify(opt));
  const cred = await navigator.credentials.get({ publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(opt.options.publicKey) });
  const json = cred.toJSON();
  const res = await fetch('/api/v1/webauthn/assert/verify', {
    method: 'POST', headers, body: JSON.stringify({ challengeId: opt.challengeId, credential: json }),
  });
  return { code: res.status, body: await res.json() };
}, token);
if (verifyResult.code !== 200 || !verifyResult.body?.data?.verified) {
  fail('assert/verify phải 200 verified=true — ' + JSON.stringify(verifyResult));
}
pass('Server verify chữ ký passkey thành công');

// ── Chấm công thiếu passkey → chặn ở lớp THIẾT BỊ ──────────────
const punch = await page.evaluate(async (tok) => {
  const res = await fetch('/api/v1/attendance/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ type: 'CHECK_IN', deviceFingerprint: 'web-passkey-test' }),
  });
  return (await res.json()).data;
}, token);
const deviceLayer = (punch?.layers || []).find((l) => l.layer === 'DEVICE');
if (punch?.rejectReason !== 'DEVICE_NOT_APPROVED' || deviceLayer?.passed !== false) {
  fail('Chấm công không passkey phải bị chặn DEVICE_NOT_APPROVED — ' + JSON.stringify(punch));
}
if (!/passkey/i.test(deviceLayer.detail || '')) fail('Thông báo lớp THIẾT BỊ phải nhắc passkey — ' + deviceLayer.detail);
pass('Chấm công thiếu passkey bị chặn: ' + deviceLayer.detail);

// ── Đăng nhập bằng passkey (usernameless) ─────────────────────
await page.evaluate(() => localStorage.removeItem('pulse_auth_user'));
await page.goto(`${BASE}/login`);
await page.waitForSelector('button:has-text("Đăng nhập bằng Passkey")', { timeout: 10000 });
await page.click('button:has-text("Đăng nhập bằng Passkey")');
await page.waitForURL('**/todo', { timeout: 15000 });
const session = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse_auth_user') || '{}'));
if (session.employeeCode !== EMPLOYEE || !session.accessToken) {
  fail('Đăng nhập bằng passkey phải trả phiên của ' + EMPLOYEE + ' — ' + JSON.stringify(session));
}
pass('Đăng nhập bằng passkey thành công (' + session.employeeCode + ')');

// ── Dọn dẹp ────────────────────────────────────────────────────
await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
await browser.close();
cleanup();
console.log('\nALL WEBAUTHN CHECKS PASSED');
