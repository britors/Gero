import { ipcMain } from 'electron';
import { query, queryOne } from '../database';
import { validateSession } from '../middleware/permissions';
import { DashboardData, Employee, JobOpening, EvaluationCycle } from '../../shared/types';

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:getData', async (_e, token: string): Promise<DashboardData> => {
    await validateSession(token);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [
      totalEmployees,
      activeEmployees,
      newHires,
      terminations,
      openPositions,
      totalCandidates,
      pendingTimesheets,
      pendingVacations,
      payrollTotal,
      avgSalary,
      headcountByDept,
      payrollChart,
      recentHires,
      birthdays,
      openJobs,
      evalProgress,
    ] = await Promise.all([
      queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM employees'),
      queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM employees WHERE is_active=true'),
      queryOne<{ count: string }>(`
        SELECT COUNT(*) AS count FROM employees
        WHERE EXTRACT(YEAR FROM hire_date)=$1 AND EXTRACT(MONTH FROM hire_date)=$2
      `, [year, month]),
      queryOne<{ count: string }>(`
        SELECT COUNT(*) AS count FROM employees
        WHERE termination_date IS NOT NULL
          AND EXTRACT(YEAR FROM termination_date)=$1 AND EXTRACT(MONTH FROM termination_date)=$2
      `, [year, month]),
      queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM job_openings WHERE status=\'open\''),
      queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM candidates'),
      queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM timesheets WHERE status=\'submitted\''),
      queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM vacation_requests WHERE status=\'pending\''),
      queryOne<{ total: string }>(`
        SELECT SUM(pe.net_salary) AS total FROM payroll_entries pe
        JOIN payroll_periods pp ON pp.id = pe.period_id
        WHERE pp.month=$1 AND pp.year=$2
      `, [month, year]),
      queryOne<{ avg: string }>('SELECT AVG(base_salary) AS avg FROM employees WHERE is_active=true'),

      query<{ dept: string; count: number }>(`
        SELECT d.name AS dept, COUNT(e.id)::int AS count
        FROM departments d
        LEFT JOIN employees e ON e.department_id=d.id AND e.is_active=true
        GROUP BY d.name ORDER BY count DESC
      `),

      query<{ month: string; total: number; headcount: number }>(`
        SELECT
          TO_CHAR(TO_DATE(pp.year || '-' || pp.month, 'YYYY-MM'), 'Mon/YYYY') AS month,
          COALESCE(SUM(pe.net_salary), 0)::numeric AS total,
          COUNT(pe.id)::int AS headcount
        FROM payroll_periods pp
        LEFT JOIN payroll_entries pe ON pe.period_id = pp.id
        WHERE pp.year * 100 + pp.month > (EXTRACT(YEAR FROM now()) * 100 + EXTRACT(MONTH FROM now()) - 6)::int
        GROUP BY pp.year, pp.month ORDER BY pp.year, pp.month
      `),

      query<Employee>(`
        SELECT e.*, d.name AS department_name, p.title AS position_title
        FROM employees e
        LEFT JOIN departments d ON d.id=e.department_id
        LEFT JOIN positions p ON p.id=e.position_id
        ORDER BY e.hire_date DESC LIMIT 5
      `),

      query<Employee>(`
        SELECT e.*, d.name AS department_name FROM employees e
        LEFT JOIN departments d ON d.id=e.department_id
        WHERE e.is_active=true
          AND EXTRACT(MONTH FROM e.birth_date)=$1
        ORDER BY EXTRACT(DAY FROM e.birth_date)
      `, [month]),

      query<JobOpening>(`
        SELECT jo.*, d.name AS department_name, COUNT(c.id)::int AS candidate_count
        FROM job_openings jo
        LEFT JOIN departments d ON d.id=jo.department_id
        LEFT JOIN candidates c ON c.opening_id=jo.id
        WHERE jo.status='open'
        GROUP BY jo.id, d.name ORDER BY jo.opened_at DESC
      `),

      query<{ cycle_id: string; cycle_name: string; start_date: string; end_date: string; status: string; form_count: number; completed_count: number }>(`
        SELECT ec.id AS cycle_id, ec.name AS cycle_name, ec.start_date, ec.end_date, ec.status,
               COUNT(ef.id)::int AS form_count,
               COUNT(ef.id) FILTER (WHERE ef.status='completed')::int AS completed_count
        FROM evaluation_cycles ec
        LEFT JOIN evaluation_forms ef ON ef.cycle_id=ec.id
        WHERE ec.status IN ('draft','in_progress')
        GROUP BY ec.id ORDER BY ec.start_date DESC
      `),
    ]);

    return {
      metrics: {
        totalEmployees: parseInt(totalEmployees?.count ?? '0'),
        activeEmployees: parseInt(activeEmployees?.count ?? '0'),
        newHiresThisMonth: parseInt(newHires?.count ?? '0'),
        terminationsThisMonth: parseInt(terminations?.count ?? '0'),
        openPositions: parseInt(openPositions?.count ?? '0'),
        totalCandidates: parseInt(totalCandidates?.count ?? '0'),
        pendingTimesheets: parseInt(pendingTimesheets?.count ?? '0'),
        pendingVacations: parseInt(pendingVacations?.count ?? '0'),
        monthPayrollTotal: parseFloat(payrollTotal?.total ?? '0'),
        averageSalary: parseFloat(avgSalary?.avg ?? '0'),
      },
      headcountByDept,
      payrollChart,
      recentHires,
      birthdaysThisMonth: birthdays,
      openJobOpenings: openJobs,
      evaluationProgress: evalProgress.map(r => ({
        cycle: {
          id: r.cycle_id, name: r.cycle_name, start_date: r.start_date, end_date: r.end_date,
          status: r.status as EvaluationCycle['status'],
          created_at: '', updated_at: '',
          form_count: r.form_count, completed_count: r.completed_count,
        },
        completion: r.form_count > 0 ? Math.round((r.completed_count / r.form_count) * 100) : 0,
      })),
    };
  });
}
