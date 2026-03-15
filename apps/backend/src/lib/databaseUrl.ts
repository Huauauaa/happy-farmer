import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const currentFileDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(currentFileDir, '..', '..');
const workspaceRoot = resolve(backendRoot, '..', '..');

const defaultJdbcUrl =
  'jdbc:mariadb://localhost:3306/farmer?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8';

const normalizeDatabaseUrl = (rawUrl: string, sourceName: string): string => {
  const normalized = rawUrl.startsWith('jdbc:') ? rawUrl.slice('jdbc:'.length) : rawUrl;
  const url = new URL(normalized);

  if (url.protocol === 'mariadb:') {
    // Prisma expects MySQL-style connection strings for MariaDB.
    url.protocol = 'mysql:';
  }

  if (url.protocol !== 'mysql:') {
    throw new Error(`Unsupported protocol in ${sourceName}: ${url.protocol}`);
  }

  return url.toString();
};

const applyDatabaseCredentials = (url: URL, source: NodeJS.ProcessEnv) => {
  const explicitUsername = source.DB_USER?.trim();
  const resolvedUsername = explicitUsername || url.username || 'root';
  url.username = resolvedUsername;

  if (source.DB_PASSWORD !== undefined) {
    url.password = source.DB_PASSWORD;
    return;
  }

  if (url.password !== '') {
    return;
  }

  if (resolvedUsername === 'root' && source.MARIADB_ROOT_PASSWORD !== undefined) {
    url.password = source.MARIADB_ROOT_PASSWORD;
  }
};

const applyDatabaseOptions = (url: URL, source: NodeJS.ProcessEnv) => {
  applyDatabaseCredentials(url, source);

  if (source.DB_CONNECTION_LIMIT?.trim() && !url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', source.DB_CONNECTION_LIMIT.trim());
  }
};

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
    const url = new URL(normalizeDatabaseUrl(explicitUrl, 'DATABASE_URL'));
    applyDatabaseOptions(url, source);
    return url.toString();
  }

  const url = new URL(normalizeDatabaseUrl(source.DB_JDBC_URL?.trim() || defaultJdbcUrl, 'DB_JDBC_URL'));
  applyDatabaseOptions(url, source);

  return url.toString();
};

export const ensureDatabaseUrl = (source: NodeJS.ProcessEnv = process.env): string => {
  const databaseUrl = resolveDatabaseUrl(source);
  source.DATABASE_URL = databaseUrl;
  return databaseUrl;
};
