import { Button, Card, Menu, Space, Tabs, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import AccountTab from './modules/account/AccountTab';
import AdminTab from './modules/admin/AdminTab';
import CartTab from './modules/cart/CartTab';
import OrdersTab from './modules/orders/OrdersTab';
import ProductDetailModal from './modules/products/ProductDetailModal';
import ProductsTab from './modules/products/ProductsTab';

type ProductSummary = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
};

type ProductDetail = ProductSummary & {
  description: string;
};

type ProductSearchResponse = {
  keyword: string;
  category: string;
  total: number;
  items: ProductSummary[];
};

type CategoryListResponse = {
  items: string[];
};

type UserProfile = {
  id: string;
  username: string;
  nickname: string | null;
  phone: string | null;
  balance: number;
  isAdmin: boolean;
  createdAt: string;
};

type LoginResponse = {
  token: string;
  expiresAt: string;
  user: UserProfile;
};

type UserResponse = {
  user: UserProfile;
};

type UpdateUserResponse = {
  message: string;
  user: UserProfile;
};

type MessageResponse = {
  message: string;
};

type CartItem = {
  productId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  quantity: number;
  subtotal: number;
};

type CartResponse = {
  total: number;
  totalAmount: number;
  items: CartItem[];
};

type OrderItem = {
  productId: string;
  productName: string;
  category: string;
  price: number;
  quantity: number;
  subtotal: number;
};

type UserOrder = {
  orderNo: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
};

type OrderListResponse = {
  total: number;
  items: UserOrder[];
};

type SubmitOrderResponse = {
  message: string;
  orderNo: string;
  totalAmount: number;
  status: string;
};

type AdminCategory = {
  id: string;
  name: string;
};

type AdminCategoryResponse = {
  total: number;
  items: AdminCategory[];
};

type AdminProductResponse = {
  total: number;
  items: ProductDetail[];
};

type AdminOrderSummary = {
  orderNo: string;
  username: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
};

type AdminOrderResponse = {
  total: number;
  items: AdminOrderSummary[];
};

type AdminUserResponse = {
  total: number;
  items: UserProfile[];
};

type AdminUserDraft = {
  nickname: string;
  phone: string;
  balance: number;
  isAdmin: boolean;
};

type SystemLogItem = {
  id: string;
  level: string;
  module: string;
  action: string;
  message: string;
  actorUserId: string | null;
  createdAt: string;
};

type SystemLogResponse = {
  total: number;
  items: SystemLogItem[];
};

type AppPage = 'shop' | 'admin';

type AdminMenuKey = 'category' | 'order' | 'product' | 'user' | 'system';

const authTokenStorageKey = 'happy-farmer-token';

