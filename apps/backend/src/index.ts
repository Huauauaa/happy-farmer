import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import { config as loadDotenv } from 'dotenv';
import express from 'express';
import * as mariadb from 'mariadb';
import type { PoolConnection } from 'mariadb';
import { z } from 'zod';
import type { AppContext } from './modules/AppContext.js';
import {
  ApiError,
  adminCategoryCreatePayloadSchema,
  adminProductCreatePayloadSchema,
  adminSystemLogsQuerySchema,
  adminUserUpdatePayloadSchema,
  cartAddPayloadSchema,
  cartUpdatePayloadSchema,
  formatNullableTimestamp,
  formatTimestamp,
  generateOrderNo,
  getBearerToken,
  getQueryText,
  hashPassword,
  isApiError,
  loginPayloadSchema,
  nullableNicknameSchema,
  nullablePhoneSchema,
  parseJdbcUrl,
  parseWithSchema,
  passwordUpdatePayloadSchema,
  profileUpdatePayloadSchema,
  readErrorMessage,
  registerPayloadSchema,
  toNumber,
  toPositiveInt,
  verifyPassword,
} from './modules/backendCore.js';
import { registerAdminRoutes } from './modules/routes/adminRoutes.js';
import { registerAuthRoutes } from './modules/routes/authRoutes.js';
import { registerCartRoutes } from './modules/routes/cartRoutes.js';
import { registerOrderRoutes } from './modules/routes/orderRoutes.js';
import { registerProductsRoutes } from './modules/routes/productsRoutes.js';
import { registerUserRoutes } from './modules/routes/userRoutes.js';

const currentFileDir = dirname(fileURLToPath(import.meta.url));
const dotenvPaths = [
  resolve(process.cwd(), '.env'),
  resolve(currentFileDir, '..', '.env'),
  resolve(currentFileDir, '..', '..', '..', '.env'),
];
const loadedDotenvPaths = new Set<string>();
for (const envPath of dotenvPaths) {
  if (loadedDotenvPaths.has(envPath) || !existsSync(envPath)) {
    continue;
  }
  loadDotenv({ path: envPath, override: false });
  loadedDotenvPaths.add(envPath);
}

const serviceName = 'happy-farmer-backend';
const defaultJdbcUrl =
  'jdbc:mariadb://localhost:3306/farmer?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8';
const tableNameSchema = z.string().regex(/^[A-Za-z0-9_]+$/, '表名仅支持字母、数字和下划线');
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DB_JDBC_URL: z.string().min(1).default(defaultJdbcUrl),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().max(50).default(5),
  PRODUCT_TABLE: tableNameSchema.default('products'),
  CATEGORY_TABLE: tableNameSchema.default('product_categories'),
  CART_TABLE: tableNameSchema.default('cart_items'),
  ORDER_TABLE: tableNameSchema.default('orders'),
  ORDER_ITEM_TABLE: tableNameSchema.default('order_items'),
  SYSTEM_LOG_TABLE: tableNameSchema.default('system_logs'),
  USER_TABLE: tableNameSchema.default('users'),
  USER_SESSION_TABLE: tableNameSchema.default('user_sessions'),
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
const port = env.PORT;
const jdbcUrl = env.DB_JDBC_URL;
const dbUser = env.DB_USER;
const dbPassword = env.DB_PASSWORD;
const connectionLimit = env.DB_CONNECTION_LIMIT;
const rawProductTableName = env.PRODUCT_TABLE;
const rawCategoryTableName = env.CATEGORY_TABLE;
const rawCartTableName = env.CART_TABLE;
const rawOrderTableName = env.ORDER_TABLE;
const rawOrderItemTableName = env.ORDER_ITEM_TABLE;
const rawSystemLogTableName = env.SYSTEM_LOG_TABLE;
const rawUserTableName = env.USER_TABLE;
const rawSessionTableName = env.USER_SESSION_TABLE;

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

type ProductSummaryRow = {
  id: string | number;
  name: string;
  category: string;
  price: string | number;
  stock: string | number;
};

