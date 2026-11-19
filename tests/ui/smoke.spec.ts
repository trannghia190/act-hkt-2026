/**
 * UI smoke test (Playwright) — chạy khi đã cài @playwright/test:
 *   npx playwright test tests/ui/smoke.spec.ts
 * Yêu cầu: frontend chạy ở http://localhost:3000, backend ở :8081.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.UI_BASE || 'http://localhost:3000';

async function login(page: any) {
  await page.goto(BASE + '/login');
  await page.getByLabel(/email|mã nhân viên/i).fill('136ACT');
  await page.getByLabel(/mật khẩu/i).fill('123456');
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForURL(/todo|attendance/);
}

test('S01 không còn nút đăng nhập nhanh theo vai trò', async ({ page }) => {
  await page.goto(BASE + '/login');
  await expect(page.getByText(/đăng nhập nhanh theo vai trò/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /đăng nhập/i })).toBeVisible();
});

test('S16 hiển thị19 quy định từ API', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/attendance/rules');
  await expect(page.getByRole('heading', { name: /19 quy định/i })).toBeVisible();
  await expect(page.getByText('late_early')).toBeVisible();
});

test('S32 có nút thêm loại nghỉ', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/admin/leave-types');
  await expect(page.getByRole('button', { name: /thêm loại nghỉ/i })).toBeVisible();
});

test('S46 bảng phép có dòng tổng', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/attendance/leave-table');
  await expect(page.getByText(/Tổng \(\d+ người\)/)).toBeVisible();
});

test('WFH: tạo 2 tuần liên tiếp', async ({ page }) => {
  await login(page);
  await page.goto(BASE + '/attendance/requests');
  await page.getByRole('button', { name: /tạo đơn|đăng ký/i }).first().click();
  await page.getByLabel(/loại đơn/i).selectOption('WFH');
  await expect(page.getByText(/lặp hàng tuần/i)).toBeVisible();
});
