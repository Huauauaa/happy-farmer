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

## 接口说明

### `GET /api/health`

用于检查后端服务状态，默认返回：

```json
{
  "ok": true,
  "service": "happy-farmer-backend"
}
```

在前端开发环境下，`/api` 请求会由 Vite 代理到 `http://localhost:3001`。

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

- 前端页面展示项目技术栈信息
- 页面加载时自动请求后端健康检查接口
- 支持手动重新发起健康检查