type ProductDetailRow = ProductSummaryRow & {
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

type UserCredentialRow = {
  id: string | number;
  username: string;
  nickname: string | null;
  phone: string | null;
  balance: string | number;
  is_admin: number;
  created_at: Date | string;
  password_hash: string;
  password_salt: string;
};

type UserPublicRow = Omit<UserCredentialRow, 'password_hash' | 'password_salt'>;

type CategoryRow = {
  id: string | number;
  name: string;
};

type CartRow = {
  product_id: string;
  quantity: string | number;
  name: string;
  category: string;
  price: string | number;
  stock: string | number;
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

type OrderRow = {
  id: string | number;
  order_no: string;
  user_id: string | number;
  total_amount: string | number;
  status: string;
  created_at: Date | string;
  paid_at: Date | string | null;
};

type OrderItemRow = {
  order_id: string | number;
  product_id: string;
  product_name: string;
  category: string;
  price: string | number;
  quantity: string | number;
  subtotal: string | number;
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

type SystemLogRow = {
  id: string | number;
  level: string;
  module: string;
  action: string;
  message: string;
  actor_user_id: string | number | null;
  created_at: Date | string;
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

const quoteIdentifier = (name: string) => `\`${name}\``;

const jdbcConfig = parseJdbcUrl(jdbcUrl);
const productTable = quoteIdentifier(rawProductTableName);
const categoryTable = quoteIdentifier(rawCategoryTableName);
const cartTable = quoteIdentifier(rawCartTableName);
const orderTable = quoteIdentifier(rawOrderTableName);
const orderItemTable = quoteIdentifier(rawOrderItemTableName);
const systemLogTable = quoteIdentifier(rawSystemLogTableName);
const userTable = quoteIdentifier(rawUserTableName);
const sessionTable = quoteIdentifier(rawSessionTableName);
const pool = mariadb.createPool({
  host: jdbcConfig.host,
  port: jdbcConfig.port,
  database: jdbcConfig.database,
  user: dbUser,
  password: dbPassword,
  connectionLimit,
  ssl: jdbcConfig.sslEnabled ? {} : undefined,
  timezone: jdbcConfig.timezone,
  charset: jdbcConfig.charset,
});

const sessionExpireDays = 7;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value !== null && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
};

const getString = (value: unknown): string => (typeof value === 'string' ? value : '');

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
};

const toProductSummary = (row: ProductSummaryRow): ProductSummary => ({
  id: String(row.id),
  name: row.name,
  category: row.category,
  price: toNumber(row.price),
  stock: toNumber(row.stock),
});

const toProductDetail = (row: ProductDetailRow): ProductDetail => ({
  ...toProductSummary(row),
  description: row.description,
});

const toUserPublic = (row: UserPublicRow): UserPublic => ({
  id: String(row.id),
  username: row.username,
  nickname: row.nickname,
  phone: row.phone,
  balance: toNumber(row.balance),
  isAdmin: row.is_admin === 1,
  createdAt: formatTimestamp(row.created_at),
});

const toCartItem = (row: CartRow): CartItem => {
  const quantity = toNumber(row.quantity);
  const price = toNumber(row.price);
  return {
    productId: row.product_id,
    name: row.name,
    category: row.category,
    price,
    stock: toNumber(row.stock),
    quantity,
    subtotal: price * quantity,
  };
};

const toOrderItem = (row: OrderItemRow): OrderItem => ({
  productId: row.product_id,
  productName: row.product_name,
  category: row.category,
  price: toNumber(row.price),
  quantity: toNumber(row.quantity),
  subtotal: toNumber(row.subtotal),
});

const toUserOrder = (order: OrderRow, items: OrderItem[]): UserOrder => ({
  orderNo: order.order_no,
  totalAmount: toNumber(order.total_amount),
  status: order.status,
  createdAt: formatTimestamp(order.created_at),
  paidAt: formatNullableTimestamp(order.paid_at),
  items,
});

const toSystemLogItem = (row: SystemLogRow): SystemLogItem => ({
  id: String(row.id),
  level: row.level,
  module: row.module,
  action: row.action,
  message: row.message,
  actorUserId: row.actor_user_id === null ? null : String(row.actor_user_id),
  createdAt: formatTimestamp(row.created_at),
});

const withConnection = async <T>(handler: (connection: PoolConnection) => Promise<T>) => {
  const connection = await pool.getConnection();
  try {
    return await handler(connection);
  } finally {
    connection.release();
  }
};

const appendSystemLog = async (params: {
  level: 'INFO' | 'WARN' | 'ERROR';
  module: string;
  action: string;
  message: string;
  actorUserId?: string | number | null;
}) => {
  const actorUserId = params.actorUserId ?? null;
  await withConnection(async (connection) => {
    await connection.query(
      `
        INSERT INTO ${systemLogTable}
        (level, module, action, message, actor_user_id)
        VALUES (?, ?, ?, ?, ?)
      `,
      [params.level, params.module, params.action, params.message, actorUserId],
    );
  });
};

const appendSystemLogSafely = async (params: {
  level: 'INFO' | 'WARN' | 'ERROR';
  module: string;
  action: string;
  message: string;
  actorUserId?: string | number | null;
}) => {
  try {
    await appendSystemLog(params);
  } catch {
    // Logging should never break business API responses.
  }
};

const adminSeedUsername = env.ADMIN_USERNAME;
const adminSeedPassword = env.ADMIN_PASSWORD;

const ensureAppTables = async () => {
  await withConnection(async (connection) => {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${productTable} (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        description TEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${categoryTable} (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${userTable} (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const userIsAdminColumnRows = (await connection.query(
      `
        SELECT COUNT(1) AS total
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND COLUMN_NAME = 'is_admin'
      `,
      [jdbcConfig.database, rawUserTableName],
    )) as Array<{ total: string | number }>;

    if (toNumber(userIsAdminColumnRows[0]?.total ?? 0) === 0) {
      await connection.query(
        `ALTER TABLE ${userTable} ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0`,
      );
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${sessionTable} (
        token CHAR(64) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_sessions_user_id (user_id),
        INDEX idx_user_sessions_expires_at (expires_at),
        CONSTRAINT fk_user_sessions_user
          FOREIGN KEY (user_id) REFERENCES ${userTable}(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${cartTable} (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        quantity INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_cart_user_product (user_id, product_id),
        INDEX idx_cart_user_id (user_id),
        CONSTRAINT fk_cart_user
          FOREIGN KEY (user_id) REFERENCES ${userTable}(id) ON DELETE CASCADE,
        CONSTRAINT fk_cart_product
          FOREIGN KEY (product_id) REFERENCES ${productTable}(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${orderTable} (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        order_no VARCHAR(40) NOT NULL UNIQUE,
        user_id BIGINT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        paid_at DATETIME NULL,
        INDEX idx_orders_user_id (user_id),
        CONSTRAINT fk_orders_user
          FOREIGN KEY (user_id) REFERENCES ${userTable}(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${orderItemTable} (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        order_id BIGINT NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        quantity INT NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        INDEX idx_order_items_order_id (order_id),
        CONSTRAINT fk_order_items_order
          FOREIGN KEY (order_id) REFERENCES ${orderTable}(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${systemLogTable} (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        level VARCHAR(20) NOT NULL,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        message VARCHAR(500) NOT NULL,
        actor_user_id BIGINT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_system_logs_created_at (created_at),
        INDEX idx_system_logs_actor_user_id (actor_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      INSERT IGNORE INTO ${categoryTable} (name)
      SELECT DISTINCT category FROM ${productTable}
      WHERE category IS NOT NULL AND category <> '';
    `);
  });
};

const seedDefaultAdmin = async () => {
  const existingAdmins = await withConnection(async (connection) => {
    return (await connection.query(
      `SELECT id FROM ${userTable} WHERE is_admin = 1 LIMIT 1`,
    )) as Array<{
      id: number;
    }>;
  });

  if (existingAdmins.length > 0) {
    return;
  }

  const { hash, salt } = hashPassword(adminSeedPassword);
  await withConnection(async (connection) => {
    const sameUsernameRows = (await connection.query(
      `SELECT id FROM ${userTable} WHERE username = ? LIMIT 1`,
      [adminSeedUsername],
    )) as Array<{ id: number }>;
    if (sameUsernameRows.length > 0) {
      await connection.query(
        `UPDATE ${userTable} SET is_admin = 1, password_hash = ?, password_salt = ? WHERE id = ?`,
        [hash, salt, sameUsernameRows[0].id],
      );
      return;
    }

    await connection.query(
      `
        INSERT INTO ${userTable} (username, password_hash, password_salt, nickname, is_admin, balance)
        VALUES (?, ?, ?, ?, 1, 10000)
      `,
      [adminSeedUsername, hash, salt, '系统管理员'],
    );
  });
};

const findUserByToken = async (token: string): Promise<UserPublicRow | null> => {
  const rows = await withConnection(async (connection) => {
    return (await connection.query(
      `
        SELECT
          u.id,
          u.username,
          u.nickname,
          u.phone,
          u.balance,
          u.is_admin,
          u.created_at
        FROM ${userTable} u
        INNER JOIN ${sessionTable} s ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > NOW()
        LIMIT 1
      `,
      [token],
    )) as UserPublicRow[];
  });

  return rows[0] ?? null;
};

const requireAuth = async (
  authorizationHeader: string | undefined,
): Promise<{ token: string; user: UserPublicRow } | null> => {
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

const requireAdminAuth = async (
  authorizationHeader: string | undefined,
): Promise<{ token: string; user: UserPublicRow } | null> => {
  const auth = await requireAuth(authorizationHeader);
  if (!auth || auth.user.is_admin !== 1) {
    return null;
  }
  return auth;
};

const fetchCartItems = async (userId: string | number): Promise<CartItem[]> => {
  const rows = await withConnection(async (connection) => {
    return (await connection.query(
      `
        SELECT
          c.product_id,
          c.quantity,
          p.name,
          p.category,
          p.price,
          p.stock
        FROM ${cartTable} c
        INNER JOIN ${productTable} p ON p.id = c.product_id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `,
      [userId],
    )) as CartRow[];
  });

  return rows.map(toCartItem);
};

const fetchUserOrders = async (userId: string | number): Promise<UserOrder[]> => {
  const orderRows = await withConnection(async (connection) => {
    return (await connection.query(
      `
        SELECT id, order_no, user_id, total_amount, status, created_at, paid_at
        FROM ${orderTable}
        WHERE user_id = ?
        ORDER BY created_at DESC
      `,
      [userId],
    )) as OrderRow[];
  });

  if (orderRows.length === 0) {
    return [];
  }

  const orderIds = orderRows.map((row) => row.id);
  const placeholders = orderIds.map(() => '?').join(', ');
  const itemRows = await withConnection(async (connection) => {
    return (await connection.query(
      `
        SELECT order_id, product_id, product_name, category, price, quantity, subtotal
        FROM ${orderItemTable}
        WHERE order_id IN (${placeholders})
        ORDER BY id
      `,
      orderIds,
    )) as OrderItemRow[];
  });

  const itemsByOrderId = new Map<string, OrderItem[]>();
  for (const row of itemRows) {
    const key = String(row.order_id);
    const existing = itemsByOrderId.get(key) ?? [];
    existing.push(toOrderItem(row));
    itemsByOrderId.set(key, existing);
  }

  return orderRows.map((order) => {
    const key = String(order.id);
    return toUserOrder(order, itemsByOrderId.get(key) ?? []);
  });
};

const appContext: AppContext = {
  app,
  serviceName,
  tableNames: {
    productTable,
    categoryTable,
    cartTable,
    orderTable,
    orderItemTable,
    systemLogTable,
    userTable,
    sessionTable,
  },
  sessionExpireDays,
  pool,
  ApiError,
  db: {
    withConnection,
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
    await ensureAppTables();
    await seedDefaultAdmin();
    console.log(
      `Database: ${jdbcConfig.host}:${jdbcConfig.port}/${jdbcConfig.database} tables={products:${rawProductTableName}, categories:${rawCategoryTableName}, carts:${rawCartTableName}, orders:${rawOrderTableName}, orderItems:${rawOrderItemTableName}, users:${rawUserTableName}, sessions:${rawSessionTableName}, systemLogs:${rawSystemLogTableName}}`,
    );
    console.log(`Default admin username: ${adminSeedUsername}`);
    app.listen(port, () => {
      console.log(`Backend listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start backend server:', readErrorMessage(error));
    process.exit(1);
  }
};

void startServer();
