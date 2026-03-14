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
