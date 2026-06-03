import { ipcMain } from 'electron';
import { query, queryOne, execute } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { Benefit, EmployeeBenefit } from '../../shared/types';

export function registerBenefitHandlers(): void {
  ipcMain.handle('benefits:listBenefits', async (_e, token: string) => {
    await validateSession(token);
    return query<Benefit>('SELECT * FROM benefits ORDER BY name');
  });

  ipcMain.handle('benefits:getBenefit', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<Benefit>('SELECT * FROM benefits WHERE id=$1', [id]);
  });

  ipcMain.handle('benefits:createBenefit', async (_e, token: string, data: Partial<Benefit>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'benefits:write')) throw new Error('Sem permissão');
    return queryOne<Benefit>(`
      INSERT INTO benefits (name, type, description, value) VALUES ($1,$2,$3,$4) RETURNING *
    `, [data.name, data.type, data.description, data.value]);
  });

  ipcMain.handle('benefits:updateBenefit', async (_e, token: string, id: string, data: Partial<Benefit>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'benefits:write')) throw new Error('Sem permissão');
    return queryOne<Benefit>(`
      UPDATE benefits SET name=$1, type=$2, description=$3, value=$4 WHERE id=$5 RETURNING *
    `, [data.name, data.type, data.description, data.value, id]);
  });

  ipcMain.handle('benefits:toggleBenefit', async (_e, token: string, id: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'benefits:write')) throw new Error('Sem permissão');
    return execute('UPDATE benefits SET is_active = NOT is_active WHERE id=$1', [id]);
  });

  ipcMain.handle('benefits:listEmployeeBenefits', async (_e, token: string, employeeId: string) => {
    await validateSession(token);
    return query<EmployeeBenefit>(`
      SELECT eb.*, b.name AS benefit_name, b.type AS benefit_type
      FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id
      WHERE eb.employee_id = $1 ORDER BY b.name
    `, [employeeId]);
  });

  ipcMain.handle('benefits:assignBenefit', async (_e, token: string, data: {
    employee_id: string; benefit_id: string; start_date: string; value?: number;
  }) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'benefits:write')) throw new Error('Sem permissão');
    return queryOne<EmployeeBenefit>(`
      INSERT INTO employee_benefits (employee_id, benefit_id, start_date, value)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (employee_id, benefit_id)
        DO UPDATE SET start_date=$3, value=$4, is_active=true
      RETURNING *
    `, [data.employee_id, data.benefit_id, data.start_date, data.value]);
  });

  ipcMain.handle('benefits:updateAssignment', async (_e, token: string, id: string, data: Partial<EmployeeBenefit>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'benefits:write')) throw new Error('Sem permissão');
    return execute(`UPDATE employee_benefits SET value=$1, end_date=$2 WHERE id=$3`, [data.value, data.end_date, id]);
  });

  ipcMain.handle('benefits:removeBenefit', async (_e, token: string, id: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'benefits:write')) throw new Error('Sem permissão');
    return execute(`UPDATE employee_benefits SET is_active=false, end_date=now() WHERE id=$1`, [id]);
  });
}
