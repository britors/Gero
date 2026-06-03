import type { Benefit } from '../../shared/types';
import { getToken } from '../index';
import { renderTable } from '../components/table';
import { statusBadge } from '../components/badge';
import { openModal, closeModal } from '../components/modal';
import { showToast } from '../components/toast';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const TYPES = [['health','Saúde'],['dental','Odontológico'],['meal','Refeição'],['transport','Transporte'],['education','Educação'],['other','Outro']];

export async function renderBenefits(container: HTMLElement): Promise<void> {
  const token = getToken();

  async function load(): Promise<void> {
    const benefits = await window.gero.invoke('benefits:listBenefits', token) as Benefit[];

    container.innerHTML = `
      <div style="max-width:1000px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Benefícios</h1>
          <button id="btn-new-benefit" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-plus"></i> Novo Benefício
          </button>
        </div>
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          ${renderTable<Benefit>({
            columns: [
              { key: 'name',    label: 'Nome',    render: r => `<span style="font-weight:500">${r.name}</span>` },
              { key: 'type',    label: 'Tipo',    render: r => r.type },
              { key: 'value',   label: 'Valor',   render: r => r.value ? `<span style="font-family:'JetBrains Mono',monospace">${fmtBRL(Number(r.value))}</span>` : '—' },
              { key: 'status',  label: 'Status',  render: r => statusBadge(r.is_active ? 'active' : 'inactive') },
              { key: 'actions', label: '', width: '120px',
                render: r => `
                  <div style="display:flex;gap:6px">
                    <button class="btn-edit-ben" data-id="${r.id}" style="padding:4px 8px;border-radius:6px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer;font-size:12px"><i class="ti ti-edit"></i></button>
                    <button class="btn-toggle-ben" data-id="${r.id}" style="padding:4px 8px;border-radius:6px;border:1px solid #2A2D3A;background:transparent;color:${r.is_active?'#D85A30':'#1D9E75'};cursor:pointer;font-size:12px">
                      <i class="ti ti-${r.is_active?'eye-off':'eye'}"></i>
                    </button>
                  </div>` },
            ],
            data: benefits,
            rowKey: r => r.id,
          })}
        </div>
      </div>
    `;

    document.getElementById('btn-new-benefit')?.addEventListener('click', () => {
      openBenefitForm(null, async (data) => {
        try { await window.gero.invoke('benefits:createBenefit', token, data); showToast('Benefício criado!', 'success'); closeModal(); load(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    container.querySelectorAll('.btn-edit-ben').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const b = benefits.find(x => x.id === btn.getAttribute('data-id'))!;
        openBenefitForm(b, async (data) => {
          try { await window.gero.invoke('benefits:updateBenefit', token, b.id, data); showToast('Benefício atualizado!', 'success'); closeModal(); load(); }
          catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
        });
      });
    });

    container.querySelectorAll('.btn-toggle-ben').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try { await window.gero.invoke('benefits:toggleBenefit', token, btn.getAttribute('data-id')!); load(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });
  }

  function openBenefitForm(b: Benefit | null, onSave: (data: Partial<Benefit>) => Promise<void>): void {
    const content = `
      <form id="ben-form" style="display:flex;flex-direction:column;gap:14px">
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Nome *</label>
          <input name="name" value="${b?.name ?? ''}" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Tipo *</label>
            <select name="type" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
              ${TYPES.map(([v,l]) => `<option value="${v}" ${b?.type===v?'selected':''}>${l}</option>`).join('')}
            </select></div>
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Valor Padrão</label>
            <input name="value" type="number" value="${b?.value ?? ''}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        </div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Descrição</label>
          <textarea name="description" rows="2" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none;resize:vertical">${b?.description ?? ''}</textarea></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button type="button" id="cancel-ben" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Salvar</button>
        </div>
      </form>`;
    openModal(b ? 'Editar Benefício' : 'Novo Benefício', content);
    document.getElementById('cancel-ben')?.addEventListener('click', closeModal);
    (document.getElementById('ben-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      await onSave({ name: fd.get('name') as string, type: fd.get('type') as Benefit['type'], value: parseFloat(fd.get('value') as string) || undefined, description: fd.get('description') as string || undefined });
    });
  }

  await load();
}
