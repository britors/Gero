import type { Department, Employee } from '../../shared/types';
import { getToken } from '../index';
import { renderTable, attachTableRowHandlers } from '../components/table';
import { openModal, closeModal } from '../components/modal';
import { showToast } from '../components/toast';

export async function renderDepartments(container: HTMLElement): Promise<void> {
  const token = getToken();

  async function load(): Promise<void> {
    const depts = await window.gero.invoke('departments:list', token) as Department[];
    const employees = await window.gero.invoke('employees:list', token, { pageSize: 200, active: true }) as { data: Employee[] };

    container.innerHTML = `
      <div style="max-width:1200px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Departamentos</h1>
          <button id="btn-new-dept" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-plus"></i> Novo Departamento
          </button>
        </div>
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          ${renderTable<Department>({
            columns: [
              { key: 'name',        label: 'Nome',           render: r => `<span style="font-weight:500">${r.name}</span>` },
              { key: 'manager',     label: 'Gestor',         render: r => r.manager_name ?? '—' },
              { key: 'cost_center', label: 'Centro de Custo', render: r => r.cost_center ?? '—' },
              { key: 'headcount',   label: 'Headcount',      render: r => `<span style="font-family:'JetBrains Mono',monospace">${r.headcount ?? 0}</span>` },
              { key: 'actions',     label: '', width: '80px',
                render: (r) => `
                  <div style="display:flex;gap:6px">
                    <button class="btn-edit-dept" data-id="${r.id}" style="padding:4px 8px;border-radius:6px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer;font-size:12px">
                      <i class="ti ti-edit"></i>
                    </button>
                    <button class="btn-del-dept" data-id="${r.id}" data-name="${r.name}" style="padding:4px 8px;border-radius:6px;border:1px solid #D85A3022;background:transparent;color:#D85A30;cursor:pointer;font-size:12px">
                      <i class="ti ti-trash"></i>
                    </button>
                  </div>`
              },
            ],
            data: depts,
            rowKey: r => r.id,
          })}
        </div>
      </div>
    `;

    document.getElementById('btn-new-dept')?.addEventListener('click', () => {
      openDeptForm(null, employees.data, async (data) => {
        try {
          await window.gero.invoke('departments:create', token, data);
          showToast('Departamento criado!', 'success');
          closeModal(); load();
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    container.querySelectorAll('.btn-edit-dept').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id')!;
        const dept = depts.find(d => d.id === id)!;
        openDeptForm(dept, employees.data, async (data) => {
          try {
            await window.gero.invoke('departments:update', token, id, data);
            showToast('Departamento atualizado!', 'success');
            closeModal(); load();
          } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
        });
      });
    });

    container.querySelectorAll('.btn-del-dept').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id')!;
        const name = btn.getAttribute('data-name')!;
        if (confirm(`Excluir departamento "${name}"?`)) {
          window.gero.invoke('departments:delete', token, id)
            .then(() => { showToast('Departamento excluído.', 'success'); load(); })
            .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'));
        }
      });
    });
  }

  await load();
}

function openDeptForm(dept: Department | null, employees: Employee[], onSave: (data: Partial<Department>) => Promise<void>): void {
  const content = `
    <form id="dept-form" style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Nome *</label>
        <input name="name" value="${dept?.name ?? ''}" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Centro de Custo</label>
        <input name="cost_center" value="${dept?.cost_center ?? ''}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Gestor</label>
        <select name="manager_id" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          <option value="">— Selecione —</option>
          ${employees.map(e => `<option value="${e.id}" ${dept?.manager_id===e.id?'selected':''}>${e.name}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
        <button type="button" id="cancel-dept" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
        <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Salvar</button>
      </div>
    </form>
  `;
  openModal(dept ? 'Editar Departamento' : 'Novo Departamento', content);
  document.getElementById('cancel-dept')?.addEventListener('click', closeModal);
  (document.getElementById('dept-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    await onSave({ name: fd.get('name') as string, cost_center: fd.get('cost_center') as string || undefined, manager_id: fd.get('manager_id') as string || undefined });
  });
}
