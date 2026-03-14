import { Button, Empty, InputNumber, List, Space, Tag, Typography } from 'antd';

type CartItem = {
  productId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  quantity: number;
  subtotal: number;
};

type CartTabProps = {
  token: string;
  cartError: string | null;
  cartMessage: string | null;
  cartLoading: boolean;
  orderLoading: boolean;
  cartItems: CartItem[];
  cartTotalAmount: number;
  fetchCart: (authToken: string) => Promise<void>;
  handleSubmitOrder: () => Promise<void>;
  handleChangeCartQuantity: (productId: string, quantity: number) => Promise<void>;
  handleRemoveFromCart: (productId: string) => Promise<void>;
};

function CartTab({
  token,
  cartError,
  cartMessage,
  cartLoading,
  orderLoading,
  cartItems,
  cartTotalAmount,
  fetchCart,
  handleSubmitOrder,
  handleChangeCartQuantity,
  handleRemoveFromCart,
}: CartTabProps) {
  if (token === '') {
    return <Typography.Paragraph>请先登录后查看购物车。</Typography.Paragraph>;
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {cartError ? <Tag color="error">购物车操作失败：{cartError}</Tag> : null}
      {cartMessage ? <Tag color="success">{cartMessage}</Tag> : null}
      <Space>
        <Button loading={cartLoading} onClick={() => void fetchCart(token)}>
          刷新购物车
        </Button>
        <Button type="primary" loading={orderLoading} onClick={() => void handleSubmitOrder()}>
          提交订单
        </Button>
      </Space>
      <Typography.Text>
        当前共 {cartItems.length} 件商品，合计 ¥{cartTotalAmount.toFixed(2)}
      </Typography.Text>

      <List
        loading={cartLoading}
        locale={{ emptyText: <Empty description="购物车为空" /> }}
        dataSource={cartItems}
        renderItem={(item) => (
          <List.Item
            key={item.productId}
            actions={[
              <InputNumber
                key={`qty-${item.productId}`}
                min={1}
                max={Math.max(item.stock, 1)}
                value={item.quantity}
                onChange={(value) => {
                  if (typeof value === 'number' && Number.isFinite(value)) {
                    void handleChangeCartQuantity(item.productId, value);
                  }
                }}
              />,
              <Button
                key={`remove-${item.productId}`}
                danger
                type="link"
                onClick={() => void handleRemoveFromCart(item.productId)}
              >
                删除
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={item.name}
              description={
                <Space size={8} wrap>
                  <Tag color="blue">{item.category}</Tag>
                  <Tag color="gold">单价 ¥{item.price.toFixed(2)}</Tag>
                  <Tag color="green">数量 {item.quantity}</Tag>
                  <Tag color="purple">小计 ¥{item.subtotal.toFixed(2)}</Tag>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Space>
  );
}

export default CartTab;
