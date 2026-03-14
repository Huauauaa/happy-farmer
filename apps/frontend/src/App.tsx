import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  List,
  Menu,
  Modal,
  Pagination,
  Popconfirm,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';

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
              items={[
            {
              key: 'products',
              label: '搜索商品（游客可用）',
              children: (
                <>
                  <Space wrap style={{ width: '100%', marginBottom: 16 }}>
                    <Select
                      style={{ width: 200 }}
                      value={selectedCategory}
                      loading={categoryLoading}
                      options={[
                        { label: '全部分类', value: '' },
                        ...categories.map((category) => ({
                          label: category,
                          value: category,
                        })),
                      ]}
                      onChange={(nextCategory) => {
                        setSelectedCategory(nextCategory);
                        void fetchProducts(keyword, nextCategory);
                      }}
                    />
                    <Input
                      style={{ minWidth: 260, flex: 1 }}
                      placeholder="请输入商品名称，例如：苹果"
                      value={keyword}
                      onChange={(event) => {
                        setKeyword(event.target.value);
                      }}
                      onPressEnter={() => {
                        void fetchProducts(keyword, selectedCategory);
                      }}
                    />
                    <Button
                      type="primary"
                      loading={loading}
                      onClick={() => void fetchProducts(keyword, selectedCategory)}
                    >
                      搜索
                    </Button>
                  </Space>

                  {error ? (
                    <Tag color="error" style={{ marginBottom: 12 }}>
                      搜索失败：{error}
                    </Tag>
                  ) : null}
                  {token === '' ? (
                    <Tag color="default" style={{ marginBottom: 12 }}>
                      登录后可将商品加入购物车
                    </Tag>
                  ) : null}

                  <List
                    loading={loading}
                    locale={{ emptyText: <Empty description="未找到匹配商品" /> }}
                    dataSource={products}
                    renderItem={(product) => (
                      <List.Item
                        key={product.id}
                        actions={[
                          <Button
                            key={`detail-${product.id}`}
                            type="link"
                            onClick={() => void fetchProductDetail(product.id)}
                          >
                            查看详情
                          </Button>,
                          <Button
                            key={`cart-${product.id}`}
                            type="link"
                            disabled={token === ''}
                            onClick={() => void handleAddToCart(product.id)}
                          >
                            加入购物车
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={product.name}
                          description={
                            <Space size={8} wrap>
                              <Tag color="blue">{product.category}</Tag>
                              <Tag color="gold">¥{product.price.toFixed(2)}</Tag>
                              <Tag color={product.stock > 0 ? 'green' : 'red'}>
                                {product.stock > 0 ? `库存 ${product.stock}` : '缺货'}
                              </Tag>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </>
              ),
            },
            {
              key: 'account',
              label: '用户中心',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {authError ? <Tag color="error">操作失败：{authError}</Tag> : null}
                  {authMessage ? <Tag color="success">{authMessage}</Tag> : null}

                  {token === '' ? (
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={12}>
                        <Card title="用户登录">
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Input
                              placeholder="账号"
                              value={loginUsername}
                              onChange={(event) => setLoginUsername(event.target.value)}
                            />
                            <Input.Password
                              placeholder="密码"
                              value={loginPassword}
                              onChange={(event) => setLoginPassword(event.target.value)}
                              onPressEnter={() => {
                                void handleLogin();
                              }}
                            />
                            <Button type="primary" loading={authLoading} onClick={() => void handleLogin()}>
                              登录
                            </Button>
                          </Space>
                        </Card>
                      </Col>
                      <Col xs={24} md={12}>
                        <Card title="用户注册">
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Input
                              placeholder="账号（3-32位字母/数字/下划线）"
                              value={registerUsername}
                              onChange={(event) => setRegisterUsername(event.target.value)}
                            />
                            <Input.Password
                              placeholder="密码（6-64位）"
                              value={registerPassword}
                              onChange={(event) => setRegisterPassword(event.target.value)}
                            />
                            <Input
                              placeholder="昵称（可选）"
                              value={registerNickname}
                              onChange={(event) => setRegisterNickname(event.target.value)}
                            />
                            <Input
                              placeholder="手机号（可选）"
                              value={registerPhone}
                              onChange={(event) => setRegisterPhone(event.target.value)}
                            />
                            <Button loading={authLoading} onClick={() => void handleRegister()}>
                              注册
                            </Button>
                          </Space>
                        </Card>
                      </Col>
                    </Row>
                  ) : (
                    <>
                      <Card title="账号信息">
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          <Typography.Text>账号：{profile?.username ?? '-'}</Typography.Text>
                          <Typography.Text>昵称：{profile?.nickname ?? '未设置'}</Typography.Text>
                          <Typography.Text>手机号：{profile?.phone ?? '未设置'}</Typography.Text>
                          <Typography.Text>余额：¥{(profile?.balance ?? 0).toFixed(2)}</Typography.Text>
                          <Typography.Text>
                            注册时间：{profile ? formatDateTime(profile.createdAt) : '-'}
                          </Typography.Text>
                          <Button danger onClick={() => void handleLogout()}>
                            退出登录
                          </Button>
                        </Space>
                      </Card>

                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                          <Card title="更新个人信息">
                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                              <Input
                                placeholder="昵称"
                                value={editNickname}
                                onChange={(event) => setEditNickname(event.target.value)}
                              />
                              <Input
                                placeholder="手机号"
                                value={editPhone}
                                onChange={(event) => setEditPhone(event.target.value)}
                              />
                              <Button type="primary" loading={authLoading} onClick={() => void handleUpdateProfile()}>
                                保存资料
                              </Button>
                            </Space>
                          </Card>
                        </Col>
                        <Col xs={24} md={12}>
                          <Card title="修改密码">
                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                              <Input.Password
                                placeholder="当前密码"
                                value={currentPassword}
                                onChange={(event) => setCurrentPassword(event.target.value)}
                              />
                              <Input.Password
                                placeholder="新密码"
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                              />
                              <Button type="primary" loading={authLoading} onClick={() => void handleChangePassword()}>
                                修改密码
                              </Button>
                            </Space>
                          </Card>
                        </Col>
                      </Row>
                    </>
                  )}
                </Space>
              ),
            },
            {
              key: 'cart',
              label: '购物车',
              children:
                token === '' ? (
                  <Typography.Paragraph>请先登录后查看购物车。</Typography.Paragraph>
                ) : (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    {cartError ? <Tag color="error">购物车操作失败：{cartError}</Tag> : null}
                    {cartMessage ? <Tag color="success">{cartMessage}</Tag> : null}
                    <Space>
                      <Button loading={cartLoading} onClick={() => void fetchCart(token)}>
                        刷新购物车
                      </Button>
                      <Button type="primary" loading={orderLoading} onClick={() => void handleSubmitOrder()}>
                        提交订单
                      </Button>
                    </Space>
                    <Typography.Text>
                      当前共 {cartItems.length} 件商品，合计 ¥{cartTotalAmount.toFixed(2)}
                    </Typography.Text>

                    <List
                      loading={cartLoading}
                      locale={{ emptyText: <Empty description="购物车为空" /> }}
                      dataSource={cartItems}
                      renderItem={(item) => (
                        <List.Item
                          key={item.productId}
                          actions={[
                            <InputNumber
                              key={`qty-${item.productId}`}
                              min={1}
                              max={Math.max(item.stock, 1)}
                              value={item.quantity}
                              onChange={(value) => {
                                if (typeof value === 'number' && Number.isFinite(value)) {
                                  void handleChangeCartQuantity(item.productId, value);
                                }
                              }}
                            />,
                            <Button
                              key={`remove-${item.productId}`}
                              danger
                              type="link"
                              onClick={() => void handleRemoveFromCart(item.productId)}
                            >
                              删除
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            title={item.name}
                            description={
                              <Space size={8} wrap>
                                <Tag color="blue">{item.category}</Tag>
                                <Tag color="gold">单价 ¥{item.price.toFixed(2)}</Tag>
                                <Tag color="green">数量 {item.quantity}</Tag>
                                <Tag color="purple">小计 ¥{item.subtotal.toFixed(2)}</Tag>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Space>
                ),
            },
            {
              key: 'orders',
              label: '我的订单',
              children:
                token === '' ? (
                  <Typography.Paragraph>请先登录后查看订单。</Typography.Paragraph>
                ) : (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    {orderError ? <Tag color="error">订单操作失败：{orderError}</Tag> : null}
                    {orderMessage ? <Tag color="success">{orderMessage}</Tag> : null}
                    <Button loading={orderLoading} onClick={() => void fetchOrders(token)}>
                      刷新订单
                    </Button>

                    <List
                      loading={orderLoading}
                      locale={{ emptyText: <Empty description="暂无订单" /> }}
                      dataSource={orderItems}
                      renderItem={(order) => (
                        <List.Item
                          key={order.orderNo}
                          actions={
                            order.status === 'UNPAID'
                              ? [
                                  <Button
                                    key={`pay-${order.orderNo}`}
                                    type="primary"
                                    onClick={() => void handlePayOrder(order.orderNo)}
                                  >
                                    立即付款
                                  </Button>,
                                ]
                              : []
                          }
                        >
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Space wrap>
                              <Tag color="blue">订单号：{order.orderNo}</Tag>
                              <Tag color={order.status === 'PAID' ? 'success' : 'warning'}>
                                {order.status}
                              </Tag>
                              <Tag color="gold">金额 ¥{order.totalAmount.toFixed(2)}</Tag>
                              <Tag color="default">创建于 {formatDateTime(order.createdAt)}</Tag>
                            </Space>
                            <List
                              size="small"
                              dataSource={order.items}
                              renderItem={(item) => (
                                <List.Item key={`${order.orderNo}-${item.productId}`}>
                                  <Space size={8} wrap>
                                    <Typography.Text>{item.productName}</Typography.Text>
                                    <Tag color="blue">{item.category}</Tag>
                                    <Tag color="gold">¥{item.price.toFixed(2)}</Tag>
                                    <Tag color="green">x{item.quantity}</Tag>
                                    <Tag color="purple">¥{item.subtotal.toFixed(2)}</Tag>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Space>
                ),
            },
            {
              key: 'admin',
              label: '后台管理',
              children:
                token === '' ? (
                  <Typography.Paragraph>请先登录管理员账号后使用后台管理。</Typography.Paragraph>
                ) : !profile?.isAdmin ? (
                  <Typography.Paragraph>当前账号不是管理员，无权访问后台管理功能。</Typography.Paragraph>
                ) : (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    {adminError ? <Tag color="error">后台操作失败：{adminError}</Tag> : null}
                    {adminMessage ? <Tag color="success">{adminMessage}</Tag> : null}
                    <Space wrap>
                      <Button loading={adminLoading} onClick={() => void handleAdminRefresh()}>
                        刷新后台数据
                      </Button>
                      <Select
                        style={{ width: 160 }}
                        value={adminPageSize}
                        options={[
                          { label: '每页 5 条', value: 5 },
                          { label: '每页 10 条', value: 10 },
                          { label: '每页 20 条', value: 20 },
                        ]}
                        onChange={(value) => setAdminPageSize(value)}
                      />
                    </Space>

                    <Row gutter={[16, 16]}>
                      <Col xs={24} lg={12}>
                        <Card id="admin-section-category" title="商品类别管理">
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Space.Compact style={{ width: '100%' }}>
                              <Input
                                placeholder="输入新分类名称"
                                value={adminCategoryName}
                                onChange={(event) => setAdminCategoryName(event.target.value)}
                              />
                              <Button
                                type="primary"
                                loading={adminLoading}
                                onClick={() => void handleAdminCreateCategory()}
                              >
                                新增分类
                              </Button>
                            </Space.Compact>

                            <Select
                              style={{ width: 180 }}
                              value={adminCategorySort}
                              options={[
                                { label: '按名称升序', value: 'asc' },
                                { label: '按名称降序', value: 'desc' },
                              ]}
                              onChange={(value) => setAdminCategorySort(value)}
                            />

                            <List
                              size="small"
                              locale={{ emptyText: <Empty description="暂无分类" /> }}
                              dataSource={pagedAdminCategories}
                              renderItem={(category) => (
                                <List.Item
                                  key={category.id}
                                  actions={[
                                    <Popconfirm
                                      key={`delete-category-${category.id}`}
                                      title="确认删除该分类？"
                                      description="若分类下存在商品，将无法删除。"
                                      okText="确认删除"
                                      cancelText="取消"
                                      onConfirm={() => void handleAdminDeleteCategory(category.id)}
                                    >
                                      <Button danger type="link">
                                        删除
                                      </Button>
                                    </Popconfirm>,
                                  ]}
                                >
                                  {category.name}
                                </List.Item>
                              )}
                            />
                            <Pagination
                              size="small"
                              current={adminCategoryPage}
                              pageSize={adminPageSize}
                              total={sortedAdminCategories.length}
                              onChange={(page) => setAdminCategoryPage(page)}
                            />
                          </Space>
                        </Card>
                      </Col>

                      <Col xs={24} lg={12}>
                        <Card id="admin-section-order" title="订单管理">
                          <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Space wrap>
                              <Select
                                style={{ width: 180 }}
                                value={adminOrderSortBy}
                                options={[
                                  { label: '按创建时间', value: 'createdAt' },
                                  { label: '按订单金额', value: 'totalAmount' },
                                  { label: '按订单状态', value: 'status' },
                                  { label: '按用户名', value: 'username' },
                                ]}
                                onChange={(value) => setAdminOrderSortBy(value)}
                              />
                              <Select
                                style={{ width: 140 }}
                                value={adminOrderSortOrder}
                                options={[
                                  { label: '升序', value: 'asc' },
                                  { label: '降序', value: 'desc' },
                                ]}
                                onChange={(value) => setAdminOrderSortOrder(value)}
                              />
                            </Space>

                          <List
                            size="small"
                            loading={adminLoading}
                            locale={{ emptyText: <Empty description="暂无订单" /> }}
                            dataSource={pagedAdminOrders}
                            renderItem={(order) => (
                              <List.Item key={order.orderNo}>
                                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                  <Space wrap>
                                    <Tag color="blue">订单号：{order.orderNo}</Tag>
                                    <Tag color="default">用户：{order.username}</Tag>
                                    <Tag color={order.status === 'PAID' ? 'success' : 'warning'}>
                                      {order.status}
                                    </Tag>
                                    <Tag color="gold">¥{order.totalAmount.toFixed(2)}</Tag>
                                  </Space>
                                  <Typography.Text type="secondary">
                                    创建时间：{formatDateTime(order.createdAt)}
                                    {order.paidAt ? `，支付时间：${formatDateTime(order.paidAt)}` : ''}
                                  </Typography.Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                            <Pagination
                              size="small"
                              current={adminOrderPage}
                              pageSize={adminPageSize}
                              total={sortedAdminOrders.length}
                              onChange={(page) => setAdminOrderPage(page)}
                            />
                          </Space>
                        </Card>
                      </Col>
                    </Row>

                    <Card id="admin-section-product" title="商品管理">
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space wrap>
                          <Input
                            placeholder="按商品名筛选"
                            value={adminProductKeyword}
                            onChange={(event) => setAdminProductKeyword(event.target.value)}
                          />
                          <Select
                            style={{ width: 180 }}
                            value={adminProductCategory}
                            options={[
                              { label: '全部分类', value: '' },
                              ...categories.map((category) => ({
                                label: category,
                                value: category,
                              })),
                            ]}
                            onChange={(value) => setAdminProductCategory(value)}
                          />
                          <Button loading={adminLoading} onClick={() => void handleAdminSearchProducts()}>
                            查询商品
                          </Button>
                          <Select
                            style={{ width: 180 }}
                            value={adminProductSortBy}
                            options={[
                              { label: '按编号', value: 'id' },
                              { label: '按名称', value: 'name' },
                              { label: '按价格', value: 'price' },
                              { label: '按库存', value: 'stock' },
                              { label: '按分类', value: 'category' },
                            ]}
                            onChange={(value) => setAdminProductSortBy(value)}
                          />
                          <Select
                            style={{ width: 140 }}
                            value={adminProductSortOrder}
                            options={[
                              { label: '升序', value: 'asc' },
                              { label: '降序', value: 'desc' },
                            ]}
                            onChange={(value) => setAdminProductSortOrder(value)}
                          />
                        </Space>

                        <Row gutter={[12, 12]}>
                          <Col xs={24} md={8}>
                            <Input
                              placeholder="商品编号，如 p-2001"
                              value={adminAddProductId}
                              onChange={(event) => setAdminAddProductId(event.target.value)}
                            />
                          </Col>
                          <Col xs={24} md={8}>
                            <Input
                              placeholder="商品名称"
                              value={adminAddProductName}
                              onChange={(event) => setAdminAddProductName(event.target.value)}
                            />
                          </Col>
                          <Col xs={24} md={8}>
                            <Input
                              placeholder="商品分类"
                              value={adminAddProductCategory}
                              onChange={(event) => setAdminAddProductCategory(event.target.value)}
                            />
                          </Col>
                          <Col xs={24} md={8}>
                            <InputNumber
                              style={{ width: '100%' }}
                              min={0.01}
                              step={0.01}
                              placeholder="价格"
                              value={adminAddProductPrice}
                              onChange={(value) => setAdminAddProductPrice(typeof value === 'number' ? value : 0)}
                            />
                          </Col>
                          <Col xs={24} md={8}>
                            <InputNumber
                              style={{ width: '100%' }}
                              min={0}
                              step={1}
                              placeholder="库存"
                              value={adminAddProductStock}
                              onChange={(value) => setAdminAddProductStock(typeof value === 'number' ? value : 0)}
                            />
                          </Col>
                          <Col xs={24} md={8}>
                            <Button type="primary" loading={adminLoading} onClick={() => void handleAdminCreateProduct()}>
                              添加商品
                            </Button>
                          </Col>
                        </Row>

                        <Input.TextArea
                          placeholder="商品描述"
                          value={adminAddProductDescription}
                          onChange={(event) => setAdminAddProductDescription(event.target.value)}
                        />

                        <List
                          size="small"
                          loading={adminLoading}
                          locale={{ emptyText: <Empty description="暂无商品数据" /> }}
                          dataSource={pagedAdminProducts}
                          renderItem={(product) => (
                            <List.Item
                              key={product.id}
                              actions={[
                                <Popconfirm
                                  key={`delete-product-${product.id}`}
                                  title="确认删除该商品？"
                                  description="删除后不可恢复。"
                                  okText="确认删除"
                                  cancelText="取消"
                                  onConfirm={() => void handleAdminDeleteProduct(product.id)}
                                >
                                  <Button danger type="link">
                                    删除商品
                                  </Button>
                                </Popconfirm>,
                              ]}
                            >
                              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                <Space wrap>
                                  <Tag color="blue">{product.id}</Tag>
                                  <Typography.Text>{product.name}</Typography.Text>
                                  <Tag color="gold">¥{product.price.toFixed(2)}</Tag>
                                  <Tag color="green">库存 {product.stock}</Tag>
                                  <Tag>{product.category}</Tag>
                                </Space>
                                <Typography.Text type="secondary">{product.description}</Typography.Text>
                              </Space>
                            </List.Item>
                          )}
                        />
                        <Pagination
                          size="small"
                          current={adminProductPage}
                          pageSize={adminPageSize}
                          total={sortedAdminProducts.length}
                          onChange={(page) => setAdminProductPage(page)}
                        />
                      </Space>
                    </Card>

                    <Card id="admin-section-user" title="用户管理">
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space>
                          <Input
                            placeholder="按账号模糊查询"
                            value={adminUserKeyword}
                            onChange={(event) => setAdminUserKeyword(event.target.value)}
                          />
                          <Button loading={adminLoading} onClick={() => void handleAdminSearchUsers()}>
                            查询用户
                          </Button>
                          <Select
                            style={{ width: 180 }}
                            value={adminUserSortBy}
                            options={[
                              { label: '按用户ID', value: 'id' },
                              { label: '按用户名', value: 'username' },
                              { label: '按余额', value: 'balance' },
                              { label: '按创建时间', value: 'createdAt' },
                            ]}
                            onChange={(value) => setAdminUserSortBy(value)}
                          />
                          <Select
                            style={{ width: 140 }}
                            value={adminUserSortOrder}
                            options={[
                              { label: '升序', value: 'asc' },
                              { label: '降序', value: 'desc' },
                            ]}
                            onChange={(value) => setAdminUserSortOrder(value)}
                          />
                        </Space>

                        <List
                          size="small"
                          loading={adminLoading}
                          locale={{ emptyText: <Empty description="暂无用户" /> }}
                          dataSource={pagedAdminUsers}
                          renderItem={(user) => {
                            const draft = adminUserDrafts[user.id] ?? {
                              nickname: user.nickname ?? '',
                              phone: user.phone ?? '',
                              balance: user.balance,
                              isAdmin: user.isAdmin,
                            };
                            return (
                              <List.Item
                                key={user.id}
                                actions={[
                                  <Button
                                    key={`update-user-${user.id}`}
                                    type="primary"
                                    onClick={() => void handleAdminUpdateUser(user.id)}
                                  >
                                    保存用户
                                  </Button>,
                                ]}
                              >
                                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                  <Space wrap>
                                    <Tag color="blue">ID {user.id}</Tag>
                                    <Tag color="default">{user.username}</Tag>
                                    <Tag color={draft.isAdmin ? 'success' : 'default'}>
                                      {draft.isAdmin ? '管理员' : '普通用户'}
                                    </Tag>
                                    <Tag color="gold">余额 ¥{draft.balance.toFixed(2)}</Tag>
                                  </Space>

                                  <Row gutter={[8, 8]}>
                                    <Col xs={24} md={8}>
                                      <Input
                                        placeholder="昵称"
                                        value={draft.nickname}
                                        onChange={(event) =>
                                          handleAdminDraftChange(user.id, 'nickname', event.target.value)
                                        }
                                      />
                                    </Col>
                                    <Col xs={24} md={8}>
                                      <Input
                                        placeholder="手机号"
                                        value={draft.phone}
                                        onChange={(event) =>
                                          handleAdminDraftChange(user.id, 'phone', event.target.value)
                                        }
                                      />
                                    </Col>
                                    <Col xs={24} md={4}>
                                      <InputNumber
                                        style={{ width: '100%' }}
                                        min={0}
                                        step={1}
                                        value={draft.balance}
                                        onChange={(value) =>
                                          handleAdminDraftChange(
                                            user.id,
                                            'balance',
                                            typeof value === 'number' ? value : 0,
                                          )
                                        }
                                      />
                                    </Col>
                                    <Col xs={24} md={4}>
                                      <Select
                                        style={{ width: '100%' }}
                                        value={draft.isAdmin ? 'admin' : 'user'}
                                        options={[
                                          { label: '普通用户', value: 'user' },
                                          { label: '管理员', value: 'admin' },
                                        ]}
                                        onChange={(value) =>
                                          handleAdminDraftChange(user.id, 'isAdmin', value === 'admin')
                                        }
                                      />
                                    </Col>
                                  </Row>
                                </Space>
                              </List.Item>
                            );
                          }}
                        />
                        <Pagination
                          size="small"
                          current={adminUserPage}
                          pageSize={adminPageSize}
                          total={sortedAdminUsers.length}
                          onChange={(page) => setAdminUserPage(page)}
                        />
                      </Space>
                    </Card>

                    <Row id="admin-section-system" gutter={[16, 16]}>
                      <Col xs={24} lg={12}>
                        <Card title="系统管理（管理员改密）">
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Input.Password
                              placeholder="当前管理员密码"
                              value={adminCurrentPassword}
                              onChange={(event) => setAdminCurrentPassword(event.target.value)}
                            />
                            <Input.Password
                              placeholder="新管理员密码"
                              value={adminNewPassword}
                              onChange={(event) => setAdminNewPassword(event.target.value)}
                            />
                            <Button
                              type="primary"
                              loading={adminLoading}
                              onClick={() => void handleAdminChangePassword()}
                            >
                              修改管理员密码
                            </Button>
                          </Space>
                        </Card>
                      </Col>

                      <Col xs={24} lg={12}>
                        <Card title="系统日志视图（原型）">
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Typography.Text type="secondary">
                              展示最近后台操作日志（创建分类/商品、订单支付、用户管理等）
                            </Typography.Text>
                            <List
                              size="small"
                              loading={adminLoading}
                              locale={{ emptyText: <Empty description="暂无系统日志" /> }}
                              dataSource={adminLogs}
                              renderItem={(log) => (
                                <List.Item key={log.id}>
                                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                    <Space wrap>
                                      <Tag color="default">{log.level}</Tag>
                                      <Tag color="blue">{log.module}</Tag>
                                      <Tag>{log.action}</Tag>
                                      <Tag color="purple">{formatDateTime(log.createdAt)}</Tag>
                                      {log.actorUserId ? <Tag color="gold">操作者 {log.actorUserId}</Tag> : null}
                                    </Space>
                                    <Typography.Text>{log.message}</Typography.Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          </Space>
                        </Card>
                      </Col>
                    </Row>
                  </Space>
                ),
            },
              ].filter((item) => (isAdminPage ? item.key === 'admin' : item.key !== 'admin'))}
            />
          </div>
        </div>
      </Card>

      <Modal
        title={detail?.name ?? '商品详情'}
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        footer={null}
      >
        {detailLoading ? (
          <Typography.Paragraph>正在加载商品详情...</Typography.Paragraph>
        ) : detailError ? (
          <Typography.Text type="danger">详情加载失败：{detailError}</Typography.Text>
        ) : detail ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text>商品编号：{detail.id}</Typography.Text>
            <Typography.Text>分类：{detail.category}</Typography.Text>
            <Typography.Text>价格：¥{detail.price.toFixed(2)}</Typography.Text>
            <Typography.Text>剩余库存：{detail.stock}</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              商品介绍：{detail.description}
            </Typography.Paragraph>
          </Space>
        ) : null}
      </Modal>
    </main>
  );
}

export default App;
