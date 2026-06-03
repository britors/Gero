import { ipcMain } from 'electron';
import { query, queryOne, execute, transaction } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { eventBus, GeroEvents } from '../runtime/event-bus';
import { Employee, PaginatedResult } from '../../shared/types';

export function registerEmployeeHandlers(): void {
  ipcMain.handle('employees:list', async (_e, token: string, opts: {
    page?: number; pageSize?: number; search?: string;
    department?: string; position?: string; contract?: string; active?: boolean;
  } = {}) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:read')) throw new Error('Sem permissão');

    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (opts.active !== undefined) { conditions.push(`e.is_active = $${p++}`); params.push(opts.active); }
    if (opts.search) { conditions.push(`(e.name ILIKE $${p++} OR e.cpf ILIKE $${p++} OR e.email ILIKE $${p++})`); params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`); p += 2; }
    if (opts.department) { conditions.push(`e.department_id = $${p++}`); params.push(opts.department); }
    if (opts.position) { conditions.push(`e.position_id = $${p++}`); params.push(opts.position); }
    if (opts.contract) { conditions.push(`e.contract_type = $${p++}`); params.push(opts.contract); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const total = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM employees e ${where}`, params
    );
    const rows = await query<Employee>(`
      SELECT e.*, d.name AS department_name, pos.title AS position_title,
             m.name AS manager_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions pos ON pos.id = e.position_id
      LEFT JOIN employees m ON m.id = e.manager_id
      ${where}
      ORDER BY e.name
      LIMIT $${p} OFFSET $${p + 1}
    `, [...params, pageSize, offset]);

    return { data: rows, total: parseInt(total?.count ?? '0'), page, pageSize } as PaginatedResult<Employee>;
  });

  ipcMain.handle('employees:get', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<Employee>(`
      SELECT e.*, d.name AS department_name, pos.title AS position_title, m.name AS manager_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions pos ON pos.id = e.position_id
      LEFT JOIN employees m ON m.id = e.manager_id
      WHERE e.id = $1
    `, [id]);
  });

  ipcMain.handle('employees:create', async (_e, token: string, data: Partial<Employee>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');

    const emp = await queryOne<Employee>(`
      INSERT INTO employees (name, cpf, rg, birth_date, gender, email, phone, address, city, state, zip_code,
        department_id, position_id, manager_id, contract_type, hire_date, base_salary,
        bank_name, bank_agency, bank_account, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `, [data.name, data.cpf, data.rg, data.birth_date, data.gender, data.email, data.phone,
        data.address, data.city, data.state, data.zip_code,
        data.department_id, data.position_id, data.manager_id,
        data.contract_type ?? 'clt', data.hire_date, data.base_salary ?? 0,
        data.bank_name, data.bank_agency, data.bank_account, sess.id]);

    if (emp) eventBus.emit(GeroEvents.EMPLOYEE_HIRED, emp);
    return emp;
  });

  ipcMain.handle('employees:update', async (_e, token: string, id: string, data: Partial<Employee>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');

    const emp = await queryOne<Employee>(`
      UPDATE employees SET
        name=$1, cpf=$2, rg=$3, birth_date=$4, gender=$5, email=$6, phone=$7,
        address=$8, city=$9, state=$10, zip_code=$11,
        department_id=$12, position_id=$13, manager_id=$14,
        contract_type=$15, hire_date=$16, base_salary=$17,
        bank_name=$18, bank_agency=$19, bank_account=$20, updated_at=now()
      WHERE id=$21
      RETURNING *
    `, [data.name, data.cpf, data.rg, data.birth_date, data.gender, data.email, data.phone,
        data.address, data.city, data.state, data.zip_code,
        data.department_id, data.position_id, data.manager_id,
        data.contract_type, data.hire_date, data.base_salary,
        data.bank_name, data.bank_agency, data.bank_account, id]);

    if (emp) eventBus.emit(GeroEvents.EMPLOYEE_UPDATED, emp);
    return emp;
  });

  ipcMain.handle('employees:terminate', async (_e, token: string, id: string, reason: string, date: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');

    const emp = await queryOne<Employee>(`
      UPDATE employees SET is_active=false, termination_date=$1, termination_reason=$2, updated_at=now()
      WHERE id=$3 RETURNING *
    `, [date, reason, id]);

    if (emp) eventBus.emit(GeroEvents.EMPLOYEE_TERMINATED, emp);
    return emp;
  });

  ipcMain.handle('employees:reactivate', async (_e, token: string, id: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    return execute(
      `UPDATE employees SET is_active=true, termination_date=NULL, termination_reason=NULL, updated_at=now() WHERE id=$1`,
      [id]
    );
  });

  ipcMain.handle('employees:listByDepartment', async (_e, token: string, deptId: string) => {
    await validateSession(token);
    return query<Employee>(`
      SELECT e.*, pos.title AS position_title FROM employees e
      LEFT JOIN positions pos ON pos.id = e.position_id
      WHERE e.department_id = $1 AND e.is_active = true ORDER BY e.name
    `, [deptId]);
  });

  ipcMain.handle('employees:getOrgChart', async (_e, token: string) => {
    await validateSession(token);
    return query<Employee & { level: number }>(`
      WITH RECURSIVE org AS (
        SELECT e.*, pos.title AS position_title, d.name AS department_name, 0 AS level
        FROM employees e
        LEFT JOIN positions pos ON pos.id = e.position_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.manager_id IS NULL AND e.is_active = true
        UNION ALL
        SELECT e.*, pos.title AS position_title, d.name AS department_name, org.level + 1
        FROM employees e
        LEFT JOIN positions pos ON pos.id = e.position_id
        LEFT JOIN departments d ON d.id = e.department_id
        JOIN org ON org.id = e.manager_id
        WHERE e.is_active = true
      )
      SELECT * FROM org ORDER BY level, name
    `);
  });

  ipcMain.handle('employees:linkToOrbi', async (_e, token: string, empId: string, orbiUserId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    return execute(`UPDATE employees SET orbi_user_id=$1, updated_at=now() WHERE id=$2`, [orbiUserId, empId]);
  });

  ipcMain.handle('employees:linkToFilo', async (_e, token: string, empId: string, filoUserId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    return execute(`UPDATE employees SET filo_user_id=$1, updated_at=now() WHERE id=$2`, [filoUserId, empId]);
  });

  ipcMain.handle('employees:syncToOrbi', async (_e, token: string, empId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    const emp = await queryOne<Employee>('SELECT * FROM employees WHERE id=$1', [empId]);
    if (!emp?.orbi_user_id) throw new Error('Funcionário não vinculado ao Orbi');
    eventBus.emit('gero.employee_sync_orbi', { employee: emp, orbi_user_id: emp.orbi_user_id });
    return true;
  });

  ipcMain.handle('employees:syncToFilo', async (_e, token: string, empId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'employees:write')) throw new Error('Sem permissão');
    const emp = await queryOne<Employee>('SELECT * FROM employees WHERE id=$1', [empId]);
    if (!emp?.filo_user_id) throw new Error('Funcionário não vinculado ao Filo');
    eventBus.emit('gero.employee_sync_filo', { employee: emp, filo_user_id: emp.filo_user_id });
    return true;
  });
}
