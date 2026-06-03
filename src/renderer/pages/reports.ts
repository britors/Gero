import type { Employee, PayrollPeriod } from '../../shared/types';
import { getToken } from '../index';
import { renderBarChart } from '../components/charts';
import { renderTable } from '../components/table';
import { contractBadge } from '../components/badge';

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const MONTHS  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export async function renderReports(container: HTMLElement): Promise<void> {
  const token = getToken();
  let activeReport = 'headcount';

  async function load(): Promise<void> {
    container.innerHTML = `
      <div style="max-width:1400px">
        <div style="margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Relatórios</h1>
          <p style="font-size:13px;color:#6B7280;margin-top:2px">Análises e exportações de dados de RH</p>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
          ${[
            ['headcount',  'Headcount',       'ti-users'],
            ['payroll',    'Folha',            'ti-cash'],
            ['turnover',   'Rotatividade',     'ti-trending-up'],
            ['benefits',   'Benefícios',       'ti-gift'],
          ].map(([key,label,icon]) => `
            <button class="report-btn" data-key="${key}" style="
              display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;
              border:1px solid #2A2D3A;cursor:pointer;font-size:13px;
              background:${activeReport===key?'#EF9F2722':'transparent'};
              color:${activeReport===key?'#EF9F27':'#9CA3AF'};
              border-color:${activeReport===key?'#EF9F2744':'#2A2D3A'}">
              <i class="ti ${icon}"></i>${label}
            </button>`).join('')}
        </div>

        <div id="report-content" style="display:grid;gap:16px">
          <div style="padding:40px;text-align:center;color:#6B7280"><div class="spinner" style="margin:0 auto"></div></div>
        </div>
      </div>
    `;

    container.querySelectorAll('.report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeReport = btn.getAttribute('data-key')!;
        container.querySelectorAll('.report-btn').forEach(b => {
          const a = b.getAttribute('data-key') === activeReport;
          (b as HTMLElement).style.background = a ? '#EF9F2722' : 'transparent';
          (b as HTMLElement).style.color = a ? '#EF9F27' : '#9CA3AF';
          (b as HTMLElement).style.borderColor = a ? '#EF9F2744' : '#2A2D3A';
        });
        loadReport(activeReport);
      });
    });

    loadReport(activeReport);
  }

  async function loadReport(key: string): Promise<void> {
    const rc = document.getElementById('report-content')!;
    rc.innerHTML = `<div style="padding:40px;text-align:center;color:#6B7280"><div class="spinner" style="margin:0 auto"></div></div>`;

    if (key === 'headcount') await loadHeadcountReport(rc);
    else if (key === 'payroll') await loadPayrollReport(rc);
    else if (key === 'turnover') await loadTurnoverReport(rc);
    else if (key === 'benefits') await loadBenefitsReport(rc);
  }

  async function loadHeadcountReport(rc: HTMLElement): Promise<void> {
    const employees = await window.gero.invoke('employees:list', token, { pageSize: 500 }) as { data: Employee[]; total: number };

    const contractMap: Record<string, number> = {};
    const deptMap: Record<string, number> = {};
    const activeCount  = employees.data.filter(e => e.is_active).length;
    const inactiveCount = employees.data.filter(e => !e.is_active).length;

    employees.data.filter(e => e.is_active).forEach(e => {
      contractMap[e.contract_type] = (contractMap[e.contract_type] ?? 0) + 1;
      const dept = e.department_name ?? 'Sem departamento';
      deptMap[dept] = (deptMap[dept] ?? 0) + 1;
    });

    const deptData = Object.entries(deptMap).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value);

    rc.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:16px">Headcount por Departamento</h3>
          ${renderBarChart(deptData, { width: 460, height: 220, yFormatter: v => String(Math.round(v)) })}
        </div>
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:16px">Distribuição por Contrato</h3>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
            ${Object.entries(contractMap).map(([type, count]) => `
              <div style="display:flex;align-items:center;justify-content:space-between">
                ${contractBadge(type)}
                <span style="font-family:'JetBrains Mono',monospace">${count}</span>
              </div>`).join('')}
          </div>
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #2A2D3A">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#1D9E75;font-size:13px">Ativos: ${activeCount}</span>
              <span style="color:#D85A30;font-size:13px">Inativos: ${inactiveCount}</span>
            </div>
            <div style="font-size:24px;font-weight:700;color:#EF9F27;font-family:'JetBrains Mono',monospace">${employees.total} total</div>
          </div>
        </div>
      </div>

      <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
        <div style="padding:14px 16px;border-bottom:1px solid #2A2D3A;font-size:13px;font-weight:600">
          Lista de Funcionários (${employees.total})
        </div>
        ${renderTable<Employee>({
          columns: [
            { key: 'name',            label: 'Nome',         render: r => `<span style="font-weight:500">${r.name}</span>` },
            { key: 'department_name', label: 'Departamento', render: r => r.department_name ?? '—' },
            { key: 'contract_type',   label: 'Contrato',     render: r => contractBadge(r.contract_type) },
            { key: 'base_salary',     label: 'Salário',      render: r => `<span style="font-family:'JetBrains Mono',monospace">${fmtBRL(Number(r.base_salary))}</span>` },
            { key: 'hire_date',       label: 'Admissão',     render: r => fmtDate(r.hire_date) },
          ],
          data: employees.data,
          rowKey: r => r.id,
        })}
      </div>
    `;
  }

  async function loadPayrollReport(rc: HTMLElement): Promise<void> {
    const periods = await window.gero.invoke('payroll:listPeriods', token) as PayrollPeriod[];
    const chartData = periods.slice().reverse().slice(-12).map(p => ({
      label: `${MONTHS[p.month-1]}/${String(p.year).slice(-2)}`,
      value: Number(p.total_net ?? 0),
    }));

    rc.innerHTML = `
      <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:16px">Evolução da Folha</h3>
        ${renderBarChart(chartData, { width: 800, height: 250, yFormatter: v => `${(v/1000).toFixed(0)}k` })}
      </div>
      <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
        ${renderTable<PayrollPeriod>({
          columns: [
            { key: 'period',     label: 'Período',       render: r => `${MONTHS[r.month-1]}/${r.year}` },
            { key: 'status',     label: 'Status',        render: r => r.status },
            { key: 'entry_count',label: 'Funcionários',  render: r => `<span style="font-family:'JetBrains Mono',monospace">${r.entry_count ?? 0}</span>` },
            { key: 'total_net',  label: 'Total Líquido', render: r => `<span style="font-family:'JetBrains Mono',monospace;color:#1D9E75">${r.total_net ? fmtBRL(Number(r.total_net)) : '—'}</span>` },
          ],
          data: periods,
          rowKey: r => r.id,
        })}
      </div>
    `;
  }

  async function loadTurnoverReport(rc: HTMLElement): Promise<void> {
    const employees = await window.gero.invoke('employees:list', token, { active: false, pageSize: 200 }) as { data: Employee[] };
    const terminated = employees.data.filter(e => e.termination_date);

    rc.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${[['Desligamentos','total',terminated.length,'#D85A30'],
           ['Resignações','resignation',terminated.filter(e=>e.termination_reason==='resignation').length,'#EF9F27'],
           ['Demissões','dismissal',terminated.filter(e=>e.termination_reason==='dismissal').length,'#7F77DD']
        ].map(([label,,count,color]) => `
          <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px;text-align:center">
            <div style="font-size:28px;font-weight:700;color:${color};font-family:'JetBrains Mono',monospace">${count}</div>
            <div style="font-size:12px;color:#9CA3AF;margin-top:4px">${label}</div>
          </div>`).join('')}
      </div>
      <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
        ${renderTable<Employee>({
          columns: [
            { key: 'name',               label: 'Funcionário',  render: r => `<span style="font-weight:500">${r.name}</span>` },
            { key: 'department_name',    label: 'Departamento', render: r => r.department_name ?? '—' },
            { key: 'hire_date',          label: 'Admissão',     render: r => fmtDate(r.hire_date) },
            { key: 'termination_date',   label: 'Desligamento', render: r => fmtDate(r.termination_date ?? '') },
            { key: 'termination_reason', label: 'Motivo',       render: r => r.termination_reason ?? '—' },
          ],
          data: terminated,
          rowKey: r => r.id,
        })}
      </div>
    `;
  }

  async function loadBenefitsReport(rc: HTMLElement): Promise<void> {
    const benefits = await window.gero.invoke('benefits:listBenefits', token) as Array<{ name: string; type: string; value?: number; is_active: boolean }>;
    const active = benefits.filter(b => b.is_active);

    rc.innerHTML = `
      <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:20px">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:16px">Benefícios Ativos (${active.length})</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          ${active.map(b => `
            <div style="background:#0F1117;border-radius:8px;padding:14px">
              <div style="font-weight:600;margin-bottom:4px">${b.name}</div>
              <div style="font-size:11px;color:#9CA3AF">${b.type}</div>
              <div style="font-size:16px;font-weight:700;color:#EF9F27;font-family:'JetBrains Mono',monospace;margin-top:6px">
                ${b.value ? fmtBRL(Number(b.value)) : '—'}
              </div>
            </div>`).join('')}
        </div>
      </div>
    `;
  }

  await load();
}
