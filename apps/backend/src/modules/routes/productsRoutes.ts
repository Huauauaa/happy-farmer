import type { Prisma } from '../../generated/prisma/client.js';
import type { AppContext } from '../AppContext.js';

export const registerProductsRoutes = (context: AppContext) => {
  const { app, prisma, serviceName, helpers, mappers } = context;

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
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

    const where: Prisma.ProductWhereInput = {};
    if (keyword !== '') {
      where.name = {
        contains: keyword,
      };
    }
    if (category !== '') {
      where.category = category;
    }

    try {
      const rows = await prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          stock: true,
        },
        orderBy: {
          id: 'asc',
        },
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
      const [categoryRows, productCategoryRows] = await Promise.all([
        prisma.productCategory.findMany({
          select: {
            name: true,
          },
          orderBy: {
            name: 'asc',
          },
        }),
        prisma.product.findMany({
          where: {
            category: {
              not: '',
            },
          },
          distinct: ['category'],
          select: {
            category: true,
          },
        }),
      ]);

      const items = Array.from(
        new Set([
          ...categoryRows.map((row) => row.name),
          ...productCategoryRows.map((row) => row.category),
        ]),
      ).sort((left, right) => left.localeCompare(right, 'zh-CN'));

      res.json({ items });
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
      const row = await prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          stock: true,
          description: true,
        },
      });

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
