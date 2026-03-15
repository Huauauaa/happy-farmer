import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';

const currentFileDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(currentFileDir, '..');
const workspaceRoot = resolve(backendRoot, '..', '..');
const defaultJdbcUrl =
  'jdbc:mariadb://localhost:3306/farmer?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8';

const normalizeDatabaseUrl = (rawUrl, sourceName) => {
  const normalized = rawUrl.startsWith('jdbc:') ? rawUrl.slice('jdbc:'.length) : rawUrl;
  const url = new URL(normalized);

  if (url.protocol === 'mariadb:') {
    url.protocol = 'mysql:';
  }

  if (url.protocol !== 'mysql:') {
    throw new Error(`Unsupported protocol in ${sourceName}: ${url.protocol}`);
  }

  return url.toString();
};

const loadBackendEnv = () => {
  const dotenvPaths = [
    resolve(process.cwd(), '.env'),
    resolve(backendRoot, '.env'),
    resolve(workspaceRoot, '.env'),
  ];
  const loadedPaths = new Set();

  for (const envPath of dotenvPaths) {
    if (loadedPaths.has(envPath) || !existsSync(envPath)) {
      continue;
    }
    loadDotenv({ path: envPath, override: false });
    loadedPaths.add(envPath);
  }
};

const ensureDatabaseUrl = () => {
  if (process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL.trim(), 'DATABASE_URL');
    return;
  }

  const url = new URL(
    normalizeDatabaseUrl(process.env.DB_JDBC_URL?.trim() || defaultJdbcUrl, 'DB_JDBC_URL'),
  );

  if (process.env.DB_USER?.trim()) {
    url.username = process.env.DB_USER.trim();
  }
  if (process.env.DB_PASSWORD !== undefined) {
    url.password = process.env.DB_PASSWORD;
  }
  if (process.env.DB_CONNECTION_LIMIT?.trim() && !url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT.trim());
  }

  process.env.DATABASE_URL = url.toString();
};

loadBackendEnv();
ensureDatabaseUrl();

const prismaArgs = process.argv.slice(2);
if (prismaArgs.length === 0) {
  console.error('Usage: node scripts/run-prisma-command.mjs <prisma-args...>');
  process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'prisma', ...prismaArgs], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
