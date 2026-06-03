import { ipcMain } from 'electron';
import { query, queryOne, execute } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { Position } from '../../shared/types';

export function registerPositionHandlers(): void {
  ipcMain.handle('positions:list', async (_e, token: string, deptId?: string) => {
    await validateSession(token);
    if (deptId) {
      return query<Position>(`
        SELECT p.*, d.name AS department_name FROM positions p
        LEFT JOIN departments d ON d.id = p.department_id
        WHERE p.department_id = $1 ORDER BY p.title
      `, [deptId]);
    }
    return query<Position>(`
      SELECT p.*, d.name AS department_name FROM positions p
      LEFT JOIN departments d ON d.id = p.department_id ORDER BY p.title
    `);
  });

  ipcMain.handle('positions:get', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<Position>(`
      SELECT p.*, d.name AS department_name FROM positions p
      LEFT JOIN departments d ON d.id = p.department_id WHERE p.id = $1
    `, [id]);
  });

  ipcMain.handle('positions:create', async (_e, token: string, data: Partial<Position>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    return queryOne<Position>(
      `INSERT INTO positions (title, department_id, level, min_salary, max_salary)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.title, data.department_id, data.level, data.min_salary, data.max_salary]
    );
  });

  ipcMain.handle('positions:update', async (_e, token: string, id: string, data: Partial<Position>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    return queryOne<Position>(
      `UPDATE positions SET title=$1, department_id=$2, level=$3, min_salary=$4, max_salary=$5 WHERE id=$6 RETURNING *`,
      [data.title, data.department_id, data.level, data.min_salary, data.max_salary, id]
    );
  });

  ipcMain.handle('positions:delete', async (_e, token: string, id: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    const used = await queryOne<{ c: string }>('SELECT COUNT(*) AS c FROM employees WHERE position_id=$1', [id]);
    if (parseInt(used?.c ?? '0') > 0) throw new Error('Cargo em uso por funcionários');
    return execute('DELETE FROM positions WHERE id=$1', [id]);
  });
}
