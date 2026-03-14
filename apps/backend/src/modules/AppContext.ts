import type { Express } from 'express';
import type { PoolConnection } from 'mariadb';

export type AuthenticatedUser = {
  id: string | number;
  username: string;
  is_admin: number;
  [key: string]: unknown;
};

export type AuthResult = {
  token: string;
  user: AuthenticatedUser;
};

export type LogPayload = {
  level: 'INFO' | 'WARN' | 'ERROR';
  module: string;
  action: string;
  message: string;
  actorUserId?: string | number | null;
};

export type AppContext = {
  app: Express;
  serviceName: string;
  tableNames: {
    productTable: string;
    categoryTable: string;
    cartTable: string;
    orderTable: string;
    orderItemTable: string;
    systemLogTable: string;
    userTable: string;
    sessionTable: string;
  };
  sessionExpireDays: number;
  pool: {
    getConnection: () => Promise<PoolConnection>;
  };
  ApiError: new (status: number, message: string) => Error & { status: number };
  db: {
    withConnection: <T>(handler: (connection: PoolConnection) => Promise<T>) => Promise<T>;
    appendSystemLogSafely: (params: LogPayload) => Promise<void>;
  };
  auth: {
    findUserByToken: (token: string) => Promise<AuthenticatedUser | null>;
    requireAuth: (authorizationHeader: string | undefined) => Promise<AuthResult | null>;
    requireAdminAuth: (authorizationHeader: string | undefined) => Promise<AuthResult | null>;
  };
  schemas: {
    registerPayloadSchema: unknown;
    loginPayloadSchema: unknown;
    profileUpdatePayloadSchema: unknown;
    passwordUpdatePayloadSchema: unknown;
    cartAddPayloadSchema: unknown;
    cartUpdatePayloadSchema: unknown;
    adminCategoryCreatePayloadSchema: unknown;
    adminProductCreatePayloadSchema: unknown;
    adminUserUpdatePayloadSchema: unknown;
    adminSystemLogsQuerySchema: unknown;
    nullableNicknameSchema: unknown;
    nullablePhoneSchema: unknown;
  };
  helpers: {
    parseWithSchema: (schema: unknown, value: unknown) => any;
    isApiError: (error: unknown) => boolean;
    readErrorMessage: (error: unknown) => string;
    getQueryText: (value: unknown) => string;
    getBearerToken: (header: string | undefined) => string | null;
    toNumber: (value: string | number) => number;
    formatTimestamp: (value: string | Date) => string;
    formatNullableTimestamp: (value: Date | string | null) => string | null;
    toPositiveInt: (value: unknown) => number | null;
    hashPassword: (password: string) => { salt: string; hash: string };
    verifyPassword: (password: string, salt: string, expectedHash: string) => boolean;
    generateOrderNo: () => string;
  };
  mappers: {
    toProductSummary: (row: any) => any;
    toProductDetail: (row: any) => any;
    toUserPublic: (row: any) => any;
    toSystemLogItem: (row: any) => any;
    toOrderItem: (row: any) => any;
    toUserOrder: (order: any, items: any[]) => any;
  };
  queries: {
    fetchCartItems: (userId: string | number) => Promise<any[]>;
    fetchUserOrders: (userId: string | number) => Promise<any[]>;
  };
};
