import { randomBytes } from 'node:crypto';

import type { AppContext } from '../AppContext.js';

export const registerAuthRoutes = (context: AppContext) => {
  const { app, prisma, db, schemas, helpers, mappers, sessionExpireDays } = context;

  app.post('/api/auth/register', async (req, res) => {
    let payload: any;
    try {
      payload = helpers.parseWithSchema(schemas.registerPayloadSchema, req.body);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }

    const { username, password, nickname, phone } = payload;

    try {
      const existingUser = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (existingUser) {
        res.status(409).json({ message: '用户名已存在' });
        return;
      }

      const { hash, salt } = helpers.hashPassword(password);
      await prisma.user.create({
        data: {
          username,
          passwordHash: hash,
          passwordSalt: salt,
          nickname,
          phone,
        },
      });

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'auth',
        action: 'register',
        message: `用户注册成功: ${username}`,
      });

      res.status(201).json({ message: '注册成功' });
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      res.status(500).json({
        message: '注册失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    let payload: any;
    try {
      payload = helpers.parseWithSchema(schemas.loginPayloadSchema, req.body);
    } catch (error) {
      if (helpers.isApiError(error)) {
        res.status((error as { status: number }).status).json({ message: (error as Error).message });
        return;
      }
      throw error;
    }

    const { username, password } = payload;

    try {
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          nickname: true,
          phone: true,
          balance: true,
          isAdmin: true,
          createdAt: true,
          passwordHash: true,
          passwordSalt: true,
        },
      });

      if (!user || !helpers.verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        res.status(401).json({ message: '账号或密码错误' });
        return;
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + sessionExpireDays * 24 * 60 * 60 * 1000);

      await prisma.$transaction([
        prisma.userSession.create({
          data: {
            token,
            userId: user.id,
            expiresAt,
          },
        }),
        prisma.userSession.deleteMany({
          where: {
            userId: user.id,
            expiresAt: {
              lte: new Date(),
            },
          },
        }),
      ]);

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'auth',
        action: 'login',
        message: `用户登录成功: ${user.username}`,
        actorUserId: Number(user.id),
      });

      res.json({
        token,
        expiresAt: expiresAt.toISOString(),
        user: mappers.toUserPublic(user),
      });
    } catch (error) {
      res.status(500).json({
        message: '登录失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const token = helpers.getBearerToken(req.header('authorization'));
      if (!token) {
        res.json({ message: '已退出登录' });
        return;
      }

      await prisma.userSession.deleteMany({
        where: { token },
      });

      await db.appendSystemLogSafely({
        level: 'INFO',
        module: 'auth',
        action: 'logout',
        message: '用户安全退出',
      });

      res.json({ message: '已退出登录' });
    } catch (error) {
      res.status(500).json({
        message: '退出登录失败',
        error: helpers.readErrorMessage(error),
      });
    }
  });
};
