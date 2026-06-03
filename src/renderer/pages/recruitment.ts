import type { JobOpening, Candidate } from '../../shared/types';
import { getToken } from '../index';
import { statusBadge } from '../components/badge';
import { openModal, closeModal } from '../components/modal';
import { showToast } from '../components/toast';
import { navigate } from '../router';

const STAGES: Array<{ key: Candidate['status']; label: string; color: string }> = [
  { key: 'applied',   label: 'Inscritos',    color: '#9CA3AF' },
  { key: 'screening', label: 'Triagem',      color: '#3B6FE8' },
  { key: 'interview', label: 'Entrevista',   color: '#7F77DD' },
  { key: 'offer',     label: 'Oferta',       color: '#EF9F27' },
  { key: 'hired',     label: 'Contratados',  color: '#1D9E75' },
  { key: 'rejected',  label: 'Rejeitados',   color: '#D85A30' },
];

function stars(rating?: number): string {
  if (!rating) return '<span style="color:#6B7280;font-size:11px">—</span>';
  return Array.from({ length: 5 }, (_, i) =>
    `<i class="ti ti-star${i < rating ? '-filled' : ''}" style="color:${i < rating ? '#F5C842' : '#6B7280'};font-size:11px"></i>`
  ).join('');
}

export async function renderRecruitment(container: HTMLElement): Promise<void> {
  const token = getToken();
  let selectedOpeningId = '';

  async function load(): Promise<void> {
    const openings = await window.gero.invoke('recruitment:listOpenings', token) as JobOpening[];
    const openOnes = openings.filter(o => o.status === 'open' || o.status === 'paused');

    container.innerHTML = `
      <div style="max-width:1600px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Recrutamento</h1>
          <button id="btn-new-opening" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-plus"></i> Nova Vaga
          </button>
        </div>

        <!-- Opening selector -->
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
          ${openings.length === 0
            ? `<p style="color:#6B7280;font-size:13px">Nenhuma vaga cadastrada.</p>`
            : openings.map(o => `
              <button class="opening-btn" data-id="${o.id}" style="
                padding:8px 14px;border-radius:20px;border:1px solid #2A2D3A;
                background:${selectedOpeningId===o.id?'#EF9F27':'transparent'};
                color:${selectedOpeningId===o.id?'#fff':'#9CA3AF'};
                cursor:pointer;font-size:13px;transition:all 0.15s;white-space:nowrap">
                ${o.title}
                <span style="margin-left:6px;font-size:11px;opacity:0.8">(${o.candidate_count ?? 0})</span>
                ${statusBadge(o.status)}
              </button>`).join('')}
        </div>

        <!-- Kanban board -->
        <div id="kanban-board" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;min-height:400px">
          ${selectedOpeningId
            ? '<div style="padding:40px;text-align:center;color:#6B7280;width:100%">Carregando...</div>'
            : `<div style="padding:40px;text-align:center;color:#6B7280;width:100%">
                <i class="ti ti-speakerphone" style="font-size:32px;display:block;margin-bottom:8px"></i>
                Selecione uma vaga para ver o kanban de candidatos
              </div>`}
        </div>
      </div>
    `;

    container.querySelectorAll('.opening-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedOpeningId = btn.getAttribute('data-id')!;
        container.querySelectorAll('.opening-btn').forEach(b => {
          const isActive = b.getAttribute('data-id') === selectedOpeningId;
          (b as HTMLElement).style.background = isActive ? '#EF9F27' : 'transparent';
          (b as HTMLElement).style.color = isActive ? '#fff' : '#9CA3AF';
        });
        loadKanban(selectedOpeningId);
      });
    });

    document.getElementById('btn-new-opening')?.addEventListener('click', () => {
      openOpeningForm(async (data) => {
        try {
          await window.gero.invoke('recruitment:createOpening', token, data);
          showToast('Vaga criada!', 'success'); closeModal(); load();
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    if (selectedOpeningId) loadKanban(selectedOpeningId);
  }

  async function loadKanban(openingId: string): Promise<void> {
    const board = document.getElementById('kanban-board')!;
    const candidates = await window.gero.invoke('recruitment:listCandidates', token, { opening: openingId }) as Candidate[];
    const byStage = new Map<string, Candidate[]>();
    STAGES.forEach(s => byStage.set(s.key, []));
    candidates.forEach(c => byStage.get(c.status)?.push(c));

    board.innerHTML = STAGES.map(stage => {
      const cards = (byStage.get(stage.key) ?? []).map(c => {
        const daysAgo = Math.floor((Date.now() - new Date(c.applied_at).getTime()) / 86400000);
        return `
          <div class="candidate-card" data-id="${c.id}" style="
            background:#0F1117;border:1px solid #2A2D3A;border-radius:8px;
            padding:12px;cursor:pointer;transition:border-color 0.15s;margin-bottom:8px">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${c.name}</div>
            <div style="font-size:11px;color:#9CA3AF;margin-bottom:6px">${c.email ?? '—'}</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>${stars(c.rating)}</div>
              <span style="font-size:10px;color:#6B7280">${daysAgo}d atrás</span>
            </div>
            ${stage.key !== 'hired' && stage.key !== 'rejected' ? `
              <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">
                ${getNextStages(stage.key).map(ns => `
                  <button class="btn-move-candidate" data-id="${c.id}" data-status="${ns.key}" style="
                    padding:3px 8px;border-radius:4px;border:none;
                    background:${ns.color}22;color:${ns.color};cursor:pointer;font-size:10px">
                    → ${ns.label}
                  </button>`).join('')}
              </div>` : ''}
          </div>`;
      }).join('');

      return `
        <div style="min-width:200px;flex:1;background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          <div style="padding:12px 14px;border-bottom:1px solid #2A2D3A;display:flex;align-items:center;justify-content:space-between">
            <span style="font-weight:600;font-size:13px;color:${stage.color}">${stage.label}</span>
            <span style="font-size:12px;color:#6B7280;font-family:'JetBrains Mono',monospace">${(byStage.get(stage.key) ?? []).length}</span>
          </div>
          <div style="padding:12px;min-height:100px">
            ${cards || `<div style="text-align:center;padding:20px;color:#6B7280;font-size:12px">Vazio</div>`}
            ${stage.key === 'applied' ? `
              <button id="btn-new-candidate" style="width:100%;padding:8px;border-radius:6px;border:1px dashed #2A2D3A;background:transparent;color:#6B7280;cursor:pointer;font-size:12px;margin-top:4px">
                <i class="ti ti-plus"></i> Novo candidato
              </button>` : ''}
          </div>
        </div>`;
    }).join('');

    board.querySelectorAll('.candidate-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.btn-move-candidate')) return;
        navigate(`/candidates/${card.getAttribute('data-id')}`);
      });
    });

    board.querySelectorAll('.btn-move-candidate').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await window.gero.invoke('recruitment:updateCandidate', token, btn.getAttribute('data-id')!, { status: btn.getAttribute('data-status') });
          showToast('Candidato movido!', 'success');
          loadKanban(selectedOpeningId);
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    document.getElementById('btn-new-candidate')?.addEventListener('click', () => {
      openCandidateForm(openingId, async (data) => {
        try {
          await window.gero.invoke('recruitment:createCandidate', token, data);
          showToast('Candidato adicionado!', 'success'); closeModal();
          loadKanban(openingId);
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });
  }

  function getNextStages(current: string) {
    const map: Record<string, string[]> = {
      applied: ['screening', 'rejected'],
      screening: ['interview', 'rejected'],
      interview: ['offer', 'rejected'],
      offer: ['hired', 'rejected'],
    };
    return STAGES.filter(s => map[current]?.includes(s.key));
  }

  function openOpeningForm(onSave: (data: Partial<JobOpening>) => Promise<void>): void {
    const content = `
      <form id="opening-form" style="display:flex;flex-direction:column;gap:14px">
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Título *</label>
          <input name="title" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Localização</label>
          <input name="location" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Faixa Salarial</label>
          <input name="salary_range" placeholder="ex: R$ 5.000 - R$ 8.000" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Descrição</label>
          <textarea name="description" rows="3" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none;resize:vertical"></textarea></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button type="button" id="cancel-opening" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Criar Vaga</button>
        </div>
      </form>`;
    openModal('Nova Vaga', content);
    document.getElementById('cancel-opening')?.addEventListener('click', closeModal);
    (document.getElementById('opening-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      await onSave({ title: fd.get('title') as string, location: fd.get('location') as string || undefined, salary_range: fd.get('salary_range') as string || undefined, description: fd.get('description') as string || undefined });
    });
  }

  function openCandidateForm(openingId: string, onSave: (data: Partial<Candidate>) => Promise<void>): void {
    const content = `
      <form id="cand-form" style="display:flex;flex-direction:column;gap:14px">
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Nome *</label>
          <input name="name" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">E-mail</label>
            <input name="email" type="email" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Telefone</label>
            <input name="phone" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        </div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">LinkedIn</label>
          <input name="linkedin" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button type="button" id="cancel-cand" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Adicionar</button>
        </div>
      </form>`;
    openModal('Novo Candidato', content);
    document.getElementById('cancel-cand')?.addEventListener('click', closeModal);
    (document.getElementById('cand-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      await onSave({ opening_id: openingId, name: fd.get('name') as string, email: fd.get('email') as string || undefined, phone: fd.get('phone') as string || undefined, linkedin: fd.get('linkedin') as string || undefined });
    });
  }

  await load();
}
