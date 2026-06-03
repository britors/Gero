import type { VacationEntitlement, VacationRequest, Employee } from '../../shared/types';
import { getToken } from '../index';
import { renderTable } from '../components/table';
import { statusBadge } from '../components/badge';
import { openModal, closeModal, openConfirm } from '../components/modal';
import { showToast } from '../components/toast';

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export async function renderVacation(container: HTMLElement): Promise<void> {
  const token = getToken();
  let activeTab: 'requests' | 'entitlements' = 'requests';

  async function load(): Promise<void> {
    const [requests, entitlements, employees] = await Promise.all([
      window.gero.invoke('vacation:listRequests', token, {}) as Promise<VacationRequest[]>,
      window.gero.invoke('vacation:listEntitlements', token) as Promise<VacationEntitlement[]>,
      window.gero.invoke('employees:list', token, { active: true, pageSize: 200 }) as Promise<{ data: Employee[] }>,
    ]);

    container.innerHTML = `
      <div style="max-width:1200px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Férias</h1>
          <button id="btn-new-request" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-plus"></i> Nova Solicitação
          </button>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:0;margin-bottom:16px;background:#1A1D27;border:1px solid #2A2D3A;border-radius:8px;overflow:hidden;width:fit-content">
          <button class="vac-tab" data-tab="requests" style="padding:8px 20px;border:none;background:${activeTab==='requests'?'#EF9F2722':'transparent'};color:${activeTab==='requests'?'#EF9F27':'#9CA3AF'};cursor:pointer;font-size:13px;font-weight:${activeTab==='requests'?'600':'400'}">
            Solicitações (${requests.length})
          </button>
          <button class="vac-tab" data-tab="entitlements" style="padding:8px 20px;border:none;background:${activeTab==='entitlements'?'#EF9F2722':'transparent'};color:${activeTab==='entitlements'?'#EF9F27':'#9CA3AF'};cursor:pointer;font-size:13px;font-weight:${activeTab==='entitlements'?'600':'400'}">
            Direitos (${entitlements.length})
          </button>
        </div>

        <!-- Content -->
        <div id="vac-content" style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          ${activeTab === 'requests' ? renderRequests(requests) : renderEntitlements(entitlements)}
        </div>
      </div>
    `;

    // Tab switching
    container.querySelectorAll('.vac-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab') as 'requests' | 'entitlements';
        load();
      });
    });

    // New request
    document.getElementById('btn-new-request')?.addEventListener('click', () => {
      openRequestForm(employees.data, entitlements, async (data) => {
        try {
          await window.gero.invoke('vacation:createRequest', token, data);
          showToast('Solicitação criada!', 'success');
          closeModal(); load();
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    // Action buttons on requests
    container.querySelectorAll('.btn-approve-vac').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await window.gero.invoke('vacation:approveRequest', token, btn.getAttribute('data-id')!);
          showToast('Férias aprovadas!', 'success'); load();
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    container.querySelectorAll('.btn-reject-vac').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await window.gero.invoke('vacation:rejectRequest', token, btn.getAttribute('data-id')!);
          showToast('Férias rejeitadas.', 'warning'); load();
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });
  }

  function renderRequests(requests: VacationRequest[]): string {
    if (requests.length === 0) return `<div style="padding:40px;text-align:center;color:#6B7280">Nenhuma solicitação.</div>`;
    return renderTable({
      columns: [
        { key: 'employee',   label: 'Funcionário', render: r => `<span style="font-weight:500">${(r as VacationRequest).employee_name ?? '—'}</span>` },
        { key: 'period',     label: 'Período',     render: r => `${fmtDate((r as VacationRequest).start_date)} → ${fmtDate((r as VacationRequest).end_date)}` },
        { key: 'days',       label: 'Dias',        render: r => `<span style="font-family:'JetBrains Mono',monospace">${(r as VacationRequest).days_count}</span>` },
        { key: 'status',     label: 'Status',      render: r => statusBadge((r as VacationRequest).status) },
        { key: 'created_at', label: 'Criado em',   render: r => fmtDate((r as VacationRequest).created_at) },
        { key: 'actions',    label: '',            width: '140px',
          render: r => (r as VacationRequest).status === 'pending' ? `
            <div style="display:flex;gap:6px">
              <button class="btn-approve-vac" data-id="${(r as VacationRequest).id}" style="padding:4px 10px;border-radius:6px;border:none;background:#1D9E7522;color:#1D9E75;cursor:pointer;font-size:12px">Aprovar</button>
              <button class="btn-reject-vac" data-id="${(r as VacationRequest).id}" style="padding:4px 10px;border-radius:6px;border:none;background:#D85A3022;color:#D85A30;cursor:pointer;font-size:12px">Rejeitar</button>
            </div>` : '' },
      ],
      data: requests,
      rowKey: r => (r as VacationRequest).id,
    });
  }

  function renderEntitlements(entitlements: VacationEntitlement[]): string {
    if (entitlements.length === 0) return `<div style="padding:40px;text-align:center;color:#6B7280">Nenhum direito registrado.</div>`;
    return renderTable({
      columns: [
        { key: 'employee',    label: 'Funcionário',  render: r => `<span style="font-weight:500">${(r as VacationEntitlement).employee_name ?? '—'}</span>` },
        { key: 'period',      label: 'Período Aquisitivo', render: r => `${fmtDate((r as VacationEntitlement).acquisition_start)} → ${fmtDate((r as VacationEntitlement).acquisition_end)}` },
        { key: 'entitled',    label: 'Direito',      render: r => `<span style="font-family:'JetBrains Mono',monospace">${(r as VacationEntitlement).days_entitled}d</span>` },
        { key: 'taken',       label: 'Tirados',      render: r => `<span style="font-family:'JetBrains Mono',monospace;color:#9CA3AF">${(r as VacationEntitlement).days_taken}d</span>` },
        { key: 'available',   label: 'Disponível',   render: r => {
          const avail = (r as VacationEntitlement).days_entitled - (r as VacationEntitlement).days_taken - (r as VacationEntitlement).days_sold;
          return `<span style="font-family:'JetBrains Mono',monospace;color:${avail > 0 ? '#1D9E75' : '#D85A30'}">${avail}d</span>`;
        }},
        { key: 'expires_at',  label: 'Vence em',     render: r => fmtDate((r as VacationEntitlement).expires_at ?? '') },
      ],
      data: entitlements,
      rowKey: r => (r as VacationEntitlement).id,
    });
  }

  function openRequestForm(employees: Employee[], entitlements: VacationEntitlement[], onSave: (data: Record<string, unknown>) => Promise<void>): void {
    const content = `
      <form id="vac-form" style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Funcionário *</label>
          <select name="employee_id" id="vac-emp" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
            <option value="">— Selecione —</option>
            ${employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Direito de Férias *</label>
          <select name="entitlement_id" id="vac-entitlement" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
            <option value="">— Selecione o funcionário primeiro —</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Início *</label>
            <input name="start_date" type="date" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Fim *</label>
            <input name="end_date" type="date" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button type="button" id="cancel-vac" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Solicitar</button>
        </div>
      </form>`;
    openModal('Nova Solicitação de Férias', content);
    document.getElementById('cancel-vac')?.addEventListener('click', closeModal);

    document.getElementById('vac-emp')?.addEventListener('change', function() {
      const empId = (this as HTMLSelectElement).value;
      const sel = document.getElementById('vac-entitlement') as HTMLSelectElement;
      const empEnts = entitlements.filter(e => e.employee_id === empId);
      sel.innerHTML = empEnts.length === 0
        ? `<option value="">Nenhum direito registrado</option>`
        : empEnts.map(e => `<option value="${e.id}">${fmtDate(e.acquisition_start)} → ${fmtDate(e.acquisition_end)} (${e.days_entitled - e.days_taken - e.days_sold}d disponíveis)</option>`).join('');
    });

    (document.getElementById('vac-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      await onSave({
        entitlement_id: fd.get('entitlement_id') as string,
        employee_id:    fd.get('employee_id') as string,
        start_date:     fd.get('start_date') as string,
        end_date:       fd.get('end_date') as string,
      });
    });
  }

  await load();
}
