import type { EmployeeDocument, Employee } from '../../shared/types';
import { getToken } from '../index';
import { renderTable } from '../components/table';
import { openModal, closeModal } from '../components/modal';
import { showToast } from '../components/toast';

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const DOC_TYPES = [['contract','Contrato'],['payslip','Holerite'],['certificate','Certificado'],['other','Outro']];

export async function renderDocuments(container: HTMLElement): Promise<void> {
  const token = getToken();
  let empFilter = '';

  async function load(): Promise<void> {
    const [docs, employees] = await Promise.all([
      window.gero.invoke('documents:list', token, { employee: empFilter || undefined }) as Promise<EmployeeDocument[]>,
      window.gero.invoke('employees:list', token, { active: true, pageSize: 200 }) as Promise<{ data: Employee[] }>,
    ]);

    container.innerHTML = `
      <div style="max-width:1200px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Documentos</h1>
          <button id="btn-new-doc" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-plus"></i> Novo Registro
          </button>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:16px">
          <select id="emp-doc-filter" style="padding:8px 12px;border-radius:8px;border:1px solid #2A2D3A;background:#1A1D27;color:#fff;font-size:13px;outline:none;flex:1;max-width:280px">
            <option value="">Todos os funcionários</option>
            ${employees.data.map(e => `<option value="${e.id}" ${empFilter===e.id?'selected':''}>${e.name}</option>`).join('')}
          </select>
        </div>
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          ${renderTable<EmployeeDocument>({
            columns: [
              { key: 'name',          label: 'Nome',         render: r => `<div style="display:flex;align-items:center;gap:8px"><i class="ti ti-file-text" style="color:#9CA3AF"></i><span style="font-weight:500">${r.name}</span></div>` },
              { key: 'employee_name', label: 'Funcionário',  render: r => r.employee_name ?? '—' },
              { key: 'type',          label: 'Tipo',         render: r => r.type },
              { key: 'period',        label: 'Período',      render: r => r.month ? `${r.month}/${r.year}` : '—' },
              { key: 'created_at',    label: 'Criado em',    render: r => fmtDate(r.created_at) },
              { key: 'actions', label: '', width: '60px',
                render: r => `<button class="btn-del-doc" data-id="${r.id}" style="padding:4px 8px;border-radius:6px;border:1px solid #D85A3022;background:transparent;color:#D85A30;cursor:pointer;font-size:12px"><i class="ti ti-trash"></i></button>` },
            ],
            data: docs,
            rowKey: r => r.id,
          })}
        </div>
      </div>
    `;

    (document.getElementById('emp-doc-filter') as HTMLSelectElement)?.addEventListener('change', function() {
      empFilter = this.value; load();
    });

    document.getElementById('btn-new-doc')?.addEventListener('click', () => {
      openDocForm(employees.data, async (data) => {
        try { await window.gero.invoke('documents:createRecord', token, data); showToast('Registro criado!', 'success'); closeModal(); load(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    container.querySelectorAll('.btn-del-doc').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Excluir registro?')) {
          try { await window.gero.invoke('documents:deleteRecord', token, btn.getAttribute('data-id')!); showToast('Registro excluído.', 'success'); load(); }
          catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
        }
      });
    });
  }

  function openDocForm(employees: Employee[], onSave: (data: Partial<EmployeeDocument>) => Promise<void>): void {
    const now = new Date();
    const content = `
      <form id="doc-form" style="display:flex;flex-direction:column;gap:14px">
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Funcionário *</label>
          <select name="employee_id" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
            <option value="">— Selecione —</option>
            ${employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
          </select></div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Nome *</label>
          <input name="name" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Tipo</label>
            <select name="type" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
              ${DOC_TYPES.map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
            </select></div>
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Mês</label>
            <input name="month" type="number" min="1" max="12" value="${now.getMonth()+1}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Ano</label>
            <input name="year" type="number" value="${now.getFullYear()}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button type="button" id="cancel-doc" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Salvar</button>
        </div>
      </form>`;
    openModal('Novo Documento', content);
    document.getElementById('cancel-doc')?.addEventListener('click', closeModal);
    (document.getElementById('doc-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      await onSave({ employee_id: fd.get('employee_id') as string, name: fd.get('name') as string, type: fd.get('type') as string, month: parseInt(fd.get('month') as string) || undefined, year: parseInt(fd.get('year') as string) || undefined });
    });
  }

  await load();
}
