import type { Employee, RescisaoEntry, RescisaoResult, TerminationReason } from '../../shared/types';
import { getToken } from '../index';
import { openModal, closeModal } from '../components/modal';
import { showToast } from '../components/toast';

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const REASON_LABELS: Record<string, string> = {
  resignation: 'Pedido de Demissão',
  dismissal:   'Dispensa s/ Justa Causa',
  mutual:      'Rescisão Consensual',
  retirement:  'Aposentadoria',
  other:       'Outro',
};

export async function renderRescisao(container: HTMLElement): Promise<void> {
  const token = getToken();

  async function load(): Promise<void> {
    const entries = await window.gero.invoke('payroll:listRescisao', token) as RescisaoEntry[];

    container.innerHTML = `
      <div style="max-width:1200px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div>
            <h1 style="font-size:20px;font-weight:700">Rescisão</h1>
            <p style="font-size:13px;color:#6B7280;margin-top:2px">Cálculo de verbas rescisórias (CLT)</p>
          </div>
          <button id="btn-new-rescisao" style="padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-plus"></i> Nova Rescisão
          </button>
        </div>

        ${entries.length === 0
          ? `<div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:60px;text-align:center;color:#6B7280">
               <i class="ti ti-file-off" style="font-size:40px;display:block;margin-bottom:12px"></i>
               Nenhuma rescisão calculada ainda.
             </div>`
          : `<div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
               <table style="width:100%;border-collapse:collapse;font-size:13px">
                 <thead>
                   <tr style="border-bottom:1px solid #2A2D3A">
                     <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Funcionário</th>
                     <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Data</th>
                     <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Motivo</th>
                     <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Bruto</th>
                     <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">INSS</th>
                     <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">IRRF</th>
                     <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase">Líquido</th>
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
                       <td style="padding:10px 14px;color:#9CA3AF">${fmtDate(e.termination_date)}</td>
                       <td style="padding:10px 14px">${REASON_LABELS[e.termination_reason] ?? e.termination_reason}</td>
                       <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace">${fmtBRL(Number(e.gross_total))}</td>
                       <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#F87171">-${fmtBRL(Number(e.inss))}</td>
                       <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#F87171">-${fmtBRL(Number(e.irrf))}</td>
                       <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:600;color:#1D9E75">${fmtBRL(Number(e.net_total))}</td>
                       <td style="padding:10px 14px;text-align:center">
                         <button class="btn-detail" data-id="${e.id}" style="padding:4px 10px;border-radius:6px;border:1px solid #EF9F2744;background:#EF9F2711;color:#EF9F27;font-size:12px;cursor:pointer">
                           <i class="ti ti-eye"></i> Ver
                         </button>
                       </td>
                     </tr>`).join('')}
                 </tbody>
               </table>
             </div>`
        }
      </div>`;

    document.getElementById('btn-new-rescisao')?.addEventListener('click', () => openNewRescisaoModal());

    container.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const entry = await window.gero.invoke('payroll:getRescisao', token, id) as RescisaoEntry;
        showDetailModal(entry);
      });
    });
  }

  function openNewRescisaoModal(): void {
    const content = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Funcionário *</label>
          <input id="r-emp-search" type="text" placeholder="Digite o nome..." autocomplete="off"
            style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          <div id="r-emp-results" style="display:none;background:#1A1D27;border:1px solid #2A2D3A;border-radius:8px;margin-top:4px;max-height:160px;overflow-y:auto"></div>
          <input id="r-emp-id" type="hidden">
          <div id="r-emp-name" style="font-size:12px;color:#EF9F27;margin-top:4px;min-height:16px"></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Data de Demissão *</label>
            <input id="r-term-date" type="date" value="${new Date().toISOString().split('T')[0]}"
              style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          </div>
          <div>
            <label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Motivo *</label>
            <select id="r-reason" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
              ${Object.entries(REASON_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>
        </div>

        <div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
            <input id="r-notice-worked" type="checkbox" style="width:16px;height:16px;cursor:pointer">
            Aviso prévio cumprido (trabalhado)
          </label>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Férias vencidas (dias)</label>
            <input id="r-vac-venc" type="number" value="0" min="0" max="30"
              style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          </div>
          <div>
            <label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Meses férias proporcionais</label>
            <input id="r-vac-prop" type="number" value="0" min="0" max="11"
              style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Meses 13º trabalhados (ano)</label>
            <input id="r-d13-months" type="number" value="${new Date().getMonth() + 1}" min="0" max="12"
              style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          </div>
          <div>
            <label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">13º já pago (1ª parcela)</label>
            <input id="r-d13-paid" type="number" value="0" min="0" step="0.01"
              style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          </div>
        </div>

        <div id="r-preview" style="display:none;background:#0F1117;border-radius:8px;padding:14px"></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button id="r-cancel" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button id="r-calc" style="padding:8px 16px;border-radius:8px;border:1px solid #EF9F2744;background:#EF9F2711;color:#EF9F27;cursor:pointer;font-size:13px;font-weight:500">Calcular</button>
          <button id="r-save" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;cursor:pointer;font-size:13px;font-weight:600;display:none">Salvar</button>
        </div>
      </div>`;

    openModal('Nova Rescisão', content);
    document.getElementById('r-cancel')?.addEventListener('click', closeModal);

    // Employee autocomplete
    let searchTimeout: ReturnType<typeof setTimeout>;
    document.getElementById('r-emp-search')?.addEventListener('input', function(this: HTMLInputElement) {
      clearTimeout(searchTimeout);
      const q = this.value.trim();
      if (q.length < 2) { document.getElementById('r-emp-results')!.style.display = 'none'; return; }
      searchTimeout = setTimeout(async () => {
        const res = await window.gero.invoke('employees:list', token, { search: q, active: true, pageSize: 10 }) as { data: Employee[] };
        const el = document.getElementById('r-emp-results')!;
        el.innerHTML = res.data.map(e =>
          `<div class="r-emp-opt" data-id="${e.id}" data-name="${e.name}" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #2A2D3A22">${e.name}</div>`
        ).join('');
        el.style.display = res.data.length ? 'block' : 'none';
        el.querySelectorAll('.r-emp-opt').forEach(opt => {
          opt.addEventListener('click', () => {
            (document.getElementById('r-emp-id') as HTMLInputElement).value = opt.getAttribute('data-id')!;
            (document.getElementById('r-emp-search') as HTMLInputElement).value = opt.getAttribute('data-name')!;
            document.getElementById('r-emp-name')!.textContent = opt.getAttribute('data-name')!;
            el.style.display = 'none';
          });
        });
      }, 250);
    });

    let lastResult: RescisaoResult | null = null;

    document.getElementById('r-calc')?.addEventListener('click', async () => {
      const empId = (document.getElementById('r-emp-id') as HTMLInputElement).value;
      if (!empId) { showToast('Selecione um funcionário', 'error'); return; }
      const params = getParams();
      try {
        const result = await window.gero.invoke('payroll:calcRescisao', token, params) as RescisaoResult;
        lastResult = result;
        showPreview(result);
        const saveBtn = document.getElementById('r-save') as HTMLButtonElement;
        saveBtn.style.display = 'inline-block';
      } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
    });

    document.getElementById('r-save')?.addEventListener('click', async () => {
      if (!lastResult) return;
      const params = getParams();
      try {
        await window.gero.invoke('payroll:saveRescisao', token, params);
        showToast('Rescisão salva!', 'success');
        closeModal();
        load();
      } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
    });
  }

  function getParams() {
    return {
      employee_id:               (document.getElementById('r-emp-id') as HTMLInputElement).value,
      termination_date:          (document.getElementById('r-term-date') as HTMLInputElement).value,
      termination_reason:        (document.getElementById('r-reason') as HTMLSelectElement).value as TerminationReason,
      notice_period_worked:      (document.getElementById('r-notice-worked') as HTMLInputElement).checked,
      vacation_days_vencidas:    parseInt((document.getElementById('r-vac-venc') as HTMLInputElement).value) || 0,
      vacation_months_proportional: parseInt((document.getElementById('r-vac-prop') as HTMLInputElement).value) || 0,
      decimo13_months_worked:    parseInt((document.getElementById('r-d13-months') as HTMLInputElement).value) || 0,
      decimo13_already_paid:     parseFloat((document.getElementById('r-d13-paid') as HTMLInputElement).value) || 0,
    };
  }

  function showPreview(r: RescisaoResult): void {
    const rows = [
      ['Saldo de Salário',          r.saldo_salario,         false],
      ['Aviso Prévio Indenizado',   r.aviso_previo,          false],
      ['Férias Vencidas + 1/3',     r.ferias_vencidas,       false],
      ['Férias Proporcionais + 1/3',r.ferias_proporcionais,  false],
      ['13º Proporcional',          r.decimo13_proporcional, false],
      ['Multa FGTS (40%)',          r.fgts_multa,            false],
      ['INSS',                      r.inss,                  true],
      ['IRRF',                      r.irrf,                  true],
    ] as Array<[string, number, boolean]>;

    const el = document.getElementById('r-preview')!;
    el.style.display = 'block';
    el.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:#9CA3AF;margin-bottom:10px;text-transform:uppercase">Resumo do Cálculo</div>
      ${rows.filter(([,v]) => v !== 0).map(([label, val, isDiscount]) => `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
          <span style="color:${isDiscount ? '#F87171' : '#D1D5DB'}">${label}</span>
          <span style="font-family:'JetBrains Mono',monospace;color:${isDiscount ? '#F87171' : '#fff'}">
            ${isDiscount ? '-' : ''}${fmtBRL(val)}
          </span>
        </div>`).join('')}
      <div style="border-top:1px solid #2A2D3A;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700;font-size:14px">
        <span>Total Líquido</span>
        <span style="color:#1D9E75;font-family:'JetBrains Mono',monospace">${fmtBRL(r.net_total)}</span>
      </div>
      <div style="font-size:11px;color:#6B7280;margin-top:6px">
        FGTS a depositar (custo empregador): ${fmtBRL(r.fgts_depositos)} &bull; Aviso: ${r.notice_days} dias
      </div>`;
  }

  function showDetailModal(entry: RescisaoEntry): void {
    const rows: Array<[string, number, boolean]> = [
      ['Saldo de Salário',           Number(entry.saldo_salario),        false],
      ['Aviso Prévio Indenizado',    Number(entry.aviso_previo),         false],
      ['Férias Vencidas + 1/3',      Number(entry.ferias_vencidas),      false],
      ['Férias Proporcionais + 1/3', Number(entry.ferias_proporcionais), false],
      ['13º Proporcional',           Number(entry.decimo13_proporcional),false],
      ['Multa FGTS (40%)',           Number(entry.fgts_multa),           false],
      ['INSS',                       Number(entry.inss),                 true],
      ['IRRF',                       Number(entry.irrf),                 true],
    ];

    const content = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><span style="font-size:11px;color:#6B7280">Funcionário</span><div style="font-weight:600">${entry.employee_name}</div></div>
          <div><span style="font-size:11px;color:#6B7280">Departamento</span><div>${entry.department_name ?? '—'}</div></div>
          <div><span style="font-size:11px;color:#6B7280">Data</span><div>${fmtDate(entry.termination_date)}</div></div>
          <div><span style="font-size:11px;color:#6B7280">Motivo</span><div>${REASON_LABELS[entry.termination_reason] ?? entry.termination_reason}</div></div>
          <div><span style="font-size:11px;color:#6B7280">Meses trabalhados</span><div>${entry.total_months}</div></div>
          <div><span style="font-size:11px;color:#6B7280">Aviso prévio</span><div>${entry.aviso_previo_days} dias${entry.notice_period_worked ? ' (cumprido)' : ' (indenizado)'}</div></div>
        </div>
        <div style="background:#0F1117;border-radius:8px;padding:14px">
          ${rows.filter(([,v]) => v !== 0).map(([label, val, isDiscount]) => `
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
              <span style="color:${isDiscount ? '#F87171' : '#D1D5DB'}">${label}</span>
              <span style="font-family:'JetBrains Mono',monospace;color:${isDiscount ? '#F87171' : '#fff'}">
                ${isDiscount ? '-' : ''}${fmtBRL(val)}
              </span>
            </div>`).join('')}
          <div style="border-top:1px solid #2A2D3A;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700;font-size:15px">
            <span>Total Líquido</span>
            <span style="color:#1D9E75;font-family:'JetBrains Mono',monospace">${fmtBRL(Number(entry.net_total))}</span>
          </div>
          <div style="font-size:11px;color:#6B7280;margin-top:8px">
            FGTS depositado estimado: ${fmtBRL(Number(entry.fgts_depositos))}
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end">
          <button id="detail-close" style="padding:8px 20px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Fechar</button>
        </div>
      </div>`;

    openModal(`Rescisão — ${entry.employee_name}`, content);
    document.getElementById('detail-close')?.addEventListener('click', closeModal);
  }

  await load();
}
