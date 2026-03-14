import type { AppContext } from '../AppContext.js';

export const registerProductsRoutes = (context: AppContext) => {
  const { app, serviceName, db, helpers, mappers, tableNames } = context;

  app.get('/api/health', async (_req, res) => {
    try {
      await db.withConnection(async (connection) => {
        await connection.query('SELECT 1');
      });
      res.json({ ok: true, service: serviceName, database: 'up' });
    } catch (error) {
      res.status(503).json({
        ok: false,
        service: serviceName,
        database: 'down',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.get('/api/products', async (req, res) => {
    const keyword = helpers.getQueryText(req.query.keyword);
    const category = helpers.getQueryText(req.query.category);
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
    const querySql = `SELECT id, name, category, price, stock FROM ${tableNames.productTable}${whereClause} ORDER BY id`;

    try {
      const rows = await db.withConnection(async (connection) => {
        return (await connection.query(querySql, params)) as any[];
      });
      const items = rows.map((row) => mappers.toProductSummary(row));
      res.json({
        keyword,
        category,
        total: items.length,
        items,
      });
    } catch (error) {
      res.status(500).json({
        message: '商品查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.get('/api/product-categories', async (_req, res) => {
    try {
      const rows = await db.withConnection(async (connection) => {
        return (await connection.query(
          `
          SELECT DISTINCT name AS category FROM ${tableNames.categoryTable}
          UNION
          SELECT DISTINCT category FROM ${tableNames.productTable}
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
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const rows = await db.withConnection(async (connection) => {
        return (await connection.query(
          `SELECT id, name, category, price, stock, description FROM ${tableNames.productTable} WHERE id = ? LIMIT 1`,
          [id],
        )) as any[];
      });

      const row = rows[0];
      if (!row) {
        res.status(404).json({ message: '商品不存在' });
        return;
      }

      res.json(mappers.toProductDetail(row));
    } catch (error) {
      res.status(500).json({
        message: '商品详情查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });
};
