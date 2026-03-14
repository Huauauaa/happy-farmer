import { Button, Empty, Input, List, Select, Space, Tag } from 'antd';

type ProductSummary = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
};

type ProductsTabProps = {
  selectedCategory: string;
  categoryLoading: boolean;
  categories: string[];
  keyword: string;
  loading: boolean;
  error: string | null;
  token: string;
  products: ProductSummary[];
  setSelectedCategory: (value: string) => void;
  setKeyword: (value: string) => void;
  fetchProducts: (keywordValue: string, categoryValue: string) => Promise<void>;
  fetchProductDetail: (id: string) => Promise<void>;
  handleAddToCart: (productId: string) => Promise<void>;
};

function ProductsTab({
  selectedCategory,
  categoryLoading,
  categories,
  keyword,
  loading,
  error,
  token,
  products,
  setSelectedCategory,
  setKeyword,
  fetchProducts,
  fetchProductDetail,
  handleAddToCart,
}: ProductsTabProps) {
  return (
    <>
      <Space wrap style={{ width: '100%', marginBottom: 16 }}>
        <Select
          style={{ width: 200 }}
          value={selectedCategory}
          loading={categoryLoading}
          options={[
            { label: '全部分类', value: '' },
            ...categories.map((category) => ({
              label: category,
              value: category,
            })),
          ]}
          onChange={(nextCategory) => {
            setSelectedCategory(nextCategory);
            void fetchProducts(keyword, nextCategory);
          }}
        />
        <Input
          style={{ minWidth: 260, flex: 1 }}
          placeholder="请输入商品名称，例如：苹果"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
          }}
          onPressEnter={() => {
            void fetchProducts(keyword, selectedCategory);
          }}
        />
        <Button type="primary" loading={loading} onClick={() => void fetchProducts(keyword, selectedCategory)}>
          搜索
        </Button>
      </Space>

      {error ? (
        <Tag color="error" style={{ marginBottom: 12 }}>
          搜索失败：{error}
        </Tag>
      ) : null}
      {token === '' ? (
        <Tag color="default" style={{ marginBottom: 12 }}>
          登录后可将商品加入购物车
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
              <Button
                key={`cart-${product.id}`}
                type="link"
                disabled={token === ''}
                onClick={() => void handleAddToCart(product.id)}
              >
                加入购物车
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
    </>
  );
}

export default ProductsTab;
