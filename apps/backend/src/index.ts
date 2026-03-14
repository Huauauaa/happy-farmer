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

if (!/^[A-Za-z0-9_]+$/.test(rawProductTableName)) {
  throw new Error('PRODUCT_TABLE only allows letters, numbers and underscores');
}

const jdbcConfig = parseJdbcUrl(jdbcUrl);
const productTable = `\`${rawProductTableName}\``;
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

const getKeyword = (value: unknown): string => {
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

const withConnection = async <T>(handler: (connection: PoolConnection) => Promise<T>) => {
  const connection = await pool.getConnection();
  try {
    return await handler(connection);
  } finally {
    connection.release();
  }
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/products', async (req, res) => {
  const keyword = getKeyword(req.query.keyword);
  const querySql = keyword
    ? `SELECT id, name, category, price, stock FROM ${productTable} WHERE name LIKE ? ORDER BY id`
    : `SELECT id, name, category, price, stock FROM ${productTable} ORDER BY id`;
  const params = keyword ? [`%${keyword}%`] : [];

  try {
    const rows = await withConnection(async (connection) => {
      return (await connection.query(querySql, params)) as ProductSummaryRow[];
    });
    const items = rows.map(toProductSummary);
    res.json({
      keyword,
      total: items.length,
      items,
    });
  } catch (error) {
    res.status(500).json({
      message: '商品查询失败',
      error: error instanceof Error ? error.message : 'Unknown error',
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(port, () => {
  console.log(
    `Database: ${jdbcConfig.host}:${jdbcConfig.port}/${jdbcConfig.database} table=${rawProductTableName}`,
  );
  console.log(`Backend listening on http://localhost:${port}`);
});
