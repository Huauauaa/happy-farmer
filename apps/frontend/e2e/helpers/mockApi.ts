import type { Page, Route } from '@playwright/test';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
};

type MockUserProfile = {
  id: string;
  username: string;
  nickname: string | null;
  phone: string | null;
  balance: number;
  isAdmin: boolean;
  createdAt: string;
};

const products: Product[] = [
  {
    id: 'p-1004',
    name: '精品红富士苹果',
    category: '水果',
    price: 12.8,
    stock: 65,
    description: '脆甜多汁，适合鲜食。',
  },
  {
    id: 'p-2001',
    name: '有机生菜',
    category: '蔬菜',
    price: 6.5,
    stock: 24,
    description: '新鲜采摘，适合凉拌与沙拉。',
  },
];

const categories = [...new Set(products.map((product) => product.category))];

const fulfillJson = async (route: Route, payload: unknown) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  });
};

export const registerStoreApiMocks = async (page: Page) => {
  await page.route('**/api/product-categories', async (route) => {
    await fulfillJson(route, { items: categories });
  });

  await page.route(/.*\/api\/products(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const keyword = (url.searchParams.get('keyword') ?? '').trim();
    const category = (url.searchParams.get('category') ?? '').trim();
    const filtered = products.filter((product) => {
      const matchesKeyword = keyword === '' || product.name.includes(keyword);
      const matchesCategory = category === '' || product.category === category;
      return matchesKeyword && matchesCategory;
    });

    await fulfillJson(route, {
      keyword,
      category,
      total: filtered.length,
      items: filtered.map(({ description: _description, ...summary }) => summary),
    });
  });

  await page.route(/.*\/api\/products\/[^/?#]+$/, async (route) => {
    const requestUrl = new URL(route.request().url());
    const productId = requestUrl.pathname.split('/').pop();
    const product = products.find((item) => item.id === productId);

    if (!product) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ message: '商品不存在' }),
      });
      return;
    }

    await fulfillJson(route, product);
  });
};

export const registerAccountApiMocks = async (page: Page) => {
  const createdAt = '2026-03-15T09:00:00.000Z';
  const userState: {
    credentials: { username: string; password: string } | null;
    profile: MockUserProfile | null;
  } = {
    credentials: null,
    profile: null,
  };

  await page.route('**/api/auth/register', async (route) => {
    const payload = route.request().postDataJSON() as {
      username: string;
      password: string;
      nickname?: string;
      phone?: string;
    };

    userState.credentials = {
      username: payload.username,
      password: payload.password,
    };
    userState.profile = {
      id: '1001',
      username: payload.username,
      nickname: payload.nickname?.trim() || null,
      phone: payload.phone?.trim() || null,
      balance: 88,
      isAdmin: false,
      createdAt,
    };

    await fulfillJson(route, { message: '注册成功，请登录' });
  });

  await page.route('**/api/auth/login', async (route) => {
    const payload = route.request().postDataJSON() as { username: string; password: string };
    const isValidCredentials =
      userState.credentials &&
      payload.username === userState.credentials.username &&
      payload.password === userState.credentials.password;

    if (!isValidCredentials || !userState.profile) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ message: '账号或密码错误' }),
      });
      return;
    }

    await fulfillJson(route, {
      token: 'mock-user-token',
      expiresAt: '2026-12-31T12:00:00.000Z',
      user: userState.profile,
    });
  });

  await page.route('**/api/users/me/password', async (route) => {
    await fulfillJson(route, { message: '密码已更新' });
  });

  await page.route('**/api/users/me', async (route) => {
    if (!userState.profile) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ message: '未登录' }),
      });
      return;
    }

    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON() as { nickname?: string; phone?: string };
      userState.profile = {
        ...userState.profile,
        nickname: payload.nickname?.trim() || null,
        phone: payload.phone?.trim() || null,
      };

      await fulfillJson(route, {
        message: '资料已更新',
        user: userState.profile,
      });
      return;
    }

    await fulfillJson(route, { user: userState.profile });
  });

  await page.route('**/api/cart', async (route) => {
    await fulfillJson(route, {
      total: 0,
      totalAmount: 0,
      items: [],
    });
  });

  await page.route('**/api/orders', async (route) => {
    await fulfillJson(route, {
      total: 0,
      items: [],
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    await fulfillJson(route, { message: '已退出登录' });
  });
};
