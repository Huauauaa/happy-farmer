import { Button, Card, Empty, Input, List, Modal, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

type ProductSummary = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
};

type ProductDetail = ProductSummary & {
  description: string;
};

type ProductSearchResponse = {
  keyword: string;
  total: number;
  items: ProductSummary[];
};

function App() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDetail | null>(null);

  const fetchProducts = async (keywordValue: string) => {
    setLoading(true);
    setError(null);

    try {
      const query = encodeURIComponent(keywordValue.trim());
      const response = await fetch(`/api/products?keyword=${query}`);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = (await response.json()) as ProductSearchResponse;
      setProducts(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductDetail = async (id: string) => {
    setIsDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    try {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = (await response.json()) as ProductDetail;
      setDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts('');
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <Card className="mx-auto max-w-4xl shadow-sm">
        <Typography.Title level={2} style={{ marginTop: 0 }}>
          商品搜索（游客模式）
        </Typography.Title>
        <Typography.Paragraph>
          无需登录即可按商品名称搜索，并可查看商品详情（库存、分类、价格、描述）。
        </Typography.Paragraph>

        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            placeholder="请输入商品名称，例如：苹果"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
            }}
            onPressEnter={() => {
              void fetchProducts(keyword);
            }}
          />
          <Button type="primary" loading={loading} onClick={() => void fetchProducts(keyword)}>
            搜索
          </Button>
        </Space.Compact>

        {error ? (
          <Tag color="error" style={{ marginBottom: 12 }}>
            搜索失败：{error}
          </Tag>
        ) : null}

        <List
          loading={loading}
          locale={{ emptyText: <Empty description="未找到匹配商品" /> }}
          dataSource={products}
          renderItem={(product) => (
            <List.Item
              key={product.id}
              actions={[
                <Button key={`detail-${product.id}`} type="link" onClick={() => void fetchProductDetail(product.id)}>
                  查看详情
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={product.name}
                description={
                  <Space size={8} wrap>
                    <Tag color="blue">{product.category}</Tag>
                    <Tag color="gold">¥{product.price.toFixed(2)}</Tag>
                    <Tag color={product.stock > 0 ? 'green' : 'red'}>
                      {product.stock > 0 ? `库存 ${product.stock}` : '缺货'}
                    </Tag>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={detail?.name ?? '商品详情'}
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        footer={null}
      >
        {detailLoading ? (
          <Typography.Paragraph>正在加载商品详情...</Typography.Paragraph>
        ) : detailError ? (
          <Typography.Text type="danger">详情加载失败：{detailError}</Typography.Text>
        ) : detail ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text>商品编号：{detail.id}</Typography.Text>
            <Typography.Text>分类：{detail.category}</Typography.Text>
            <Typography.Text>价格：¥{detail.price.toFixed(2)}</Typography.Text>
            <Typography.Text>剩余库存：{detail.stock}</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              商品介绍：{detail.description}
            </Typography.Paragraph>
          </Space>
        ) : null}
      </Modal>
    </main>
  );
}

export default App;
