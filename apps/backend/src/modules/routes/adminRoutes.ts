import type { AppContext } from '../AppContext.js';

export const registerAdminRoutes = (context: AppContext) => {
  const { app, tableNames, db, auth, schemas, helpers, mappers, ApiError } = context;

  app.get('/api/admin/categories', async (req, res) => {
    try {
      const adminAuth = await auth.requireAdminAuth(req.header('authorization'));
      if (!adminAuth) {
        res.status(403).json({ message: '仅管理员可访问' });
        return;
      }

      const rows = await db.withConnection(async (connection) => {
        return (await connection.query(
          `SELECT id, name FROM ${tableNames.categoryTable} ORDER BY name`,
        )) as Array<{ id: string | number; name: string }>;
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

      await db.withConnection(async (connection) => {
        const exists = (await connection.query(
          `SELECT id FROM ${tableNames.categoryTable} WHERE name = ? LIMIT 1`,
          [name],
        )) as Array<{ id: number }>;
        if (exists.length > 0) {
          throw new ApiError(409, '分类已存在');
        }
        await connection.query(`INSERT INTO ${tableNames.categoryTable} (name) VALUES (?)`, [name]);
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

      await db.withConnection(async (connection) => {
        const categoryRows = (await connection.query(
          `SELECT name FROM ${tableNames.categoryTable} WHERE id = ? LIMIT 1`,
          [categoryId],
        )) as Array<{ name: string }>;
        const category = categoryRows[0];
        if (!category) {
          throw new ApiError(404, '分类不存在');
        }

        const productCountRows = (await connection.query(
          `SELECT COUNT(1) AS total FROM ${tableNames.productTable} WHERE category = ?`,
          [category.name],
        )) as Array<{ total: string | number }>;
        if (helpers.toNumber(productCountRows[0]?.total ?? 0) > 0) {
          throw new ApiError(400, '分类下存在商品，无法删除');
        }

        await connection.query(`DELETE FROM ${tableNames.categoryTable} WHERE id = ?`, [categoryId]);
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
      const rows = await db.withConnection(async (connection) => {
        return (await connection.query(
          `SELECT id, name, category, price, stock, description FROM ${tableNames.productTable}${whereClause} ORDER BY id`,
          params,
        )) as any[];
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

      await db.withConnection(async (connection) => {
        const duplicatedRows = (await connection.query(
          `SELECT id FROM ${tableNames.productTable} WHERE id = ? OR name = ? LIMIT 1`,
          [id, name],
        )) as Array<{ id: string }>;
        if (duplicatedRows.length > 0) {
          throw new ApiError(409, '商品已存在，不能重复添加');
        }

        await connection.query(
          `
          INSERT INTO ${tableNames.productTable} (id, name, category, price, stock, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          [id, name, category, price, stock, description],
        );
        await connection.query(`INSERT IGNORE INTO ${tableNames.categoryTable} (name) VALUES (?)`, [category]);
      });

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

      await db.withConnection(async (connection) => {
        const exists = (await connection.query(
          `SELECT id FROM ${tableNames.productTable} WHERE id = ? LIMIT 1`,
          [id],
        )) as Array<{ id: string }>;
        if (exists.length === 0) {
          throw new ApiError(404, '商品不存在');
        }
        await connection.query(`DELETE FROM ${tableNames.cartTable} WHERE product_id = ?`, [id]);
        await connection.query(`DELETE FROM ${tableNames.productTable} WHERE id = ?`, [id]);
      });

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

      const rows = await db.withConnection(async (connection) => {
        return (await connection.query(
          `
          SELECT
            o.order_no,
            o.total_amount,
            o.status,
            o.created_at,
            o.paid_at,
            u.username
          FROM ${tableNames.orderTable} o
          INNER JOIN ${tableNames.userTable} u ON o.user_id = u.id
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
          totalAmount: helpers.toNumber(row.total_amount),
          status: row.status,
          createdAt: helpers.formatTimestamp(row.created_at),
          paidAt: helpers.formatNullableTimestamp(row.paid_at),
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

      const params: string[] = [];
      const whereClause =
        keyword === ''
          ? ''
          : (() => {
              params.push(`%${keyword}%`);
              return ' WHERE username LIKE ?';
            })();
      const rows = await db.withConnection(async (connection) => {
        return (await connection.query(
          `
          SELECT id, username, nickname, phone, balance, is_admin, created_at
          FROM ${tableNames.userTable}
          ${whereClause}
          ORDER BY id
        `,
          params,
        )) as any[];
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

      await db.withConnection(async (connection) => {
        const result = await connection.query(
          `UPDATE ${tableNames.userTable} SET ${updates.join(', ')} WHERE id = ?`,
          params,
        );
        if ((result as { affectedRows?: number }).affectedRows === 0) {
          throw new ApiError(404, '用户不存在');
        }
      });

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

      const rows = await db.withConnection(async (connection) => {
        return (await connection.query(
          `
          SELECT id, level, module, action, message, actor_user_id, created_at
          FROM ${tableNames.systemLogTable}
          ORDER BY id DESC
          LIMIT ?
        `,
          [normalizedLimit],
        )) as any[];
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
