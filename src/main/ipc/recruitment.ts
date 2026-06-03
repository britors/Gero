import { ipcMain } from 'electron';
import { query, queryOne, execute, transaction } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { eventBus, GeroEvents } from '../runtime/event-bus';
import { JobOpening, Candidate, Interview } from '../../shared/types';

const VALID_TRANSITIONS: Record<string, string[]> = {
  applied:   ['screening', 'rejected'],
  screening: ['interview', 'rejected', 'applied'],
  interview: ['offer', 'rejected', 'screening'],
  offer:     ['hired', 'rejected', 'interview'],
  hired:     [],
  rejected:  [],
};

export function registerRecruitmentHandlers(): void {
  ipcMain.handle('recruitment:listOpenings', async (_e, token: string) => {
    await validateSession(token);
    return query<JobOpening>(`
      SELECT jo.*, d.name AS department_name, p.title AS position_title,
             COUNT(c.id)::int AS candidate_count
      FROM job_openings jo
      LEFT JOIN departments d ON d.id = jo.department_id
      LEFT JOIN positions p ON p.id = jo.position_id
      LEFT JOIN candidates c ON c.opening_id = jo.id
      GROUP BY jo.id, d.name, p.title ORDER BY jo.created_at DESC
    `);
  });

  ipcMain.handle('recruitment:getOpening', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<JobOpening>(`
      SELECT jo.*, d.name AS department_name, p.title AS position_title,
             COUNT(c.id)::int AS candidate_count
      FROM job_openings jo
      LEFT JOIN departments d ON d.id = jo.department_id
      LEFT JOIN positions p ON p.id = jo.position_id
      LEFT JOIN candidates c ON c.opening_id = jo.id
      WHERE jo.id = $1 GROUP BY jo.id, d.name, p.title
    `, [id]);
  });

  ipcMain.handle('recruitment:createOpening', async (_e, token: string, data: Partial<JobOpening>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'recruitment:write')) throw new Error('Sem permissão');
    return queryOne<JobOpening>(`
      INSERT INTO job_openings (title, department_id, position_id, description, requirements, salary_range, location, remote, openings_count, opened_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [data.title, data.department_id, data.position_id, data.description, data.requirements,
        data.salary_range, data.location, data.remote ?? false, data.openings_count ?? 1,
        data.opened_at ?? new Date().toISOString().split('T')[0], sess.id]);
  });

  ipcMain.handle('recruitment:updateOpening', async (_e, token: string, id: string, data: Partial<JobOpening>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'recruitment:write')) throw new Error('Sem permissão');
    return queryOne<JobOpening>(`
      UPDATE job_openings SET title=$1, department_id=$2, position_id=$3, description=$4, requirements=$5,
        salary_range=$6, location=$7, remote=$8, openings_count=$9, status=$10, updated_at=now()
      WHERE id=$11 RETURNING *
    `, [data.title, data.department_id, data.position_id, data.description, data.requirements,
        data.salary_range, data.location, data.remote, data.openings_count, data.status, id]);
  });

  ipcMain.handle('recruitment:closeOpening', async (_e, token: string, id: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'recruitment:write')) throw new Error('Sem permissão');
    return execute(`UPDATE job_openings SET status='closed', closed_at=now(), updated_at=now() WHERE id=$1`, [id]);
  });

  ipcMain.handle('recruitment:listCandidates', async (_e, token: string, opts: {
    opening?: string; status?: string; rating?: number;
  } = {}) => {
    await validateSession(token);
    const conds: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (opts.opening) { conds.push(`c.opening_id = $${p++}`); params.push(opts.opening); }
    if (opts.status) { conds.push(`c.status = $${p++}`); params.push(opts.status); }
    if (opts.rating) { conds.push(`c.rating >= $${p++}`); params.push(opts.rating); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    return query<Candidate>(`
      SELECT c.*, jo.title AS opening_title FROM candidates c
      LEFT JOIN job_openings jo ON jo.id = c.opening_id
      ${where} ORDER BY c.applied_at DESC
    `, params);
  });

  ipcMain.handle('recruitment:getCandidate', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<Candidate>(`
      SELECT c.*, jo.title AS opening_title FROM candidates c
      LEFT JOIN job_openings jo ON jo.id = c.opening_id WHERE c.id = $1
    `, [id]);
  });

  ipcMain.handle('recruitment:createCandidate', async (_e, token: string, data: Partial<Candidate>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'recruitment:write')) throw new Error('Sem permissão');
    const cand = await queryOne<Candidate>(`
      INSERT INTO candidates (opening_id, name, email, phone, linkedin, resume_path, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [data.opening_id, data.name, data.email, data.phone, data.linkedin, data.resume_path, data.notes]);
    eventBus.emit(GeroEvents.CANDIDATE_APPLIED, cand);
    return cand;
  });

  ipcMain.handle('recruitment:updateCandidate', async (_e, token: string, id: string, data: Partial<Candidate>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'recruitment:write')) throw new Error('Sem permissão');

    if (data.status) {
      const current = await queryOne<{ status: string }>('SELECT status FROM candidates WHERE id=$1', [id]);
      if (current && !VALID_TRANSITIONS[current.status]?.includes(data.status)) {
        throw new Error(`Transição inválida: ${current.status} → ${data.status}`);
      }
    }

    return queryOne<Candidate>(`
      UPDATE candidates SET name=$1, email=$2, phone=$3, linkedin=$4, status=$5, rating=$6, notes=$7, updated_at=now()
      WHERE id=$8 RETURNING *
    `, [data.name, data.email, data.phone, data.linkedin, data.status, data.rating, data.notes, id]);
  });

  ipcMain.handle('recruitment:scheduleInterview', async (_e, token: string, data: Partial<Interview>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'recruitment:write')) throw new Error('Sem permissão');
    return queryOne<Interview>(`
      INSERT INTO interviews (candidate_id, interviewer_id, scheduled_at, duration_min, type)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [data.candidate_id, data.interviewer_id, data.scheduled_at, data.duration_min ?? 60, data.type ?? 'video']);
  });

  ipcMain.handle('recruitment:updateInterview', async (_e, token: string, id: string, data: Partial<Interview>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'recruitment:write')) throw new Error('Sem permissão');
    return queryOne<Interview>(`
      UPDATE interviews SET status=$1, feedback=$2, rating=$3 WHERE id=$4 RETURNING *
    `, [data.status, data.feedback, data.rating, id]);
  });

  ipcMain.handle('recruitment:hireCandidate', async (_e, token: string, candidateId: string, employeeData: {
    department_id?: string; position_id?: string; hire_date: string; base_salary: number; contract_type?: string;
  }) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'recruitment:write')) throw new Error('Sem permissão');

    const cand = await queryOne<Candidate>('SELECT * FROM candidates WHERE id=$1', [candidateId]);
    if (!cand) throw new Error('Candidato não encontrado');
    if (cand.status !== 'offer') throw new Error('Candidato precisa estar com oferta antes de ser contratado');

    return transaction(async (client) => {
      const emp = await client.query<{ id: string; name: string }>(`
        INSERT INTO employees (name, email, phone, department_id, position_id,
          contract_type, hire_date, base_salary, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, name
      `, [cand.name, cand.email, cand.phone, employeeData.department_id, employeeData.position_id,
          employeeData.contract_type ?? 'clt', employeeData.hire_date, employeeData.base_salary, sess.id]);

      const employee = emp.rows[0]!;

      await client.query(
        `UPDATE candidates SET status='hired', hired_at=now(), employee_id=$1, updated_at=now() WHERE id=$2`,
        [employee.id, candidateId]
      );

      eventBus.emit(GeroEvents.CANDIDATE_HIRED, { candidate: cand, employee_id: employee.id });
      eventBus.emit(GeroEvents.EMPLOYEE_HIRED, { id: employee.id, name: employee.name });
      return employee;
    });
  });
}
