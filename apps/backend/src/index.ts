import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import { config as loadDotenv } from 'dotenv';
import express from 'express';
import * as mariadb from 'mariadb';
import type { PoolConnection } from 'mariadb';

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

const app = express();
const port = Number(process.env.PORT ?? 3001);
const serviceName = 'happy-farmer-backend';
const defaultJdbcUrl =
  'jdbc:mariadb://localhost:3306/farmer?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8';
const jdbcUrl = process.env.DB_JDBC_URL ?? defaultJdbcUrl;
const dbUser = process.env.DB_USER ?? 'root';
const dbPassword = process.env.DB_PASSWORD ?? '';
const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT ?? 5);
const rawProductTableName = process.env.PRODUCT_TABLE ?? 'products';
const rawCategoryTableName = process.env.CATEGORY_TABLE ?? 'product_categories';
const rawCartTableName = process.env.CART_TABLE ?? 'cart_items';
const rawOrderTableName = process.env.ORDER_TABLE ?? 'orders';
const rawOrderItemTableName = process.env.ORDER_ITEM_TABLE ?? 'order_items';
const rawSystemLogTableName = process.env.SYSTEM_LOG_TABLE ?? 'system_logs';
const rawUserTableName = process.env.USER_TABLE ?? 'users';
const rawSessionTableName = process.env.USER_SESSION_TABLE ?? 'user_sessions';

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

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const parseJdbcUrl = (value: string) => {
  const normalized = value.startsWith('jdbc:') ? value.slice('jdbc:'.length) : value;
  const url = new URL(normalized);
  if (url.protocol !== 'mariadb:') {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }

  const database = url.pathname.replace(/^\/+/, '');
  if (!database) {
    throw new Error('Database name is required in DB_JDBC_URL');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    database,
    sslEnabled: url.searchParams.get('useSSL') === 'true',
    timezone: url.searchParams.get('serverTimezone') ?? undefined,
    charset: url.searchParams.get('characterEncoding') ?? undefined,
  };
};

const assertValidIdentifier = (name: string, envName: string) => {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`${envName} only allows letters, numbers and underscores`);
  }
};

const quoteIdentifier = (name: string) => `\`${name}\``;

assertValidIdentifier(rawProductTableName, 'PRODUCT_TABLE');
assertValidIdentifier(rawCategoryTableName, 'CATEGORY_TABLE');
assertValidIdentifier(rawCartTableName, 'CART_TABLE');
assertValidIdentifier(rawOrderTableName, 'ORDER_TABLE');
assertValidIdentifier(rawOrderItemTableName, 'ORDER_ITEM_TABLE');
assertValidIdentifier(rawSystemLogTableName, 'SYSTEM_LOG_TABLE');
assertValidIdentifier(rawUserTableName, 'USER_TABLE');
assertValidIdentifier(rawSessionTableName, 'USER_SESSION_TABLE');

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
  connectionLimit: Number.isNaN(connectionLimit) ? 5 : connectionLimit,
  ssl: jdbcConfig.sslEnabled ? {} : undefined,
  timezone: jdbcConfig.timezone,
  charset: jdbcConfig.charset,
});

const sessionExpireDays = 7;

const getQueryText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }
  return '';
};

const toNumber = (value: string | number): number => {
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
};

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

const formatTimestamp = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const validateUsername = (username: string): string | null => {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
    return '用户名需为 3-32 位，仅可包含字母、数字、下划线';
  }
  return null;
};

const validatePassword = (password: string): string | null => {
  if (password.length < 6 || password.length > 64) {
    return '密码长度需在 6 到 64 位之间';
  }
  return null;
};

const validatePhone = (phone: string | null): string | null => {
  if (phone === null) {
    return null;
  }
  if (!/^[0-9+\- ]{6,32}$/.test(phone)) {
    return '手机号格式不正确';
  }
  return null;
};

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

const formatNullableTimestamp = (value: Date | string | null): string | null => {
  if (value === null) {
    return null;
  }
  return formatTimestamp(value);
};

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
  const timePart = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
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

