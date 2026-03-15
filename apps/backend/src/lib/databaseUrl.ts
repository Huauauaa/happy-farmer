import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const currentFileDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(currentFileDir, '..', '..');
const workspaceRoot = resolve(backendRoot, '..', '..');

const defaultJdbcUrl =
  'jdbc:mariadb://localhost:3306/farmer?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8';

export const loadBackendEnv = () => {
  const dotenvPaths = [
    resolve(process.cwd(), '.env'),
    resolve(backendRoot, '.env'),
    resolve(workspaceRoot, '.env'),
  ];
  const loadedPaths = new Set<string>();

  for (const envPath of dotenvPaths) {
    if (loadedPaths.has(envPath) || !existsSync(envPath)) {
      continue;
    }
    loadDotenv({ path: envPath, override: false });
    loadedPaths.add(envPath);
  }
};

export const resolveDatabaseUrl = (source: NodeJS.ProcessEnv = process.env): string => {
  const explicitUrl = source.DATABASE_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const jdbcUrl = source.DB_JDBC_URL?.trim() || defaultJdbcUrl;
  const normalized = jdbcUrl.startsWith('jdbc:') ? jdbcUrl.slice('jdbc:'.length) : jdbcUrl;
  const url = new URL(normalized);
  if (url.protocol !== 'mariadb:') {
    throw new Error(`Unsupported protocol in DB_JDBC_URL: ${url.protocol}`);
  }

  if (source.DB_USER?.trim()) {
    url.username = source.DB_USER.trim();
  }
  if (source.DB_PASSWORD !== undefined) {
    url.password = source.DB_PASSWORD;
  }
  if (source.DB_CONNECTION_LIMIT?.trim() && !url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', source.DB_CONNECTION_LIMIT.trim());
  }

  return url.toString();
};

export const ensureDatabaseUrl = (source: NodeJS.ProcessEnv = process.env): string => {
  const databaseUrl = resolveDatabaseUrl(source);
  source.DATABASE_URL = databaseUrl;
  return databaseUrl;
};
