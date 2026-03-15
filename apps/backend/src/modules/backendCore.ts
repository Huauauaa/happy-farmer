import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const parseJdbcUrl = (value: string) => {
  const normalized = value.startsWith('jdbc:') ? value.slice('jdbc:'.length) : value;
  const url = new URL(normalized);
  if (url.protocol !== 'mariadb:') {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }

  const database = url.pathname.replace(/^\/+/, '');
  if (!database) {
    throw new Error('Database name is required in DB_JDBC_URL');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    database,
    sslEnabled: url.searchParams.get('useSSL') === 'true',
    timezone: url.searchParams.get('serverTimezone') ?? undefined,
    charset: url.searchParams.get('characterEncoding') ?? undefined,
  };
};

export const getQueryText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }
  return '';
};

export const toNumber = (value: string | number): number => {
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
};

export const formatTimestamp = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

export const formatNullableTimestamp = (value: Date | string | null): string | null => {
  if (value === null) {
    return null;
  }
  return formatTimestamp(value);
};

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,32}$/, '用户名需为 3-32 位，仅可包含字母、数字、下划线');

const passwordSchema = z
  .string()
  .min(6, '密码长度需在 6 到 64 位之间')
  .max(64, '密码长度需在 6 到 64 位之间');

const phoneRegex = /^[0-9+\- ]{6,32}$/;

export const nullablePhoneSchema = z
  .string()
  .trim()
  .transform((text) => (text === '' ? null : text))
  .nullable()
  .refine((text) => text === null || phoneRegex.test(text), '手机号格式不正确');

export const nullableNicknameSchema = z
  .string()
  .trim()
  .transform((text) => (text === '' ? null : text))
  .nullable()
  .refine((text) => text === null || text.length <= 128, '昵称最长 128 个字符');

const positiveIntSchema = z.coerce.number().int().positive('数量必须为正整数');

const zodErrorMessage = (error: z.ZodError): string => error.issues[0]?.message ?? '请求参数不合法';

export const parseWithSchema = <S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, zodErrorMessage(parsed.error));
  }
  return parsed.data;
};

export const registerPayloadSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  nickname: z.string().optional().default('').pipe(nullableNicknameSchema),
  phone: z.string().optional().default('').pipe(nullablePhoneSchema),
});

export const loginPayloadSchema = z.object({
  username: z.string().trim().min(1, '账号和密码不能为空'),
  password: z.string().min(1, '账号和密码不能为空'),
});

export const profileUpdatePayloadSchema = z
  .object({
    nickname: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine(
    (payload) => payload.nickname !== undefined || payload.phone !== undefined,
    '至少传入一个可更新字段',
  );

export const passwordUpdatePayloadSchema = z.object({
  currentPassword: z.string().min(1, '当前密码和新密码不能为空'),
  newPassword: passwordSchema,
});

export const cartAddPayloadSchema = z.object({
  productId: z.string().trim().min(1, '商品编号不能为空'),
  quantity: positiveIntSchema.default(1),
});

export const cartUpdatePayloadSchema = z.object({
  quantity: positiveIntSchema,
});

export const adminCategoryCreatePayloadSchema = z.object({
  name: z.string().trim().min(1, '分类名称不能为空'),
});

export const adminProductCreatePayloadSchema = z.object({
  id: z.string().trim().min(1, '商品编号不能为空'),
  name: z.string().trim().min(1, '商品名称不能为空'),
  category: z.string().trim().min(1, '商品分类不能为空'),
  description: z.string().trim().min(1, '商品描述不能为空'),
  price: z.coerce.number().positive('商品价格必须大于 0'),
  stock: z.coerce.number().int('库存必须是非负整数').min(0, '库存必须是非负整数'),
});

export const adminUserUpdatePayloadSchema = z
  .object({
    nickname: z.string().optional(),
    phone: z.string().optional(),
    balance: z.coerce.number().min(0, '余额必须是非负数').optional(),
    isAdmin: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
  .refine(
    (payload) =>
      payload.nickname !== undefined ||
      payload.phone !== undefined ||
      payload.balance !== undefined ||
      payload.isAdmin !== undefined,
    '至少传入一个更新字段',
  );

export const adminSystemLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
};

export const verifyPassword = (password: string, salt: string, expectedHash: string): boolean => {
  const hash = scryptSync(password, salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(hash, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
};

export const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
};

export const generateOrderNo = (): string => {
  const timePart = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);
  const randomPart = randomBytes(3).toString('hex').toUpperCase();
  return `OD${timePart}${randomPart}`;
};

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export const getBearerToken = (header: string | undefined): string | null => {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token.trim() === '' ? null : token.trim();
};

export const readErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};
