import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
};

const products: Product[] = [
  {
    id: 'p-1001',
    name: '有机西红柿',
    category: '蔬菜',
    price: 9.9,
    stock: 86,
    description: '自然成熟、皮薄多汁，适合凉拌和炒菜。',
  },
  {
    id: 'p-1002',
    name: '新鲜黄瓜',
    category: '蔬菜',
    price: 6.5,
    stock: 120,
    description: '脆嫩清甜，可直接生食或作为沙拉配菜。',
  },
  {
    id: 'p-1003',
    name: '高山土豆',
    category: '根茎',
    price: 5.2,
    stock: 200,
    description: '粉糯口感，适合炖煮、焖烧和炸制。',
  },
  {
    id: 'p-1004',
    name: '精品红富士苹果',
    category: '水果',
    price: 12.8,
    stock: 65,
    description: '果肉紧实、甜酸平衡，适合日常鲜食。',
  },
  {
    id: 'p-1005',
    name: '海南香蕉',
    category: '水果',
    price: 8.6,
    stock: 92,
    description: '成熟度适中，香甜软糯，便于即食。',
  },
  {
    id: 'p-1006',
    name: '散养土鸡蛋',
    category: '蛋类',
    price: 18.0,
    stock: 40,
    description: '每日新鲜采集，蛋黄饱满，营养均衡。',
  },
];

const getKeyword = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }
  return '';
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'happy-farmer-backend' });
});

app.get('/api/products', (req, res) => {
  const keyword = getKeyword(req.query.keyword).toLowerCase();
  const matchedProducts = keyword
    ? products.filter((product) => product.name.toLowerCase().includes(keyword))
    : products;

  const items = matchedProducts.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    stock: product.stock,
  }));

  res.json({
    keyword,
    total: items.length,
    items,
  });
});

app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const product = products.find((item) => item.id === id);

  if (!product) {
    res.status(404).json({ message: '商品不存在' });
    return;
  }

  res.json(product);
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
