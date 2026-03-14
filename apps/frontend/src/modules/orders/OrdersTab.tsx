import { Button, Empty, List, Space, Tag, Typography } from 'antd';

type OrderItem = {
  productId: string;
  productName: string;
  category: string;
  price: number;
  quantity: number;
  subtotal: number;
};

type UserOrder = {
  orderNo: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
};

type OrdersTabProps = {
  token: string;
  orderError: string | null;
  orderMessage: string | null;
  orderLoading: boolean;
  orderItems: UserOrder[];
  formatDateTime: (value: string) => string;
  fetchOrders: (authToken: string) => Promise<void>;
  handlePayOrder: (orderNo: string) => Promise<void>;
};

function OrdersTab({
  token,
  orderError,
  orderMessage,
  orderLoading,
  orderItems,
  formatDateTime,
  fetchOrders,
  handlePayOrder,
}: OrdersTabProps) {
  if (token === '') {
    return <Typography.Paragraph>请先登录后查看订单。</Typography.Paragraph>;
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {orderError ? <Tag color="error">订单操作失败：{orderError}</Tag> : null}
      {orderMessage ? <Tag color="success">{orderMessage}</Tag> : null}
      <Button loading={orderLoading} onClick={() => void fetchOrders(token)}>
        刷新订单
      </Button>

      <List
        loading={orderLoading}
        locale={{ emptyText: <Empty description="暂无订单" /> }}
        dataSource={orderItems}
        renderItem={(order) => (
          <List.Item
            key={order.orderNo}
            actions={
              order.status === 'UNPAID'
                ? [
                    <Button key={`pay-${order.orderNo}`} type="primary" onClick={() => void handlePayOrder(order.orderNo)}>
                      立即付款
                    </Button>,
                  ]
                : []
            }
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="blue">订单号：{order.orderNo}</Tag>
                <Tag color={order.status === 'PAID' ? 'success' : 'warning'}>{order.status}</Tag>
                <Tag color="gold">金额 ¥{order.totalAmount.toFixed(2)}</Tag>
                <Tag color="default">创建于 {formatDateTime(order.createdAt)}</Tag>
              </Space>
              <List
                size="small"
                dataSource={order.items}
                renderItem={(item) => (
                  <List.Item key={`${order.orderNo}-${item.productId}`}>
                    <Space size={8} wrap>
                      <Typography.Text>{item.productName}</Typography.Text>
                      <Tag color="blue">{item.category}</Tag>
                      <Tag color="gold">¥{item.price.toFixed(2)}</Tag>
                      <Tag color="green">x{item.quantity}</Tag>
                      <Tag color="purple">¥{item.subtotal.toFixed(2)}</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            </Space>
          </List.Item>
        )}
      />
    </Space>
  );
}

export default OrdersTab;
