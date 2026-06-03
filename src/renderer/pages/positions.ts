import type { Position, Department } from '../../shared/types';
import { getToken } from '../index';
import { renderTable } from '../components/table';
import { openModal, closeModal } from '../components/modal';
import { showToast } from '../components/toast';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const LEVELS = [['junior','Júnior'],['mid','Pleno'],['senior','Sênior'],['lead','Lead'],['manager','Gerente'],['director','Diretor']];

export async function renderPositions(container: HTMLElement): Promise<void> {
  const token = getToken();

  async function load(): Promise<void> {
    const [positions, depts] = await Promise.all([
      window.gero.invoke('positions:list', token) as Promise<Position[]>,
      window.gero.invoke('departments:list', token) as Promise<Department[]>,
    ]);

    container.innerHTML = `
      <div style="max-width:1200px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Cargos</h1>
          <button id="btn-new-pos" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-plus"></i> Novo Cargo
          </button>
        </div>
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          ${renderTable<Position>({
            columns: [
              { key: 'title',           label: 'Cargo',        render: r => `<span style="font-weight:500">${r.title}</span>` },
              { key: 'department_name', label: 'Departamento', render: r => r.department_name ?? '—' },
              { key: 'level',           label: 'Nível',        render: r => r.level ?? '—' },
              { key: 'salary_range',    label: 'Faixa Salarial',
                render: r => r.min_salary
                  ? `<span style="font-family:'JetBrains Mono',monospace;font-size:12px">${fmtBRL(Number(r.min_salary))} – ${fmtBRL(Number(r.max_salary ?? 0))}</span>`
                  : '—' },
              { key: 'actions', label: '', width: '80px',
                render: r => `
                  <div style="display:flex;gap:6px">
                    <button class="btn-edit-pos" data-id="${r.id}" style="padding:4px 8px;border-radius:6px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer;font-size:12px"><i class="ti ti-edit"></i></button>
                    <button class="btn-del-pos" data-id="${r.id}" data-title="${r.title}" style="padding:4px 8px;border-radius:6px;border:1px solid #D85A3022;background:transparent;color:#D85A30;cursor:pointer;font-size:12px"><i class="ti ti-trash"></i></button>
                  </div>` },
            ],
            data: positions,
            rowKey: r => r.id,
          })}
        </div>
      </div>
    `;

    document.getElementById('btn-new-pos')?.addEventListener('click', () => {
      openPosForm(null, depts as Department[], async (data) => {
        try { await window.gero.invoke('positions:create', token, data); showToast('Cargo criado!', 'success'); closeModal(); load(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    container.querySelectorAll('.btn-edit-pos').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pos = positions.find(p => p.id === btn.getAttribute('data-id'))!;
        openPosForm(pos, depts as Department[], async (data) => {
          try { await window.gero.invoke('positions:update', token, pos.id, data); showToast('Cargo atualizado!', 'success'); closeModal(); load(); }
          catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
        });
      });
    });

    container.querySelectorAll('.btn-del-pos').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id')!;
        if (confirm(`Excluir cargo "${btn.getAttribute('data-title')}"?`)) {
          window.gero.invoke('positions:delete', token, id)
            .then(() => { showToast('Cargo excluído.', 'success'); load(); })
            .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'));
        }
      });
    });
  }

  await load();
}

function openPosForm(pos: Position | null, depts: Department[], onSave: (data: Partial<Position>) => Promise<void>): void {
  const content = `
    <form id="pos-form" style="display:flex;flex-direction:column;gap:14px">
      <div><label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Cargo *</label>
        <input name="title" value="${pos?.title ?? ''}" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
      <div><label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Departamento</label>
        <select name="department_id" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          <option value="">— Selecione —</option>
          ${depts.map(d => `<option value="${d.id}" ${pos?.department_id===d.id?'selected':''}>${d.name}</option>`).join('')}
        </select></div>
      <div><label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Nível</label>
        <select name="level" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          <option value="">— Selecione —</option>
          ${LEVELS.map(([v,l]) => `<option value="${v}" ${pos?.level===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Salário Mín.</label>
          <input name="min_salary" type="number" value="${pos?.min_salary ?? ''}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div><label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">Salário Máx.</label>
          <input name="max_salary" type="number" value="${pos?.max_salary ?? ''}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
        <button type="button" id="cancel-pos" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
        <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Salvar</button>
      </div>
    </form>
  `;
  openModal(pos ? 'Editar Cargo' : 'Novo Cargo', content);
  document.getElementById('cancel-pos')?.addEventListener('click', closeModal);
  (document.getElementById('pos-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    await onSave({
      title: fd.get('title') as string,
      department_id: fd.get('department_id') as string || undefined,
      level: fd.get('level') as string || undefined,
      min_salary: parseFloat(fd.get('min_salary') as string) || undefined,
      max_salary: parseFloat(fd.get('max_salary') as string) || undefined,
    });
  });
}
