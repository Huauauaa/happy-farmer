import type { AppContext } from '../AppContext.js';

export const registerUserRoutes = (context: AppContext) => {
  const { app, prisma, auth, schemas, helpers } = context;

  app.get('/api/users/me', async (req, res) => {
    try {
      const authResult = await auth.requireAuth(req.header('authorization'));
      if (!authResult) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      res.json({ user: authResult.user });
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

      const data: {
        nickname?: string | null;
        phone?: string | null;
      } = {};
      if (hasNickname) {
        data.nickname = nickname;
      }
      if (hasPhone) {
        data.phone = phone;
      }

      await prisma.user.update({
        where: { id: BigInt(authResult.user.id) },
        data,
      });

      const refreshedUser = await auth.findUserByToken(authResult.token);
      if (!refreshedUser) {
        res.status(401).json({ message: '登录状态无效，请重新登录' });
        return;
      }

      res.json({
        message: '个人信息更新成功',
        user: refreshedUser,
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

      const user = await prisma.user.findUnique({
        where: { id: BigInt(authResult.user.id) },
        select: {
          id: true,
          passwordHash: true,
          passwordSalt: true,
        },
      });

      if (!user || !helpers.verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)) {
        res.status(400).json({ message: '当前密码错误' });
        return;
      }

      const { hash, salt } = helpers.hashPassword(newPassword);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: hash,
            passwordSalt: salt,
          },
        }),
        prisma.userSession.deleteMany({
          where: {
            userId: user.id,
            token: {
              not: authResult.token,
            },
          },
        }),
      ]);

      res.json({ message: '密码修改成功' });
    } catch (error) {
      res.status(500).json({
        message: '修改密码失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });
};
