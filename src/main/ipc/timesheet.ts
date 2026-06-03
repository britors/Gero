import { ipcMain } from 'electron';
import { query, queryOne, execute } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { eventBus, GeroEvents } from '../runtime/event-bus';
import { Timesheet, TimeEntry } from '../../shared/types';

function calcWorkedHours(clockIn?: string, clockOut?: string, breakStart?: string, breakEnd?: string): number {
  if (!clockIn || !clockOut) return 0;
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); };
  let worked = toMin(clockOut) - toMin(clockIn);
  if (breakStart && breakEnd) worked -= (toMin(breakEnd) - toMin(breakStart));
  return parseFloat((Math.max(0, worked) / 60).toFixed(2));
}

export function registerTimesheetHandlers(): void {
  ipcMain.handle('timesheet:list', async (_e, token: string, opts: {
    employee?: string; month?: number; year?: number; status?: string;
  } = {}) => {
    const sess = await validateSession(token);
    if (!sess) throw new Error('Não autenticado');
    const conds: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (opts.employee) { conds.push(`t.employee_id = $${p++}`); params.push(opts.employee); }
    if (opts.month) { conds.push(`t.month = $${p++}`); params.push(opts.month); }
    if (opts.year) { conds.push(`t.year = $${p++}`); params.push(opts.year); }
    if (opts.status) { conds.push(`t.status = $${p++}`); params.push(opts.status); }
    const where = conds.length > 0 ? 'WHERE ' + conds.join(' AND ') : '';
    return query<Timesheet>(`
      SELECT t.*, e.name AS employee_name FROM timesheets t
      JOIN employees e ON e.id = t.employee_id
      ${where} ORDER BY t.year DESC, t.month DESC, e.name
    `, params);
  });

  ipcMain.handle('timesheet:get', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<Timesheet>(`
      SELECT t.*, e.name AS employee_name FROM timesheets t
      JOIN employees e ON e.id = t.employee_id WHERE t.id = $1
    `, [id]);
  });

  ipcMain.handle('timesheet:createOrGet', async (_e, token: string, employeeId: string, month: number, year: number) => {
    await validateSession(token);
    const existing = await queryOne<Timesheet>('SELECT * FROM timesheets WHERE employee_id=$1 AND month=$2 AND year=$3', [employeeId, month, year]);
    if (existing) return existing;
    return queryOne<Timesheet>(
      `INSERT INTO timesheets (employee_id, month, year) VALUES ($1,$2,$3) RETURNING *`,
      [employeeId, month, year]
    );
  });

  ipcMain.handle('timesheet:listEntries', async (_e, token: string, timesheetId: string) => {
    await validateSession(token);
    return query<TimeEntry>('SELECT * FROM time_entries WHERE timesheet_id=$1 ORDER BY entry_date', [timesheetId]);
  });

  ipcMain.handle('timesheet:addEntry', async (_e, token: string, timesheetId: string, data: Partial<TimeEntry>) => {
    await validateSession(token);
    const worked = data.worked_hours ?? calcWorkedHours(data.clock_in, data.clock_out, data.break_start, data.break_end);

    // Get the employee's scheduled hours for the day
    const sheet = await queryOne<{ employee_id: string }>('SELECT employee_id FROM timesheets WHERE id=$1', [timesheetId]);
    let overtime = 0;
    if (sheet && data.entry_date) {
      const dayOfWeek = new Date(data.entry_date).getDay(); // 0=Sun
      const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayMap[dayOfWeek] ?? 'monday';
      const sched = await queryOne<{ start_col: string; end_col: string } & Record<string, string | null>>(`
        SELECT ws.${dayName}_start AS start_time, ws.${dayName}_end AS end_time
        FROM employee_schedules es
        JOIN work_schedules ws ON ws.id = es.schedule_id
        WHERE es.employee_id = $1 AND es.start_date <= $2
        ORDER BY es.start_date DESC LIMIT 1
      `, [sheet.employee_id, data.entry_date]);
      if (sched?.start_time && sched?.end_time) {
        const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); };
        const scheduled = (toMin(sched.end_time as string) - toMin(sched.start_time as string)) / 60;
        overtime = parseFloat(Math.max(0, worked - scheduled).toFixed(2));
      }
    }

    return queryOne<TimeEntry>(`
      INSERT INTO time_entries (timesheet_id, entry_date, type, clock_in, clock_out, break_start, break_end, worked_hours, overtime, absence, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [timesheetId, data.entry_date, data.type ?? 'regular', data.clock_in, data.clock_out,
        data.break_start, data.break_end, worked, overtime, data.absence ?? false, data.notes]);
  });

  ipcMain.handle('timesheet:updateEntry', async (_e, token: string, entryId: string, data: Partial<TimeEntry>) => {
    await validateSession(token);
    const worked = data.worked_hours ?? calcWorkedHours(data.clock_in, data.clock_out, data.break_start, data.break_end);
    return execute(`
      UPDATE time_entries SET type=$1, clock_in=$2, clock_out=$3, break_start=$4, break_end=$5,
        worked_hours=$6, overtime=$7, absence=$8, notes=$9 WHERE id=$10
    `, [data.type, data.clock_in, data.clock_out, data.break_start, data.break_end,
        worked, data.overtime ?? 0, data.absence ?? false, data.notes, entryId]);
  });

  ipcMain.handle('timesheet:deleteEntry', async (_e, token: string, entryId: string) => {
    await validateSession(token);
    return execute('DELETE FROM time_entries WHERE id=$1', [entryId]);
  });

  ipcMain.handle('timesheet:submit', async (_e, token: string, timesheetId: string) => {
    const sess = await validateSession(token);
    if (!sess) throw new Error('Não autenticado');
    const updated = await execute(
      `UPDATE timesheets SET status='submitted', updated_at=now() WHERE id=$1 AND status='open'`,
      [timesheetId]
    );
    if (!updated) throw new Error('Timesheet não pode ser enviado no status atual');
    const ts = await queryOne<Timesheet>('SELECT * FROM timesheets WHERE id=$1', [timesheetId]);
    eventBus.emit(GeroEvents.TIMESHEET_SUBMITTED, ts);
    return ts;
  });

  ipcMain.handle('timesheet:approve', async (_e, token: string, timesheetId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'timesheet:approve')) throw new Error('Sem permissão');
    const updated = await execute(
      `UPDATE timesheets SET status='approved', approved_by=$1, approved_at=now(), updated_at=now()
       WHERE id=$2 AND status='submitted'`,
      [sess.id, timesheetId]
    );
    if (!updated) throw new Error('Timesheet não está aguardando aprovação');
    const ts = await queryOne<Timesheet>('SELECT * FROM timesheets WHERE id=$1', [timesheetId]);
    eventBus.emit(GeroEvents.TIMESHEET_APPROVED, ts);
    return ts;
  });

  ipcMain.handle('timesheet:reject', async (_e, token: string, timesheetId: string, notes?: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'timesheet:approve')) throw new Error('Sem permissão');
    const updated = await execute(
      `UPDATE timesheets SET status='open', updated_at=now() WHERE id=$1 AND status='submitted'`,
      [timesheetId]
    );
    if (!updated) throw new Error('Timesheet não está aguardando aprovação');
    const ts = await queryOne<Timesheet>('SELECT * FROM timesheets WHERE id=$1', [timesheetId]);
    eventBus.emit(GeroEvents.TIMESHEET_REJECTED, { timesheet: ts, notes });
    return ts;
  });

  ipcMain.handle('timesheet:getMonthSummary', async (_e, token: string, timesheetId: string) => {
    await validateSession(token);
    return queryOne<{ total_hours: number; overtime_hours: number; absence_days: number; entry_count: number }>(`
      SELECT
        SUM(worked_hours)::numeric AS total_hours,
        SUM(overtime)::numeric AS overtime_hours,
        COUNT(*) FILTER (WHERE absence = true)::int AS absence_days,
        COUNT(*)::int AS entry_count
      FROM time_entries WHERE timesheet_id = $1
    `, [timesheetId]);
  });
}
