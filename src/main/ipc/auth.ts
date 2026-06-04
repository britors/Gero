import { ipcMain } from 'electron';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { query, queryOne, execute } from '../database';
import { validateSession, invalidateSessionCache, hasPermission } from '../middleware/permissions';
import { User, Role, AuthResult } from '../../shared/types';

const SESSION_HOURS = 8;

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, email: string, password: string): Promise<AuthResult> => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await queryOne<{
      id: string; name: string; email: string; password_hash: string;
      role_id: string; role_name: string; permissions: string[];
      avatar_initials?: string; avatar_color: string; is_active: boolean;
    }>(`
      SELECT u.*, r.name AS role_name, r.permissions
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1 AND u.is_active = true
    `, [normalizedEmail]);

    if (!user) throw new Error('Credenciais inválidas');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new Error('Credenciais inválidas');

    const token = crypto.randomBytes(32).toString('hex');
    const hash  = tokenHash(token);
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

    await execute(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
      [user.id, hash, expiresAt]
    );
    await execute(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

    const result: AuthResult = {
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        role_id: user.role_id,
        role: { id: user.role_id, name: user.role_name, permissions: user.permissions, created_at: '' },
        avatar_initials: user.avatar_initials,
        avatar_color: user.avatar_color,
        is_active: true,
        created_at: '', updated_at: '',
      },
    };
    return result;
  });

  ipcMain.handle('auth:logout', async (_event, token: string): Promise<void> => {
    if (!token) return;
    await execute(`DELETE FROM user_sessions WHERE token_hash = $1`, [tokenHash(token)]);
    invalidateSessionCache(token);
  });

  ipcMain.handle('auth:me', async (_event, token: string): Promise<User | null> => {
    const user = await validateSession(token);
    if (!user) return null;

    const full = await queryOne<User & { role_name: string; permissions: string[] }>(`
      SELECT u.*, r.name AS role_name, r.permissions
      FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
    `, [user.id]);

    if (!full) return null;
    return {
      ...full,
      role: { id: full.role_id!, name: full.role_name, permissions: full.permissions, created_at: '' },
    };
  });

  ipcMain.handle('auth:listUsers', async (_event, token: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:read')) throw new Error('Sem permissão');
    return query<User>(`
      SELECT u.id, u.name, u.email, u.role_id, r.name AS role_name,
             u.avatar_initials, u.avatar_color, u.is_active, u.last_login_at, u.created_at, u.updated_at
      FROM users u LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY u.name
    `);
  });

  ipcMain.handle('auth:createUser', async (_event, token: string, data: {
    name: string; email: string; password: string; role_id: string; avatar_initials?: string;
  }) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, '*')) throw new Error('Sem permissão');
    const hash = await bcrypt.hash(data.password, 12);
    const initials = data.avatar_initials ?? data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    return execute(
      `INSERT INTO users (name, email, password_hash, role_id, avatar_initials) VALUES ($1,$2,$3,$4,$5)`,
      [data.name, data.email.trim().toLowerCase(), hash, data.role_id, initials]
    );
  });

  ipcMain.handle('auth:updateUser', async (_event, token: string, userId: string, data: Partial<User>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, '*')) throw new Error('Sem permissão');
    return execute(
      `UPDATE users SET name=$1, email=$2, role_id=$3, avatar_initials=$4, avatar_color=$5, updated_at=now() WHERE id=$6`,
      [data.name, data.email?.trim().toLowerCase(), data.role_id, data.avatar_initials, data.avatar_color, userId]
    );
  });

  ipcMain.handle('auth:deactivateUser', async (_event, token: string, userId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, '*')) throw new Error('Sem permissão');
    return execute(`UPDATE users SET is_active=false, updated_at=now() WHERE id=$1`, [userId]);
  });

  ipcMain.handle('auth:changePassword', async (_event, token: string, userId: string, newPassword: string) => {
    const sess = await validateSession(token);
    if (!sess) throw new Error('Não autenticado');
    if (sess.id !== userId && !hasPermission(sess.permissions, '*')) throw new Error('Sem permissão');
    const hash = await bcrypt.hash(newPassword, 12);
    return execute(`UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2`, [hash, userId]);
  });

  ipcMain.handle('auth:listRoles', async (_event, token: string) => {
    await validateSession(token);
    return query<Role>('SELECT * FROM roles ORDER BY name');
  });

  ipcMain.handle('auth:createRole', async (_event, token: string, data: {
    name: string; description?: string; permissions: string[];
  }) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, '*')) throw new Error('Sem permissão');
    return execute(
      `INSERT INTO roles (name, description, permissions) VALUES ($1,$2,$3)`,
      [data.name, data.description, data.permissions]
    );
  });
}
