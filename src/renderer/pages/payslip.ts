import type { PayrollPeriod, PayrollEntry } from '../../shared/types';
import { getToken } from '../index';
import { renderTable } from '../components/table';
import { showToast } from '../components/toast';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export async function renderPayslip(container: HTMLElement): Promise<void> {
  const token = getToken();
  let selectedPeriodId = '';

  async function load(): Promise<void> {
    const periods = await window.gero.invoke('payroll:listPeriods', token) as PayrollPeriod[];

    container.innerHTML = `
      <div style="max-width:1200px">
        <div style="margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Holerites</h1>
          <p style="font-size:13px;color:#6B7280;margin-top:2px">Visualize e imprima contracheques individuais</p>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center">
          <select id="period-select" style="padding:9px 12px;border-radius:8px;border:1px solid #2A2D3A;background:#1A1D27;color:#fff;font-size:13px;outline:none;min-width:240px">
            <option value="">— Selecione um período —</option>
            ${periods.map(p => `<option value="${p.id}" ${selectedPeriodId===p.id?'selected':''}>${MONTHS[p.month-1]}/${p.year} — ${p.status}</option>`).join('')}
          </select>
        </div>

        <div id="entries-list" style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          <div style="padding:40px;text-align:center;color:#6B7280">
            <i class="ti ti-file-invoice" style="font-size:36px;display:block;margin-bottom:8px"></i>
            Selecione um período para listar os holerites
          </div>
        </div>
      </div>
    `;

    (document.getElementById('period-select') as HTMLSelectElement)?.addEventListener('change', function() {
      selectedPeriodId = this.value;
      if (selectedPeriodId) loadEntries(selectedPeriodId);
    });
  }

  async function loadEntries(periodId: string): Promise<void> {
    const listEl = document.getElementById('entries-list')!;
    listEl.innerHTML = `<div style="padding:20px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;

    try {
      const entries = await window.gero.invoke('payroll:listEntries', token, periodId) as PayrollEntry[];

      if (entries.length === 0) {
        listEl.innerHTML = `<div style="padding:40px;text-align:center;color:#6B7280">Nenhuma entrada. Gere a folha primeiro na tela de Períodos.</div>`;
        return;
      }

      listEl.innerHTML = `
        <div style="padding:12px 16px;border-bottom:1px solid #2A2D3A;font-size:13px;font-weight:600;display:flex;justify-content:space-between">
          <span>${entries.length} funcionários</span>
          <span style="color:#1D9E75;font-family:'JetBrains Mono',monospace">${fmtBRL(entries.reduce((s,e) => s + Number(e.net_salary), 0))} total líquido</span>
        </div>
        ${renderTable({
          columns: [
            { key: 'employee_name', label: 'Funcionário',  render: r => `<span style="font-weight:500">${(r as PayrollEntry).employee_name ?? ''}</span>` },
            { key: 'department',    label: 'Departamento', render: r => (r as PayrollEntry).department_name ?? '—' },
            { key: 'gross_salary',  label: 'Bruto',        render: r => `<span style="font-family:'JetBrains Mono',monospace">${fmtBRL(Number((r as PayrollEntry).gross_salary))}</span>` },
            { key: 'inss',          label: 'INSS',         render: r => `<span style="font-family:'JetBrains Mono',monospace;color:#D85A30">-${fmtBRL(Number((r as PayrollEntry).inss))}</span>` },
            { key: 'irrf',          label: 'IRRF',         render: r => `<span style="font-family:'JetBrains Mono',monospace;color:#D85A30">-${fmtBRL(Number((r as PayrollEntry).irrf))}</span>` },
            { key: 'net_salary',    label: 'Líquido',      render: r => `<span style="font-family:'JetBrains Mono',monospace;color:#1D9E75;font-weight:600">${fmtBRL(Number((r as PayrollEntry).net_salary))}</span>` },
            { key: 'actions', label: '', width: '100px',
              render: r => `<button class="btn-view-payslip" data-id="${(r as PayrollEntry).id}" style="padding:5px 12px;border-radius:6px;border:1px solid #EF9F2744;background:#EF9F2711;color:#EF9F27;cursor:pointer;font-size:12px">
                <i class="ti ti-eye"></i> Ver</button>` },
          ],
          data: entries,
          rowKey: r => (r as PayrollEntry).id,
        })}
      `;

      listEl.querySelectorAll('.btn-view-payslip').forEach(btn => {
        btn.addEventListener('click', async () => {
          const entryId = btn.getAttribute('data-id')!;
          try {
            const html = await window.gero.invoke('payroll:generatePayslip', token, entryId) as string;
            const win = window.open('', '_blank', 'width=820,height=680,scrollbars=yes');
            if (win) { win.document.write(html); win.document.close(); }
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Erro ao gerar holerite', 'error');
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div style="padding:24px;color:#D85A30">Erro: ${err instanceof Error ? err.message : String(err)}</div>`;
    }
  }

  await load();
}
