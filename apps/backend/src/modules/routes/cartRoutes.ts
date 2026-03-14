import type { AppContext } from '../AppContext.js';

export const registerCartRoutes = (context: AppContext) => {
  const { app, tableNames, db, auth, schemas, helpers, queries, ApiError } = context;

  app.get('/api/cart', async (req, res) => {
    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      const items = await queries.fetchCartItems(authResult.user.id);
      const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
      res.json({
        total: items.length,
        totalAmount,
        items,
      });
    } catch (error) {
      res.status(500).json({
        message: '购物车查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.post('/api/cart/items', async (req, res) => {
    let payload: any;
    try {
      payload = helpers.parseWithSchema(schemas.cartAddPayloadSchema, req.body);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }
    const { productId, quantity } = payload;

    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      await db.withConnection(async (connection) => {
        const productRows = (await connection.query(
          `SELECT id, stock FROM ${tableNames.productTable} WHERE id = ? LIMIT 1`,
          [productId],
        )) as Array<{ id: string; stock: string | number }>;
        const product = productRows[0];
        if (!product) {
          throw new ApiError(404, '商品不存在');
        }

        const stock = helpers.toNumber(product.stock);
        if (quantity > stock) {
          throw new ApiError(400, '加入数量超过库存');
        }

        const cartRows = (await connection.query(
          `SELECT quantity FROM ${tableNames.cartTable} WHERE user_id = ? AND product_id = ? LIMIT 1`,
          [authResult.user.id, productId],
        )) as Array<{ quantity: string | number }>;

        if (cartRows.length === 0) {
          await connection.query(
            `INSERT INTO ${tableNames.cartTable} (user_id, product_id, quantity) VALUES (?, ?, ?)`,
            [authResult.user.id, productId, quantity],
          );
          return;
        }

        const nextQuantity = helpers.toNumber(cartRows[0].quantity) + quantity;
        if (nextQuantity > stock) {
          throw new ApiError(400, '加入数量超过库存');
        }

        await connection.query(
          `UPDATE ${tableNames.cartTable} SET quantity = ? WHERE user_id = ? AND product_id = ?`,
          [nextQuantity, authResult.user.id, productId],
        );
      });

      res.status(201).json({ message: '已加入购物车' });
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '加入购物车失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.put('/api/cart/items/:productId', async (req, res) => {
    const { productId } = req.params;
    let payload: any;
    try {
      payload = helpers.parseWithSchema(schemas.cartUpdatePayloadSchema, req.body);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }
    const { quantity } = payload;

    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      await db.withConnection(async (connection) => {
        const productRows = (await connection.query(
          `SELECT stock FROM ${tableNames.productTable} WHERE id = ? LIMIT 1`,
          [productId],
        )) as Array<{ stock: string | number }>;
        const product = productRows[0];
        if (!product) {
          throw new ApiError(404, '商品不存在');
        }
        if (quantity > helpers.toNumber(product.stock)) {
          throw new ApiError(400, '数量超过库存');
        }

        const result = await connection.query(
          `UPDATE ${tableNames.cartTable} SET quantity = ? WHERE user_id = ? AND product_id = ?`,
          [quantity, authResult.user.id, productId],
        );
        if ((result as { affectedRows?: number }).affectedRows === 0) {
          throw new ApiError(404, '购物车中不存在该商品');
        }
      });

      res.json({ message: '购物车数量更新成功' });
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '更新购物车失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.delete('/api/cart/items/:productId', async (req, res) => {
    const { productId } = req.params;

    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      await db.withConnection(async (connection) => {
        await connection.query(`DELETE FROM ${tableNames.cartTable} WHERE user_id = ? AND product_id = ?`, [
          authResult.user.id,
          productId,
        ]);
      });

      res.json({ message: '已从购物车移除' });
    } catch (error) {
      res.status(500).json({
        message: '移除购物车商品失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });
};
