import bcrypt from 'bcrypt';
import { initPool, query, execute, closePool } from './database';
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
    if (key && rest.length > 0) process.env[key.trim()] = rest.join('=').trim();
  }
}

interface SeedUser {
  name: string;
  email: string;
  password: string;
  roleName: string;
  avatarInitials: string;
}

const SEED_USERS: SeedUser[] = [
  { name: 'Rodrigo Brito',  email: 'rodrigo@w3ti.com.br',  password: 'Admin@123',   roleName: 'admin',      avatarInitials: 'RB' },
  { name: 'RH Demo',        email: 'rh@w3ti.com.br',        password: 'RH@123',      roleName: 'hr_manager', avatarInitials: 'RH' },
  { name: 'Gestor Demo',    email: 'gestor@w3ti.com.br',    password: 'Manager@123', roleName: 'manager',    avatarInitials: 'GD' },
  { name: 'Dev Demo',       email: 'dev@w3ti.com.br',       password: 'Dev@123',     roleName: 'developer',  avatarInitials: 'DD' },
];

async function main(): Promise<void> {
  loadEnv();
  const connStr = process.env['DATABASE_URL'] ||
    `postgresql://${process.env['DB_USER'] || 'postgres'}:${process.env['DB_PASS'] || 'postgres'}@${process.env['DB_HOST'] || 'localhost'}:${process.env['DB_PORT'] || '5432'}/${process.env['DB_NAME'] || 'gero'}`;

  initPool(connStr);
  try {
    for (const u of SEED_USERS) {
      const existing = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [u.email]);
      if (existing.length > 0) {
        console.log(`[seed] User ${u.email} already exists, skipping.`);
        continue;
      }

      const roleRows = await query<{ id: string }>('SELECT id FROM roles WHERE name = $1', [u.roleName]);
      if (roleRows.length === 0) {
        console.warn(`[seed] Role '${u.roleName}' not found — did you run migration 002?`);
        continue;
      }
      const roleId = roleRows[0]!.id;
      const hash = await bcrypt.hash(u.password, 12);

      await execute(
        `INSERT INTO users (name, email, password_hash, role_id, avatar_initials) VALUES ($1,$2,$3,$4,$5)`,
        [u.name, u.email, hash, roleId, u.avatarInitials]
      );
      console.log(`[seed] Created user: ${u.email} (${u.roleName})`);
    }
    console.log('[seed] Done.');
  } finally {
    await closePool();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
