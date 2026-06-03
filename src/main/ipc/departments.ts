import { ipcMain } from 'electron';
import { query, queryOne, execute } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { Department } from '../../shared/types';

export function registerDepartmentHandlers(): void {
  ipcMain.handle('departments:list', async (_e, token: string) => {
    await validateSession(token);
    return query<Department>(`
      SELECT d.*, e.name AS manager_name, COUNT(emp.id)::int AS headcount
      FROM departments d
      LEFT JOIN employees e ON e.id = d.manager_id
      LEFT JOIN employees emp ON emp.department_id = d.id AND emp.is_active = true
      GROUP BY d.id, e.name ORDER BY d.name
    `);
  });

  ipcMain.handle('departments:get', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<Department>(`
      SELECT d.*, e.name AS manager_name
      FROM departments d LEFT JOIN employees e ON e.id = d.manager_id
      WHERE d.id = $1
    `, [id]);
  });

  ipcMain.handle('departments:create', async (_e, token: string, data: { name: string; cost_center?: string; manager_id?: string }) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    return queryOne<Department>(
      `INSERT INTO departments (name, cost_center, manager_id) VALUES ($1,$2,$3) RETURNING *`,
      [data.name, data.cost_center, data.manager_id ?? null]
    );
  });

  ipcMain.handle('departments:update', async (_e, token: string, id: string, data: Partial<Department>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    return queryOne<Department>(
      `UPDATE departments SET name=$1, cost_center=$2, manager_id=$3 WHERE id=$4 RETURNING *`,
      [data.name, data.cost_center, data.manager_id ?? null, id]
    );
  });

  ipcMain.handle('departments:delete', async (_e, token: string, id: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    const headcount = await queryOne<{ c: string }>(
      `SELECT COUNT(*) AS c FROM employees WHERE department_id=$1 AND is_active=true`, [id]
    );
    if (parseInt(headcount?.c ?? '0') > 0) throw new Error('Não é possível excluir departamento com funcionários ativos');
    return execute('DELETE FROM departments WHERE id=$1', [id]);
  });

  ipcMain.handle('departments:getHeadcount', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<{ headcount: number }>(
      `SELECT COUNT(*)::int AS headcount FROM employees WHERE department_id=$1 AND is_active=true`, [id]
    );
  });
}
