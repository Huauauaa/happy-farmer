import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProductsTab from './ProductsTab';

const product = {
  id: 'apple-1',
  name: '红富士苹果',
  category: '水果',
  price: 12.5,
  stock: 8,
};

const createProps = (overrides: Partial<ComponentProps<typeof ProductsTab>> = {}) => ({
  selectedCategory: '水果',
  categoryLoading: false,
  categories: ['水果', '蔬菜'],
  keyword: '苹果',
  loading: false,
  error: null,
  token: 'token-123',
  products: [product],
  setSelectedCategory: vi.fn(),
  setKeyword: vi.fn(),
  fetchProducts: vi.fn().mockResolvedValue(undefined),
  fetchProductDetail: vi.fn().mockResolvedValue(undefined),
  handleAddToCart: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('ProductsTab', () => {
  it('calls fetchProducts with current filters when search button is clicked', () => {
    const props = createProps();

    render(<ProductsTab {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '搜索' }));

    expect(props.fetchProducts).toHaveBeenCalledWith('苹果', '水果');
  });

  it('updates keyword and opens detail for the selected product', () => {
    const props = createProps();

    render(<ProductsTab {...props} />);

    fireEvent.change(screen.getByPlaceholderText('请输入商品名称，例如：苹果'), {
      target: { value: '香蕉' },
    });
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));

    expect(props.setKeyword).toHaveBeenCalledWith('香蕉');
    expect(props.fetchProductDetail).toHaveBeenCalledWith('apple-1');
  });

  it('shows guest hint and disables add-to-cart before login', () => {
    const props = createProps({ token: '' });

    render(<ProductsTab {...props} />);

    expect(screen.getByText('登录后可将商品加入购物车')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '加入购物车' })).toBeDisabled();
  });

  it('adds the current product to cart for logged in users', () => {
    const props = createProps();

    render(<ProductsTab {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '加入购物车' }));

    expect(props.handleAddToCart).toHaveBeenCalledWith('apple-1');
  });
});