const adminSeedUsername = process.env.ADMIN_USERNAME ?? 'admin';
const adminSeedPassword = process.env.ADMIN_PASSWORD ?? 'admin123456';

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

    await connection.query(
      `ALTER TABLE ${userTable} ADD COLUMN IF NOT EXISTS is_admin TINYINT(1) NOT NULL DEFAULT 0`,
    );

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
    return (await connection.query(`SELECT id FROM ${userTable} WHERE is_admin = 1 LIMIT 1`)) as Array<{
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

app.get('/api/health', async (_req, res) => {
  try {
    await withConnection(async (connection) => {
      await connection.query('SELECT 1');
    });
    res.json({ ok: true, service: serviceName, database: 'up' });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: serviceName,
      database: 'down',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/products', async (req, res) => {
  const keyword = getQueryText(req.query.keyword);
  const category = getQueryText(req.query.category);
  const conditions: string[] = [];
  const params: string[] = [];

  if (keyword !== '') {
    conditions.push('name LIKE ?');
    params.push(`%${keyword}%`);
  }
  if (category !== '') {
    conditions.push('category = ?');
    params.push(category);
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const querySql = `SELECT id, name, category, price, stock FROM ${productTable}${whereClause} ORDER BY id`;

  try {
    const rows = await withConnection(async (connection) => {
      return (await connection.query(querySql, params)) as ProductSummaryRow[];
    });
    const items = rows.map(toProductSummary);
    res.json({
      keyword,
      category,
      total: items.length,
      items,
    });
  } catch (error) {
    res.status(500).json({
      message: '商品查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/product-categories', async (_req, res) => {
  try {
    const rows = await withConnection(async (connection) => {
      return (await connection.query(
        `
          SELECT DISTINCT name AS category FROM ${categoryTable}
          UNION
          SELECT DISTINCT category FROM ${productTable}
          WHERE category IS NOT NULL AND category <> ''
          ORDER BY category
        `,
      )) as Array<{ category: string }>;
    });

    res.json({
      items: rows.map((row) => row.category),
    });
  } catch (error) {
    res.status(500).json({
      message: '分类查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await withConnection(async (connection) => {
      return (await connection.query(
        `SELECT id, name, category, price, stock, description FROM ${productTable} WHERE id = ? LIMIT 1`,
        [id],
      )) as ProductDetailRow[];
    });

    const row = rows[0];
    if (!row) {
      res.status(404).json({ message: '商品不存在' });
      return;
    }

    res.json(toProductDetail(row));
  } catch (error) {
    res.status(500).json({
      message: '商品详情查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const payload = asRecord(req.body);
  const username = getString(payload.username).trim();
  const password = getString(payload.password);
  const nickname = normalizeOptionalText(payload.nickname);
  const phone = normalizeOptionalText(payload.phone);

  const usernameError = validateUsername(username);
  if (usernameError) {
    res.status(400).json({ message: usernameError });
    return;
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    res.status(400).json({ message: passwordError });
    return;
  }

  const phoneError = validatePhone(phone);
  if (phoneError) {
    res.status(400).json({ message: phoneError });
    return;
  }

  try {
    const existingUsers = await withConnection(async (connection) => {
      return (await connection.query(`SELECT id FROM ${userTable} WHERE username = ? LIMIT 1`, [
        username,
      ])) as Array<{ id: number }>;
    });

    if (existingUsers.length > 0) {
      res.status(409).json({ message: '用户名已存在' });
      return;
    }

    const { hash, salt } = hashPassword(password);

    await withConnection(async (connection) => {
      await connection.query(
        `
          INSERT INTO ${userTable}
          (username, password_hash, password_salt, nickname, phone)
          VALUES (?, ?, ?, ?, ?)
        `,
        [username, hash, salt, nickname, phone],
      );
    });

    await appendSystemLogSafely({
      level: 'INFO',
      module: 'auth',
      action: 'register',
      message: `用户注册成功: ${username}`,
    });

    res.status(201).json({ message: '注册成功' });
  } catch (error) {
    res.status(500).json({
      message: '注册失败',
      error: readErrorMessage(error),
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const payload = asRecord(req.body);
  const username = getString(payload.username).trim();
  const password = getString(payload.password);

  if (username === '' || password === '') {
    res.status(400).json({ message: '账号和密码不能为空' });
    return;
  }

  try {
    const userRows = await withConnection(async (connection) => {
      return (await connection.query(
        `
          SELECT
            id,
            username,
            nickname,
            phone,
            balance,
            is_admin,
            created_at,
            password_hash,
            password_salt
          FROM ${userTable}
          WHERE username = ?
          LIMIT 1
        `,
        [username],
      )) as UserCredentialRow[];
    });

    const user = userRows[0];
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      res.status(401).json({ message: '账号或密码错误' });
      return;
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + sessionExpireDays * 24 * 60 * 60 * 1000);

    await withConnection(async (connection) => {
      await connection.query(
        `INSERT INTO ${sessionTable} (token, user_id, expires_at) VALUES (?, ?, ?)`,
        [token, user.id, expiresAt],
      );
      await connection.query(`DELETE FROM ${sessionTable} WHERE user_id = ? AND expires_at <= NOW()`, [
        user.id,
      ]);
    });

    await appendSystemLogSafely({
      level: 'INFO',
      module: 'auth',
      action: 'login',
      message: `用户登录成功: ${user.username}`,
      actorUserId: user.id,
    });

    res.json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: toUserPublic(user),
    });
  } catch (error) {
    res.status(500).json({
      message: '登录失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/users/me', async (req, res) => {
  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    res.json({ user: toUserPublic(auth.user) });
  } catch (error) {
    res.status(500).json({
      message: '获取用户信息失败',
      error: readErrorMessage(error),
    });
  }
});

app.put('/api/users/me', async (req, res) => {
  const payload = asRecord(req.body);
  const hasNickname = Object.prototype.hasOwnProperty.call(payload, 'nickname');
  const hasPhone = Object.prototype.hasOwnProperty.call(payload, 'phone');
  const nickname = normalizeOptionalText(payload.nickname);
  const phone = normalizeOptionalText(payload.phone);

  if (!hasNickname && !hasPhone) {
    res.status(400).json({ message: '至少传入一个可更新字段' });
    return;
  }

  if (nickname !== null && nickname.length > 128) {
    res.status(400).json({ message: '昵称最长 128 个字符' });
    return;
  }

  const phoneError = validatePhone(phone);
  if (hasPhone && phoneError) {
    res.status(400).json({ message: phoneError });
    return;
  }

  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    const updates: string[] = [];
    const params: Array<string | number | null> = [];
    if (hasNickname) {
      updates.push('nickname = ?');
      params.push(nickname);
    }
    if (hasPhone) {
      updates.push('phone = ?');
      params.push(phone);
    }
    params.push(auth.user.id);

    await withConnection(async (connection) => {
      await connection.query(`UPDATE ${userTable} SET ${updates.join(', ')} WHERE id = ?`, params);
    });

    const refreshedUser = await findUserByToken(auth.token);
    if (!refreshedUser) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    res.json({
      message: '个人信息更新成功',
      user: toUserPublic(refreshedUser),
    });
  } catch (error) {
    res.status(500).json({
      message: '更新个人信息失败',
      error: readErrorMessage(error),
    });
  }
});

app.put('/api/users/me/password', async (req, res) => {
  const payload = asRecord(req.body);
  const currentPassword = getString(payload.currentPassword);
  const newPassword = getString(payload.newPassword);

  if (currentPassword === '' || newPassword === '') {
    res.status(400).json({ message: '当前密码和新密码不能为空' });
    return;
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    res.status(400).json({ message: passwordError });
    return;
  }

  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    const userRows = await withConnection(async (connection) => {
      return (await connection.query(
        `SELECT id, password_hash, password_salt FROM ${userTable} WHERE id = ? LIMIT 1`,
        [auth.user.id],
      )) as Array<{ id: number; password_hash: string; password_salt: string }>;
    });

    const user = userRows[0];
    if (!user || !verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
      res.status(400).json({ message: '当前密码错误' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    await withConnection(async (connection) => {
      await connection.query(
        `UPDATE ${userTable} SET password_hash = ?, password_salt = ? WHERE id = ?`,
        [hash, salt, auth.user.id],
      );
      await connection.query(`DELETE FROM ${sessionTable} WHERE user_id = ? AND token <> ?`, [
        auth.user.id,
        auth.token,
      ]);
    });

    res.json({ message: '密码修改成功' });
  } catch (error) {
    res.status(500).json({
      message: '修改密码失败',
      error: readErrorMessage(error),
    });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = getBearerToken(req.header('authorization'));
    if (!token) {
      res.json({ message: '已退出登录' });
      return;
    }

    await withConnection(async (connection) => {
      await connection.query(`DELETE FROM ${sessionTable} WHERE token = ?`, [token]);
    });

    await appendSystemLogSafely({
      level: 'INFO',
      module: 'auth',
      action: 'logout',
      message: '用户安全退出',
    });

    res.json({ message: '已退出登录' });
  } catch (error) {
    res.status(500).json({
      message: '退出登录失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/cart', async (req, res) => {
  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    const items = await fetchCartItems(auth.user.id);
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    res.json({
      total: items.length,
      totalAmount,
      items,
    });
  } catch (error) {
    res.status(500).json({
      message: '购物车查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.post('/api/cart/items', async (req, res) => {
  const payload = asRecord(req.body);
  const productId = getString(payload.productId).trim();
  const quantity = toPositiveInt(payload.quantity) ?? 1;

  if (productId === '') {
    res.status(400).json({ message: '商品编号不能为空' });
    return;
  }

  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    await withConnection(async (connection) => {
      const productRows = (await connection.query(
        `SELECT id, stock FROM ${productTable} WHERE id = ? LIMIT 1`,
        [productId],
      )) as Array<{ id: string; stock: string | number }>;
      const product = productRows[0];
      if (!product) {
        throw new ApiError(404, '商品不存在');
      }

      const stock = toNumber(product.stock);
      if (quantity > stock) {
        throw new ApiError(400, '加入数量超过库存');
      }

      const cartRows = (await connection.query(
        `SELECT quantity FROM ${cartTable} WHERE user_id = ? AND product_id = ? LIMIT 1`,
        [auth.user.id, productId],
      )) as Array<{ quantity: string | number }>;

      if (cartRows.length === 0) {
        await connection.query(
          `INSERT INTO ${cartTable} (user_id, product_id, quantity) VALUES (?, ?, ?)`,
          [auth.user.id, productId, quantity],
        );
        return;
      }

      const nextQuantity = toNumber(cartRows[0].quantity) + quantity;
      if (nextQuantity > stock) {
        throw new ApiError(400, '加入数量超过库存');
      }

      await connection.query(`UPDATE ${cartTable} SET quantity = ? WHERE user_id = ? AND product_id = ?`, [
        nextQuantity,
        auth.user.id,
        productId,
      ]);
    });

    res.status(201).json({ message: '已加入购物车' });
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: '加入购物车失败',
      error: readErrorMessage(error),
    });
  }
});

app.put('/api/cart/items/:productId', async (req, res) => {
  const { productId } = req.params;
  const payload = asRecord(req.body);
  const quantity = toPositiveInt(payload.quantity);
  if (quantity === null) {
    res.status(400).json({ message: '数量必须为正整数' });
    return;
  }

  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    await withConnection(async (connection) => {
      const productRows = (await connection.query(
        `SELECT stock FROM ${productTable} WHERE id = ? LIMIT 1`,
        [productId],
      )) as Array<{ stock: string | number }>;
      const product = productRows[0];
      if (!product) {
        throw new ApiError(404, '商品不存在');
      }
      if (quantity > toNumber(product.stock)) {
        throw new ApiError(400, '数量超过库存');
      }

      const result = await connection.query(
        `UPDATE ${cartTable} SET quantity = ? WHERE user_id = ? AND product_id = ?`,
        [quantity, auth.user.id, productId],
      );
      if ((result as { affectedRows?: number }).affectedRows === 0) {
        throw new ApiError(404, '购物车中不存在该商品');
      }
    });

    res.json({ message: '购物车数量更新成功' });
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: '更新购物车失败',
      error: readErrorMessage(error),
    });
  }
});

app.delete('/api/cart/items/:productId', async (req, res) => {
  const { productId } = req.params;

  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    await withConnection(async (connection) => {
      await connection.query(`DELETE FROM ${cartTable} WHERE user_id = ? AND product_id = ?`, [
        auth.user.id,
        productId,
      ]);
    });

    res.json({ message: '已从购物车移除' });
  } catch (error) {
    res.status(500).json({
      message: '移除购物车商品失败',
      error: readErrorMessage(error),
    });
  }
});

app.post('/api/orders/submit', async (req, res) => {
  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const cartRows = (await connection.query(
        `
          SELECT c.product_id, c.quantity, p.name, p.category, p.price, p.stock
          FROM ${cartTable} c
          INNER JOIN ${productTable} p ON p.id = c.product_id
          WHERE c.user_id = ?
          FOR UPDATE
        `,
        [auth.user.id],
      )) as CartRow[];

      if (cartRows.length === 0) {
        throw new ApiError(400, '购物车为空，无法提交订单');
      }

      const orderNo = generateOrderNo();
      let totalAmount = 0;
      const orderItems: Array<{
        productId: string;
        productName: string;
        category: string;
        price: number;
        quantity: number;
        subtotal: number;
      }> = [];

      for (const row of cartRows) {
        const quantity = toNumber(row.quantity);
        const price = toNumber(row.price);
        const stock = toNumber(row.stock);
        if (quantity > stock) {
          throw new ApiError(400, `${row.name} 库存不足`);
        }
        const subtotal = quantity * price;
        totalAmount += subtotal;
        orderItems.push({
          productId: row.product_id,
          productName: row.name,
          category: row.category,
          price,
          quantity,
          subtotal,
        });
      }

      await connection.query(
        `
          INSERT INTO ${orderTable} (order_no, user_id, total_amount, status)
          VALUES (?, ?, ?, 'UNPAID')
        `,
        [orderNo, auth.user.id, totalAmount],
      );
      const insertedOrderRows = (await connection.query(
        `SELECT id FROM ${orderTable} WHERE order_no = ? LIMIT 1`,
        [orderNo],
      )) as Array<{ id: string | number }>;
      const insertedOrder = insertedOrderRows[0];
      if (!insertedOrder) {
        throw new ApiError(500, '订单创建失败');
      }

      for (const item of orderItems) {
        await connection.query(
          `
            INSERT INTO ${orderItemTable}
            (order_id, product_id, product_name, category, price, quantity, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            insertedOrder.id,
            item.productId,
            item.productName,
            item.category,
            item.price,
            item.quantity,
            item.subtotal,
          ],
        );
      }

      await connection.query(`DELETE FROM ${cartTable} WHERE user_id = ?`, [auth.user.id]);
      await connection.commit();

      await appendSystemLogSafely({
        level: 'INFO',
        module: 'order',
        action: 'submit',
        message: `提交订单成功: ${orderNo}, 金额 ${totalAmount.toFixed(2)}`,
        actorUserId: auth.user.id,
      });

      res.status(201).json({
        message: '订单提交成功',
        orderNo,
        totalAmount,
        status: 'UNPAID',
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: '提交订单失败',
      error: readErrorMessage(error),
    });
  }
});

app.post('/api/orders/:orderNo/pay', async (req, res) => {
  const { orderNo } = req.params;
  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const orderRows = (await connection.query(
        `
          SELECT id, order_no, user_id, total_amount, status, created_at, paid_at
          FROM ${orderTable}
          WHERE order_no = ? AND user_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [orderNo, auth.user.id],
      )) as OrderRow[];
      const order = orderRows[0];
      if (!order) {
        throw new ApiError(404, '订单不存在');
      }
      if (order.status === 'PAID') {
        throw new ApiError(400, '订单已支付');
      }

      const itemRows = (await connection.query(
        `
          SELECT order_id, product_id, product_name, category, price, quantity, subtotal
          FROM ${orderItemTable}
          WHERE order_id = ?
        `,
        [order.id],
      )) as OrderItemRow[];

      for (const item of itemRows) {
        const productRows = (await connection.query(
          `SELECT stock FROM ${productTable} WHERE id = ? LIMIT 1 FOR UPDATE`,
          [item.product_id],
        )) as Array<{ stock: string | number }>;
        const product = productRows[0];
        if (!product) {
          throw new ApiError(400, `商品 ${item.product_name} 不存在`);
        }
        if (toNumber(product.stock) < toNumber(item.quantity)) {
          throw new ApiError(400, `${item.product_name} 库存不足，无法支付`);
        }
      }

      const userRows = (await connection.query(
        `SELECT balance FROM ${userTable} WHERE id = ? LIMIT 1 FOR UPDATE`,
        [auth.user.id],
      )) as Array<{ balance: string | number }>;
      const user = userRows[0];
      if (!user) {
        throw new ApiError(404, '用户不存在');
      }

      const totalAmount = toNumber(order.total_amount);
      if (toNumber(user.balance) < totalAmount) {
        throw new ApiError(400, '账户余额不足，无法付款');
      }

      await connection.query(`UPDATE ${userTable} SET balance = balance - ? WHERE id = ?`, [
        totalAmount,
        auth.user.id,
      ]);
      for (const item of itemRows) {
        await connection.query(`UPDATE ${productTable} SET stock = stock - ? WHERE id = ?`, [
          item.quantity,
          item.product_id,
        ]);
      }
      await connection.query(`UPDATE ${orderTable} SET status = 'PAID', paid_at = NOW() WHERE id = ?`, [
        order.id,
      ]);
      await connection.commit();

      await appendSystemLogSafely({
        level: 'INFO',
        module: 'order',
        action: 'pay',
        message: `订单支付成功: ${orderNo}, 金额 ${totalAmount.toFixed(2)}`,
        actorUserId: auth.user.id,
      });

      res.json({ message: '付款成功', orderNo });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: '订单支付失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    const orders = await fetchUserOrders(auth.user.id);
    res.json({
      total: orders.length,
      items: orders,
    });
  } catch (error) {
    res.status(500).json({
      message: '订单查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/orders/:orderNo', async (req, res) => {
  const { orderNo } = req.params;
  try {
    const auth = await requireAuth(req.header('authorization'));
    if (!auth) {
      res.status(401).json({ message: '登录状态无效，请重新登录' });
      return;
    }

    const orders = await fetchUserOrders(auth.user.id);
    const order = orders.find((item) => item.orderNo === orderNo);
    if (!order) {
      res.status(404).json({ message: '订单不存在' });
      return;
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({
      message: '订单详情查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/admin/categories', async (req, res) => {
  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    const rows = await withConnection(async (connection) => {
      return (await connection.query(`SELECT id, name FROM ${categoryTable} ORDER BY name`)) as CategoryRow[];
    });
    res.json({
      total: rows.length,
      items: rows.map((row) => ({ id: String(row.id), name: row.name })),
    });
  } catch (error) {
    res.status(500).json({
      message: '分类管理查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.post('/api/admin/categories', async (req, res) => {
  const payload = asRecord(req.body);
  const name = getString(payload.name).trim();
  if (name === '') {
    res.status(400).json({ message: '分类名称不能为空' });
    return;
  }

  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    await withConnection(async (connection) => {
      const exists = (await connection.query(`SELECT id FROM ${categoryTable} WHERE name = ? LIMIT 1`, [
        name,
      ])) as Array<{ id: number }>;
      if (exists.length > 0) {
        throw new ApiError(409, '分类已存在');
      }
      await connection.query(`INSERT INTO ${categoryTable} (name) VALUES (?)`, [name]);
    });
    await appendSystemLogSafely({
      level: 'INFO',
      module: 'admin.category',
      action: 'create',
      message: `管理员新增分类: ${name}`,
      actorUserId: adminAuth.user.id,
    });
    res.status(201).json({ message: '分类创建成功' });
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: '分类创建失败',
      error: readErrorMessage(error),
    });
  }
});

app.delete('/api/admin/categories/:id', async (req, res) => {
  const categoryId = toPositiveInt(req.params.id);
  if (categoryId === null) {
    res.status(400).json({ message: '分类编号不正确' });
    return;
  }

  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    await withConnection(async (connection) => {
      const categoryRows = (await connection.query(`SELECT name FROM ${categoryTable} WHERE id = ? LIMIT 1`, [
        categoryId,
      ])) as Array<{ name: string }>;
      const category = categoryRows[0];
      if (!category) {
        throw new ApiError(404, '分类不存在');
      }

      const productCountRows = (await connection.query(
        `SELECT COUNT(1) AS total FROM ${productTable} WHERE category = ?`,
        [category.name],
      )) as Array<{ total: string | number }>;
      if (toNumber(productCountRows[0]?.total ?? 0) > 0) {
        throw new ApiError(400, '分类下存在商品，无法删除');
      }

      await connection.query(`DELETE FROM ${categoryTable} WHERE id = ?`, [categoryId]);
    });

    await appendSystemLogSafely({
      level: 'INFO',
      module: 'admin.category',
      action: 'delete',
      message: `管理员删除分类: ${categoryId}`,
      actorUserId: adminAuth.user.id,
    });

    res.json({ message: '分类删除成功' });
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: '分类删除失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/admin/products', async (req, res) => {
  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    const keyword = getQueryText(req.query.keyword);
    const category = getQueryText(req.query.category);
    const conditions: string[] = [];
    const params: string[] = [];
    if (keyword !== '') {
      conditions.push('name LIKE ?');
      params.push(`%${keyword}%`);
    }
    if (category !== '') {
      conditions.push('category = ?');
      params.push(category);
    }
    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = await withConnection(async (connection) => {
      return (await connection.query(
        `SELECT id, name, category, price, stock, description FROM ${productTable}${whereClause} ORDER BY id`,
        params,
      )) as ProductDetailRow[];
    });

    res.json({
      total: rows.length,
      items: rows.map(toProductDetail),
    });
  } catch (error) {
    res.status(500).json({
      message: '商品管理查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.post('/api/admin/products', async (req, res) => {
  const payload = asRecord(req.body);
  const id = getString(payload.id).trim();
  const name = getString(payload.name).trim();
  const category = getString(payload.category).trim();
  const description = getString(payload.description).trim();
  const price = Number(payload.price);
  const stock = Number(payload.stock);

  if (id === '' || name === '' || category === '' || description === '') {
    res.status(400).json({ message: '商品信息不完整' });
    return;
  }
  if (!Number.isFinite(price) || price <= 0) {
    res.status(400).json({ message: '商品价格必须大于 0' });
    return;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    res.status(400).json({ message: '库存必须是非负整数' });
    return;
  }

  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    await withConnection(async (connection) => {
      const duplicatedRows = (await connection.query(
        `SELECT id FROM ${productTable} WHERE id = ? OR name = ? LIMIT 1`,
        [id, name],
      )) as Array<{ id: string }>;
      if (duplicatedRows.length > 0) {
        throw new ApiError(409, '商品已存在，不能重复添加');
      }

      await connection.query(
        `
          INSERT INTO ${productTable} (id, name, category, price, stock, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [id, name, category, price, stock, description],
      );
      await connection.query(`INSERT IGNORE INTO ${categoryTable} (name) VALUES (?)`, [category]);
    });

    await appendSystemLogSafely({
      level: 'INFO',
      module: 'admin.product',
      action: 'create',
      message: `管理员添加商品: ${name} (${id})`,
      actorUserId: adminAuth.user.id,
    });

    res.status(201).json({ message: '商品添加成功' });
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: '商品添加失败',
      error: readErrorMessage(error),
    });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    await withConnection(async (connection) => {
      const exists = (await connection.query(`SELECT id FROM ${productTable} WHERE id = ? LIMIT 1`, [
        id,
      ])) as Array<{ id: string }>;
      if (exists.length === 0) {
        throw new ApiError(404, '商品不存在');
      }
      await connection.query(`DELETE FROM ${cartTable} WHERE product_id = ?`, [id]);
      await connection.query(`DELETE FROM ${productTable} WHERE id = ?`, [id]);
    });

    await appendSystemLogSafely({
      level: 'INFO',
      module: 'admin.product',
      action: 'delete',
      message: `管理员删除商品: ${id}`,
      actorUserId: adminAuth.user.id,
    });

    res.json({ message: '商品删除成功' });
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: '商品删除失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    const rows = await withConnection(async (connection) => {
      return (await connection.query(
        `
          SELECT
            o.order_no,
            o.total_amount,
            o.status,
            o.created_at,
            o.paid_at,
            u.username
          FROM ${orderTable} o
          INNER JOIN ${userTable} u ON o.user_id = u.id
          ORDER BY o.created_at DESC
        `,
      )) as Array<{
        order_no: string;
        total_amount: string | number;
        status: string;
        created_at: Date | string;
        paid_at: Date | string | null;
        username: string;
      }>;
    });

    res.json({
      total: rows.length,
      items: rows.map((row) => ({
        orderNo: row.order_no,
        username: row.username,
        totalAmount: toNumber(row.total_amount),
        status: row.status,
        createdAt: formatTimestamp(row.created_at),
        paidAt: formatNullableTimestamp(row.paid_at),
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: '订单管理查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/admin/users', async (req, res) => {
  const keyword = getQueryText(req.query.keyword);
  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    const params: string[] = [];
    const whereClause =
      keyword === ''
        ? ''
        : (() => {
            params.push(`%${keyword}%`);
            return ' WHERE username LIKE ?';
          })();
    const rows = await withConnection(async (connection) => {
      return (await connection.query(
        `
          SELECT id, username, nickname, phone, balance, is_admin, created_at
          FROM ${userTable}
          ${whereClause}
          ORDER BY id
        `,
        params,
      )) as UserPublicRow[];
    });

    res.json({
      total: rows.length,
      items: rows.map(toUserPublic),
    });
  } catch (error) {
    res.status(500).json({
      message: '用户管理查询失败',
      error: readErrorMessage(error),
    });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  const userId = toPositiveInt(req.params.id);
  if (userId === null) {
    res.status(400).json({ message: '用户编号不正确' });
    return;
  }

  const payload = asRecord(req.body);
  const hasNickname = Object.prototype.hasOwnProperty.call(payload, 'nickname');
  const hasPhone = Object.prototype.hasOwnProperty.call(payload, 'phone');
  const hasBalance = Object.prototype.hasOwnProperty.call(payload, 'balance');
  const hasIsAdmin = Object.prototype.hasOwnProperty.call(payload, 'isAdmin');
  const nickname = normalizeOptionalText(payload.nickname);
  const phone = normalizeOptionalText(payload.phone);
  const balance = Number(payload.balance);
  const isAdmin = payload.isAdmin === true || payload.isAdmin === 1;

  if (!hasNickname && !hasPhone && !hasBalance && !hasIsAdmin) {
    res.status(400).json({ message: '至少传入一个更新字段' });
    return;
  }

  if (hasPhone) {
    const phoneError = validatePhone(phone);
    if (phoneError) {
      res.status(400).json({ message: phoneError });
      return;
    }
  }
  if (hasBalance && (!Number.isFinite(balance) || balance < 0)) {
    res.status(400).json({ message: '余额必须是非负数' });
    return;
  }

  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    const updates: string[] = [];
    const params: Array<string | number | null> = [];
    if (hasNickname) {
      updates.push('nickname = ?');
      params.push(nickname);
    }
    if (hasPhone) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (hasBalance) {
      updates.push('balance = ?');
      params.push(balance);
    }
    if (hasIsAdmin) {
      updates.push('is_admin = ?');
      params.push(isAdmin ? 1 : 0);
    }
    params.push(userId);

    await withConnection(async (connection) => {
      const result = await connection.query(`UPDATE ${userTable} SET ${updates.join(', ')} WHERE id = ?`, params);
      if ((result as { affectedRows?: number }).affectedRows === 0) {
        throw new ApiError(404, '用户不存在');
      }
    });

    await appendSystemLogSafely({
      level: 'INFO',
      module: 'admin.user',
      action: 'update',
      message: `管理员更新用户: ${userId}`,
      actorUserId: adminAuth.user.id,
    });

    res.json({ message: '用户信息更新成功' });
  } catch (error) {
    if (isApiError(error)) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: '用户信息更新失败',
      error: readErrorMessage(error),
    });
  }
});

app.get('/api/admin/system/logs', async (req, res) => {
  const limit = Number(req.query.limit);
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;

  try {
    const adminAuth = await requireAdminAuth(req.header('authorization'));
    if (!adminAuth) {
      res.status(403).json({ message: '仅管理员可访问' });
      return;
    }

    const rows = await withConnection(async (connection) => {
      return (await connection.query(
        `
          SELECT id, level, module, action, message, actor_user_id, created_at
          FROM ${systemLogTable}
          ORDER BY id DESC
          LIMIT ?
        `,
        [normalizedLimit],
      )) as SystemLogRow[];
    });

    res.json({
      total: rows.length,
      items: rows.map(toSystemLogItem),
    });
  } catch (error) {
    res.status(500).json({
      message: '系统日志查询失败',
      error: readErrorMessage(error),
    });
  }
});

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
