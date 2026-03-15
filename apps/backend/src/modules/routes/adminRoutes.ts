import type { Prisma } from '@prisma/client';
import type { AppContext } from '../AppContext.js';

export const registerAdminRoutes = (context: AppContext) => {
  const { app, prisma, db, auth, schemas, helpers, mappers, ApiError } = context;

  app.get('/api/admin/categories', async (req, res) => {
    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const rows = await prisma.productCategory.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      res.json({
        total: rows.length,
        items: rows.map((row) => ({ id: String(row.id), name: row.name })),
      });
    } catch (error) {
      res.status(500).json({
        message: '分类管理查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.post('/api/admin/categories', async (req, res) => {
    let payload: any;
    try {
      payload = helpers.parseWithSchema(schemas.adminCategoryCreatePayloadSchema, req.body);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }

    const { name } = payload;

    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const existingCategory = await prisma.productCategory.findUnique({
        where: { name },
        select: { id: true },
      });
      if (existingCategory) {
        throw new ApiError(409, '分类已存在');
      }

      await prisma.productCategory.create({
        data: { name },
      });

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'admin.category',
        action: 'create',
        message: `管理员新增分类: ${name}`,
        actorUserId: adminAuth.user.id,
      });

      res.status(201).json({ message: '分类创建成功' });
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '分类创建失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.delete('/api/admin/categories/:id', async (req, res) => {
    const categoryId = helpers.toPositiveInt(req.params.id);
    if (categoryId === null) {
      res.status(400).json({ message: '分类编号不正确' });
      return;
    }

    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const category = await prisma.productCategory.findUnique({
        where: { id: BigInt(categoryId) },
        select: {
          name: true,
        },
      });
      if (!category) {
        throw new ApiError(404, '分类不存在');
      }

      const productCount = await prisma.product.count({
        where: {
          category: category.name,
        },
      });
      if (productCount > 0) {
        throw new ApiError(400, '分类下存在商品，无法删除');
      }

      await prisma.productCategory.delete({
        where: { id: BigInt(categoryId) },
      });

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'admin.category',
        action: 'delete',
        message: `管理员删除分类: ${categoryId}`,
        actorUserId: adminAuth.user.id,
      });

      res.json({ message: '分类删除成功' });
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '分类删除失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.get('/api/admin/products', async (req, res) => {
    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const keyword = helpers.getQueryText(req.query.keyword);
      const category = helpers.getQueryText(req.query.category);
      const where: Prisma.ProductWhereInput = {};
      if (keyword !== '') {
        where.name = {
          contains: keyword,
        };
      }
      if (category !== '') {
        where.category = category;
      }

      const rows = await prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          stock: true,
          description: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      res.json({
        total: rows.length,
        items: rows.map((row) => mappers.toProductDetail(row)),
      });
    } catch (error) {
      res.status(500).json({
        message: '商品管理查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.post('/api/admin/products', async (req, res) => {
    let payload: any;
    try {
      payload = helpers.parseWithSchema(schemas.adminProductCreatePayloadSchema, req.body);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }

    const { id, name, category, description, price, stock } = payload;

    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const duplicatedProduct = await prisma.product.findFirst({
        where: {
          OR: [{ id }, { name }],
        },
        select: { id: true },
      });
      if (duplicatedProduct) {
        throw new ApiError(409, '商品已存在，不能重复添加');
      }

      await prisma.$transaction([
        prisma.product.create({
          data: {
            id,
            name,
            category,
            description,
            price,
            stock,
          },
        }),
        prisma.productCategory.upsert({
          where: { name: category },
          update: {},
          create: { name: category },
        }),
      ]);

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'admin.product',
        action: 'create',
        message: `管理员添加商品: ${name} (${id})`,
        actorUserId: adminAuth.user.id,
      });

      res.status(201).json({ message: '商品添加成功' });
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '商品添加失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.delete('/api/admin/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existingProduct) {
        throw new ApiError(404, '商品不存在');
      }

      await prisma.$transaction([
        prisma.cartItem.deleteMany({
          where: { productId: id },
        }),
        prisma.product.delete({
          where: { id },
        }),
      ]);

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'admin.product',
        action: 'delete',
        message: `管理员删除商品: ${id}`,
        actorUserId: adminAuth.user.id,
      });

      res.json({ message: '商品删除成功' });
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '商品删除失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.get('/api/admin/orders', async (req, res) => {
    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const rows = await prisma.order.findMany({
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        total: rows.length,
        items: rows.map((row) => ({
          orderNo: row.orderNo,
          username: row.user.username,
          totalAmount: helpers.toNumber(row.totalAmount),
          status: row.status,
          createdAt: helpers.formatTimestamp(row.createdAt),
          paidAt: helpers.formatNullableTimestamp(row.paidAt),
        })),
      });
    } catch (error) {
      res.status(500).json({
        message: '订单管理查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.get('/api/admin/users', async (req, res) => {
    const keyword = helpers.getQueryText(req.query.keyword);
    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const rows = await prisma.user.findMany({
        where:
          keyword === ''
            ? undefined
            : {
                username: {
                  contains: keyword,
                },
              },
        select: {
          id: true,
          username: true,
          nickname: true,
          phone: true,
          balance: true,
          isAdmin: true,
          createdAt: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      res.json({
        total: rows.length,
        items: rows.map((row) => mappers.toUserPublic(row)),
      });
    } catch (error) {
      res.status(500).json({
        message: '用户管理查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.put('/api/admin/users/:id', async (req, res) => {
    const userId = helpers.toPositiveInt(req.params.id);
    if (userId === null) {
      res.status(400).json({ message: '用户编号不正确' });
      return;
    }

    let payload: any;
    try {
      payload = helpers.parseWithSchema(schemas.adminUserUpdatePayloadSchema, req.body);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }

    const hasNickname = payload.nickname !== undefined;
    const hasPhone = payload.phone !== undefined;
    const hasBalance = payload.balance !== undefined;
    const hasIsAdmin = payload.isAdmin !== undefined;
    const nickname = hasNickname ? helpers.parseWithSchema(schemas.nullableNicknameSchema, payload.nickname) : null;
    const phone = hasPhone ? helpers.parseWithSchema(schemas.nullablePhoneSchema, payload.phone) : null;
    const balance = payload.balance ?? 0;
    const isAdmin = payload.isAdmin === true || payload.isAdmin === 1;

    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const data: {
        nickname?: string | null;
        phone?: string | null;
        balance?: number;
        isAdmin?: boolean;
      } = {};
      if (hasNickname) {
        data.nickname = nickname;
      }
      if (hasPhone) {
        data.phone = phone;
      }
      if (hasBalance) {
        data.balance = balance;
      }
      if (hasIsAdmin) {
        data.isAdmin = isAdmin;
      }

      const updatedUser = await prisma.user.updateMany({
        where: { id: BigInt(userId) },
        data,
      });
      if (updatedUser.count === 0) {
        throw new ApiError(404, '用户不存在');
      }

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'admin.user',
        action: 'update',
        message: `管理员更新用户: ${userId}`,
        actorUserId: adminAuth.user.id,
      });

      res.json({ message: '用户信息更新成功' });
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '用户信息更新失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.get('/api/admin/system/logs', async (req, res) => {
    let query: any;
    try {
      query = helpers.parseWithSchema(schemas.adminSystemLogsQuerySchema, req.query);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }

    const normalizedLimit = query.limit;

    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const rows = await prisma.systemLog.findMany({
        orderBy: {
          id: 'desc',
        },
        take: normalizedLimit,
      });

      res.json({
        total: rows.length,
        items: rows.map((row) => mappers.toSystemLogItem(row)),
      });
    } catch (error) {
      res.status(500).json({
        message: '系统日志查询失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });
};
