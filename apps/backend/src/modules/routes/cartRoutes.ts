import type { AppContext } from '../AppContext.js';

export const registerCartRoutes = (context: AppContext) => {
  const { app, prisma, auth, schemas, helpers, queries, ApiError } = context;

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

      const userId = BigInt(authResult.user.id);
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          stock: true,
        },
      });
      if (!product) {
        throw new ApiError(404, '商品不存在');
      }
      if (quantity > product.stock) {
        throw new ApiError(400, '加入数量超过库存');
      }

      const existingCartItem = await prisma.cartItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        select: {
          quantity: true,
        },
      });

      if (!existingCartItem) {
        await prisma.cartItem.create({
          data: {
            userId,
            productId,
            quantity,
          },
        });
      } else {
        const nextQuantity = existingCartItem.quantity + quantity;
        if (nextQuantity > product.stock) {
          throw new ApiError(400, '加入数量超过库存');
        }

        await prisma.cartItem.update({
          where: {
            userId_productId: {
              userId,
              productId,
            },
          },
          data: {
            quantity: nextQuantity,
          },
        });
      }

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

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          stock: true,
        },
      });
      if (!product) {
        throw new ApiError(404, '商品不存在');
      }
      if (quantity > product.stock) {
        throw new ApiError(400, '数量超过库存');
      }

      const updatedCartItem = await prisma.cartItem.updateMany({
        where: {
          userId: BigInt(authResult.user.id),
          productId,
        },
        data: {
          quantity,
        },
      });
      if (updatedCartItem.count === 0) {
        throw new ApiError(404, '购物车中不存在该商品');
      }

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

      await prisma.cartItem.deleteMany({
        where: {
          userId: BigInt(authResult.user.id),
          productId,
        },
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
