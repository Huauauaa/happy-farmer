# Happy Farmer

一个基于 pnpm workspace 的前后端分离示例项目，包含：

- `apps/frontend`：React + TypeScript + Vite + Ant Design + Tailwind CSS
- `apps/backend`：Express + TypeScript

前端通过 Vite 开发代理访问后端接口，当前内置了一个健康检查接口用于联调验证。

## 项目结构

```text
.
├── apps
│   ├── backend
│   │   ├── src/index.ts
│   │   └── package.json
│   └── frontend
│       ├── src/App.tsx
│       └── package.json
├── package.json
└── pnpm-workspace.yaml
```

## 环境要求

- Node.js 18+
- pnpm 10+

仓库根目录已声明：

```json
"packageManager": "pnpm@10.16.0"
```

## 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

## 本地开发

### 同时启动前后端

```bash
pnpm dev
```

默认情况下：

- 前端开发服务运行在 `http://localhost:5173`
- 后端服务运行在 `http://localhost:3001`

### 分别启动

```bash
pnpm dev:frontend
pnpm dev:backend
```

## 数据库配置（MariaDB）

后端商品查询默认使用 MariaDB，默认 JDBC 连接串为：

```text
jdbc:mariadb://localhost:3306/farmer?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8
```

可通过以下环境变量覆盖：

- `DB_JDBC_URL`：JDBC 连接串（默认值如上）
- `DB_USER`：数据库用户名（默认 `root`）
- `DB_PASSWORD`：数据库密码（默认空字符串）
- `PRODUCT_TABLE`：商品表名（默认 `products`）
- `CATEGORY_TABLE`：商品分类表名（默认 `product_categories`）
- `CART_TABLE`：购物车表名（默认 `cart_items`）
- `ORDER_TABLE`：订单表名（默认 `orders`）
- `ORDER_ITEM_TABLE`：订单明细表名（默认 `order_items`）
- `USER_TABLE`：用户表名（默认 `users`）
- `USER_SESSION_TABLE`：登录会话表名（默认 `user_sessions`）
- `ADMIN_USERNAME`：默认管理员账号（默认 `admin`）
- `ADMIN_PASSWORD`：默认管理员密码（默认 `admin123456`）

示例表结构（供搜索与详情接口使用）：

```sql
CREATE TABLE products (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL
);
```

认证相关表（后端会在启动时自动创建，亦可手动创建）：

```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash CHAR(128) NOT NULL,
  password_salt CHAR(32) NOT NULL,
  nickname VARCHAR(128) NULL,
  phone VARCHAR(32) NULL,
  balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
  token CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_sessions_user_id (user_id),
  INDEX idx_user_sessions_expires_at (expires_at),
  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE product_categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  quantity INT NOT NULL,
  UNIQUE KEY uniq_cart_user_product (user_id, product_id)
);

CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL
);

CREATE TABLE order_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL
);
```

## 接口说明

### `GET /api/health`

用于检查后端服务状态，默认返回：

```json
{
  "ok": true,
  "service": "happy-farmer-backend",
  "database": "up"
}
```

在前端开发环境下，`/api` 请求会由 Vite 代理到 `http://localhost:3001`。

### `GET /api/products?keyword=关键词&category=分类名`

按商品名称模糊搜索，并支持按分类筛选。`keyword` 和 `category` 都为空时返回全部商品。

示例返回：

```json
{
  "keyword": "苹果",
  "category": "水果",
  "total": 1,
  "items": [
    {
      "id": "p-1004",
      "name": "精品红富士苹果",
      "category": "水果",
      "price": 12.8,
      "stock": 65
    }
  ]
}
```

### `GET /api/product-categories`

获取可筛选的商品分类列表。

### `GET /api/products/:id`

查询单个商品详情（包含商品描述）。

### `POST /api/auth/register`

用户注册。示例请求体：

```json
{
  "username": "demo_user",
  "password": "12345678",
  "nickname": "演示用户",
  "phone": "13800001111"
}
```

### `POST /api/auth/login`

用户登录，成功后返回 `token`（Bearer Token）。

### `POST /api/auth/logout`

用户安全退出（清理当前 token 会话）。

### `GET /api/users/me`

获取当前登录用户信息。请求头：

```text
Authorization: Bearer <token>
```

