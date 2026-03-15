import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProductDetailModal from './ProductDetailModal';

const detail = {
  id: 'apple-1',
  name: '红富士苹果',
  category: '水果',
  price: 12.5,
  stock: 8,
  description: '甜脆多汁，适合直接食用。',
};

describe('ProductDetailModal', () => {
  it('renders loading state while product detail is being fetched', () => {
    render(
      <ProductDetailModal
        detail={null}
        isDetailOpen
        detailLoading
        detailError={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('正在加载商品详情...')).toBeInTheDocument();
  });

  it('renders error state when detail request fails', () => {
    render(
      <ProductDetailModal
        detail={null}
        isDetailOpen
        detailLoading={false}
        detailError="商品不存在"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('详情加载失败：商品不存在')).toBeInTheDocument();
  });

  it('renders product detail and closes through modal dismiss action', () => {
    const onClose = vi.fn();

    render(
      <ProductDetailModal
        detail={detail}
        isDetailOpen
        detailLoading={false}
        detailError={null}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('商品编号：apple-1')).toBeInTheDocument();
    expect(screen.getByText('分类：水果')).toBeInTheDocument();
    expect(screen.getByText('价格：¥12.50')).toBeInTheDocument();
    expect(screen.getByText('商品介绍：甜脆多汁，适合直接食用。')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
