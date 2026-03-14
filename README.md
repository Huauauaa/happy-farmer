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

### `GET /api/products?keyword=关键词`

按商品名称进行模糊搜索。`keyword` 为空时返回全部商品。

示例返回：

```json
{
  "keyword": "苹果",
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

### `GET /api/products/:id`

查询单个商品详情（包含商品描述）。

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
- 商品列表展示：分类、价格、库存信息
- 商品详情查看：可查看商品编号、库存、描述等信息
- 提供后端健康检查与商品查询/详情接口
