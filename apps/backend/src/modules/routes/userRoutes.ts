import type { AppContext } from '../AppContext.js';

export const registerUserRoutes = (context: AppContext) => {
  const { app, tableNames, db, auth, schemas, helpers, mappers } = context;

  app.get('/api/users/me', async (req, res) => {
    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      res.json({ user: mappers.toUserPublic(authResult.user) });
    } catch (error) {
      res.status(500).json({
        message: '获取用户信息失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.put('/api/users/me', async (req, res) => {
    let payload: any;
    try {
      payload = helpers.parseWithSchema(schemas.profileUpdatePayloadSchema, req.body);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }
    const hasNickname = payload.nickname !== undefined;
    const hasPhone = payload.phone !== undefined;
    const nickname = hasNickname ? helpers.parseWithSchema(schemas.nullableNicknameSchema, payload.nickname) : null;
    const phone = hasPhone ? helpers.parseWithSchema(schemas.nullablePhoneSchema, payload.phone) : null;

    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
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
      params.push(authResult.user.id);

      await db.withConnection(async (connection) => {
        await connection.query(`UPDATE ${tableNames.userTable} SET ${updates.join(', ')} WHERE id = ?`, params);
      });

      const refreshedUser = await auth.findUserByToken(authResult.token);
      if (!refreshedUser) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      res.json({
        message: '个人信息更新成功',
        user: mappers.toUserPublic(refreshedUser),
      });
    } catch (error) {
      res.status(500).json({
        message: '更新个人信息失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.put('/api/users/me/password', async (req, res) => {
    let payload: any;
    try {
      payload = helpers.parseWithSchema(schemas.passwordUpdatePayloadSchema, req.body);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }
    const { currentPassword, newPassword } = payload;

    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      const userRows = await db.withConnection(async (connection) => {
        return (await connection.query(
          `SELECT id, password_hash, password_salt FROM ${tableNames.userTable} WHERE id = ? LIMIT 1`,
          [authResult.user.id],
        )) as Array<{ id: number; password_hash: string; password_salt: string }>;
      });

      const user = userRows[0];
      if (!user || !helpers.verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
        res.status(400).json({ message: '当前密码错误' });
        return;
      }

      const { hash, salt } = helpers.hashPassword(newPassword);
      await db.withConnection(async (connection) => {
        await connection.query(
          `UPDATE ${tableNames.userTable} SET password_hash = ?, password_salt = ? WHERE id = ?`,
          [hash, salt, authResult.user.id],
        );
        await connection.query(`DELETE FROM ${tableNames.sessionTable} WHERE user_id = ? AND token <> ?`, [
          authResult.user.id,
          authResult.token,
        ]);
      });

      res.json({ message: '密码修改成功' });
    } catch (error) {
      res.status(500).json({
        message: '修改密码失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });
};
