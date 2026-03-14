import { Button, Card, Col, Empty, Input, List, Modal, Row, Space, Tabs, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

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
  total: number;
  items: ProductSummary[];
};

type UserProfile = {
  id: string;
  username: string;
  nickname: string | null;
  phone: string | null;
  balance: number;
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
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductSummary[]>([]);
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

  const fetchProducts = async (keywordValue: string) => {
    setLoading(true);
    setError(null);

    try {
      const query = encodeURIComponent(keywordValue.trim());
      const response = await fetch(`/api/products?keyword=${query}`);
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

  const handleLogout = () => {
    persistToken('');
    setProfile(null);
    setAuthError(null);
    setAuthMessage('已退出登录');
  };

  useEffect(() => {
    void fetchProducts('');
  }, []);

  useEffect(() => {
    if (token === '') {
      setProfile(null);
      return;
    }
    void fetchProfile(token);
  }, [token]);

  useEffect(() => {
    setEditNickname(profile?.nickname ?? '');
    setEditPhone(profile?.phone ?? '');
  }, [profile]);

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <Card className="mx-auto max-w-5xl shadow-sm">
        <Typography.Title level={2} style={{ marginTop: 0 }}>
          Happy Farmer
        </Typography.Title>
        <Typography.Paragraph>
          支持游客商品搜索，也支持用户注册、登录、个人资料维护与密码修改。
        </Typography.Paragraph>

        <Tabs
          defaultActiveKey="products"
          items={[
            {
              key: 'products',
              label: '搜索商品（游客可用）',
              children: (
                <>
                  <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
                    <Input
                      placeholder="请输入商品名称，例如：苹果"
                      value={keyword}
                      onChange={(event) => {
                        setKeyword(event.target.value);
                      }}
                      onPressEnter={() => {
                        void fetchProducts(keyword);
                      }}
                    />
                    <Button type="primary" loading={loading} onClick={() => void fetchProducts(keyword)}>
                      搜索
                    </Button>
                  </Space.Compact>

                  {error ? (
                    <Tag color="error" style={{ marginBottom: 12 }}>
                      搜索失败：{error}
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
                          <Button danger onClick={handleLogout}>
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
          ]}
        />
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
