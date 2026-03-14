import type { AppContext } from '../AppContext.js';

export const registerOrderRoutes = (context: AppContext) => {
  const { app, tableNames, pool, db, auth, helpers, ApiError, mappers, queries } = context;

  app.post('/api/orders/submit', async (req, res) => {
    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const cartRows = (await connection.query(
          `
          SELECT c.product_id, c.quantity, p.name, p.category, p.price, p.stock
          FROM ${tableNames.cartTable} c
          INNER JOIN ${tableNames.productTable} p ON p.id = c.product_id
          WHERE c.user_id = ?
          FOR UPDATE
        `,
          [authResult.user.id],
        )) as any[];

        if (cartRows.length === 0) {
          throw new ApiError(400, '购物车为空，无法提交订单');
        }

        const orderNo = helpers.generateOrderNo();
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
          const quantity = helpers.toNumber(row.quantity);
          const price = helpers.toNumber(row.price);
          const stock = helpers.toNumber(row.stock);
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
          INSERT INTO ${tableNames.orderTable} (order_no, user_id, total_amount, status)
          VALUES (?, ?, ?, 'UNPAID')
        `,
          [orderNo, authResult.user.id, totalAmount],
        );
        const insertedOrderRows = (await connection.query(
          `SELECT id FROM ${tableNames.orderTable} WHERE order_no = ? LIMIT 1`,
          [orderNo],
        )) as Array<{ id: string | number }>;
        const insertedOrder = insertedOrderRows[0];
        if (!insertedOrder) {
          throw new ApiError(500, '订单创建失败');
        }

        for (const item of orderItems) {
          await connection.query(
            `
            INSERT INTO ${tableNames.orderItemTable}
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

        await connection.query(`DELETE FROM ${tableNames.cartTable} WHERE user_id = ?`, [authResult.user.id]);
        await connection.commit();

        await db.appendSystemLogSafely({
          level: 'INFO',
          module: 'order',
          action: 'submit',
          message: `提交订单成功: ${orderNo}, 金额 ${totalAmount.toFixed(2)}`,
          actorUserId: authResult.user.id,
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
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '提交订单失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.post('/api/orders/:orderNo/pay', async (req, res) => {
    const { orderNo } = req.params;
    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const orderRows = (await connection.query(
          `
          SELECT id, order_no, user_id, total_amount, status, created_at, paid_at
          FROM ${tableNames.orderTable}
          WHERE order_no = ? AND user_id = ?
          LIMIT 1
          FOR UPDATE
        `,
          [orderNo, authResult.user.id],
        )) as any[];
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
          FROM ${tableNames.orderItemTable}
          WHERE order_id = ?
        `,
          [order.id],
        )) as any[];

        for (const item of itemRows) {
          const productRows = (await connection.query(
            `SELECT stock FROM ${tableNames.productTable} WHERE id = ? LIMIT 1 FOR UPDATE`,
            [item.product_id],
          )) as Array<{ stock: string | number }>;
          const product = productRows[0];
          if (!product) {
            throw new ApiError(400, `商品 ${item.product_name} 不存在`);
          }
          if (helpers.toNumber(product.stock) < helpers.toNumber(item.quantity)) {
            throw new ApiError(400, `${item.product_name} 库存不足，无法支付`);
          }
        }

        const userRows = (await connection.query(
          `SELECT balance FROM ${tableNames.userTable} WHERE id = ? LIMIT 1 FOR UPDATE`,
          [authResult.user.id],
        )) as Array<{ balance: string | number }>;
        const user = userRows[0];
        if (!user) {
          throw new ApiError(404, '用户不存在');
        }

        const totalAmount = helpers.toNumber(order.total_amount);
        if (helpers.toNumber(user.balance) < totalAmount) {
          throw new ApiError(400, '账户余额不足，无法付款');
        }

        await connection.query(`UPDATE ${tableNames.userTable} SET balance = balance - ? WHERE id = ?`, [
          totalAmount,
          authResult.user.id,
        ]);
        for (const item of itemRows) {
          await connection.query(`UPDATE ${tableNames.productTable} SET stock = stock - ? WHERE id = ?`, [
            item.quantity,
            item.product_id,
          ]);
        }
        await connection.query(`UPDATE ${tableNames.orderTable} SET status = 'PAID', paid_at = NOW() WHERE id = ?`, [
          order.id,
        ]);
        await connection.commit();

        await db.appendSystemLogSafely({
          level: 'INFO',
          module: 'order',
          action: 'pay',
          message: `订单支付成功: ${orderNo}, 金额 ${totalAmount.toFixed(2)}`,
          actorUserId: authResult.user.id,
        });

        res.json({ message: '付款成功', orderNo });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '订单支付失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.get('/api/orders', async (req, res) => {
    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      const orders = await queries.fetchUserOrders(authResult.user.id);
      res.json({
        total: orders.length,
        items: orders,
      });
    } catch (error) {
      res.status(500).json({
        message: '订单查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.get('/api/orders/:orderNo', async (req, res) => {
    const { orderNo } = req.params;
    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      const orders = await queries.fetchUserOrders(authResult.user.id);
      const order = orders.find((item) => item.orderNo === orderNo);
      if (!order) {
        res.status(404).json({ message: '订单不存在' });
        return;
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({
        message: '订单详情查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });
};
