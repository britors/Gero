import { ipcMain } from 'electron';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { writeSetupConfig, PgConfig, CompanyProfile, SetupConfig } from '../setup-config';
import { reconfigurePool, runMigrations, query, execute } from '../database';

interface SetupPayload {
  pg:               PgConfig;
  company?:         CompanyProfile;
  admin?:           { name: string; email: string; password: string };
  isExistingDb:     boolean;
  setupCompletedAt: string;
}

export function registerSetupHandlers(onComplete: () => Promise<void>): void {

  ipcMain.handle('setup:checkPgConnection', async (_e, pgCfg: PgConfig) => {
    const p = new Pool({ ...pgCfg, max: 1, connectionTimeoutMillis: 5000 });
    try {
      await p.query('SELECT 1');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      await p.end().catch(() => {});
    }
  });

  ipcMain.handle('setup:checkPgExists', async (_e, pgCfg: PgConfig) => {
    const p = new Pool({ ...pgCfg, max: 1, connectionTimeoutMillis: 5000 });
    try {
      const tables = await p.query<{ count: string }>(`
        SELECT COUNT(*) AS count FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      `);
      if (parseInt(tables.rows[0]!.count) === 0) return { exists: false };
      const users = await p.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users WHERE is_active = true`
      );
      return { exists: true, userCount: parseInt(users.rows[0]!.count) };
    } catch {
      return { exists: false };
    } finally {
      await p.end().catch(() => {});
    }
  });

  ipcMain.handle('setup:complete', async (_e, payload: SetupPayload) => {
    reconfigurePool(payload.pg);
    await runMigrations();

    if (!payload.isExistingDb && payload.admin) {
      const { name, password } = payload.admin;
      const email = payload.admin.email.trim().toLowerCase();
      const hash = await bcrypt.hash(password, 12);
      const initials = name.split(' ').slice(0, 2).map((p: string) => p[0]).join('').toUpperCase();
      const roles = await query<{ id: string }>(`SELECT id FROM roles WHERE name = 'admin'`);
      const roleId = roles[0]?.id ?? null;
      await execute(
        `INSERT INTO users (name, email, password_hash, role_id, avatar_initials, avatar_color)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING`,
        [name, email, hash, roleId, initials, '#EF9F27']
      );
    }

    const cfg: SetupConfig = {
      pg:               payload.pg,
      company:          payload.company,
      setupCompletedAt: payload.setupCompletedAt,
    };
    writeSetupConfig(cfg);
    void onComplete();
  });
}
