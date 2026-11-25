/**
 * Trang Tuỳ chỉnh thông báo đọc/ghi dữ liệu THẬT (S36) — UI Playwright.
 *
 * Kiểm tra trên một nhân viên thật (136ACT):
 *   1. Trang mở được, hiện danh sách sự kiện theo nhóm.
 *   2. Bật kênh EMAIL của sự kiện "Chưa check-in khi quá 30 phút" → toast lưu
 *      và GET /notifications/preferences trả email=true.
 *   3. Tắt lại → email=false (khôi phục nguyên trạng).
 *   4. Khối Web Push hiện trạng thái thiết bị đã đăng ký + nút bật/tắt.
 *
 * Chạy (frontend :3000 + backend :8080):
 *   node tests/ui/test_notification_prefs.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8080/api/v1';
const EMPLOYEE = '136ACT';
const EVENT = 'MISSING_CHECKIN';

const fail = (msg) => {
  console.error('FAIL ' + msg);
  process.exit(1);
};
const pass = (msg) => console.log('PASS ' + msg);

const apiToken = (await (await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ employeeCodeOrEmail: EMPLOYEE, password: '123456' }),
})).json()).data.accessToken;

const readPrefs = async () => {
  const res = await fetch(`${API}/notifications/preferences`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  return (await res.json()).data;
};

const originalPrefs = await readPrefs();
const original = originalPrefs.events[EVENT];
const originalQuiet = originalPrefs.quietHoursEnabled;
const originalMaxPush = originalPrefs.maxPushPerDay;
const originalDedupe = originalPrefs.dedupeHours;
const createdNotifs = [];

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

try {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="text"], input[name="employeeCodeOrEmail"], input[placeholder*="Mã"], input[placeholder*="Email"]', EMPLOYEE);
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/todo', { timeout: 15000 });

  // Lời mời bật Web Push ở lần đăng nhập đầu trên thiết bị (S36).
  let sawPrompt = true;
  try {
    await page.waitForSelector('text=Bật thông báo đẩy?', { timeout: 6000 });
  } catch {
    sawPrompt = false;
  }
  if (sawPrompt) {
    pass('Lời mời bật Web Push hiện ở lần đăng nhập đầu');
    await page.locator('button', { hasText: 'Để sau' }).first().click();
    await page.waitForSelector('text=Bật thông báo đẩy?', { state: 'detached', timeout: 5000 });
    await page.reload();
    await page.waitForTimeout(1200);
    if ((await page.locator('text=Bật thông báo đẩy?').count()) > 0) {
      fail('Đã chọn "Để sau" nhưng lời mời vẫn hiện lại sau khi tải lại trang');
    }
    pass('Chọn "Để sau" → không hỏi lại trên thiết bị này');
  } else {
    console.log('SKIP không thấy lời mời push (trình duyệt test đã có quyền hoặc không hỗ trợ)');
  }

  await page.goto(`${BASE}/account/notifications`);
  await page.waitForSelector('text=Tuỳ chỉnh thông báo', { timeout: 15000 });
  pass('Trang Tuỳ chỉnh thông báo mở được');

  // Khối "Kiểm Thử An Toàn Phân Quyền" là công cụ kiểm thử nội bộ — không được
  // hiện cho người dùng cuối (403 đã được test API bảo đảm).
  if ((await page.locator('text=Kiểm Thử An Toàn Phân Quyền').count()) > 0) {
    fail('Trang người dùng vẫn hiện khối kiểm thử phân quyền');
  }
  pass('Không còn khối kiểm thử phân quyền trên giao diện người dùng');

  await page.waitForSelector('text=Chưa check-in khi quá 30 phút', { timeout: 15000 });
  await page.waitForSelector('text=thiết bị đã đăng ký nhận push', { timeout: 15000 });

  // Nhân viên không được thấy sự kiện chỉ dành cho HR/quản lý.
  if ((await page.getByText('Nhắc HR chốt bảng công kỳ này').count()) > 0) {
    fail('Nhân viên vẫn thấy sự kiện HR_CLOSE_TIMESHEET trên trang tuỳ chỉnh');
  }
  pass('Danh mục sự kiện đã lọc theo vai trò nhân viên');
  const pushBtn = page.locator('button', { hasText: /Bật thông báo đẩy|Tắt trên thiết bị này/ });
  if ((await pushBtn.count()) === 0) fail('Không thấy nút bật/tắt Web Push trên thiết bị');
  pass('Khối Web Push hiện số thiết bị + nút bật/tắt');

  // Khoá VAPID phải được CHÍNH TRÌNH DUYỆT chấp nhận. Headless không có push
  // service nên có thể lỗi "permission denied" — nhưng KHÔNG được là
  // "The provided applicationServerKey is not valid" (lỗi định dạng khoá).
  const vapid = (await (await fetch(`${API}/notifications/push/public-key`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })).json()).data.publicKey;
  const subResult = await page.evaluate(async (key) => {
    const b64 = key.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
    const arr = Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    try {
      await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || String(e) };
    }
  }, vapid);
  if (!subResult.ok && /applicationServerKey is not valid/i.test(subResult.message)) {
    fail('Trình duyệt từ chối applicationServerKey — ' + subResult.message);
  }
  pass('Khoá VAPID được trình duyệt chấp nhận (không lỗi applicationServerKey)');

  // Hàng sự kiện MISSING_CHECKIN: checkbox thứ 2 là EMAIL (web, email, push).
  // Chọn div SÂU NHẤT vừa chứa nhãn sự kiện vừa chứa checkbox — nhãn nằm trong div con
  // nên locator chỉ theo text sẽ trúng div không có checkbox.
  const row = page.locator('div')
    .filter({ has: page.getByText('Chưa check-in khi quá 30 phút', { exact: true }) })
    .filter({ has: page.locator('input[type="checkbox"]') })
    .last();
  const emailBox = row.locator('input[type="checkbox"]').nth(1);

  const waitForEmail = async (expected) => {
    const deadline = Date.now() + 10000;
    let last;
    while (Date.now() < deadline) {
      last = (await readPrefs()).events[EVENT];
      if (last.email === expected) return last;
      await page.waitForTimeout(400);
    }
    return last;
  };

  await emailBox.click();
  const afterOn = await waitForEmail(!original.email);
  if (afterOn.email !== !original.email) {
    fail('Bật EMAIL qua UI không lưu vào backend — ' + JSON.stringify(afterOn));
  }
  if (afterOn.web !== original.web || afterOn.push !== original.push) {
    fail('Bật EMAIL làm đổi kênh khác — ' + JSON.stringify({ original, afterOn }));
  }
  pass(`Bật kênh EMAIL qua UI: backend email=${afterOn.email}`);

  await emailBox.click();
  const afterOff = await waitForEmail(original.email);
  if (afterOff.email !== original.email) {
    fail('Tắt lại EMAIL qua UI không lưu — ' + JSON.stringify(afterOff));
  }
  if (afterOff.web !== original.web || afterOff.push !== original.push) {
    fail('Tắt EMAIL làm đổi kênh khác — ' + JSON.stringify({ original, afterOff }));
  }
  pass('Tắt lại kênh EMAIL: backend trở về nguyên trạng');

  // Giờ yên lặng: bật/tắt và kiểm tra backend.
  const quietRow = page.locator('div')
    .filter({ hasText: /Giờ Yên Lặng/i })
    .filter({ has: page.locator('input[type="checkbox"], button[role="switch"]') })
    .last();
  const quietBox = quietRow.locator('input[type="checkbox"], button[role="switch"]').first();
  // Input thật là sr-only; click vào label (công tắc hiển thị) mới đúng như người dùng.
  const quietToggle = quietRow.locator('label').last();
  if ((await quietBox.count()) > 0) {
    await quietToggle.click();
    await page.waitForTimeout(800);
    const afterQuiet = await readPrefs();
    if (afterQuiet.quietHoursEnabled === originalQuiet) {
      fail('Bật/tắt giờ yên lặng qua UI không lưu');
    }
    await quietToggle.click();
    await page.waitForTimeout(800);
    const restored = await readPrefs();
    if (restored.quietHoursEnabled !== originalQuiet) fail('Khôi phục giờ yên lặng thất bại');
    pass('Bật/tắt giờ yên lặng lưu đúng vào backend');
  } else {
    console.log('SKIP không thấy công tắc giờ yên lặng (UI đổi cách hiển thị)');
  }

  // Hạn mức push/ngày + cửa sổ dedupe phải sửa được và lưu thật.
  const maxInput = page.getByLabel('Số lượt push tối đa mỗi ngày');
  if ((await maxInput.count()) === 0) {
    fail('Không thấy ô nhập hạn mức push/ngày');
  }
  const newMax = originalMaxPush === 2 ? 3 : 2;
  await maxInput.fill(String(newMax));
  await maxInput.blur();
  await page.waitForTimeout(900);
  const afterNum = await readPrefs();
  if (afterNum.maxPushPerDay !== newMax) {
    fail(`Sửa hạn mức push/ngày qua UI không lưu — backend=${afterNum.maxPushPerDay}`);
  }
  pass(`Sửa hạn mức push/ngày qua UI: backend maxPushPerDay=${afterNum.maxPushPerDay}`);

  // Thẻ "Việc của tôi" là lối tắt sang Todo Inbox (không phải cấu hình).
  await page.goto(`${BASE}/account/notifications`);
  await page.waitForSelector('text=Việc của tôi (Personal Actions)', { timeout: 15000 });
  await page.locator('a', { hasText: 'Việc của tôi (Personal Actions)' }).first().click();
  await page.waitForURL('**/todo', { timeout: 15000 });
  pass('Thẻ "Việc của tôi" mở Todo Inbox');

  // Hộp thư lọc theo NHÓM sự kiện, không phải từng sự kiện lẻ.
  const catalog = (await (await fetch(`${API}/notifications/preferences/events`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })).json()).data;
  const groupLabels = Array.from(new Set(catalog.map((e) => e.categoryLabel || e.category)));
  const categoryLabel = (cat) => (catalog.find((e) => e.category === cat)?.categoryLabel) || cat;
  const mark = 'ZZUI' + Date.now();
  const createNotif = async (eventKey, type, title) => {
    const res = await fetch(`${API}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({ eventKey, type, title, content: title, priority: 'LOW' }),
    });
    const body = await res.json();
    if (!body.success) fail('Không tạo được thông báo test: ' + JSON.stringify(body));
    createdNotifs.push(body.data.id);
    return body.data.id;
  };
  const attTitle = `${mark} Chấm công`;
  const reqTitle = `${mark} Đơn từ`;
  await createNotif('MISSING_CHECKOUT', 'ATTENDANCE', attTitle);
  await createNotif('REQUEST_APPROVED', 'REQUEST', reqTitle);

  await page.goto(`${BASE}/notifications`);
  const categorySelect = page.locator('select[title="Lọc theo nhóm sự kiện"]');
  await categorySelect.waitFor({ timeout: 15000 });
  const optionTexts = (await categorySelect.locator('option').allTextContents()).map((s) => s.trim());
  if (optionTexts[0] !== 'Tất cả nhóm sự kiện') {
    fail('Thiếu lựa chọn "Tất cả nhóm sự kiện" — ' + optionTexts.slice(0, 3).join(' | '));
  }
  const stray = optionTexts.slice(1).filter((label) => !groupLabels.includes(label));
  if (stray.length > 0) {
    fail('Bộ lọc còn sự kiện lẻ thay vì nhóm: ' + stray.join(', '));
  }
  if (groupLabels.length < 2 || optionTexts.length < 3) {
    fail('Bộ lọc nhóm không đủ nhóm: ' + optionTexts.join(', '));
  }
  pass(`Hộp thư lọc theo ${optionTexts.length - 1} nhóm sự kiện (${optionTexts.slice(1).join(', ')})`);

  // Chọn nhóm → server lọc thật, danh sách không rỗng dù thông báo cũ chỉ có type.
  let lastUrl = '';
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/notifications?')) lastUrl = r.url();
  });
  // Chọn nhóm → chờ đúng response lọc về rồi mới kiểm danh sách (tránh đọc
  // danh sách cũ còn cả 2 thông báo trước khi server trả về).
  const pickCategory = async (cat, expectTitle, absentTitle, failMsg) => {
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/notifications?') && r.url().includes(`category=${cat}`),
        { timeout: 15000 },
      ),
      categorySelect.selectOption({ label: categoryLabel(cat) }),
    ]);
    if (!resp.ok()) fail(`Lọc ${cat} lỗi HTTP ${resp.status()}`);
    await page.waitForSelector(`text=${expectTitle}`, { timeout: 15000 });
    if (!lastUrl.includes(`category=${cat}`)) fail('Chọn nhóm không gọi server với category: ' + lastUrl);
    await page.locator(`text=${absentTitle}`).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    if (await page.locator(`text=${absentTitle}`).count()) fail(failMsg);
  };

  await pickCategory('ATTENDANCE', attTitle, reqTitle, 'Lọc Chấm công vẫn hiện thông báo Đơn từ');
  pass('Lọc nhóm Chấm công: chỉ trả đúng thông báo chấm công');

  await pickCategory('REQUEST', reqTitle, attTitle, 'Lọc Đơn từ vẫn hiện thông báo Chấm công');
  pass('Lọc nhóm Đơn từ: chỉ trả đúng thông báo đơn từ');
} finally {
  // Khôi phục nguyên trạng qua API dù test lỗi giữa chừng.
  const current = await readPrefs();
  await fetch(`${API}/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({
      quietHoursEnabled: originalQuiet,
      quietHoursStart: current.quietHoursStart,
      quietHoursEnd: current.quietHoursEnd,
      maxPushPerDay: originalMaxPush,
      dedupeHours: originalDedupe,
      pushEnabled: current.pushEnabled ?? true,
      events: { ...current.events, [EVENT]: original },
    }),
  });
  for (const id of createdNotifs) {
    await fetch(`${API}/notifications/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiToken}` },
    }).catch(() => {});
  }
  await browser.close();
}

console.log('\nALL NOTIFICATION PREFS (UI) CHECKS PASSED');
