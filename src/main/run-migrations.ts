import { initPool, runMigrations, closePool } from './database';
import fs from 'fs';
import path from 'path';

function loadEnv(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

async function main(): Promise<void> {
  loadEnv();
  const connStr = process.env['DATABASE_URL'] ||
    `postgresql://${process.env['DB_USER'] || 'postgres'}:${process.env['DB_PASS'] || 'postgres'}@${process.env['DB_HOST'] || 'localhost'}:${process.env['DB_PORT'] || '5432'}/${process.env['DB_NAME'] || 'gero'}`;

  initPool(connStr);
  try {
    await runMigrations();
    console.log('[migrations] All migrations applied successfully.');
  } finally {
    await closePool();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
