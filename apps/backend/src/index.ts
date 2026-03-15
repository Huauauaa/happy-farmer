import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { ensureDatabaseUrl, loadBackendEnv } from './lib/databaseUrl.js';
import { Prisma, PrismaClient } from './generated/prisma/client.js';
import type { AppContext } from './modules/AppContext.js';
import { registerAdminRoutes } from './modules/routes/adminRoutes.js';
import { registerAuthRoutes } from './modules/routes/authRoutes.js';
import { registerCartRoutes } from './modules/routes/cartRoutes.js';
import { registerOrderRoutes } from './modules/routes/orderRoutes.js';
import { registerProductsRoutes } from './modules/routes/productsRoutes.js';
import { registerUserRoutes } from './modules/routes/userRoutes.js';

loadBackendEnv();
process.env.DB_CONNECTION_LIMIT = process.env.DB_CONNECTION_LIMIT?.trim() || '5';
const databaseUrl = ensureDatabaseUrl();

const serviceName = 'happy-farmer-backend';
const sessionExpireDays = 7;

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().max(50).default(5),
  ADMIN_USERNAME: z
    .string()
    .regex(/^[A-Za-z0-9_]{3,32}$/, '管理员账号需为 3-32 位字母/数字/下划线')
    .default('admin'),
  ADMIN_PASSWORD: z
    .string()
    .min(6, '管理员密码至少 6 位')
    .max(64, '管理员密码最多 64 位')
    .default('admin123456'),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  const issue = parsedEnv.error.issues[0];
  throw new Error(
    `Invalid environment configuration: ${issue.path.join('.') || 'unknown'} ${issue.message}`,
  );
}

const env = parsedEnv.data;
const app = express();
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseUrl),
});

app.use(cors());
app.use(express.json());

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

type UserPublic = {
  id: string;
  username: string;
  nickname: string | null;
  phone: string | null;
  balance: number;
  isAdmin: boolean;
  createdAt: string;
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

type SystemLogItem = {
  id: string;
  level: string;
  module: string;
  action: string;
  message: string;
  actorUserId: string | null;
  createdAt: string;
};

const userPublicSelect = {
  id: true,
  username: true,
  nickname: true,
  phone: true,
  balance: true,
  isAdmin: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type UserPublicRecord = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const getQueryText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }
  return '';
};

const toNumber = (value: unknown): number => {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
};

const toDatabaseId = (value: string | number | bigint): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }
  return BigInt(value);
};

const formatTimestamp = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const formatNullableTimestamp = (value: Date | string | null): string | null => {
  if (value === null) {
    return null;
  }
  return formatTimestamp(value);
};

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,32}$/, '用户名需为 3-32 位，仅可包含字母、数字、下划线');
const passwordSchema = z
  .string()
  .min(6, '密码长度需在 6 到 64 位之间')
  .max(64, '密码长度需在 6 到 64 位之间');
const phoneRegex = /^[0-9+\- ]{6,32}$/;
const nullablePhoneSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || phoneRegex.test(value), '手机号格式不正确');
const nullableNicknameSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || value.length <= 128, '昵称最长 128 个字符');
const positiveIntSchema = z.coerce.number().int().positive('数量必须为正整数');
const zodErrorMessage = (error: z.ZodError): string => error.issues[0]?.message ?? '请求参数不合法';
const parseWithSchema = <S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, zodErrorMessage(parsed.error));
  }
  return parsed.data;
};

const registerPayloadSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  nickname: z.string().optional().default('').pipe(nullableNicknameSchema),
  phone: z.string().optional().default('').pipe(nullablePhoneSchema),
});
const loginPayloadSchema = z.object({
  username: z.string().trim().min(1, '账号和密码不能为空'),
  password: z.string().min(1, '账号和密码不能为空'),
});
const profileUpdatePayloadSchema = z
  .object({
    nickname: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine(
    (payload) => payload.nickname !== undefined || payload.phone !== undefined,
    '至少传入一个可更新字段',
  );
const passwordUpdatePayloadSchema = z.object({
  currentPassword: z.string().min(1, '当前密码和新密码不能为空'),
  newPassword: passwordSchema,
});
const cartAddPayloadSchema = z.object({
  productId: z.string().trim().min(1, '商品编号不能为空'),
  quantity: positiveIntSchema.default(1),
});
const cartUpdatePayloadSchema = z.object({
  quantity: positiveIntSchema,
});
const adminCategoryCreatePayloadSchema = z.object({
  name: z.string().trim().min(1, '分类名称不能为空'),
});
const adminProductCreatePayloadSchema = z.object({
  id: z.string().trim().min(1, '商品编号不能为空'),
  name: z.string().trim().min(1, '商品名称不能为空'),
  category: z.string().trim().min(1, '商品分类不能为空'),
  description: z.string().trim().min(1, '商品描述不能为空'),
  price: z.coerce.number().positive('商品价格必须大于 0'),
  stock: z.coerce.number().int('库存必须是非负整数').min(0, '库存必须是非负整数'),
});
const adminUserUpdatePayloadSchema = z
  .object({
    nickname: z.string().optional(),
    phone: z.string().optional(),
    balance: z.coerce.number().min(0, '余额必须是非负数').optional(),
    isAdmin: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
  .refine(
    (payload) =>
      payload.nickname !== undefined ||
      payload.phone !== undefined ||
      payload.balance !== undefined ||
      payload.isAdmin !== undefined,
    '至少传入一个更新字段',
  );
const adminSystemLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
};

const verifyPassword = (password: string, salt: string, expectedHash: string): boolean => {
  const hash = scryptSync(password, salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(hash, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
};

const toProductSummary = (row: {
  id: string;
  name: string;
  category: string;
  price: Prisma.Decimal | number | string;
  stock: number;
}): ProductSummary => ({
  id: row.id,
  name: row.name,
  category: row.category,
  price: toNumber(row.price),
  stock: row.stock,
});

const toProductDetail = (row: {
  id: string;
  name: string;
  category: string;
  price: Prisma.Decimal | number | string;
  stock: number;
  description: string;
}): ProductDetail => ({
  ...toProductSummary(row),
  description: row.description,
});

const toUserPublic = (row: UserPublicRecord): UserPublic => ({
  id: String(row.id),
  username: row.username,
  nickname: row.nickname,
  phone: row.phone,
  balance: toNumber(row.balance),
  isAdmin: row.isAdmin,
  createdAt: formatTimestamp(row.createdAt),
});

const toSystemLogItem = (row: {
  id: bigint;
  level: string;
  module: string;
  action: string;
  message: string;
  actorUserId: bigint | null;
  createdAt: Date | string;
}): SystemLogItem => ({
  id: String(row.id),
  level: row.level,
  module: row.module,
  action: row.action,
  message: row.message,
  actorUserId: row.actorUserId === null ? null : String(row.actorUserId),
  createdAt: formatTimestamp(row.createdAt),
});

const toOrderItem = (row: {
  productId: string;
  productName: string;
  category: string;
  price: Prisma.Decimal | number | string;
  quantity: number;
  subtotal: Prisma.Decimal | number | string;
}): OrderItem => ({
  productId: row.productId,
  productName: row.productName,
  category: row.category,
  price: toNumber(row.price),
  quantity: row.quantity,
  subtotal: toNumber(row.subtotal),
});

const toUserOrder = (order: {
  orderNo: string;
  totalAmount: Prisma.Decimal | number | string;
  status: string;
  createdAt: Date | string;
  paidAt: Date | string | null;
  items: Array<{
    productId: string;
    productName: string;
    category: string;
    price: Prisma.Decimal | number | string;
    quantity: number;
    subtotal: Prisma.Decimal | number | string;
  }>;
}): UserOrder => ({
  orderNo: order.orderNo,
  totalAmount: toNumber(order.totalAmount),
  status: order.status,
  createdAt: formatTimestamp(order.createdAt),
  paidAt: formatNullableTimestamp(order.paidAt),
  items: order.items.map(toOrderItem),
});

const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
};

const generateOrderNo = (): string => {
  const timePart = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);
  const randomPart = randomBytes(3).toString('hex').toUpperCase();
  return `OD${timePart}${randomPart}`;
};

const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

const getBearerToken = (header: string | undefined): string | null => {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token.trim() === '' ? null : token.trim();
};

const readErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

const appendSystemLogSafely = async (params: {
  level: 'INFO' | 'WARN' | 'ERROR';
  module: string;
  action: string;
  message: string;
  actorUserId?: string | number | null;
}) => {
  try {
    await prisma.systemLog.create({
      data: {
        level: params.level,
        module: params.module,
        action: params.action,
        message: params.message,
        actorUserId:
          params.actorUserId === undefined || params.actorUserId === null
            ? null
            : toDatabaseId(params.actorUserId),
      },
    });
  } catch {
    // Logging should never break business API responses.
  }
};

const syncCategoryCatalogFromProducts = async () => {
  const productCategories = await prisma.product.findMany({
    where: {
      category: {
        not: '',
      },
    },
    distinct: ['category'],
    select: {
      category: true,
    },
  });

  for (const item of productCategories) {
    await prisma.productCategory.upsert({
      where: { name: item.category },
      update: {},
      create: { name: item.category },
    });
  }
};

const seedDefaultAdmin = async () => {
  const existingAdmin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { id: true },
  });
  if (existingAdmin) {
    return;
  }

  const { hash, salt } = hashPassword(env.ADMIN_PASSWORD);
  const sameUsernameUser = await prisma.user.findUnique({
    where: { username: env.ADMIN_USERNAME },
    select: { id: true },
  });

  if (sameUsernameUser) {
    await prisma.user.update({
      where: { id: sameUsernameUser.id },
      data: {
        isAdmin: true,
        passwordHash: hash,
        passwordSalt: salt,
      },
    });
    return;
  }

  await prisma.user.create({
    data: {
      username: env.ADMIN_USERNAME,
      passwordHash: hash,
      passwordSalt: salt,
      nickname: '系统管理员',
      isAdmin: true,
      balance: 10000,
    },
  });
};

const findUserByToken = async (token: string) => {
  const session = await prisma.userSession.findFirst({
    where: {
      token,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      user: {
        select: userPublicSelect,
      },
    },
  });

  return session?.user ? toUserPublic(session.user) : null;
};

const requireAuth = async (authorizationHeader: string | undefined) => {
  const token = getBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }

  const user = await findUserByToken(token);
  if (!user) {
    return null;
  }

  return { token, user };
};

