import { IpcMainInvokeEvent } from 'electron';
import { query } from '../database';
import { UnauthorizedError } from '../../shared/types';

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role_id: string;
  permissions: string[];
  avatar_initials?: string;
  avatar_color: string;
}

const sessionCache = new Map<string, { user: SessionUser; expiresAt: Date }>();

export async function validateSession(token: string): Promise<SessionUser | null> {
  const cached = sessionCache.get(token);
  if (cached && cached.expiresAt > new Date()) return cached.user;

  const rows = await query<{
    user_id: string; expires_at: string; name: string; email: string;
    role_id: string; permissions: string[]; avatar_initials?: string; avatar_color: string;
    is_active: boolean;
  }>(`
    SELECT s.user_id, s.expires_at, u.name, u.email, u.role_id, u.avatar_initials,
           u.avatar_color, u.is_active, r.permissions
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN roles r ON r.id = u.role_id
    WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true
  `, [token]);

  if (rows.length === 0) return null;
  const row = rows[0]!;

  const user: SessionUser = {
    id: row.user_id,
    name: row.name,
    email: row.email,
    role_id: row.role_id,
    permissions: row.permissions,
    avatar_initials: row.avatar_initials,
    avatar_color: row.avatar_color,
  };

  sessionCache.set(token, { user, expiresAt: new Date(row.expires_at) });
  return user;
}

export function invalidateSessionCache(token: string): void {
  sessionCache.delete(token);
}

export function hasPermission(permissions: string[], required: string): boolean {
  if (permissions.includes('*')) return true;
  if (permissions.includes(required)) return true;

  // Check prefix wildcard: e.g. 'employees:*' matches 'employees:read'
  const [ns] = required.split(':');
  return permissions.includes(`${ns}:*`);
}

export function requirePermission(
  permission: string
): (event: IpcMainInvokeEvent, token: string, ...args: unknown[]) => Promise<void> {
  return async (_event, token, ..._args) => {
    if (!token) {
      throw Object.assign(new Error('Não autenticado'), { code: 'UNAUTHORIZED' } as UnauthorizedError);
    }
    const user = await validateSession(token);
    if (!user) {
      throw Object.assign(new Error('Sessão expirada'), { code: 'UNAUTHORIZED' } as UnauthorizedError);
    }
    if (!hasPermission(user.permissions, permission)) {
      throw Object.assign(new Error(`Permissão insuficiente: ${permission}`), {
        code: 'UNAUTHORIZED',
        requiredPermission: permission,
      } as UnauthorizedError);
    }
  };
}

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  return validateSession(token);
}
