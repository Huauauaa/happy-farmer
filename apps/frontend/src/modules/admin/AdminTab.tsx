import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  List,
  Pagination,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';

type UserProfile = {
  id: string;
  username: string;
  nickname: string | null;
  phone: string | null;
  balance: number;
  isAdmin: boolean;
  createdAt: string;
};

type AdminCategory = {
  id: string;
  name: string;
};

type ProductDetail = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
};

type AdminOrderSummary = {
  orderNo: string;
  username: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
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

type AdminTabProps = {
  token: string;
  profile: UserProfile | null;
  adminError: string | null;
  adminMessage: string | null;
  adminLoading: boolean;
  adminPageSize: number;
  setAdminPageSize: (value: number) => void;
  handleAdminRefresh: () => Promise<void>;

  adminCategoryName: string;
  setAdminCategoryName: (value: string) => void;
  adminCategorySort: 'asc' | 'desc';
  setAdminCategorySort: (value: 'asc' | 'desc') => void;
  pagedAdminCategories: AdminCategory[];
  sortedAdminCategoriesLength: number;
  adminCategoryPage: number;
  setAdminCategoryPage: (page: number) => void;
  handleAdminCreateCategory: () => Promise<void>;
  handleAdminDeleteCategory: (id: string) => Promise<void>;

  adminOrderSortBy: 'createdAt' | 'totalAmount' | 'status' | 'username';
  setAdminOrderSortBy: (value: 'createdAt' | 'totalAmount' | 'status' | 'username') => void;
  adminOrderSortOrder: 'asc' | 'desc';
  setAdminOrderSortOrder: (value: 'asc' | 'desc') => void;
  pagedAdminOrders: AdminOrderSummary[];
  sortedAdminOrdersLength: number;
  adminOrderPage: number;
  setAdminOrderPage: (page: number) => void;

  adminProductKeyword: string;
  setAdminProductKeyword: (value: string) => void;
  adminProductCategory: string;
  setAdminProductCategory: (value: string) => void;
  categories: string[];
  handleAdminSearchProducts: () => Promise<void>;
  adminProductSortBy: 'id' | 'name' | 'price' | 'stock' | 'category';
  setAdminProductSortBy: (value: 'id' | 'name' | 'price' | 'stock' | 'category') => void;
  adminProductSortOrder: 'asc' | 'desc';
  setAdminProductSortOrder: (value: 'asc' | 'desc') => void;
  adminAddProductId: string;
  setAdminAddProductId: (value: string) => void;
  adminAddProductName: string;
  setAdminAddProductName: (value: string) => void;
  adminAddProductCategory: string;
  setAdminAddProductCategory: (value: string) => void;
  adminAddProductPrice: number;
  setAdminAddProductPrice: (value: number) => void;
  adminAddProductStock: number;
  setAdminAddProductStock: (value: number) => void;
  adminAddProductDescription: string;
  setAdminAddProductDescription: (value: string) => void;
  handleAdminCreateProduct: () => Promise<void>;
  pagedAdminProducts: ProductDetail[];
  sortedAdminProductsLength: number;
  adminProductPage: number;
  setAdminProductPage: (page: number) => void;
  handleAdminDeleteProduct: (productId: string) => Promise<void>;

  adminUserKeyword: string;
  setAdminUserKeyword: (value: string) => void;
  handleAdminSearchUsers: () => Promise<void>;
  adminUserSortBy: 'id' | 'username' | 'balance' | 'createdAt';
  setAdminUserSortBy: (value: 'id' | 'username' | 'balance' | 'createdAt') => void;
  adminUserSortOrder: 'asc' | 'desc';
  setAdminUserSortOrder: (value: 'asc' | 'desc') => void;
  pagedAdminUsers: UserProfile[];
  adminUserDrafts: Record<string, AdminUserDraft>;
  handleAdminDraftChange: <K extends keyof AdminUserDraft>(userId: string, field: K, value: AdminUserDraft[K]) => void;
  handleAdminUpdateUser: (userId: string) => Promise<void>;
  adminUserPage: number;
  setAdminUserPage: (page: number) => void;
  sortedAdminUsersLength: number;

  adminCurrentPassword: string;
  setAdminCurrentPassword: (value: string) => void;
  adminNewPassword: string;
  setAdminNewPassword: (value: string) => void;
  handleAdminChangePassword: () => Promise<void>;
  adminLogs: SystemLogItem[];
  formatDateTime: (value: string) => string;
};

function AdminTab({
  token,
  profile,
  adminError,
  adminMessage,
  adminLoading,
  adminPageSize,
  setAdminPageSize,
  handleAdminRefresh,
  adminCategoryName,
  setAdminCategoryName,
  adminCategorySort,
  setAdminCategorySort,
  pagedAdminCategories,
  sortedAdminCategoriesLength,
  adminCategoryPage,
  setAdminCategoryPage,
  handleAdminCreateCategory,
  handleAdminDeleteCategory,
  adminOrderSortBy,
  setAdminOrderSortBy,
  adminOrderSortOrder,
  setAdminOrderSortOrder,
  pagedAdminOrders,
  sortedAdminOrdersLength,
  adminOrderPage,
  setAdminOrderPage,
  adminProductKeyword,
  setAdminProductKeyword,
  adminProductCategory,
  setAdminProductCategory,
  categories,
  handleAdminSearchProducts,
  adminProductSortBy,
  setAdminProductSortBy,
  adminProductSortOrder,
  setAdminProductSortOrder,
  adminAddProductId,
  setAdminAddProductId,
  adminAddProductName,
  setAdminAddProductName,
  adminAddProductCategory,
  setAdminAddProductCategory,
  adminAddProductPrice,
  setAdminAddProductPrice,
  adminAddProductStock,
  setAdminAddProductStock,
  adminAddProductDescription,
  setAdminAddProductDescription,
  handleAdminCreateProduct,
  pagedAdminProducts,
  sortedAdminProductsLength,
  adminProductPage,
  setAdminProductPage,
  handleAdminDeleteProduct,
  adminUserKeyword,
  setAdminUserKeyword,
  handleAdminSearchUsers,
  adminUserSortBy,
  setAdminUserSortBy,
  adminUserSortOrder,
  setAdminUserSortOrder,
  pagedAdminUsers,
  adminUserDrafts,
  handleAdminDraftChange,
  handleAdminUpdateUser,
  adminUserPage,
  setAdminUserPage,
  sortedAdminUsersLength,
  adminCurrentPassword,
  setAdminCurrentPassword,
  adminNewPassword,
  setAdminNewPassword,
  handleAdminChangePassword,
  adminLogs,
  formatDateTime,
}: AdminTabProps) {
  if (token === '') {
    return <Typography.Paragraph>请先登录管理员账号后使用后台管理。</Typography.Paragraph>;
  }

  if (!profile?.isAdmin) {
    return <Typography.Paragraph>当前账号不是管理员，无权访问后台管理功能。</Typography.Paragraph>;
  }

  return (
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
                <Button type="primary" loading={adminLoading} onClick={() => void handleAdminCreateCategory()}>
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
                total={sortedAdminCategoriesLength}
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
                        <Tag color={order.status === 'PAID' ? 'success' : 'warning'}>{order.status}</Tag>
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
                total={sortedAdminOrdersLength}
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
            total={sortedAdminProductsLength}
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
                    <Button key={`update-user-${user.id}`} type="primary" onClick={() => void handleAdminUpdateUser(user.id)}>
                      保存用户
                    </Button>,
                  ]}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag color="blue">ID {user.id}</Tag>
                      <Tag color="default">{user.username}</Tag>
                      <Tag color={draft.isAdmin ? 'success' : 'default'}>{draft.isAdmin ? '管理员' : '普通用户'}</Tag>
                      <Tag color="gold">余额 ¥{draft.balance.toFixed(2)}</Tag>
                    </Space>

                    <Row gutter={[8, 8]}>
                      <Col xs={24} md={8}>
                        <Input
                          placeholder="昵称"
                          value={draft.nickname}
                          onChange={(event) => handleAdminDraftChange(user.id, 'nickname', event.target.value)}
                        />
                      </Col>
                      <Col xs={24} md={8}>
                        <Input
                          placeholder="手机号"
                          value={draft.phone}
                          onChange={(event) => handleAdminDraftChange(user.id, 'phone', event.target.value)}
                        />
                      </Col>
                      <Col xs={24} md={4}>
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          step={1}
                          value={draft.balance}
                          onChange={(value) =>
                            handleAdminDraftChange(user.id, 'balance', typeof value === 'number' ? value : 0)
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
                          onChange={(value) => handleAdminDraftChange(user.id, 'isAdmin', value === 'admin')}
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
            total={sortedAdminUsersLength}
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
              <Button type="primary" loading={adminLoading} onClick={() => void handleAdminChangePassword()}>
                修改管理员密码
              </Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="系统日志视图（原型）">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Typography.Text type="secondary">展示最近后台操作日志（创建分类/商品、订单支付、用户管理等）</Typography.Text>
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
  );
}

export default AdminTab;
