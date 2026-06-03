import type { Candidate, Interview } from '../../shared/types';
import { getToken } from '../index';
import { statusBadge } from '../components/badge';
import { openModal, closeModal } from '../components/modal';
import { showToast } from '../components/toast';
import { navigate } from '../router';

const fmtDate = (d: string) => d ? new Date(d).toLocaleString('pt-BR') : '—';

export async function renderCandidateDetail(container: HTMLElement, params: Record<string, string>): Promise<void> {
  const token = getToken();
  const { id } = params;
  const candidate = await window.gero.invoke('recruitment:getCandidate', token, id) as Candidate | null;

  if (!candidate) {
    container.innerHTML = `<div style="padding:40px;color:#D85A30">Candidato não encontrado.</div>`;
    return;
  }

  function stars(r?: number): string {
    if (!r) return '—';
    return Array.from({length:5},(_,i) => `<i class="ti ti-star${i<r?'-filled':''}" style="color:${i<r?'#F5C842':'#6B7280'}"></i>`).join('');
  }

  container.innerHTML = `
    <div style="max-width:900px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button id="btn-back" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer;font-size:13px">
          <i class="ti ti-arrow-left"></i> Recrutamento
        </button>
      </div>

      <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:24px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
          <div style="width:56px;height:56px;border-radius:50%;background:#3B6FE822;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#3B6FE8;flex-shrink:0">
            ${candidate.name.slice(0,2).toUpperCase()}
          </div>
          <div style="flex:1">
            <div style="font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px">
              ${candidate.name} ${statusBadge(candidate.status)}
            </div>
            <div style="font-size:13px;color:#9CA3AF;margin-top:2px">Vaga: ${candidate.opening_title ?? '—'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px">${stars(candidate.rating)}</div>
            <div style="font-size:11px;color:#6B7280">Candidatura em ${new Date(candidate.applied_at).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
          <div>
            <h4 style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;margin-bottom:8px">Contato</h4>
            ${candidate.email ? `<div style="font-size:13px;margin-bottom:4px"><i class="ti ti-mail" style="color:#9CA3AF;margin-right:6px"></i>${candidate.email}</div>` : ''}
            ${candidate.phone ? `<div style="font-size:13px;margin-bottom:4px"><i class="ti ti-phone" style="color:#9CA3AF;margin-right:6px"></i>${candidate.phone}</div>` : ''}
            ${candidate.linkedin ? `<div style="font-size:13px"><i class="ti ti-brand-linkedin" style="color:#9CA3AF;margin-right:6px"></i>${candidate.linkedin}</div>` : ''}
          </div>
          <div>
            <h4 style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;margin-bottom:8px">Notas</h4>
            <p style="font-size:13px;color:#9CA3AF">${candidate.notes ?? 'Nenhuma nota.'}</p>
          </div>
        </div>

        <!-- Action buttons -->
        <div style="display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid #2A2D3A">
          ${candidate.status === 'offer' ? `
            <button id="btn-hire" style="padding:8px 16px;border-radius:8px;border:none;background:#1D9E75;color:#fff;cursor:pointer;font-size:13px;font-weight:600">
              <i class="ti ti-user-check"></i> Contratar
            </button>` : ''}
          <button id="btn-edit-candidate" style="padding:8px 14px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer;font-size:13px">
            <i class="ti ti-edit"></i> Editar
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/recruitment'));

  document.getElementById('btn-hire')?.addEventListener('click', () => {
    openModal('Contratar Candidato', `
      <form id="hire-form" style="display:flex;flex-direction:column;gap:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Data de Admissão *</label>
            <input name="hire_date" type="date" required value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Salário Base *</label>
            <input name="base_salary" type="number" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button type="button" id="cancel-hire" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#1D9E75;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Contratar</button>
        </div>
      </form>`);
    document.getElementById('cancel-hire')?.addEventListener('click', closeModal);
    (document.getElementById('hire-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      try {
        const emp = await window.gero.invoke('recruitment:hireCandidate', token, id, {
          hire_date:   fd.get('hire_date') as string,
          base_salary: parseFloat(fd.get('base_salary') as string),
        }) as { id: string };
        showToast('Candidato contratado como funcionário!', 'success');
        closeModal();
        navigate(`/employees/${emp.id}`);
      } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
    });
  });
}