### `PUT /api/users/me`

更新当前用户资料（昵称、手机号）。

### `PUT /api/users/me/password`

修改当前用户密码。

### `GET /api/cart`

查看当前登录用户购物车。

### `POST /api/cart/items`

加入购物车。请求体示例：

```json
{
  "productId": "p-1001",
  "quantity": 1
}
```

### `PUT /api/cart/items/:productId`

更新购物车商品数量。

### `DELETE /api/cart/items/:productId`

从购物车删除商品。

### `POST /api/orders/submit`

提交购物车并生成订单编号（初始状态 `UNPAID`）。

### `POST /api/orders/:orderNo/pay`

支付订单：余额充足则扣减余额并完成支付，余额不足则返回失败。

### `GET /api/orders`

查询当前登录用户订单列表（含订单明细）。

### `GET /api/orders/:orderNo`

查询当前登录用户单个订单详情。

### 管理员接口（需管理员 token）

- `GET /api/admin/categories`：查询分类
- `POST /api/admin/categories`：新增分类
- `DELETE /api/admin/categories/:id`：删除分类（分类下有商品时禁止删除）
- `GET /api/admin/products`：查询商品
- `POST /api/admin/products`：新增商品（重复商品禁止新增）
- `DELETE /api/admin/products/:id`：删除商品
- `GET /api/admin/orders`：查询所有订单
- `GET /api/admin/users`：查询用户
- `PUT /api/admin/users/:id`：管理用户信息（昵称/手机号/余额/管理员角色）

## 业务功能介绍（需求）

### 前台功能

1. **搜索商品**  
   游客无需登录即可通过商品名称搜索商品，并可进入商品详情页查看商品剩余数量、基础信息等内容。

2. **分类查询**  
   用户可按商品分类进行筛选，快速定位目标商品类别。

3. **用户注册**  
   用户通过注册页面按提示填写正确信息后即可完成注册。

4. **用户登录**  
   注册用户输入正确账号和密码后登录系统，并自动跳转首页；账号或密码错误时给出提示并要求重新输入。

5. **更新信息**  
   用户登录后可查看和修改个人资料，也可修改账户密码。

6. **购物车**  
   用户登录后可将商品加入购物车，也可将购物车中的商品删除。

7. **提交订单**  
   用户可对购物车内商品提交订单。提交后系统自动生成订单编号；支付成功视为购买成功，若账户余额不足则无法支付。

8. **查看订单**  
   用户可根据自身需求查看个人订单信息。

### 后台功能

1. **商品类别管理**  
   管理员登录后台后可维护商品类别，如新增、删除商品类别等。

2. **商品管理**  
   管理员可新增或删除商品；若商品已存在，系统应提示不可重复添加。

3. **订单管理**  
   管理员可查询订单并查看全部订单信息。

4. **用户管理**  
   管理员可查询和维护用户基础信息。

5. **系统管理**  
   管理员可执行系统级管理操作，如修改登录密码、安全退出等。

## 构建

在仓库根目录执行：

```bash
pnpm build
```

该命令会递归构建 workspace 中的前后端应用。

## 常用脚本

### 根目录

- `pnpm dev`：并行启动所有应用的开发模式
- `pnpm build`：构建所有应用
- `pnpm format`：使用 Prettier 格式化整个仓库
- `pnpm format:check`：检查代码格式

### 后端

- `pnpm --filter @happy-farmer/backend dev`
- `pnpm --filter @happy-farmer/backend build`
- `pnpm --filter @happy-farmer/backend start`

### 前端

- `pnpm --filter @happy-farmer/frontend dev`
- `pnpm --filter @happy-farmer/frontend build`
- `pnpm --filter @happy-farmer/frontend preview`

## 当前功能

- 游客模式商品搜索：可按商品名称查询商品
- 分类查询：可按商品分类筛选商品
- 商品列表展示：分类、价格、库存信息
- 商品详情查看：可查看商品编号、库存、描述等信息
- 用户注册、登录、查看并更新个人资料、修改密码
- 购物车：加入商品、修改数量、删除商品
- 订单：提交订单生成订单号、支付订单、查看个人订单
- 后台：分类管理、商品管理、订单管理、用户管理、系统安全退出
- 提供后端健康检查、商品、用户、购物车、订单与后台管理接口