const requireAdminAuth = async (authorizationHeader: string | undefined) => {
  const auth = await requireAuth(authorizationHeader);
  if (!auth || !auth.user.isAdmin) {
    return null;
  }
  return auth;
};

const fetchCartItems = async (userId: string | number) => {
  const rows = await prisma.cartItem.findMany({
    where: {
      userId: toDatabaseId(userId),
    },
    include: {
      product: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return rows.map((row) => {
    const price = toNumber(row.product.price);
    return {
      productId: row.productId,
      name: row.product.name,
      category: row.product.category,
      price,
      stock: row.product.stock,
      quantity: row.quantity,
      subtotal: price * row.quantity,
    };
  });
};

const fetchUserOrders = async (userId: string | number) => {
  const rows = await prisma.order.findMany({
    where: {
      userId: toDatabaseId(userId),
    },
    include: {
      items: {
        orderBy: {
          id: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return rows.map(toUserOrder);
};

const appContext: AppContext = {
  app,
  prisma,
  serviceName,
  sessionExpireDays,
  ApiError,
  db: {
    appendSystemLogSafely,
  },
  auth: {
    findUserByToken,
    requireAuth,
    requireAdminAuth,
  },
  schemas: {
    registerPayloadSchema,
    loginPayloadSchema,
    profileUpdatePayloadSchema,
    passwordUpdatePayloadSchema,
    cartAddPayloadSchema,
    cartUpdatePayloadSchema,
    adminCategoryCreatePayloadSchema,
    adminProductCreatePayloadSchema,
    adminUserUpdatePayloadSchema,
    adminSystemLogsQuerySchema,
    nullableNicknameSchema,
    nullablePhoneSchema,
  },
  helpers: {
    parseWithSchema: parseWithSchema as (schema: unknown, value: unknown) => any,
    isApiError,
    readErrorMessage,
    getQueryText,
    getBearerToken,
    toNumber,
    formatTimestamp,
    formatNullableTimestamp,
    toPositiveInt,
    hashPassword,
    verifyPassword,
    generateOrderNo,
  },
  mappers: {
    toProductSummary,
    toProductDetail,
    toUserPublic,
    toSystemLogItem,
    toOrderItem,
    toUserOrder,
  },
  queries: {
    fetchCartItems,
    fetchUserOrders,
  },
};

registerProductsRoutes(appContext);
registerAuthRoutes(appContext);
registerUserRoutes(appContext);
registerCartRoutes(appContext);
registerOrderRoutes(appContext);
registerAdminRoutes(appContext);

const startServer = async () => {
  try {
    await prisma.$connect();
    await syncCategoryCatalogFromProducts();
    await seedDefaultAdmin();

    const parsedDatabaseUrl = new URL(databaseUrl);
    console.log(`Database: ${parsedDatabaseUrl.host}${parsedDatabaseUrl.pathname}`);
    console.log(`Default admin username: ${env.ADMIN_USERNAME}`);
    app.listen(env.PORT, () => {
      console.log(`Backend listening on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backend server:', readErrorMessage(error));
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  }
};

const shutdown = async () => {
  await prisma.$disconnect().catch(() => undefined);
};

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});

void startServer();
