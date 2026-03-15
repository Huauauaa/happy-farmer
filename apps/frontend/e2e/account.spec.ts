import { expect, test } from '@playwright/test';
import { registerAccountApiMocks, registerStoreApiMocks } from './helpers/mockApi';

test.beforeEach(async ({ page }) => {
  await registerStoreApiMocks(page);
  await registerAccountApiMocks(page);
  await page.goto('/');
});

test('visitor can register, login, update profile, and logout', async ({ page }) => {
  await page.getByRole('tab', { name: '用户中心' }).click();

  await page.getByPlaceholder('账号（3-32位字母/数字/下划线）').fill('playwright_user');
  await page.getByPlaceholder('密码（6-64位）').fill('playwright-pass');
  await page.getByPlaceholder('昵称（可选）').fill('测试用户');
  await page.getByPlaceholder('手机号（可选）').fill('13800001111');
  await page.getByRole('button', { name: /注\s*册/ }).click();

  await expect(page.getByText('注册成功，请登录')).toBeVisible();
  await expect(page.getByPlaceholder('账号')).toHaveValue('playwright_user');

  await page.getByPlaceholder('密码').fill('playwright-pass');
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await expect(page.getByText('账号：playwright_user')).toBeVisible();
  await expect(page.getByText('昵称：测试用户')).toBeVisible();
  await expect(page.getByText('手机号：13800001111')).toBeVisible();

  await page.getByPlaceholder('昵称').fill('已更新昵称');
  await page.getByPlaceholder('手机号').fill('13900002222');
  await page.getByRole('button', { name: /保\s*存\s*资\s*料/ }).click();

  await expect(page.getByText('资料已更新')).toBeVisible();
  await expect(page.getByText('昵称：已更新昵称')).toBeVisible();
  await expect(page.getByText('手机号：13900002222')).toBeVisible();

  await page.getByRole('button', { name: /退\s*出\s*登\s*录/ }).click();

  await expect(page.getByText('已退出登录')).toBeVisible();
  await expect(page.getByRole('button', { name: /登\s*录/ })).toBeVisible();
});
