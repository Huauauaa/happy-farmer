import { describe, expect, it } from 'vitest';

import {
  ApiError,
  adminUserUpdatePayloadSchema,
  cartAddPayloadSchema,
  formatNullableTimestamp,
  formatTimestamp,
  generateOrderNo,
  getBearerToken,
  getQueryText,
  hashPassword,
  parseJdbcUrl,
  parseWithSchema,
  readErrorMessage,
  registerPayloadSchema,
  toNumber,
  toPositiveInt,
  verifyPassword,
} from '../src/modules/backendCore.js';

describe('backendCore helpers', () => {
  it('parses JDBC url fields correctly', () => {
    expect(
      parseJdbcUrl(
        'jdbc:mariadb://127.0.0.1:3307/farmer?useSSL=true&serverTimezone=Asia/Shanghai&characterEncoding=utf8',
      ),
    ).toEqual({
      host: '127.0.0.1',
      port: 3307,
      database: 'farmer',
      sslEnabled: true,
      timezone: 'Asia/Shanghai',
      charset: 'utf8',
    });

    expect(parseJdbcUrl('mariadb://localhost/demo')).toEqual({
      host: 'localhost',
      port: 3306,
      database: 'demo',
      sslEnabled: false,
      timezone: undefined,
      charset: undefined,
    });
  });

  it('rejects unsupported JDBC protocols', () => {
    expect(() => parseJdbcUrl('jdbc:mysql://localhost:3306/demo')).toThrowError(
      'Unsupported protocol: mysql:',
    );
  });

  it('normalizes registration payloads and uses schema defaults', () => {
    const payload = parseWithSchema(registerPayloadSchema, {
      username: '  test_user  ',
      password: 'secret123',
      nickname: '  测试昵称  ',
      phone: ' 13800001111 ',
    });

    expect(payload).toEqual({
      username: 'test_user',
      password: 'secret123',
      nickname: '测试昵称',
      phone: '13800001111',
    });

    expect(
      parseWithSchema(cartAddPayloadSchema, {
        productId: 'p-1001',
      }),
    ).toEqual({
      productId: 'p-1001',
      quantity: 1,
    });
  });

  it('throws ApiError when request payload is invalid', () => {
    try {
      parseWithSchema(registerPayloadSchema, {
        username: 'x',
        password: '123',
      });
      throw new Error('expected ApiError');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect(readErrorMessage(error)).toContain('用户名需为 3-32 位');
    }
  });

  it('hashes passwords and verifies them safely', () => {
    const password = 'secret123';
    const { salt, hash } = hashPassword(password);

    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
    expect(verifyPassword(password, salt, hash)).toBe(true);
    expect(verifyPassword('wrong-password', salt, hash)).toBe(false);
    expect(verifyPassword(password, salt, 'abcd')).toBe(false);
  });

  it('parses bearer tokens and positive integers', () => {
    expect(getBearerToken('Bearer mock-token')).toBe('mock-token');
    expect(getBearerToken('Bearer   another-token   ')).toBeNull();
    expect(getBearerToken('Basic mock-token')).toBeNull();
    expect(getBearerToken(undefined)).toBeNull();

    expect(toPositiveInt(3)).toBe(3);
    expect(toPositiveInt(' 42 ')).toBe(42);
    expect(toPositiveInt('0')).toBeNull();
    expect(toPositiveInt(-1)).toBeNull();
  });

  it('formats numbers, query strings, timestamps, and order numbers', () => {
    const createdAt = new Date('2026-03-15T12:30:45.000Z');
    const orderNo = generateOrderNo();

    expect(toNumber('12.5')).toBe(12.5);
    expect(getQueryText([' apple ', 'banana'])).toBe('apple');
    expect(getQueryText(null)).toBe('');
    expect(formatTimestamp(createdAt)).toBe('2026-03-15T12:30:45.000Z');
    expect(formatNullableTimestamp(null)).toBeNull();
    expect(formatNullableTimestamp('2026-03-15T12:30:45.000Z')).toBe('2026-03-15T12:30:45.000Z');
    expect(orderNo).toMatch(/^OD\d{14}[0-9A-F]{6}$/);
  });

  it('accepts admin user update payloads with mixed field types', () => {
    expect(
      parseWithSchema(adminUserUpdatePayloadSchema, {
        balance: '88.5',
        isAdmin: 1,
      }),
    ).toEqual({
      balance: 88.5,
      isAdmin: 1,
    });
  });
});
