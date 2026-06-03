import { ipcMain } from 'electron';
import { query, queryOne, execute } from '../database';
import { validateSession } from '../middleware/permissions';
import { EmployeeDocument } from '../../shared/types';

export function registerDocumentHandlers(): void {
  ipcMain.handle('documents:list', async (_e, token: string, opts: {
    employee?: string; type?: string; year?: number;
  } = {}) => {
    await validateSession(token);
    const conds: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (opts.employee) { conds.push(`ed.employee_id=$${p++}`); params.push(opts.employee); }
    if (opts.type) { conds.push(`ed.type=$${p++}`); params.push(opts.type); }
    if (opts.year) { conds.push(`ed.year=$${p++}`); params.push(opts.year); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    return query<EmployeeDocument>(`
      SELECT ed.*, e.name AS employee_name FROM employee_documents ed
      JOIN employees e ON e.id = ed.employee_id
      ${where} ORDER BY ed.created_at DESC
    `, params);
  });

  ipcMain.handle('documents:getDocument', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<EmployeeDocument>(`
      SELECT ed.*, e.name AS employee_name FROM employee_documents ed
      JOIN employees e ON e.id = ed.employee_id WHERE ed.id = $1
    `, [id]);
  });

  ipcMain.handle('documents:createRecord', async (_e, token: string, data: Partial<EmployeeDocument>) => {
    const sess = await validateSession(token);
    if (!sess) throw new Error('Não autenticado');
    return queryOne<EmployeeDocument>(`
      INSERT INTO employee_documents (employee_id, type, name, file_path, month, year, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [data.employee_id, data.type, data.name, data.file_path, data.month, data.year, sess.id]);
  });

  ipcMain.handle('documents:deleteRecord', async (_e, token: string, id: string) => {
    const sess = await validateSession(token);
    if (!sess) throw new Error('Não autenticado');
    return execute('DELETE FROM employee_documents WHERE id=$1', [id]);
  });
}