const getStoredToken = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.localStorage.getItem(authTokenStorageKey) ?? '';
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { message?: string; error?: string };
    if (data.message) {
      return data.message;
    }
    if (data.error) {
      return data.error;
    }
  } catch {
    // Ignore JSON parse failures and fallback to status text.
  }
  return `请求失败：${response.status}`;
};

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>(() => {
    if (typeof window === 'undefined') {
      return 'shop';
    }
    return window.location.hash === '#/admin' ? 'admin' : 'shop';
  });
  const [adminMenuKey, setAdminMenuKey] = useState<AdminMenuKey>('category');
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [token, setToken] = useState<string>(getStoredToken);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerNickname, setRegisterNickname] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartTotalAmount, setCartTotalAmount] = useState(0);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<UserOrder[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([]);
  const [adminProducts, setAdminProducts] = useState<ProductDetail[]>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrderSummary[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminUserDrafts, setAdminUserDrafts] = useState<Record<string, AdminUserDraft>>({});
  const [adminCategoryName, setAdminCategoryName] = useState('');
  const [adminProductKeyword, setAdminProductKeyword] = useState('');
  const [adminProductCategory, setAdminProductCategory] = useState('');
  const [adminUserKeyword, setAdminUserKeyword] = useState('');
  const [adminAddProductId, setAdminAddProductId] = useState('');
  const [adminAddProductName, setAdminAddProductName] = useState('');
  const [adminAddProductCategory, setAdminAddProductCategory] = useState('');
  const [adminAddProductPrice, setAdminAddProductPrice] = useState<number>(0);
  const [adminAddProductStock, setAdminAddProductStock] = useState<number>(0);
  const [adminAddProductDescription, setAdminAddProductDescription] = useState('');
  const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminLogs, setAdminLogs] = useState<SystemLogItem[]>([]);
  const [adminCategorySort, setAdminCategorySort] = useState<'asc' | 'desc'>('asc');
  const [adminProductSortBy, setAdminProductSortBy] = useState<'id' | 'name' | 'price' | 'stock' | 'category'>('id');
  const [adminProductSortOrder, setAdminProductSortOrder] = useState<'asc' | 'desc'>('asc');
  const [adminOrderSortBy, setAdminOrderSortBy] = useState<'createdAt' | 'totalAmount' | 'status' | 'username'>(
    'createdAt',
  );
  const [adminOrderSortOrder, setAdminOrderSortOrder] = useState<'asc' | 'desc'>('desc');
  const [adminUserSortBy, setAdminUserSortBy] = useState<'id' | 'username' | 'balance' | 'createdAt'>('id');
  const [adminUserSortOrder, setAdminUserSortOrder] = useState<'asc' | 'desc'>('asc');
  const [adminCategoryPage, setAdminCategoryPage] = useState(1);
  const [adminProductPage, setAdminProductPage] = useState(1);
  const [adminOrderPage, setAdminOrderPage] = useState(1);
  const [adminUserPage, setAdminUserPage] = useState(1);
  const [adminPageSize, setAdminPageSize] = useState(5);

  const persistToken = (nextToken: string) => {
    setToken(nextToken);
    if (typeof window === 'undefined') {
      return;
    }
    if (nextToken === '') {
      window.localStorage.removeItem(authTokenStorageKey);
    } else {
      window.localStorage.setItem(authTokenStorageKey, nextToken);
    }
  };

  const toAdminDrafts = (users: UserProfile[]): Record<string, AdminUserDraft> => {
    const drafts: Record<string, AdminUserDraft> = {};
    users.forEach((user) => {
      drafts[user.id] = {
        nickname: user.nickname ?? '',
        phone: user.phone ?? '',
        balance: user.balance,
        isAdmin: user.isAdmin,
      };
    });
    return drafts;
  };

  const requireAdminToken = (): string | null => {
    if (token === '') {
      setAdminError('请先登录管理员账号');
      return null;
    }
    if (!profile?.isAdmin) {
      setAdminError('当前账号不是管理员');
      return null;
    }
    return token;
  };

  const fetchProducts = async (keywordValue: string, categoryValue: string) => {
    setLoading(true);
    setError(null);

    try {
      const queryKeyword = keywordValue.trim();
      const queryCategory = categoryValue.trim();
      const searchParams = new URLSearchParams();
      if (queryKeyword !== '') {
        searchParams.set('keyword', queryKeyword);
      }
      if (queryCategory !== '') {
        searchParams.set('category', queryCategory);
      }
      const queryString = searchParams.toString();
      const url = queryString === '' ? '/api/products' : `/api/products?${queryString}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as ProductSearchResponse;
      setProducts(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    setCategoryLoading(true);
    try {
      const response = await fetch('/api/product-categories');
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as CategoryListResponse;
      setCategories(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCategories([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  const fetchProductDetail = async (id: string) => {
    setIsDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    try {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as ProductDetail;
      setDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchProfile = async (authToken: string) => {
    try {
      const response = await fetch('/api/users/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.status === 401) {
        persistToken('');
        setProfile(null);
        setAuthError('登录状态已失效，请重新登录');
        return;
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as UserResponse;
      setProfile(data.user);
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '未知错误');
    }
  };

  const fetchCart = async (authToken: string) => {
    setCartLoading(true);
    setCartError(null);
    try {
      const response = await fetch('/api/cart', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as CartResponse;
      setCartItems(data.items);
      setCartTotalAmount(data.totalAmount);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : '未知错误');
      setCartItems([]);
      setCartTotalAmount(0);
    } finally {
      setCartLoading(false);
    }
  };

  const fetchOrders = async (authToken: string) => {
    setOrderLoading(true);
    setOrderError(null);
    try {
      const response = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as OrderListResponse;
      setOrderItems(data.items);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : '未知错误');
      setOrderItems([]);
    } finally {
      setOrderLoading(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    if (token === '') {
      setCartError('请先登录后再加入购物车');
      return;
    }
    setCartLoading(true);
    setCartError(null);
    setCartMessage(null);
    try {
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setCartMessage(data.message);
      await fetchCart(token);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setCartLoading(false);
    }
  };

  const handleChangeCartQuantity = async (productId: string, quantity: number) => {
    if (token === '') {
      return;
    }
    setCartLoading(true);
    setCartError(null);
    setCartMessage(null);
    try {
      const response = await fetch(`/api/cart/items/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setCartMessage(data.message);
      await fetchCart(token);
      await fetchProducts(keyword, selectedCategory);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setCartLoading(false);
    }
  };

  const handleRemoveFromCart = async (productId: string) => {
    if (token === '') {
      return;
    }
    setCartLoading(true);
    setCartError(null);
    setCartMessage(null);
    try {
      const response = await fetch(`/api/cart/items/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setCartMessage(data.message);
      await fetchCart(token);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setCartLoading(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (token === '') {
      return;
    }
    setOrderLoading(true);
    setOrderError(null);
    setOrderMessage(null);
    try {
      const response = await fetch('/api/orders/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as SubmitOrderResponse;
      setOrderMessage(`${data.message}，订单号：${data.orderNo}`);
      await fetchCart(token);
      await fetchOrders(token);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setOrderLoading(false);
    }
  };

  const handlePayOrder = async (orderNo: string) => {
    if (token === '') {
      return;
    }
    setOrderLoading(true);
    setOrderError(null);
    setOrderMessage(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNo)}/pay`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setOrderMessage(`${data.message}（订单号：${orderNo}）`);
      await fetchOrders(token);
      await fetchProfile(token);
      await fetchProducts(keyword, selectedCategory);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setOrderLoading(false);
    }
  };

  const fetchAdminCategories = async (authToken: string) => {
    const response = await fetch('/api/admin/categories', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    const data = (await response.json()) as AdminCategoryResponse;
    setAdminCategories(data.items);
  };

  const fetchAdminProducts = async (
    authToken: string,
    keywordValue: string,
    categoryValue: string,
  ) => {
    const searchParams = new URLSearchParams();
    if (keywordValue.trim() !== '') {
      searchParams.set('keyword', keywordValue.trim());
    }
    if (categoryValue.trim() !== '') {
      searchParams.set('category', categoryValue.trim());
    }
    const query = searchParams.toString();
    const url = query === '' ? '/api/admin/products' : `/api/admin/products?${query}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    const data = (await response.json()) as AdminProductResponse;
    setAdminProducts(data.items);
  };

  const fetchAdminOrders = async (authToken: string) => {
    const response = await fetch('/api/admin/orders', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    const data = (await response.json()) as AdminOrderResponse;
    setAdminOrders(data.items);
  };

  const fetchAdminSystemLogs = async (authToken: string) => {
    const response = await fetch('/api/admin/system/logs?limit=100', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    const data = (await response.json()) as SystemLogResponse;
    setAdminLogs(data.items);
  };

  const fetchAdminUsers = async (authToken: string, keywordValue: string) => {
    const params = new URLSearchParams();
    if (keywordValue.trim() !== '') {
      params.set('keyword', keywordValue.trim());
    }
    const query = params.toString();
    const url = query === '' ? '/api/admin/users' : `/api/admin/users?${query}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    const data = (await response.json()) as AdminUserResponse;
    setAdminUsers(data.items);
    setAdminUserDrafts(toAdminDrafts(data.items));
  };

  const refreshAdminDashboard = async (authToken: string) => {
    await Promise.all([
      fetchAdminCategories(authToken),
      fetchAdminProducts(authToken, adminProductKeyword, adminProductCategory),
      fetchAdminOrders(authToken),
      fetchAdminUsers(authToken, adminUserKeyword),
      fetchAdminSystemLogs(authToken),
    ]);
  };

  const handleAdminRefresh = async () => {
    const authToken = requireAdminToken();
    if (!authToken) {
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminMessage(null);
    try {
      await refreshAdminDashboard(authToken);
      setAdminMessage('后台数据已刷新');
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminCreateCategory = async () => {
    const authToken = requireAdminToken();
    if (!authToken) {
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminMessage(null);
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: adminCategoryName }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setAdminCategoryName('');
      setAdminMessage(data.message);
      await fetchAdminCategories(authToken);
      await fetchCategories();
      await fetchAdminSystemLogs(authToken);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminDeleteCategory = async (id: string) => {
    const authToken = requireAdminToken();
    if (!authToken) {
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminMessage(null);
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setAdminMessage(data.message);
      await fetchAdminCategories(authToken);
      await fetchCategories();
      await fetchAdminSystemLogs(authToken);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminCreateProduct = async () => {
    const authToken = requireAdminToken();
    if (!authToken) {
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminMessage(null);
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          id: adminAddProductId,
          name: adminAddProductName,
          category: adminAddProductCategory,
          price: adminAddProductPrice,
          stock: adminAddProductStock,
          description: adminAddProductDescription,
        }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setAdminMessage(data.message);
      setAdminAddProductId('');
      setAdminAddProductName('');
      setAdminAddProductCategory('');
      setAdminAddProductPrice(0);
      setAdminAddProductStock(0);
      setAdminAddProductDescription('');
      await fetchAdminProducts(authToken, adminProductKeyword, adminProductCategory);
      await fetchAdminCategories(authToken);
      await fetchCategories();
      await fetchProducts(keyword, selectedCategory);
      await fetchAdminSystemLogs(authToken);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminDeleteProduct = async (productId: string) => {
    const authToken = requireAdminToken();
    if (!authToken) {
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setAdminMessage(data.message);
      await fetchAdminProducts(authToken, adminProductKeyword, adminProductCategory);
      await fetchProducts(keyword, selectedCategory);
      await fetchCart(authToken);
      await fetchAdminSystemLogs(authToken);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminSearchProducts = async () => {
    const authToken = requireAdminToken();
    if (!authToken) {
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    try {
      await fetchAdminProducts(authToken, adminProductKeyword, adminProductCategory);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminSearchUsers = async () => {
    const authToken = requireAdminToken();
    if (!authToken) {
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    try {
      await fetchAdminUsers(authToken, adminUserKeyword);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminDraftChange = <K extends keyof AdminUserDraft>(
    userId: string,
    field: K,
    value: AdminUserDraft[K],
  ) => {
    setAdminUserDrafts((previous) => ({
      ...previous,
      [userId]: {
        ...(previous[userId] ?? {
          nickname: '',
          phone: '',
          balance: 0,
          isAdmin: false,
        }),
        [field]: value,
      },
    }));
  };

  const handleAdminUpdateUser = async (userId: string) => {
    const authToken = requireAdminToken();
    if (!authToken) {
      return;
    }
    const draft = adminUserDrafts[userId];
    if (!draft) {
      setAdminError('未找到可更新的用户草稿数据');
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          nickname: draft.nickname,
          phone: draft.phone,
          balance: draft.balance,
          isAdmin: draft.isAdmin,
        }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setAdminMessage(`${data.message}（用户 ID: ${userId}）`);
      await fetchAdminUsers(authToken, adminUserKeyword);
      await fetchAdminSystemLogs(authToken);
      if (profile?.id === userId) {
        await fetchProfile(authToken);
      }
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminChangePassword = async () => {
    const authToken = requireAdminToken();
    if (!authToken) {
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminMessage(null);
    try {
      const response = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          currentPassword: adminCurrentPassword,
          newPassword: adminNewPassword,
        }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as MessageResponse;
      setAdminCurrentPassword('');
      setAdminNewPassword('');
      setAdminMessage(`管理员密码修改成功：${data.message}`);
      await fetchAdminSystemLogs(authToken);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRegister = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: registerUsername.trim(),
          password: registerPassword,
          nickname: registerNickname.trim(),
          phone: registerPhone.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as MessageResponse;
      setAuthMessage(data.message);
      setLoginUsername(registerUsername.trim());
      setRegisterPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as LoginResponse;
      persistToken(data.token);
      setProfile(data.user);
      setAuthMessage(`登录成功，有效期至 ${formatDateTime(data.expiresAt)}`);
      setLoginPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (token === '') {
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nickname: editNickname,
          phone: editPhone,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as UpdateUserResponse;
      setProfile(data.user);
      setAuthMessage(data.message);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (token === '') {
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const response = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as MessageResponse;
      setCurrentPassword('');
      setNewPassword('');
      setAuthMessage(data.message);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token !== '') {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore network errors on logout cleanup.
      }
    }
    persistToken('');
    setProfile(null);
    setCartItems([]);
    setCartTotalAmount(0);
    setOrderItems([]);
    setAdminCategories([]);
    setAdminProducts([]);
    setAdminOrders([]);
    setAdminUsers([]);
    setAdminUserDrafts({});
    setAuthError(null);
    setAuthMessage('已退出登录');
  };

  const navigateToAdminPage = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '/admin';
    }
    setAdminMenuKey('category');
    setCurrentPage('admin');
  };

  const navigateToShopPage = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '/shop';
    }
    setCurrentPage('shop');
  };

  const scrollToAdminSection = (key: AdminMenuKey) => {
    setAdminMenuKey(key);
    if (typeof window === 'undefined') {
      return;
    }
    const target = window.document.getElementById(`admin-section-${key}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    void fetchCategories();
    void fetchProducts('', '');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const syncPage = () => {
      setCurrentPage(window.location.hash === '#/admin' ? 'admin' : 'shop');
    };
    syncPage();
    window.addEventListener('hashchange', syncPage);
    return () => {
      window.removeEventListener('hashchange', syncPage);
    };
  }, []);

  useEffect(() => {
    if (token === '') {
      setProfile(null);
      setCartItems([]);
      setCartTotalAmount(0);
      setOrderItems([]);
      setAdminCategories([]);
      setAdminProducts([]);
      setAdminOrders([]);
      setAdminUsers([]);
      setAdminUserDrafts({});
      return;
    }
    void fetchProfile(token);
    void fetchCart(token);
    void fetchOrders(token);
  }, [token]);

  useEffect(() => {
    if (token === '' || !profile?.isAdmin) {
      return;
    }
    void handleAdminRefresh();
  }, [token, profile?.isAdmin]);

  useEffect(() => {
    setEditNickname(profile?.nickname ?? '');
    setEditPhone(profile?.phone ?? '');
  }, [profile]);

  useEffect(() => {
    setAdminCategoryPage(1);
  }, [adminCategories.length, adminCategorySort, adminPageSize]);

  useEffect(() => {
    setAdminProductPage(1);
  }, [adminProducts.length, adminProductSortBy, adminProductSortOrder, adminPageSize]);

  useEffect(() => {
    setAdminOrderPage(1);
  }, [adminOrders.length, adminOrderSortBy, adminOrderSortOrder, adminPageSize]);

  useEffect(() => {
    setAdminUserPage(1);
  }, [adminUsers.length, adminUserSortBy, adminUserSortOrder, adminPageSize]);

  const sortedAdminCategories = useMemo(() => {
    const copied = [...adminCategories];
    copied.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    if (adminCategorySort === 'desc') {
      copied.reverse();
    }
    return copied;
  }, [adminCategories, adminCategorySort]);

  const sortedAdminProducts = useMemo(() => {
    const copied = [...adminProducts];
    copied.sort((left, right) => {
      const factor = adminProductSortOrder === 'asc' ? 1 : -1;
      if (adminProductSortBy === 'price' || adminProductSortBy === 'stock') {
        return (left[adminProductSortBy] - right[adminProductSortBy]) * factor;
      }
      return String(left[adminProductSortBy]).localeCompare(String(right[adminProductSortBy]), 'zh-CN') * factor;
    });
    return copied;
  }, [adminProducts, adminProductSortBy, adminProductSortOrder]);

  const sortedAdminOrders = useMemo(() => {
    const copied = [...adminOrders];
    copied.sort((left, right) => {
      const factor = adminOrderSortOrder === 'asc' ? 1 : -1;
      if (adminOrderSortBy === 'totalAmount') {
        return (left.totalAmount - right.totalAmount) * factor;
      }
      return String(left[adminOrderSortBy]).localeCompare(String(right[adminOrderSortBy]), 'zh-CN') * factor;
    });
    return copied;
  }, [adminOrders, adminOrderSortBy, adminOrderSortOrder]);

  const sortedAdminUsers = useMemo(() => {
    const copied = [...adminUsers];
    copied.sort((left, right) => {
      const factor = adminUserSortOrder === 'asc' ? 1 : -1;
      if (adminUserSortBy === 'balance') {
        return (left.balance - right.balance) * factor;
      }
      if (adminUserSortBy === 'id') {
        return (Number(left.id) - Number(right.id)) * factor;
      }
      return String(left[adminUserSortBy]).localeCompare(String(right[adminUserSortBy]), 'zh-CN') * factor;
    });
    return copied;
  }, [adminUsers, adminUserSortBy, adminUserSortOrder]);

  const pageStart = (page: number) => (page - 1) * adminPageSize;
  const pagedAdminCategories = sortedAdminCategories.slice(pageStart(adminCategoryPage), pageStart(adminCategoryPage) + adminPageSize);
  const pagedAdminProducts = sortedAdminProducts.slice(pageStart(adminProductPage), pageStart(adminProductPage) + adminPageSize);
  const pagedAdminOrders = sortedAdminOrders.slice(pageStart(adminOrderPage), pageStart(adminOrderPage) + adminPageSize);
  const pagedAdminUsers = sortedAdminUsers.slice(pageStart(adminUserPage), pageStart(adminUserPage) + adminPageSize);
  const isAdminPage = currentPage === 'admin';
  const adminMenuItems = [
    { key: 'category', label: '分类管理' },
    { key: 'order', label: '订单管理' },
    { key: 'product', label: '商品管理' },
    { key: 'user', label: '用户管理' },
    { key: 'system', label: '系统管理' },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <Card className={`mx-auto shadow-sm ${isAdminPage ? 'max-w-7xl' : 'max-w-5xl'}`}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 0 }}>
              {isAdminPage ? '后台管理' : 'Happy Farmer'}
            </Typography.Title>
            {isAdminPage ? (
              <Button onClick={navigateToShopPage}>返回商城</Button>
            ) : profile?.isAdmin ? (
              <Button type="primary" onClick={navigateToAdminPage}>
                进入后台管理
              </Button>
            ) : null}
          </Space>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {isAdminPage
              ? '后台管理已整理为独立页面，左侧菜单用于快速跳转管理模块。'
              : '支持游客商品搜索，也支持用户注册登录、购物车、提交订单、支付订单与个人资料维护。'}
          </Typography.Paragraph>
        </Space>

        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          {isAdminPage ? (
            <Card
              size="small"
              style={{ width: 220, position: 'sticky', top: 24, alignSelf: 'flex-start', flexShrink: 0 }}
              bodyStyle={{ padding: 8 }}
            >
              <Menu
                mode="inline"
                selectedKeys={[adminMenuKey]}
                items={adminMenuItems}
                onClick={({ key }) => scrollToAdminSection(key as AdminMenuKey)}
              />
            </Card>
          ) : null}

          <div style={{ flex: 1, minWidth: 0 }}>
            <Tabs
              defaultActiveKey={isAdminPage ? 'admin' : 'products'}
              activeKey={isAdminPage ? 'admin' : undefined}
              tabBarStyle={isAdminPage ? { display: 'none' } : undefined}
              items={
                isAdminPage
                  ? [
                      {
                        key: 'admin',
                        label: '后台管理',
                        children: (
                          <AdminTab
                            token={token}
                            profile={profile}
                            adminError={adminError}
                            adminMessage={adminMessage}
                            adminLoading={adminLoading}
                            adminPageSize={adminPageSize}
                            setAdminPageSize={setAdminPageSize}
                            handleAdminRefresh={handleAdminRefresh}
                            adminCategoryName={adminCategoryName}
                            setAdminCategoryName={setAdminCategoryName}
                            adminCategorySort={adminCategorySort}
                            setAdminCategorySort={setAdminCategorySort}
                            pagedAdminCategories={pagedAdminCategories}
                            sortedAdminCategoriesLength={sortedAdminCategories.length}
                            adminCategoryPage={adminCategoryPage}
                            setAdminCategoryPage={setAdminCategoryPage}
                            handleAdminCreateCategory={handleAdminCreateCategory}
                            handleAdminDeleteCategory={handleAdminDeleteCategory}
                            adminOrderSortBy={adminOrderSortBy}
                            setAdminOrderSortBy={setAdminOrderSortBy}
                            adminOrderSortOrder={adminOrderSortOrder}
                            setAdminOrderSortOrder={setAdminOrderSortOrder}
                            pagedAdminOrders={pagedAdminOrders}
                            sortedAdminOrdersLength={sortedAdminOrders.length}
                            adminOrderPage={adminOrderPage}
                            setAdminOrderPage={setAdminOrderPage}
                            adminProductKeyword={adminProductKeyword}
                            setAdminProductKeyword={setAdminProductKeyword}
                            adminProductCategory={adminProductCategory}
                            setAdminProductCategory={setAdminProductCategory}
                            categories={categories}
                            handleAdminSearchProducts={handleAdminSearchProducts}
                            adminProductSortBy={adminProductSortBy}
                            setAdminProductSortBy={setAdminProductSortBy}
                            adminProductSortOrder={adminProductSortOrder}
                            setAdminProductSortOrder={setAdminProductSortOrder}
                            adminAddProductId={adminAddProductId}
                            setAdminAddProductId={setAdminAddProductId}
                            adminAddProductName={adminAddProductName}
                            setAdminAddProductName={setAdminAddProductName}
                            adminAddProductCategory={adminAddProductCategory}
                            setAdminAddProductCategory={setAdminAddProductCategory}
                            adminAddProductPrice={adminAddProductPrice}
                            setAdminAddProductPrice={setAdminAddProductPrice}
                            adminAddProductStock={adminAddProductStock}
                            setAdminAddProductStock={setAdminAddProductStock}
                            adminAddProductDescription={adminAddProductDescription}
                            setAdminAddProductDescription={setAdminAddProductDescription}
                            handleAdminCreateProduct={handleAdminCreateProduct}
                            pagedAdminProducts={pagedAdminProducts}
                            sortedAdminProductsLength={sortedAdminProducts.length}
                            adminProductPage={adminProductPage}
                            setAdminProductPage={setAdminProductPage}
                            handleAdminDeleteProduct={handleAdminDeleteProduct}
                            adminUserKeyword={adminUserKeyword}
                            setAdminUserKeyword={setAdminUserKeyword}
                            handleAdminSearchUsers={handleAdminSearchUsers}
                            adminUserSortBy={adminUserSortBy}
                            setAdminUserSortBy={setAdminUserSortBy}
                            adminUserSortOrder={adminUserSortOrder}
                            setAdminUserSortOrder={setAdminUserSortOrder}
                            pagedAdminUsers={pagedAdminUsers}
                            adminUserDrafts={adminUserDrafts}
                            handleAdminDraftChange={handleAdminDraftChange}
                            handleAdminUpdateUser={handleAdminUpdateUser}
                            adminUserPage={adminUserPage}
                            setAdminUserPage={setAdminUserPage}
                            sortedAdminUsersLength={sortedAdminUsers.length}
                            adminCurrentPassword={adminCurrentPassword}
                            setAdminCurrentPassword={setAdminCurrentPassword}
                            adminNewPassword={adminNewPassword}
                            setAdminNewPassword={setAdminNewPassword}
                            handleAdminChangePassword={handleAdminChangePassword}
                            adminLogs={adminLogs}
                            formatDateTime={formatDateTime}
                          />
                        ),
                      },
                    ]
                  : [
                      {
                        key: 'products',
                        label: '搜索商品（游客可用）',
                        children: (
                          <ProductsTab
                            selectedCategory={selectedCategory}
                            categoryLoading={categoryLoading}
                            categories={categories}
                            keyword={keyword}
                            loading={loading}
                            error={error}
                            token={token}
                            products={products}
                            setSelectedCategory={setSelectedCategory}
                            setKeyword={setKeyword}
                            fetchProducts={fetchProducts}
                            fetchProductDetail={fetchProductDetail}
                            handleAddToCart={handleAddToCart}
                          />
                        ),
                      },
                      {
                        key: 'account',
                        label: '用户中心',
                        children: (
                          <AccountTab
                            authError={authError}
                            authMessage={authMessage}
                            token={token}
                            profile={profile}
                            authLoading={authLoading}
                            loginUsername={loginUsername}
                            loginPassword={loginPassword}
                            registerUsername={registerUsername}
                            registerPassword={registerPassword}
                            registerNickname={registerNickname}
                            registerPhone={registerPhone}
                            editNickname={editNickname}
                            editPhone={editPhone}
                            currentPassword={currentPassword}
                            newPassword={newPassword}
                            formatDateTime={formatDateTime}
                            setLoginUsername={setLoginUsername}
                            setLoginPassword={setLoginPassword}
                            setRegisterUsername={setRegisterUsername}
                            setRegisterPassword={setRegisterPassword}
                            setRegisterNickname={setRegisterNickname}
                            setRegisterPhone={setRegisterPhone}
                            setEditNickname={setEditNickname}
                            setEditPhone={setEditPhone}
                            setCurrentPassword={setCurrentPassword}
                            setNewPassword={setNewPassword}
                            handleLogin={handleLogin}
                            handleRegister={handleRegister}
                            handleUpdateProfile={handleUpdateProfile}
                            handleChangePassword={handleChangePassword}
                            handleLogout={handleLogout}
                          />
                        ),
                      },
                      {
                        key: 'cart',
                        label: '购物车',
                        children: (
                          <CartTab
                            token={token}
                            cartError={cartError}
                            cartMessage={cartMessage}
                            cartLoading={cartLoading}
                            orderLoading={orderLoading}
                            cartItems={cartItems}
                            cartTotalAmount={cartTotalAmount}
                            fetchCart={fetchCart}
                            handleSubmitOrder={handleSubmitOrder}
                            handleChangeCartQuantity={handleChangeCartQuantity}
                            handleRemoveFromCart={handleRemoveFromCart}
                          />
                        ),
                      },
                      {
                        key: 'orders',
                        label: '我的订单',
                        children: (
                          <OrdersTab
                            token={token}
                            orderError={orderError}
                            orderMessage={orderMessage}
                            orderLoading={orderLoading}
                            orderItems={orderItems}
                            formatDateTime={formatDateTime}
                            fetchOrders={fetchOrders}
                            handlePayOrder={handlePayOrder}
                          />
                        ),
                      },
                    ]
              }
            />
          </div>
        </div>
      </Card>

      <ProductDetailModal
        detail={detail}
        isDetailOpen={isDetailOpen}
        detailLoading={detailLoading}
        detailError={detailError}
        onClose={() => setIsDetailOpen(false)}
      />
    </main>
  );
}

export default App;
