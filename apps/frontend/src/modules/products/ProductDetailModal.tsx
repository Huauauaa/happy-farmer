import { Modal, Space, Typography } from 'antd';

type ProductDetail = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
};

type ProductDetailModalProps = {
  detail: ProductDetail | null;
  isDetailOpen: boolean;
  detailLoading: boolean;
  detailError: string | null;
  onClose: () => void;
};

function ProductDetailModal({ detail, isDetailOpen, detailLoading, detailError, onClose }: ProductDetailModalProps) {
  return (
    <Modal title={detail?.name ?? '商品详情'} open={isDetailOpen} onCancel={onClose} footer={null}>
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
          <Typography.Paragraph style={{ marginBottom: 0 }}>商品介绍：{detail.description}</Typography.Paragraph>
        </Space>
      ) : null}
    </Modal>
  );
}

export default ProductDetailModal;
