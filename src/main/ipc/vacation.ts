import { ipcMain } from 'electron';
import { query, queryOne, execute } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { eventBus, GeroEvents } from '../runtime/event-bus';
import { VacationEntitlement, VacationRequest } from '../../shared/types';

export function registerVacationHandlers(): void {
  ipcMain.handle('vacation:listEntitlements', async (_e, token: string, employeeId?: string) => {
    await validateSession(token);
    if (employeeId) {
      return query<VacationEntitlement>(`
        SELECT ve.*, e.name AS employee_name FROM vacation_entitlements ve
        JOIN employees e ON e.id = ve.employee_id
        WHERE ve.employee_id = $1 ORDER BY ve.acquisition_start DESC
      `, [employeeId]);
    }
    return query<VacationEntitlement>(`
      SELECT ve.*, e.name AS employee_name FROM vacation_entitlements ve
      JOIN employees e ON e.id = ve.employee_id ORDER BY e.name, ve.acquisition_start DESC
    `);
  });

  ipcMain.handle('vacation:getEntitlement', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<VacationEntitlement>(`
      SELECT ve.*, e.name AS employee_name FROM vacation_entitlements ve
      JOIN employees e ON e.id = ve.employee_id WHERE ve.id = $1
    `, [id]);
  });

  ipcMain.handle('vacation:calculateEntitlement', async (_e, token: string, employeeId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'vacation:write')) throw new Error('Sem permissão');

    const emp = await queryOne<{ hire_date: string }>('SELECT hire_date FROM employees WHERE id=$1', [employeeId]);
    if (!emp) throw new Error('Funcionário não encontrado');

    const hireDate = new Date(emp.hire_date);
    const now = new Date();

    const yearsWorked = Math.floor((now.getTime() - hireDate.getTime()) / (365.25 * 24 * 3600 * 1000));
    const acquisitionStart = new Date(hireDate);
    acquisitionStart.setFullYear(hireDate.getFullYear() + yearsWorked);
    const acquisitionEnd = new Date(acquisitionStart);
    acquisitionEnd.setFullYear(acquisitionStart.getFullYear() + 1);
    acquisitionEnd.setDate(acquisitionEnd.getDate() - 1);

    const expiresAt = new Date(acquisitionEnd);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    return queryOne<VacationEntitlement>(`
      INSERT INTO vacation_entitlements (employee_id, acquisition_start, acquisition_end, expires_at)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [employeeId, acquisitionStart.toISOString().split('T')[0], acquisitionEnd.toISOString().split('T')[0], expiresAt.toISOString().split('T')[0]]);
  });

  ipcMain.handle('vacation:listRequests', async (_e, token: string, opts: { employee?: string; status?: string } = {}) => {
    await validateSession(token);
    const conds: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (opts.employee) { conds.push(`vr.employee_id = $${p++}`); params.push(opts.employee); }
    if (opts.status) { conds.push(`vr.status = $${p++}`); params.push(opts.status); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    return query<VacationRequest>(`
      SELECT vr.*, e.name AS employee_name FROM vacation_requests vr
      JOIN employees e ON e.id = vr.employee_id ${where} ORDER BY vr.created_at DESC
    `, params);
  });

  ipcMain.handle('vacation:createRequest', async (_e, token: string, data: {
    entitlement_id: string; employee_id: string; start_date: string; end_date: string;
    days_sold?: number; notes?: string;
  }) => {
    const sess = await validateSession(token);
    if (!sess) throw new Error('Não autenticado');

    const entitlement = await queryOne<VacationEntitlement>('SELECT * FROM vacation_entitlements WHERE id=$1', [data.entitlement_id]);
    if (!entitlement) throw new Error('Direito de férias não encontrado');

    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1;
    const available = entitlement.days_entitled - entitlement.days_taken - entitlement.days_sold;

    if (days > available) throw new Error(`Dias solicitados (${days}) excedem saldo disponível (${available})`);

    const req = await queryOne<VacationRequest>(`
      INSERT INTO vacation_requests (entitlement_id, employee_id, start_date, end_date, days_count, days_sold, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [data.entitlement_id, data.employee_id, data.start_date, data.end_date, days, data.days_sold ?? 0, data.notes]);

    eventBus.emit(GeroEvents.VACATION_REQUESTED, req);
    return req;
  });

  ipcMain.handle('vacation:approveRequest', async (_e, token: string, requestId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'vacation:approve')) throw new Error('Sem permissão');

    const req = await queryOne<VacationRequest>('SELECT * FROM vacation_requests WHERE id=$1', [requestId]);
    if (!req || req.status !== 'pending') throw new Error('Solicitação não está pendente');

    await execute(
      `UPDATE vacation_requests SET status='approved', approved_by=$1, approved_at=now() WHERE id=$2`,
      [sess.id, requestId]
    );
    await execute(
      `UPDATE vacation_entitlements SET days_taken = days_taken + $1 WHERE id = $2`,
      [req.days_count, req.entitlement_id]
    );

    eventBus.emit(GeroEvents.VACATION_APPROVED, req);
    return true;
  });

  ipcMain.handle('vacation:rejectRequest', async (_e, token: string, requestId: string, notes?: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'vacation:approve')) throw new Error('Sem permissão');

    await execute(
      `UPDATE vacation_requests SET status='rejected', notes=COALESCE($1, notes), approved_by=$2, approved_at=now() WHERE id=$3`,
      [notes, sess.id, requestId]
    );
    eventBus.emit(GeroEvents.VACATION_REJECTED, { request_id: requestId });
    return true;
  });

  ipcMain.handle('vacation:cancelRequest', async (_e, token: string, requestId: string) => {
    const sess = await validateSession(token);
    if (!sess) throw new Error('Não autenticado');

    const req = await queryOne<VacationRequest>('SELECT * FROM vacation_requests WHERE id=$1', [requestId]);
    if (!req) throw new Error('Solicitação não encontrada');
    if (!['pending', 'approved'].includes(req.status)) throw new Error('Solicitação não pode ser cancelada');

    if (req.status === 'approved') {
      await execute(
        `UPDATE vacation_entitlements SET days_taken = days_taken - $1 WHERE id = $2`,
        [req.days_count, req.entitlement_id]
      );
    }
    return execute(`UPDATE vacation_requests SET status='cancelled' WHERE id=$1`, [requestId]);
  });

  ipcMain.handle('vacation:getBalance', async (_e, token: string, employeeId: string) => {
    await validateSession(token);
    const rows = await query<{ days_entitled: number; days_taken: number; days_sold: number; expires_at?: string }>(`
      SELECT days_entitled, days_taken, days_sold, expires_at
      FROM vacation_entitlements WHERE employee_id = $1 ORDER BY acquisition_start DESC LIMIT 1
    `, [employeeId]);
    if (rows.length === 0) return { available: 0, taken: 0, sold: 0 };
    const r = rows[0]!;
    return {
      available: r.days_entitled - r.days_taken - r.days_sold,
      taken: r.days_taken,
      sold: r.days_sold,
      expires_at: r.expires_at,
    };
  });
}
