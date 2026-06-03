import { ipcMain } from 'electron';
import { query, queryOne, execute, transaction } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { eventBus, GeroEvents } from '../runtime/event-bus';
import { PayrollPeriod, PayrollEntry, Employee, Decimo13Entry, RescisaoEntry, RescisaoResult } from '../../shared/types';
import { calculatePayroll, calculateDecimo13, calcDecimo13MonthsWorked, calculateRescisao, calcNoticeDays } from '../payroll-calc';
export { calculatePayroll } from '../payroll-calc';

export function registerPayrollHandlers(): void {
  ipcMain.handle('payroll:listPeriods', async (_e, token: string) => {
    await validateSession(token);
    return query<PayrollPeriod>(`
      SELECT p.*, COUNT(pe.id)::int AS entry_count, SUM(pe.net_salary) AS total_net
      FROM payroll_periods p LEFT JOIN payroll_entries pe ON pe.period_id = p.id
      GROUP BY p.id ORDER BY p.year DESC, p.month DESC
    `);
  });

  ipcMain.handle('payroll:getPeriod', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<PayrollPeriod>(`
      SELECT p.*, COUNT(pe.id)::int AS entry_count, SUM(pe.net_salary) AS total_net
      FROM payroll_periods p LEFT JOIN payroll_entries pe ON pe.period_id = p.id
      WHERE p.id = $1 GROUP BY p.id
    `, [id]);
  });

  ipcMain.handle('payroll:createPeriod', async (_e, token: string, month: number, year: number) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');
    return queryOne<PayrollPeriod>(
      `INSERT INTO payroll_periods (month, year, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [month, year, sess.id]
    );
  });

  ipcMain.handle('payroll:generateEntries', async (_e, token: string, periodId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');

    const period = await queryOne<PayrollPeriod>('SELECT * FROM payroll_periods WHERE id=$1', [periodId]);
    if (!period) throw new Error('Período não encontrado');
    if (period.status !== 'draft') throw new Error('Só é possível gerar entradas para períodos em rascunho');

    const employees = await query<Employee>('SELECT * FROM employees WHERE is_active = true');

    return transaction(async (client) => {
      let count = 0;
      for (const emp of employees) {
        const calc = calculatePayroll(parseFloat(String(emp.base_salary)));

        // Get benefit values
        const benefits = await query<{ type: string; value: number }>(`
          SELECT b.type, COALESCE(eb.value, b.value, 0) AS value
          FROM employee_benefits eb
          JOIN benefits b ON b.id = eb.benefit_id
          WHERE eb.employee_id = $1 AND eb.is_active = true
        `, [emp.id]);

        const meal = benefits.find(b => b.type === 'meal')?.value ?? 0;
        const transport = benefits.find(b => b.type === 'transport')?.value ?? 0;
        const health = benefits.find(b => b.type === 'health')?.value ?? 0;

        await client.query(`
          INSERT INTO payroll_entries
            (period_id, employee_id, base_salary, overtime_value, bonus, other_earnings,
             gross_salary, inss, irrf, absence_discount, other_discounts, fgts, net_salary,
             meal_allowance, transport_voucher, health_plan)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
          ON CONFLICT (period_id, employee_id) DO NOTHING
        `, [periodId, emp.id, calc.base_salary, calc.overtime_value, calc.bonus, calc.other_earnings,
            calc.gross_salary, calc.inss, calc.irrf, calc.absence_discount, calc.other_discounts,
            calc.fgts, calc.net_salary, meal, transport, health]);
        count++;
      }

      eventBus.emit(GeroEvents.PAYROLL_GENERATED, { period_id: periodId, employee_count: count });
      return count;
    });
  });

  ipcMain.handle('payroll:getEntry', async (_e, token: string, entryId: string) => {
    await validateSession(token);
    return queryOne<PayrollEntry>(`
      SELECT pe.*, e.name AS employee_name, d.name AS department_name, p.title AS position_title
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      WHERE pe.id = $1
    `, [entryId]);
  });

  ipcMain.handle('payroll:updateEntry', async (_e, token: string, entryId: string, data: Partial<PayrollEntry>) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');

    const entry = await queryOne<PayrollEntry>('SELECT * FROM payroll_entries WHERE id=$1', [entryId]);
    if (!entry) throw new Error('Entrada não encontrada');

    const baseSalary     = parseFloat(String(data.base_salary     ?? entry.base_salary));
    const overtime       = parseFloat(String(data.overtime_value  ?? entry.overtime_value));
    const bonus          = parseFloat(String(data.bonus           ?? entry.bonus));
    const otherEarnings  = parseFloat(String(data.other_earnings  ?? entry.other_earnings));
    const absenceDisc    = parseFloat(String(data.absence_discount ?? entry.absence_discount));
    const otherDisc      = parseFloat(String(data.other_discounts  ?? entry.other_discounts));

    const calc = calculatePayroll(baseSalary, overtime, bonus, otherEarnings, absenceDisc, otherDisc);

    return queryOne<PayrollEntry>(`
      UPDATE payroll_entries SET
        base_salary=$1, overtime_value=$2, bonus=$3, other_earnings=$4,
        gross_salary=$5, inss=$6, irrf=$7, absence_discount=$8, other_discounts=$9,
        fgts=$10, net_salary=$11, updated_at=now()
      WHERE id=$12 RETURNING *
    `, [calc.base_salary, calc.overtime_value, calc.bonus, calc.other_earnings,
        calc.gross_salary, calc.inss, calc.irrf, calc.absence_discount, calc.other_discounts,
        calc.fgts, calc.net_salary, entryId]);
  });

  ipcMain.handle('payroll:approvePeriod', async (_e, token: string, periodId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');
    const updated = await execute(
      `UPDATE payroll_periods SET status='approved', updated_at=now() WHERE id=$1 AND status='draft'`,
      [periodId]
    );
    if (!updated) throw new Error('Período não está em rascunho');
    const period = await queryOne<PayrollPeriod>('SELECT * FROM payroll_periods WHERE id=$1', [periodId]);
    eventBus.emit(GeroEvents.PAYROLL_APPROVED, { period_id: periodId });
    return period;
  });

  ipcMain.handle('payroll:markPaid', async (_e, token: string, periodId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');
    const updated = await execute(
      `UPDATE payroll_periods SET status='paid', closed_at=now(), updated_at=now() WHERE id=$1 AND status='approved'`,
      [periodId]
    );
    if (!updated) throw new Error('Período não está aprovado');

    const period = await queryOne<PayrollPeriod>('SELECT * FROM payroll_periods WHERE id=$1', [periodId]);
    const totals = await queryOne<{ total: number; headcount: number }>(
      `SELECT SUM(net_salary) AS total, COUNT(*)::int AS headcount FROM payroll_entries WHERE period_id=$1`,
      [periodId]
    );
    eventBus.emit(GeroEvents.PAYROLL_PAID, {
      period_id: periodId,
      total_amount: totals?.total ?? 0,
      headcount: totals?.headcount ?? 0,
    });
    return period;
  });

  ipcMain.handle('payroll:generatePayslip', async (_e, token: string, entryId: string): Promise<string> => {
    await validateSession(token);
    const entry = await queryOne<PayrollEntry & {
      employee_name: string; department_name: string; position_title: string;
      cpf: string; hire_date: string; contract_type: string; period_month: number; period_year: number;
    }>(`
      SELECT pe.*, e.name AS employee_name, e.cpf, e.hire_date, e.contract_type,
             d.name AS department_name, p.title AS position_title,
             pp.month AS period_month, pp.year AS period_year
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      JOIN payroll_periods pp ON pp.id = pe.period_id
      WHERE pe.id = $1
    `, [entryId]);

    if (!entry) throw new Error('Entrada não encontrada');

    const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const competencia = `${monthNames[(entry.period_month - 1)]}/${entry.period_year}`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; font-family: 'Inter', Arial, sans-serif; }
  body { background: #fff; color: #222; padding: 24px; font-size: 12px; }
  .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #EF9F27; padding-bottom:12px; margin-bottom:16px; }
  .company { font-size:18px; font-weight:700; color:#B86E00; }
  .doc-title { font-size:14px; font-weight:600; }
  .section { margin-bottom:16px; }
  .section-title { font-size:11px; font-weight:700; text-transform:uppercase; color:#888; margin-bottom:6px; border-bottom:1px solid #eee; padding-bottom:4px; }
  .row { display:flex; gap:16px; margin-bottom:4px; }
  .field { flex:1; }
  .field label { font-size:10px; color:#888; display:block; }
  .field span { font-size:12px; font-weight:500; }
  table { width:100%; border-collapse:collapse; }
  th { background:#f5f5f5; font-size:10px; text-align:left; padding:4px 8px; }
  td { padding:4px 8px; border-bottom:1px solid #f0f0f0; }
  td.amount { text-align:right; font-family: 'JetBrains Mono', monospace; }
  .total-row td { font-weight:700; background:#f9f9f9; }
  .net-salary { background:#1D9E75; color:#fff; font-size:16px; font-weight:700; padding:12px; text-align:center; border-radius:8px; margin-top:12px; }
  .footer { margin-top:24px; font-size:10px; color:#aaa; text-align:center; border-top:1px solid #eee; padding-top:12px; }
  .amber { color:#EF9F27; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company">W3TI SERVIÇOS DE INFORMÁTICA LTDA</div>
    <div style="color:#888;font-size:11px;">CNPJ: 00.000.000/0001-00</div>
  </div>
  <div style="text-align:right">
    <div class="doc-title">HOLERITE / RECIBO DE PAGAMENTO</div>
    <div class="amber" style="font-weight:700;font-size:13px;">Competência: ${competencia}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Dados do Funcionário</div>
  <div class="row">
    <div class="field"><label>Nome</label><span>${entry.employee_name}</span></div>
    <div class="field"><label>CPF</label><span>${entry.cpf ?? '-'}</span></div>
    <div class="field"><label>Admissão</label><span>${new Date(entry.hire_date).toLocaleDateString('pt-BR')}</span></div>
  </div>
  <div class="row">
    <div class="field"><label>Cargo</label><span>${entry.position_title ?? '-'}</span></div>
    <div class="field"><label>Departamento</label><span>${entry.department_name ?? '-'}</span></div>
    <div class="field"><label>Contrato</label><span>${entry.contract_type?.toUpperCase() ?? '-'}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Proventos</div>
  <table>
    <tr><th>Descrição</th><th style="text-align:right">Valor</th></tr>
    <tr><td>Salário Base</td><td class="amount">${fmt(entry.base_salary)}</td></tr>
    ${parseFloat(String(entry.overtime_value)) > 0 ? `<tr><td>Horas Extras</td><td class="amount">${fmt(entry.overtime_value)}</td></tr>` : ''}
    ${parseFloat(String(entry.bonus)) > 0 ? `<tr><td>Bônus</td><td class="amount">${fmt(entry.bonus)}</td></tr>` : ''}
    ${parseFloat(String(entry.other_earnings)) > 0 ? `<tr><td>Outros Proventos</td><td class="amount">${fmt(entry.other_earnings)}</td></tr>` : ''}
    <tr class="total-row"><td>Total de Proventos</td><td class="amount">${fmt(entry.gross_salary)}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">Descontos</div>
  <table>
    <tr><th>Descrição</th><th style="text-align:right">Valor</th></tr>
    <tr><td>INSS</td><td class="amount">-${fmt(entry.inss)}</td></tr>
    <tr><td>IRRF</td><td class="amount">-${fmt(entry.irrf)}</td></tr>
    ${parseFloat(String(entry.absence_discount)) > 0 ? `<tr><td>Desconto de Faltas</td><td class="amount">-${fmt(entry.absence_discount)}</td></tr>` : ''}
    ${parseFloat(String(entry.other_discounts)) > 0 ? `<tr><td>Outros Descontos</td><td class="amount">-${fmt(entry.other_discounts)}</td></tr>` : ''}
    <tr class="total-row"><td>Total de Descontos</td><td class="amount">-${fmt(parseFloat(String(entry.inss)) + parseFloat(String(entry.irrf)) + parseFloat(String(entry.absence_discount)) + parseFloat(String(entry.other_discounts)))}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">Benefícios</div>
  <table>
    <tr><th>Descrição</th><th style="text-align:right">Valor</th></tr>
    ${parseFloat(String(entry.meal_allowance)) > 0 ? `<tr><td>Vale Refeição</td><td class="amount">${fmt(entry.meal_allowance)}</td></tr>` : ''}
    ${parseFloat(String(entry.transport_voucher)) > 0 ? `<tr><td>Vale Transporte</td><td class="amount">${fmt(entry.transport_voucher)}</td></tr>` : ''}
    ${parseFloat(String(entry.health_plan)) > 0 ? `<tr><td>Plano de Saúde</td><td class="amount">${fmt(entry.health_plan)}</td></tr>` : ''}
  </table>
</div>

<div class="section">
  <div class="section-title">Encargos (Custos do Empregador)</div>
  <table>
    <tr><th>Descrição</th><th style="text-align:right">Valor</th></tr>
    <tr><td>FGTS (8%)</td><td class="amount">${fmt(entry.fgts)}</td></tr>
  </table>
</div>

<div class="net-salary">Salário Líquido: ${fmt(entry.net_salary)}</div>

<div class="footer">
  Gero — Sistema de Gestão de RH &bull; W3TI SERVIÇOS DE INFORMÁTICA LTDA &bull; suporte@w3ti.com.br<br>
  © 2026 W3TI SERVIÇOS DE INFORMÁTICA LTDA. Todos os direitos reservados.
</div>
</body>
</html>`;
  });

  ipcMain.handle('payroll:listEntries', async (_e, token: string, periodId: string) => {
    await validateSession(token);
    return query<PayrollEntry>(`
      SELECT pe.*, e.name AS employee_name, d.name AS department_name, p.title AS position_title
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      WHERE pe.period_id = $1 ORDER BY e.name
    `, [periodId]);
  });

  ipcMain.handle('payroll:recalculate', async (_e, token: string, periodId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');

    const entries = await query<PayrollEntry>('SELECT * FROM payroll_entries WHERE period_id=$1', [periodId]);
    return transaction(async (client) => {
      for (const entry of entries) {
        const calc = calculatePayroll(
          parseFloat(String(entry.base_salary)),
          parseFloat(String(entry.overtime_value)),
          parseFloat(String(entry.bonus)),
          parseFloat(String(entry.other_earnings)),
          parseFloat(String(entry.absence_discount)),
          parseFloat(String(entry.other_discounts))
        );
        await client.query(`
          UPDATE payroll_entries SET
            gross_salary=$1, inss=$2, irrf=$3, fgts=$4, net_salary=$5, updated_at=now()
          WHERE id=$6
        `, [calc.gross_salary, calc.inss, calc.irrf, calc.fgts, calc.net_salary, entry.id]);
      }
      return entries.length;
    });
  });

  // ─── Décimo Terceiro ──────────────────────────────────────────────────────────

  ipcMain.handle('payroll:listDecimo13', async (_e, token: string, year: number) => {
    await validateSession(token);
    return query<Decimo13Entry>(`
      SELECT d.*, e.name AS employee_name, dep.name AS department_name, p.title AS position_title
      FROM decimo13_entries d
      JOIN employees e ON e.id = d.employee_id
      LEFT JOIN departments dep ON dep.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      WHERE d.year = $1
      ORDER BY e.name
    `, [year]);
  });

  ipcMain.handle('payroll:generateDecimo13', async (_e, token: string, year: number) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');

    const employees = await query<Employee & { hire_date: string }>(
      `SELECT * FROM employees WHERE is_active = true AND contract_type = 'clt'`
    );

    return transaction(async (client) => {
      let count = 0;
      for (const emp of employees) {
        const months = calcDecimo13MonthsWorked(new Date(emp.hire_date), year);
        if (months <= 0) continue;

        const calc = calculateDecimo13(parseFloat(String(emp.base_salary)), months);

        await client.query(`
          INSERT INTO decimo13_entries
            (employee_id, year, months_worked, gross, first_installment, inss, irrf, fgts, second_installment, net_total, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (employee_id, year) DO UPDATE SET
            months_worked=$3, gross=$4, first_installment=$5, inss=$6, irrf=$7,
            fgts=$8, second_installment=$9, net_total=$10, updated_at=now()
        `, [emp.id, year, calc.months_worked, calc.gross, calc.first_installment,
            calc.inss, calc.irrf, calc.fgts, calc.second_installment, calc.net_total, sess.id]);
        count++;
      }
      return count;
    });
  });

  ipcMain.handle('payroll:payDecimo13First', async (_e, token: string, entryId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');

    const updated = await execute(
      `UPDATE decimo13_entries SET status='paid_first', first_paid_at=now(), updated_at=now()
       WHERE id=$1 AND status='draft'`,
      [entryId]
    );
    if (!updated) throw new Error('Entrada não está em rascunho');
    return queryOne<Decimo13Entry>('SELECT * FROM decimo13_entries WHERE id=$1', [entryId]);
  });

  // ─── Rescisão ─────────────────────────────────────────────────────────────────

  ipcMain.handle('payroll:calcRescisao', async (_e, token: string, params: {
    employee_id: string;
    termination_date: string;
    termination_reason: 'resignation' | 'dismissal' | 'mutual' | 'retirement' | 'other';
    notice_period_worked: boolean;
    vacation_days_vencidas: number;
    vacation_months_proportional: number;
    decimo13_months_worked: number;
    decimo13_already_paid: number;
  }): Promise<RescisaoResult & { notice_days: number }> => {
    await validateSession(token);
    const emp = await queryOne<Employee>('SELECT * FROM employees WHERE id=$1', [params.employee_id]);
    if (!emp) throw new Error('Funcionário não encontrado');

    const result = calculateRescisao({
      baseSalary: parseFloat(String(emp.base_salary)),
      hireDate: new Date(emp.hire_date),
      terminationDate: new Date(params.termination_date),
      terminationReason: params.termination_reason,
      noticePeriodWorked: params.notice_period_worked,
      vacationDaysVencidas: params.vacation_days_vencidas,
      vacationMonthsProportional: params.vacation_months_proportional,
      decimo13MonthsWorked: params.decimo13_months_worked,
      decimo13AlreadyPaid: params.decimo13_already_paid,
    });
    return result;
  });

  ipcMain.handle('payroll:saveRescisao', async (_e, token: string, params: {
    employee_id: string;
    termination_date: string;
    termination_reason: 'resignation' | 'dismissal' | 'mutual' | 'retirement' | 'other';
    notice_period_worked: boolean;
    vacation_days_vencidas: number;
    vacation_months_proportional: number;
    decimo13_months_worked: number;
    decimo13_already_paid: number;
  }): Promise<RescisaoEntry> => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');

    const emp = await queryOne<Employee>('SELECT * FROM employees WHERE id=$1', [params.employee_id]);
    if (!emp) throw new Error('Funcionário não encontrado');

    const r = calculateRescisao({
      baseSalary: parseFloat(String(emp.base_salary)),
      hireDate: new Date(emp.hire_date),
      terminationDate: new Date(params.termination_date),
      terminationReason: params.termination_reason,
      noticePeriodWorked: params.notice_period_worked,
      vacationDaysVencidas: params.vacation_days_vencidas,
      vacationMonthsProportional: params.vacation_months_proportional,
      decimo13MonthsWorked: params.decimo13_months_worked,
      decimo13AlreadyPaid: params.decimo13_already_paid,
    });

    return queryOne<RescisaoEntry>(`
      INSERT INTO rescisao_entries (
        employee_id, termination_date, termination_reason, notice_period_worked,
        vacation_days_vencidas, vacation_months_proportional,
        decimo13_months_worked, decimo13_already_paid,
        saldo_salario, aviso_previo, aviso_previo_days,
        ferias_vencidas, ferias_proporcionais, decimo13_proporcional,
        fgts_depositos, fgts_multa, inss, irrf, gross_total, net_total,
        notice_days, total_months, days_in_last_month, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      )
      ON CONFLICT (employee_id, termination_date) DO UPDATE SET
        termination_reason=$3, notice_period_worked=$4,
        vacation_days_vencidas=$5, vacation_months_proportional=$6,
        decimo13_months_worked=$7, decimo13_already_paid=$8,
        saldo_salario=$9, aviso_previo=$10, aviso_previo_days=$11,
        ferias_vencidas=$12, ferias_proporcionais=$13, decimo13_proporcional=$14,
        fgts_depositos=$15, fgts_multa=$16, inss=$17, irrf=$18,
        gross_total=$19, net_total=$20, notice_days=$21, total_months=$22, days_in_last_month=$23
      RETURNING *
    `, [
      params.employee_id, params.termination_date, params.termination_reason, params.notice_period_worked,
      params.vacation_days_vencidas, params.vacation_months_proportional,
      params.decimo13_months_worked, params.decimo13_already_paid,
      r.saldo_salario, r.aviso_previo, r.aviso_previo_days,
      r.ferias_vencidas, r.ferias_proporcionais, r.decimo13_proporcional,
      r.fgts_depositos, r.fgts_multa, r.inss, r.irrf, r.gross_total, r.net_total,
      r.notice_days, r.total_months, r.days_in_last_month, sess.id,
    ]) as Promise<RescisaoEntry>;
  });

  ipcMain.handle('payroll:listRescisao', async (_e, token: string) => {
    await validateSession(token);
    return query<RescisaoEntry>(`
      SELECT r.*, e.name AS employee_name, d.name AS department_name, p.title AS position_title
      FROM rescisao_entries r
      JOIN employees e ON e.id = r.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      ORDER BY r.termination_date DESC
    `);
  });

  ipcMain.handle('payroll:getRescisao', async (_e, token: string, id: string) => {
    await validateSession(token);
    return queryOne<RescisaoEntry>(`
      SELECT r.*, e.name AS employee_name, d.name AS department_name, p.title AS position_title
      FROM rescisao_entries r
      JOIN employees e ON e.id = r.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      WHERE r.id = $1
    `, [id]);
  });

  ipcMain.handle('payroll:payDecimo13Second', async (_e, token: string, entryId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'payroll:write')) throw new Error('Sem permissão');

    const updated = await execute(
      `UPDATE decimo13_entries SET status='paid_both', second_paid_at=now(), updated_at=now()
       WHERE id=$1 AND status='paid_first'`,
      [entryId]
    );
    if (!updated) throw new Error('1ª parcela ainda não foi paga');
    return queryOne<Decimo13Entry>('SELECT * FROM decimo13_entries WHERE id=$1', [entryId]);
  });
}
