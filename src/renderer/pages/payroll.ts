import type { PayrollPeriod, PayrollEntry, Decimo13Entry } from '../../shared/types';
import { getToken } from '../index';
import { renderTable } from '../components/table';
import { statusBadge } from '../components/badge';
import { openModal, closeModal, openConfirm } from '../components/modal';
import { showToast } from '../components/toast';
import { navigate } from '../router';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function decimo13Badge(status: string): string {
  if (status === 'paid_both')  return `<span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:#1D9E7522;color:#1D9E75">Quitado</span>`;
  if (status === 'paid_first') return `<span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:#EF9F2722;color:#EF9F27">1ª Paga</span>`;
  return `<span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:#6B728022;color:#9CA3AF">Rascunho</span>`;
}

export async function renderPayroll(container: HTMLElement): Promise<void> {
  const token = getToken();
  let activeTab: 'folha' | 'decimo13' = 'folha';

  container.innerHTML = `
    <div style="max-width:1400px">
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:20px">
        <h1 style="font-size:20px;font-weight:700;margin-right:16px">Folha de Pagamento</h1>
        <button id="tab-folha" style="padding:7px 16px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;background:#EF9F27;color:#fff">Folha Mensal</button>
        <button id="tab-decimo13" style="padding:7px 16px;border-radius:8px;border:1px solid #2A2D3A;font-size:13px;font-weight:600;cursor:pointer;background:transparent;color:#9CA3AF">Décimo Terceiro</button>
      </div>
      <div id="tab-content"></div>
    </div>`;

  function setTab(tab: 'folha' | 'decimo13'): void {
    activeTab = tab;
    const btnFolha    = document.getElementById('tab-folha') as HTMLButtonElement;
    const btnDecimo13 = document.getElementById('tab-decimo13') as HTMLButtonElement;
    if (tab === 'folha') {
      btnFolha.style.cssText    = 'padding:7px 16px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;background:#EF9F27;color:#fff';
      btnDecimo13.style.cssText = 'padding:7px 16px;border-radius:8px;border:1px solid #2A2D3A;font-size:13px;font-weight:600;cursor:pointer;background:transparent;color:#9CA3AF';
      loadFolha();
    } else {
      btnFolha.style.cssText    = 'padding:7px 16px;border-radius:8px;border:1px solid #2A2D3A;font-size:13px;font-weight:600;cursor:pointer;background:transparent;color:#9CA3AF';
      btnDecimo13.style.cssText = 'padding:7px 16px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;background:#EF9F27;color:#fff';
      loadDecimo13();
    }
  }

  document.getElementById('tab-folha')?.addEventListener('click',    () => setTab('folha'));
  document.getElementById('tab-decimo13')?.addEventListener('click', () => setTab('decimo13'));

  // ── Décimo Terceiro tab ──────────────────────────────────────────────────────

  async function loadDecimo13(): Promise<void> {
    const tabContent = document.getElementById('tab-content')!;
    const year = new Date().getFullYear();

    tabContent.innerHTML = `
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px">
            <label style="font-size:13px;color:#9CA3AF">Ano:</label>
            <input id="d13-year" type="number" value="${year}" min="2020" max="2030"
              style="width:90px;padding:6px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          </div>
          <button id="btn-gen-d13" style="padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-refresh"></i> Gerar / Recalcular
          </button>
        </div>
        <div id="d13-table-wrap"></div>
      </div>`;

    async function loadD13Table(): Promise<void> {
      const y = parseInt((document.getElementById('d13-year') as HTMLInputElement).value);
      const entries = await window.gero.invoke('payroll:listDecimo13', token, y) as Decimo13Entry[];
      const wrap = document.getElementById('d13-table-wrap')!;

      if (entries.length === 0) {
        wrap.innerHTML = `<div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:40px;text-align:center;color:#6B7280">
          <i class="ti ti-calendar-dollar" style="font-size:32px;display:block;margin-bottom:8px"></i>
          Nenhuma entrada para ${y}. Clique em "Gerar / Recalcular" para criar.
        </div>`;
        return;
      }

      const totalGross  = entries.reduce((s,e) => s + Number(e.gross), 0);
      const totalNet    = entries.reduce((s,e) => s + Number(e.net_total), 0);
      const totalFgts   = entries.reduce((s,e) => s + Number(e.fgts), 0);

      wrap.innerHTML = `
        <div style="display:flex;gap:12px;margin-bottom:16px">
          <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:8px;padding:12px 20px;flex:1;text-align:center">
            <div style="font-size:18px;font-weight:700;color:#EF9F27;font-family:'JetBrains Mono',monospace">${entries.length}</div>
            <div style="font-size:11px;color:#6B7280;margin-top:2px">Funcionários CLT</div>
          </div>
          <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:8px;padding:12px 20px;flex:2;text-align:center">
            <div style="font-size:18px;font-weight:700;color:#EF9F27;font-family:'JetBrains Mono',monospace">${fmtBRL(totalGross)}</div>
            <div style="font-size:11px;color:#6B7280;margin-top:2px">Total Bruto</div>
          </div>
          <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:8px;padding:12px 20px;flex:2;text-align:center">
            <div style="font-size:18px;font-weight:700;color:#1D9E75;font-family:'JetBrains Mono',monospace">${fmtBRL(totalNet)}</div>
            <div style="font-size:11px;color:#6B7280;margin-top:2px">Total Líquido</div>
          </div>
          <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:8px;padding:12px 20px;flex:2;text-align:center">
            <div style="font-size:18px;font-weight:700;color:#3B6FE8;font-family:'JetBrains Mono',monospace">${fmtBRL(totalFgts)}</div>
            <div style="font-size:11px;color:#6B7280;margin-top:2px">Total FGTS</div>
          </div>
        </div>
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:1px solid #2A2D3A">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Funcionário</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Meses</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Bruto</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">1ª Parcela</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">INSS</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">IRRF</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">2ª Parcela</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Status</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(e => `
                <tr style="border-bottom:1px solid #2A2D3A22">
                  <td style="padding:10px 14px">
                    <div style="font-weight:500">${e.employee_name}</div>
                    <div style="font-size:11px;color:#6B7280">${e.department_name ?? ''}</div>
                  </td>
                  <td style="padding:10px 14px;text-align:center;color:#9CA3AF">${e.months_worked}/12</td>
                  <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace">${fmtBRL(Number(e.gross))}</td>
                  <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#EF9F27">${fmtBRL(Number(e.first_installment))}</td>
                  <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#F87171">-${fmtBRL(Number(e.inss))}</td>
                  <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#F87171">-${fmtBRL(Number(e.irrf))}</td>
                  <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#1D9E75">${fmtBRL(Number(e.second_installment))}</td>
                  <td style="padding:10px 14px;text-align:center">${decimo13Badge(e.status)}</td>
                  <td style="padding:10px 14px;text-align:center">
                    ${e.status === 'draft'      ? `<button class="btn-pay-1st" data-id="${e.id}" style="padding:4px 10px;border-radius:6px;border:none;background:#EF9F2722;color:#EF9F27;font-size:12px;cursor:pointer;font-weight:500">Pagar 1ª</button>` : ''}
                    ${e.status === 'paid_first' ? `<button class="btn-pay-2nd" data-id="${e.id}" style="padding:4px 10px;border-radius:6px;border:none;background:#1D9E7522;color:#1D9E75;font-size:12px;cursor:pointer;font-weight:500">Pagar 2ª</button>` : ''}
                    ${e.status === 'paid_both'  ? `<span style="color:#6B7280;font-size:12px">—</span>` : ''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;

      wrap.querySelectorAll('.btn-pay-1st').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id')!;
          const emp = entries.find(e => e.id === id);
          openConfirm(`Pagar 1ª parcela do décimo terceiro de ${emp?.employee_name} (${fmtBRL(Number(emp?.first_installment))})?`, async () => {
            try { await window.gero.invoke('payroll:payDecimo13First', token, id); showToast('1ª parcela registrada!', 'success'); closeModal(); loadD13Table(); }
            catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
          });
        });
      });

      wrap.querySelectorAll('.btn-pay-2nd').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id')!;
          const emp = entries.find(e => e.id === id);
          openConfirm(`Pagar 2ª parcela do décimo terceiro de ${emp?.employee_name} (${fmtBRL(Number(emp?.second_installment))})?`, async () => {
            try { await window.gero.invoke('payroll:payDecimo13Second', token, id); showToast('2ª parcela registrada!', 'success'); closeModal(); loadD13Table(); }
            catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
          });
        });
      });
    }

    document.getElementById('btn-gen-d13')?.addEventListener('click', async () => {
      const y = parseInt((document.getElementById('d13-year') as HTMLInputElement).value);
      try {
        const count = await window.gero.invoke('payroll:generateDecimo13', token, y) as number;
        showToast(`Décimo terceiro gerado para ${count} funcionários!`, 'success');
        loadD13Table();
      } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
    });

    document.getElementById('d13-year')?.addEventListener('change', loadD13Table);

    await loadD13Table();
  }

  // ── Folha Mensal tab ─────────────────────────────────────────────────────────

  let selectedPeriod: PayrollPeriod | null = null;

  async function loadFolha(): Promise<void> {
    const tabContent = document.getElementById('tab-content')!;
    const periods = await window.gero.invoke('payroll:listPeriods', token) as PayrollPeriod[];

    tabContent.innerHTML = `
      <div>
        <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:16px">
          <button id="btn-new-period" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-plus"></i> Novo Período
          </button>
        </div>

        <div style="display:grid;grid-template-columns:320px 1fr;gap:16px;align-items:start">
          <!-- Periods list -->
          <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
            <div style="padding:14px 16px;border-bottom:1px solid #2A2D3A;font-size:13px;font-weight:600">Períodos</div>
            <div id="periods-list">
              ${periods.length === 0 ? `<p style="padding:16px;color:#6B7280;font-size:13px">Nenhum período criado.</p>` :
                periods.map(p => `
                  <div class="period-item" data-id="${p.id}" style="
                    padding:12px 16px;border-bottom:1px solid #2A2D3A22;cursor:pointer;
                    transition:background 0.12s;
                    ${selectedPeriod?.id===p.id?'background:#EF9F2711;border-left:2px solid #EF9F27;':''}">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                      <span style="font-weight:600">${MONTHS[p.month-1]}/${p.year}</span>
                      ${statusBadge(p.status)}
                    </div>
                    <div style="font-size:12px;color:#6B7280;margin-top:2px">
                      ${p.entry_count ?? 0} funcionários &bull;
                      ${p.total_net ? fmtBRL(Number(p.total_net)) : '—'}
                    </div>
                  </div>`).join('')}
            </div>
          </div>

          <!-- Period detail -->
          <div id="period-detail" style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
            <div style="padding:40px;text-align:center;color:#6B7280">
              <i class="ti ti-cash" style="font-size:32px;display:block;margin-bottom:8px"></i>
              Selecione um período para ver os detalhes
            </div>
          </div>
        </div>
      </div>
    `;

    // Period selection
    tabContent.querySelectorAll('.period-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-id')!;
        selectedPeriod = periods.find(p => p.id === id) ?? null;
        if (selectedPeriod) loadPeriodDetail(selectedPeriod);
      });
    });

    // New period
    document.getElementById('btn-new-period')?.addEventListener('click', () => {
      const now = new Date();
      const content = `
        <form id="period-form" style="display:flex;flex-direction:column;gap:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Mês *</label>
              <select name="month" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
                ${MONTHS.map((m,i) => `<option value="${i+1}" ${now.getMonth()===i?'selected':''}>${m}</option>`).join('')}
              </select></div>
            <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Ano *</label>
              <input name="year" type="number" value="${now.getFullYear()}" min="2020" max="2030" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
            <button type="button" id="cancel-period" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
            <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Criar</button>
          </div>
        </form>`;
      openModal('Novo Período', content);
      document.getElementById('cancel-period')?.addEventListener('click', closeModal);
      (document.getElementById('period-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        try {
          await window.gero.invoke('payroll:createPeriod', token, parseInt(fd.get('month') as string), parseInt(fd.get('year') as string));
          showToast('Período criado!', 'success');
          closeModal(); loadFolha();
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });
  }

  async function loadPeriodDetail(period: PayrollPeriod): Promise<void> {
    const detail = document.getElementById('period-detail')!;
    detail.innerHTML = `<div style="padding:20px;text-align:center;color:#6B7280"><div class="spinner" style="margin:0 auto"></div></div>`;

    const entries = await window.gero.invoke('payroll:getPeriod', token, period.id) as PayrollPeriod;
    const entryList = await window.gero.invoke('payroll:listPeriods', token) as PayrollPeriod[];
    const periodEntries = await window.gero.invoke('payroll:getPeriod', token, period.id) as PayrollPeriod;

    const rows = await window.gero.invoke('employees:list', token, { active: true, pageSize: 200 }) as { data: Array<{ id: string; name: string }> };

    // Load all entries for the period
    let entriesHtml = '<p style="color:#6B7280;padding:16px;font-size:13px">Nenhuma entrada. Clique em "Gerar Folha" para criar.</p>';
    try {
      // We'll just show period info + action buttons
    } catch { /* ok */ }

    detail.innerHTML = `
      <div style="padding:20px">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #2A2D3A">
          <div>
            <h2 style="font-size:18px;font-weight:700">${MONTHS[period.month-1]}/${period.year}</h2>
            <div style="font-size:12px;color:#6B7280;margin-top:2px">${statusBadge(period.status)}</div>
          </div>
          <div style="display:flex;gap:8px">
            ${period.status === 'draft' ? `
              <button id="btn-generate" style="padding:8px 14px;border-radius:8px;border:1px solid #3B6FE844;background:#3B6FE811;color:#3B6FE8;cursor:pointer;font-size:13px;font-weight:500">
                <i class="ti ti-refresh"></i> Gerar Folha
              </button>
              <button id="btn-approve" style="padding:8px 14px;border-radius:8px;border:none;background:#EF9F27;color:#fff;cursor:pointer;font-size:13px;font-weight:600">
                <i class="ti ti-check"></i> Aprovar
              </button>` : ''}
            ${period.status === 'approved' ? `
              <button id="btn-mark-paid" style="padding:8px 14px;border-radius:8px;border:none;background:#1D9E75;color:#fff;cursor:pointer;font-size:13px;font-weight:600">
                <i class="ti ti-currency-dollar"></i> Marcar como Pago
              </button>` : ''}
          </div>
        </div>

        <!-- Summary cards -->
        <div style="display:flex;gap:12px;margin-bottom:20px">
          <div style="background:#0F1117;border-radius:8px;padding:12px 20px;text-align:center;flex:1">
            <div style="font-size:20px;font-weight:700;color:#EF9F27;font-family:'JetBrains Mono',monospace">${period.entry_count ?? 0}</div>
            <div style="font-size:11px;color:#6B7280;margin-top:2px">Funcionários</div>
          </div>
          <div style="background:#0F1117;border-radius:8px;padding:12px 20px;text-align:center;flex:2">
            <div style="font-size:20px;font-weight:700;color:#1D9E75;font-family:'JetBrains Mono',monospace">${period.total_net ? fmtBRL(Number(period.total_net)) : '—'}</div>
            <div style="font-size:11px;color:#6B7280;margin-top:2px">Total Líquido</div>
          </div>
        </div>

        <div style="font-size:13px;color:#6B7280;text-align:center;padding:20px">
          Clique em "Gerar Folha" para calcular e ver todos os lançamentos.
          <br>Use <a href="#/payslip" style="color:#EF9F27">Holerites</a> para ver e imprimir contracheques individuais.
        </div>
      </div>
    `;

    document.getElementById('btn-generate')?.addEventListener('click', async () => {
      try {
        const count = await window.gero.invoke('payroll:generateEntries', token, period.id) as number;
        showToast(`Folha gerada para ${count} funcionários!`, 'success');
        loadFolha();
      } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
    });

    document.getElementById('btn-approve')?.addEventListener('click', () => {
      openConfirm('Aprovar esta folha de pagamento?', async () => {
        try { await window.gero.invoke('payroll:approvePeriod', token, period.id); showToast('Folha aprovada!', 'success'); closeModal(); loadFolha(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    document.getElementById('btn-mark-paid')?.addEventListener('click', () => {
      openConfirm('Marcar esta folha como paga?', async () => {
        try { await window.gero.invoke('payroll:markPaid', token, period.id); showToast('Folha marcada como paga!', 'success'); closeModal(); loadFolha(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });
  }

  setTab('folha');
}
