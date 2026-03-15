import { Prisma } from '@prisma/client';
import type { AppContext } from '../AppContext.js';

export const registerOrderRoutes = (context: AppContext) => {
  const { app, prisma, db, auth, helpers, ApiError, queries } = context;

  app.post('/api/orders/submit', async (req, res) => {
    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      const userId = BigInt(authResult.user.id);
      const orderResult = await prisma.$transaction(
        async (tx) => {
          const cartItems = await tx.cartItem.findMany({
            where: { userId },
            include: {
              product: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

          if (cartItems.length === 0) {
            throw new ApiError(400, '购物车为空，无法提交订单');
          }

          const orderNo = helpers.generateOrderNo();
          let totalAmount = 0;
          const orderItems = cartItems.map((row) => {
            if (row.quantity > row.product.stock) {
              throw new ApiError(400, `${row.product.name} 库存不足`);
            }

            const price = helpers.toNumber(row.product.price);
            const subtotal = price * row.quantity;
            totalAmount += subtotal;
            return {
              productId: row.productId,
              productName: row.product.name,
              category: row.product.category,
              price,
              quantity: row.quantity,
              subtotal,
            };
          });

          await tx.order.create({
            data: {
              orderNo,
              userId,
              totalAmount,
              status: 'UNPAID',
              items: {
                create: orderItems,
              },
            },
          });

          await tx.cartItem.deleteMany({
            where: { userId },
          });

          return {
            orderNo,
            totalAmount,
            status: 'UNPAID',
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'order',
        action: 'submit',
        message: `提交订单成功: ${orderResult.orderNo}, 金额 ${orderResult.totalAmount.toFixed(2)}`,
        actorUserId: authResult.user.id,
      });

      res.status(201).json({
        message: '订单提交成功',
        orderNo: orderResult.orderNo,
        totalAmount: orderResult.totalAmount,
        status: orderResult.status,
      });
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

      const userId = BigInt(authResult.user.id);
      const paymentResult = await prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findFirst({
            where: {
              orderNo,
              userId,
            },
            include: {
              items: {
                orderBy: {
                  id: 'asc',
                },
              },
            },
          });
          if (!order) {
            throw new ApiError(404, '订单不存在');
          }
          if (order.status === 'PAID') {
            throw new ApiError(400, '订单已支付');
          }

          const totalAmount = helpers.toNumber(order.totalAmount);
          const userUpdated = await tx.user.updateMany({
            where: {
              id: userId,
              balance: {
                gte: totalAmount,
              },
            },
            data: {
              balance: {
                decrement: totalAmount,
              },
            },
          });
          if (userUpdated.count === 0) {
            throw new ApiError(400, '账户余额不足，无法付款');
          }

          for (const item of order.items) {
            const productUpdated = await tx.product.updateMany({
              where: {
                id: item.productId,
                stock: {
                  gte: item.quantity,
                },
              },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            });

            if (productUpdated.count === 0) {
              throw new ApiError(400, `${item.productName} 库存不足，无法支付`);
            }
          }

          const orderUpdated = await tx.order.updateMany({
            where: {
              id: order.id,
              status: 'UNPAID',
            },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            },
          });
          if (orderUpdated.count === 0) {
            throw new ApiError(400, '订单已支付');
          }

          return { totalAmount };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'order',
        action: 'pay',
        message: `订单支付成功: ${orderNo}, 金额 ${paymentResult.totalAmount.toFixed(2)}`,
        actorUserId: authResult.user.id,
      });

      res.json({ message: '付款成功', orderNo });
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
