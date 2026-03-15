import { expect, test } from '@playwright/test';
import { registerStoreApiMocks } from './helpers/mockApi';

test.beforeEach(async ({ page }) => {
  await registerStoreApiMocks(page);
  await page.goto('/');
});

test('guest can search products and open the detail modal', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Happy Farmer' })).toBeVisible();
  await expect(page.getByText('登录后可将商品加入购物车')).toBeVisible();
  await expect(page.getByText('精品红富士苹果')).toBeVisible();
  await expect(page.getByText('有机生菜')).toBeVisible();

  await page.getByPlaceholder('请输入商品名称，例如：苹果').fill('苹果');
  await page.getByRole('button', { name: '搜索' }).click();

  await expect(page.getByText('精品红富士苹果')).toBeVisible();
  await expect(page.getByText('有机生菜')).toHaveCount(0);

  const appleItem = page.locator('.ant-list-item').filter({ hasText: '精品红富士苹果' });
  await appleItem.getByRole('button', { name: '查看详情' }).click();

  await expect(page.getByRole('dialog', { name: '精品红富士苹果' })).toBeVisible();
  await expect(page.getByText('商品编号：p-1004')).toBeVisible();
  await expect(page.getByText('价格：¥12.80')).toBeVisible();
  await expect(page.getByText('商品介绍：脆甜多汁，适合鲜食。')).toBeVisible();
});
