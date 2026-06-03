import { Pool, PoolClient, QueryResult } from 'pg';
import path from 'path';
import fs from 'fs';

let pool: Pool | null = null;

export function initPool(connectionString: string): void {
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected client error:', err.message);
  });
}

function getPool(): Pool {
  if (!pool) throw new Error('Database pool not initialized. Call initPool() first.');
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result: QueryResult<T> = await getPool().query(sql, params);
  return result.rows;
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params?: unknown[]): Promise<number> {
  const result = await getPool().query(sql, params);
  return result.rowCount ?? 0;
}

export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function reconfigurePool(cfg: {
  host: string; port: number; database: string; user: string; password: string;
}): void {
  if (pool) { pool.end().catch(() => {}); }
  pool = new Pool({
    host:                    cfg.host,
    port:                    cfg.port,
    database:                cfg.database,
    user:                    cfg.user,
    password:                cfg.password,
    max:                     10,
    idleTimeoutMillis:       30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => {
    console.error('[db] Unexpected client error:', err.message);
  });
}

// Migration runner
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         serial PRIMARY KEY,
      filename   varchar NOT NULL UNIQUE,
      applied_at timestamptz DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(): Promise<string[]> {
  const rows = await query<{ filename: string }>('SELECT filename FROM _migrations ORDER BY id');
  return rows.map(r => r.filename);
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.includes(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`[migrations] Applying ${file}...`);
    await transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
    });
    console.log(`[migrations] Applied ${file}`);
  }
}
