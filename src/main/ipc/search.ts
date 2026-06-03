import { ipcMain } from 'electron';
import { query } from '../database';
import { validateSession } from '../middleware/permissions';
import { SearchResult } from '../../shared/types';

export function registerSearchHandlers(): void {
  ipcMain.handle('search:global', async (_e, token: string, q: string): Promise<SearchResult> => {
    await validateSession(token);

    if (!q || q.trim().length < 2) return { employees: [], openings: [], candidates: [] };

    const like = `%${q.trim()}%`;

    const [employees, openings, candidates] = await Promise.all([
      query<SearchResult['employees'][number]>(`
        SELECT e.id, e.name, p.title AS position_title, d.name AS department_name, e.is_active
        FROM employees e
        LEFT JOIN positions  p ON p.id = e.position_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.name ILIKE $1 OR e.cpf ILIKE $1
        ORDER BY e.is_active DESC, e.name
        LIMIT 6
      `, [like]),

      query<SearchResult['openings'][number]>(`
        SELECT jo.id, jo.title, d.name AS department_name, jo.status
        FROM job_openings jo
        LEFT JOIN departments d ON d.id = jo.department_id
        WHERE jo.title ILIKE $1 AND jo.status NOT IN ('cancelled','closed')
        ORDER BY jo.created_at DESC
        LIMIT 5
      `, [like]),

      query<SearchResult['candidates'][number]>(`
        SELECT c.id, c.name, jo.title AS opening_title, c.status
        FROM candidates c
        LEFT JOIN job_openings jo ON jo.id = c.opening_id
        WHERE c.name ILIKE $1 OR c.email ILIKE $1
        ORDER BY c.created_at DESC
        LIMIT 5
      `, [like]),
    ]);

    return { employees, openings, candidates };
  });
}
