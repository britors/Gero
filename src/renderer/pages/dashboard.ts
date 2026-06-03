import type { DashboardData } from '../../shared/types';
import { getToken } from '../index';
import { renderBarChart, renderLineChart } from '../components/charts';
import { navigate } from '../router';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

function metricCard(icon: string, label: string, value: string | number, sub: string, color = '#EF9F27', route?: string): string {
  const clickable = route ? `data-route="${route}" style="cursor:pointer"` : '';
  return `
    <div class="metric-card" ${clickable} style="
      background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;
      padding:20px;display:flex;flex-direction:column;gap:8px;
      transition:border-color 0.15s;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:12px;color:#9CA3AF;font-weight:500">${label}</div>
        <div style="width:32px;height:32px;border-radius:8px;background:${color}22;
                    display:flex;align-items:center;justify-content:center">
          <i class="ti ${icon}" style="font-size:16px;color:${color}"></i>
        </div>
      </div>
      <div style="font-size:24px;font-weight:700;color:#fff;font-family:'JetBrains Mono',monospace">${value}</div>
      <div style="font-size:11px;color:#6B7280">${sub}</div>
    </div>
  `;
}

export async function renderDashboard(container: HTMLElement): Promise<void> {
  const token = getToken();
  const data = await window.gero.invoke('dashboard:getData', token) as DashboardData;
  const m = data.metrics;

  const barChartData = data.headcountByDept.map(d => ({ label: d.dept, value: d.count }));
  const lineData = data.payrollChart.map(d => ({
    label: d.month,
    value: Number(d.total),
    value2: d.headcount,
  }));

  container.innerHTML = `
    <div style="max-width:1400px">
      <div style="margin-bottom:24px">
        <h1 style="font-size:20px;font-weight:700;color:#fff">Dashboard</h1>
        <p style="font-size:13px;color:#6B7280;margin-top:4px">Visão geral dos recursos humanos</p>
      </div>

      <!-- Metrics grid -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px">
        ${metricCard('ti-users',         'Total de Funcionários',    m.totalEmployees,          `${m.activeEmployees} ativos`,       '#EF9F27', '/employees')}
        ${metricCard('ti-user-plus',     'Novas Contratações',        m.newHiresThisMonth,       'neste mês',                         '#1D9E75', '/employees')}
        ${metricCard('ti-user-minus',    'Desligamentos',             m.terminationsThisMonth,   'neste mês',                         '#D85A30')}
        ${metricCard('ti-speakerphone',  'Vagas Abertas',             m.openPositions,           `${m.totalCandidates} candidatos`,   '#3B6FE8', '/recruitment')}
        ${metricCard('ti-clock',         'Pontos Pendentes',          m.pendingTimesheets,       'aguardando aprovação',              '#7F77DD', '/timesheet')}
        ${metricCard('ti-beach',         'Férias Pendentes',          m.pendingVacations,        'aguardando aprovação',              '#F5C842', '/vacation')}
        ${metricCard('ti-cash',          'Folha do Mês',              fmtBRL(m.monthPayrollTotal),'total líquido',                   '#EF9F27', '/payroll')}
        ${metricCard('ti-chart-line',    'Salário Médio',             fmtBRL(m.averageSalary),   'funcionários ativos',               '#1D9E75')}
        ${metricCard('ti-building',      'Departamentos',             data.headcountByDept.length,'com funcionários ativos',          '#3B6FE8', '/departments')}
        ${metricCard('ti-chart-bar',     'Ciclos de Avaliação',       data.evaluationProgress.length,'em andamento',                  '#7F77DD', '/evaluation')}
      </div>

      <!-- Charts row -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <!-- Headcount by dept -->
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:16px">Headcount por Departamento</h3>
          <div style="overflow-x:auto">
            ${renderBarChart(barChartData, { width: 500, height: 200, yFormatter: v => String(Math.round(v)) })}
          </div>
        </div>
        <!-- Payroll evolution -->
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:16px">Evolução da Folha (6 meses)</h3>
          <div style="overflow-x:auto">
            ${renderLineChart(lineData, { width: 500, height: 200, yFormatter: v => (v/1000).toFixed(0) + 'k' })}
          </div>
          <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:#9CA3AF">
            <span><span style="display:inline-block;width:12px;height:3px;background:#EF9F27;vertical-align:middle;margin-right:4px"></span>Folha (R$ mil)</span>
            <span><span style="display:inline-block;width:12px;height:3px;background:#3B6FE8;vertical-align:middle;margin-right:4px;border-top:2px dashed #3B6FE8"></span>Headcount</span>
          </div>
        </div>
      </div>

      <!-- Bottom row -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
        <!-- Recent hires -->
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:14px">Contratações Recentes</h3>
          ${data.recentHires.length === 0
            ? `<p style="color:#6B7280;font-size:13px">Nenhuma contratação recente</p>`
            : data.recentHires.slice(0, 5).map(e => `
              <div class="hover-row" data-route="/employees/${e.id}" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #2A2D3A22;cursor:pointer">
                <div style="width:32px;height:32px;border-radius:50%;background:#EF9F2722;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#EF9F27;flex-shrink:0">
                  ${e.name.slice(0, 2).toUpperCase()}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.name}</div>
                  <div style="font-size:11px;color:#6B7280">${e.position_title ?? e.department_name ?? ''}</div>
                </div>
                <div style="font-size:11px;color:#6B7280">${fmtDate(e.hire_date)}</div>
              </div>`).join('')}
        </div>

        <!-- Birthdays -->
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:14px">🎂 Aniversários do Mês</h3>
          ${data.birthdaysThisMonth.length === 0
            ? `<p style="color:#6B7280;font-size:13px">Nenhum aniversário este mês</p>`
            : data.birthdaysThisMonth.map(e => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #2A2D3A22">
                <div style="width:32px;height:32px;border-radius:50%;background:#F5C84222;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#F5C842;flex-shrink:0">
                  ${e.name.slice(0, 2).toUpperCase()}
                </div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:500">${e.name}</div>
                  <div style="font-size:11px;color:#6B7280">${e.birth_date ? fmtDate(e.birth_date) : ''}</div>
                </div>
              </div>`).join('')}
        </div>

        <!-- Open jobs -->
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:14px">Vagas Abertas</h3>
          ${data.openJobOpenings.length === 0
            ? `<p style="color:#6B7280;font-size:13px">Nenhuma vaga aberta</p>`
            : data.openJobOpenings.slice(0, 5).map(j => `
              <div class="hover-row" data-route="/recruitment" style="padding:8px 0;border-bottom:1px solid #2A2D3A22;cursor:pointer">
                <div style="font-size:13px;font-weight:500;margin-bottom:2px">${j.title}</div>
                <div style="font-size:11px;color:#6B7280">${j.department_name ?? ''} &bull; ${j.candidate_count ?? 0} candidatos</div>
              </div>`).join('')}
        </div>
      </div>
    </div>
    <style>
      .metric-card:hover { border-color:#EF9F2766 !important; }
      .hover-row:hover { opacity:0.8; }
    </style>
  `;

  // Route click handlers
  container.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', () => {
      navigate(el.getAttribute('data-route')!);
    });
  });
}
