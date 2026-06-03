import { ipcMain } from 'electron';
import { query, queryOne, execute, transaction } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { eventBus, GeroEvents } from '../runtime/event-bus';
import { EvaluationCycle, EvaluationForm, EvaluationAnswer, DevelopmentPlan } from '../../shared/types';

export function registerEvaluationHandlers(): void {
  ipcMain.handle('evaluation:listCycles', async (_e, token: string) => {
    await validateSession(token);
    return query<EvaluationCycle>(`
      SELECT ec.*,
        COUNT(ef.id)::int AS form_count,
        COUNT(ef.id) FILTER (WHERE ef.status='completed')::int AS completed_count
      FROM evaluation_cycles ec
      LEFT JOIN evaluation_forms ef ON ef.cycle_id = ec.id
      GROUP BY ec.id ORDER BY ec.start_date DESC
    `);
  });

  ipcMain.handle('evaluation:getCycle', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<EvaluationCycle>(`
      SELECT ec.*,
        COUNT(ef.id)::int AS form_count,
        COUNT(ef.id) FILTER (WHERE ef.status='completed')::int AS completed_count
      FROM evaluation_cycles ec
      LEFT JOIN evaluation_forms ef ON ef.cycle_id = ec.id
      WHERE ec.id = $1 GROUP BY ec.id
    `, [id]);
  });

  ipcMain.handle('evaluation:createCycle', async (_e, token: string, data: Partial<EvaluationCycle>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'evaluation:write')) throw new Error('Sem permissão');
    return queryOne<EvaluationCycle>(`
      INSERT INTO evaluation_cycles (name, description, start_date, end_date, created_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [data.name, data.description, data.start_date, data.end_date, sess.id]);
  });

  ipcMain.handle('evaluation:startCycle', async (_e, token: string, cycleId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'evaluation:write')) throw new Error('Sem permissão');

    return transaction(async (client) => {
      await client.query(
        `UPDATE evaluation_cycles SET status='in_progress', updated_at=now() WHERE id=$1 AND status='draft'`,
        [cycleId]
      );
      const employees = await client.query<{ id: string }>(`SELECT id FROM employees WHERE is_active=true`);
      for (const emp of employees.rows) {
        // Self evaluation
        await client.query(`
          INSERT INTO evaluation_forms (cycle_id, evaluatee_id, evaluator_id, type)
          VALUES ($1,$2,$2,'self') ON CONFLICT DO NOTHING
        `, [cycleId, emp.id]);
        // Manager evaluation (if they have a manager)
        await client.query(`
          INSERT INTO evaluation_forms (cycle_id, evaluatee_id, evaluator_id, type)
          SELECT $1, $2, manager_id, 'manager'
          FROM employees WHERE id=$2 AND manager_id IS NOT NULL
          ON CONFLICT DO NOTHING
        `, [cycleId, emp.id]);
      }
      eventBus.emit(GeroEvents.EVAL_CYCLE_STARTED, { cycle_id: cycleId });
      return employees.rowCount ?? 0;
    });
  });

  ipcMain.handle('evaluation:listForms', async (_e, token: string, opts: {
    cycle?: string; evaluatee?: string; evaluator?: string; type?: string; status?: string;
  } = {}) => {
    await validateSession(token);
    const conds: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (opts.cycle) { conds.push(`ef.cycle_id=$${p++}`); params.push(opts.cycle); }
    if (opts.evaluatee) { conds.push(`ef.evaluatee_id=$${p++}`); params.push(opts.evaluatee); }
    if (opts.evaluator) { conds.push(`ef.evaluator_id=$${p++}`); params.push(opts.evaluator); }
    if (opts.type) { conds.push(`ef.type=$${p++}`); params.push(opts.type); }
    if (opts.status) { conds.push(`ef.status=$${p++}`); params.push(opts.status); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    return query<EvaluationForm>(`
      SELECT ef.*, ec.name AS cycle_name,
             ee.name AS evaluatee_name, er.name AS evaluator_name
      FROM evaluation_forms ef
      JOIN evaluation_cycles ec ON ec.id = ef.cycle_id
      JOIN employees ee ON ee.id = ef.evaluatee_id
      JOIN employees er ON er.id = ef.evaluator_id
      ${where} ORDER BY ee.name, ef.type
    `, params);
  });

  ipcMain.handle('evaluation:getForm', async (_e, token: string, id: string) => {
    await validateSession(token);
    const form = await queryOne<EvaluationForm>(`
      SELECT ef.*, ec.name AS cycle_name, ee.name AS evaluatee_name, er.name AS evaluator_name
      FROM evaluation_forms ef
      JOIN evaluation_cycles ec ON ec.id = ef.cycle_id
      JOIN employees ee ON ee.id = ef.evaluatee_id
      JOIN employees er ON er.id = ef.evaluator_id
      WHERE ef.id = $1
    `, [id]);
    if (!form) return null;
    const answers = await query<EvaluationAnswer>('SELECT * FROM evaluation_answers WHERE form_id=$1 ORDER BY competency', [id]);
    return { ...form, answers };
  });

  ipcMain.handle('evaluation:submitForm', async (_e, token: string, formId: string, answers: Array<{ competency: string; score: number; comment?: string }>) => {
    const sess = await validateSession(token);
    if (!sess) throw new Error('Não autenticado');

    return transaction(async (client) => {
      await client.query('DELETE FROM evaluation_answers WHERE form_id=$1', [formId]);
      for (const a of answers) {
        await client.query(
          `INSERT INTO evaluation_answers (form_id, competency, score, comment) VALUES ($1,$2,$3,$4)`,
          [formId, a.competency, a.score, a.comment]
        );
      }
      const avg = answers.length > 0 ? answers.reduce((s, a) => s + a.score, 0) / answers.length : null;
      await client.query(
        `UPDATE evaluation_forms SET status='completed', submitted_at=now(), overall_score=$1, updated_at=now() WHERE id=$2`,
        [avg ? parseFloat(avg.toFixed(1)) : null, formId]
      );
      eventBus.emit(GeroEvents.EVAL_FORM_SUBMITTED, { form_id: formId });
      return true;
    });
  });

  ipcMain.handle('evaluation:calibrate', async (_e, token: string, formId: string, finalScore: number) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'evaluation:write')) throw new Error('Sem permissão');
    return execute(
      `UPDATE evaluation_forms SET overall_score=$1, updated_at=now() WHERE id=$2`,
      [finalScore, formId]
    );
  });

  ipcMain.handle('evaluation:completeCycle', async (_e, token: string, cycleId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'evaluation:write')) throw new Error('Sem permissão');
    await execute(
      `UPDATE evaluation_cycles SET status='completed', updated_at=now() WHERE id=$1`,
      [cycleId]
    );
    eventBus.emit(GeroEvents.EVAL_CYCLE_COMPLETED, { cycle_id: cycleId });
    return true;
  });

  ipcMain.handle('evaluation:listDevelopmentPlans', async (_e, token: string, employeeId?: string) => {
    await validateSession(token);
    if (employeeId) {
      return query<DevelopmentPlan>(`
        SELECT dp.*, e.name AS employee_name, ec.name AS cycle_name FROM development_plans dp
        JOIN employees e ON e.id = dp.employee_id
        LEFT JOIN evaluation_cycles ec ON ec.id = dp.cycle_id
        WHERE dp.employee_id=$1 ORDER BY dp.created_at DESC
      `, [employeeId]);
    }
    return query<DevelopmentPlan>(`
      SELECT dp.*, e.name AS employee_name, ec.name AS cycle_name FROM development_plans dp
      JOIN employees e ON e.id = dp.employee_id
      LEFT JOIN evaluation_cycles ec ON ec.id = dp.cycle_id
      ORDER BY e.name, dp.created_at DESC
    `);
  });

  ipcMain.handle('evaluation:createPlan', async (_e, token: string, data: Partial<DevelopmentPlan>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'evaluation:write')) throw new Error('Sem permissão');
    return queryOne<DevelopmentPlan>(`
      INSERT INTO development_plans (employee_id, cycle_id, objective, actions, deadline, created_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [data.employee_id, data.cycle_id, data.objective, data.actions, data.deadline, sess.id]);
  });

  ipcMain.handle('evaluation:updatePlan', async (_e, token: string, id: string, data: Partial<DevelopmentPlan>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'evaluation:write')) throw new Error('Sem permissão');
    return queryOne<DevelopmentPlan>(`
      UPDATE development_plans SET objective=$1, actions=$2, deadline=$3, status=$4, updated_at=now()
      WHERE id=$5 RETURNING *
    `, [data.objective, data.actions, data.deadline, data.status, id]);
  });
}
