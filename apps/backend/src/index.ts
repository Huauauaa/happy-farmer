import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import cors from 'cors';
import express from 'express';
import * as mariadb from 'mariadb';
import type { PoolConnection } from 'mariadb';

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
  createdAt: string;
};

type UserCredentialRow = {
  id: string | number;
  username: string;
  nickname: string | null;
  phone: string | null;
  balance: string | number;
  created_at: Date | string;
  password_hash: string;
  password_salt: string;
};

type UserPublicRow = Omit<UserCredentialRow, 'password_hash' | 'password_salt'>;

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
assertValidIdentifier(rawUserTableName, 'USER_TABLE');
assertValidIdentifier(rawSessionTableName, 'USER_SESSION_TABLE');

const jdbcConfig = parseJdbcUrl(jdbcUrl);
const productTable = quoteIdentifier(rawProductTableName);
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
  createdAt: formatTimestamp(row.created_at),
});

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

const ensureAuthTables = async () => {
  await withConnection(async (connection) => {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${userTable} (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(64) NOT NULL UNIQUE,
        password_hash CHAR(128) NOT NULL,
        password_salt CHAR(32) NOT NULL,
        nickname VARCHAR(128) NULL,
        phone VARCHAR(32) NULL,
        balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

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
        `SELECT DISTINCT category FROM ${productTable} WHERE category IS NOT NULL AND category <> '' ORDER BY category`,
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

const startServer = async () => {
  try {
    await ensureAuthTables();
    console.log(
      `Database: ${jdbcConfig.host}:${jdbcConfig.port}/${jdbcConfig.database} tables={products:${rawProductTableName}, users:${rawUserTableName}, sessions:${rawSessionTableName}}`,
    );
    app.listen(port, () => {
      console.log(`Backend listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start backend server:', readErrorMessage(error));
    process.exit(1);
  }
};

void startServer();
