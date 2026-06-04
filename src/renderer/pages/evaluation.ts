import type { EvaluationCycle, EvaluationForm, DevelopmentPlan } from '../../shared/types';
import { getToken } from '../index';
import { renderTable } from '../components/table';
import { statusBadge } from '../components/badge';
import { openModal, closeModal, openConfirm } from '../components/modal';
import { showToast } from '../components/toast';

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const COMPETENCIES = ['Comunicação','Trabalho em equipe','Proatividade','Qualidade técnica','Liderança','Resolução de problemas'];

export async function renderEvaluation(container: HTMLElement): Promise<void> {
  const token = getToken();
  let activeTab: 'cycles' | 'forms' | 'pdis' = 'cycles';

  async function load(): Promise<void> {
    const [cycles, forms, plans] = await Promise.all([
      window.gero.invoke('evaluation:listCycles', token) as Promise<EvaluationCycle[]>,
      window.gero.invoke('evaluation:listForms', token, {}) as Promise<EvaluationForm[]>,
      window.gero.invoke('evaluation:listDevelopmentPlans', token) as Promise<DevelopmentPlan[]>,
    ]);

    container.innerHTML = `
      <div style="max-width:1400px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Avaliação de Desempenho</h1>
          <div style="display:flex;gap:8px">
            ${activeTab === 'cycles' ? `<button id="btn-new-cycle" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer"><i class="ti ti-plus"></i> Novo Ciclo</button>` : ''}
            ${activeTab === 'pdis' ? `<button id="btn-new-pdi" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer"><i class="ti ti-plus"></i> Novo PDI</button>` : ''}
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;background:#1A1D27;border:1px solid #2A2D3A;border-radius:8px;overflow:hidden;width:fit-content;margin-bottom:16px">
          ${[['cycles','Ciclos'],['forms','Formulários'],['pdis','PDIs']].map(([tab,label]) => `
            <button class="eval-tab" data-tab="${tab}" style="padding:8px 20px;border:none;background:${activeTab===tab?'#EF9F2722':'transparent'};color:${activeTab===tab?'#EF9F27':'#9CA3AF'};cursor:pointer;font-size:13px;font-weight:${activeTab===tab?'600':'400'}">${label}</button>`).join('')}
        </div>

        <!-- Content -->
        <div id="eval-content" style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          ${activeTab === 'cycles'  ? renderCycles(cycles)  : ''}
          ${activeTab === 'forms'   ? renderForms(forms)    : ''}
          ${activeTab === 'pdis'    ? renderPdis(plans)     : ''}
        </div>
      </div>
    `;

    container.querySelectorAll('.eval-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab') as typeof activeTab;
        load();
      });
    });

    document.getElementById('btn-new-cycle')?.addEventListener('click', () => {
      openCycleForm(async (data) => {
        try { await window.gero.invoke('evaluation:createCycle', token, data); showToast('Ciclo criado!', 'success'); closeModal(); load(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    document.getElementById('btn-new-pdi')?.addEventListener('click', () => {
      void openPdiForm(cycles, async (data) => {
        try { await window.gero.invoke('evaluation:createPlan', token, data); showToast('PDI criado!', 'success'); closeModal(); load(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    // Cycle action buttons
    container.querySelectorAll('.btn-start-cycle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        openConfirm('Iniciar o ciclo criará formulários para todos os funcionários ativos.', async () => {
          try { const n = await window.gero.invoke('evaluation:startCycle', token, btn.getAttribute('data-id')!) as number; showToast(`Ciclo iniciado para ${n} funcionários!`, 'success'); closeModal(); load(); }
          catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
        }, 'Iniciar Ciclo');
      });
    });

    container.querySelectorAll('.btn-complete-cycle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        openConfirm('Concluir o ciclo?', async () => {
          try { await window.gero.invoke('evaluation:completeCycle', token, btn.getAttribute('data-id')!); showToast('Ciclo concluído!', 'success'); closeModal(); load(); }
          catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
        }, 'Concluir');
      });
    });

    // Form actions
    container.querySelectorAll('.btn-fill-form').forEach(btn => {
      btn.addEventListener('click', () => {
        openEvaluationForm(btn.getAttribute('data-id')!, async (answers) => {
          try { await window.gero.invoke('evaluation:submitForm', token, btn.getAttribute('data-id')!, answers); showToast('Avaliação enviada!', 'success'); closeModal(); load(); }
          catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
        });
      });
    });
  }

  function renderCycles(cycles: EvaluationCycle[]): string {
    if (cycles.length === 0) return `<div style="padding:40px;text-align:center;color:#6B7280">Nenhum ciclo criado.</div>`;
    return `<div style="padding:16px">${cycles.map(c => {
      const pct = c.form_count ? Math.round(((c.completed_count ?? 0) / c.form_count) * 100) : 0;
      return `
        <div style="padding:16px;border-bottom:1px solid #2A2D3A">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div>
              <div style="font-weight:600;font-size:15px">${c.name}</div>
              <div style="font-size:12px;color:#9CA3AF;margin-top:2px">${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${statusBadge(c.status)}
              ${c.status === 'draft' ? `<button class="btn-start-cycle" data-id="${c.id}" style="padding:5px 12px;border-radius:6px;border:none;background:#3B6FE822;color:#3B6FE8;cursor:pointer;font-size:12px">Iniciar</button>` : ''}
              ${c.status === 'in_progress' ? `<button class="btn-complete-cycle" data-id="${c.id}" style="padding:5px 12px;border-radius:6px;border:none;background:#1D9E7522;color:#1D9E75;cursor:pointer;font-size:12px">Concluir</button>` : ''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1;height:6px;background:#2A2D3A;border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:#EF9F27;transition:width 0.3s"></div>
            </div>
            <span style="font-size:12px;color:#9CA3AF;white-space:nowrap">${c.completed_count ?? 0}/${c.form_count ?? 0} forms (${pct}%)</span>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function renderForms(forms: EvaluationForm[]): string {
    if (forms.length === 0) return `<div style="padding:40px;text-align:center;color:#6B7280">Nenhum formulário.</div>`;
    return renderTable({
      columns: [
        { key: 'evaluatee',  label: 'Avaliado',    render: r => `<span style="font-weight:500">${(r as EvaluationForm).evaluatee_name ?? '—'}</span>` },
        { key: 'evaluator',  label: 'Avaliador',   render: r => (r as EvaluationForm).evaluator_name ?? '—' },
        { key: 'cycle',      label: 'Ciclo',       render: r => (r as EvaluationForm).cycle_name ?? '—' },
        { key: 'type',       label: 'Tipo',        render: r => (r as EvaluationForm).type },
        { key: 'status',     label: 'Status',      render: r => statusBadge((r as EvaluationForm).status) },
        { key: 'score',      label: 'Nota',        render: r => (r as EvaluationForm).overall_score ? `<span style="font-family:'JetBrains Mono',monospace;color:#EF9F27">${(r as EvaluationForm).overall_score}/5</span>` : '—' },
        { key: 'actions', label: '', width: '100px',
          render: r => (r as EvaluationForm).status === 'pending' || (r as EvaluationForm).status === 'in_progress'
            ? `<button class="btn-fill-form" data-id="${(r as EvaluationForm).id}" style="padding:5px 12px;border-radius:6px;border:1px solid #EF9F2744;background:#EF9F2711;color:#EF9F27;cursor:pointer;font-size:12px">Preencher</button>`
            : '' },
      ],
      data: forms,
      rowKey: r => (r as EvaluationForm).id,
    });
  }

  function renderPdis(plans: DevelopmentPlan[]): string {
    if (plans.length === 0) return `<div style="padding:40px;text-align:center;color:#6B7280">Nenhum PDI registrado.</div>`;
    return renderTable({
      columns: [
        { key: 'employee',  label: 'Funcionário', render: r => `<span style="font-weight:500">${(r as DevelopmentPlan).employee_name ?? '—'}</span>` },
        { key: 'objective', label: 'Objetivo',    render: r => `<div style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(r as DevelopmentPlan).objective}</div>` },
        { key: 'deadline',  label: 'Prazo',       render: r => fmtDate((r as DevelopmentPlan).deadline ?? '') },
        { key: 'status',    label: 'Status',      render: r => statusBadge((r as DevelopmentPlan).status) },
      ],
      data: plans,
      rowKey: r => (r as DevelopmentPlan).id,
    });
  }

  function openCycleForm(onSave: (data: Partial<EvaluationCycle>) => Promise<void>): void {
    const now = new Date();
    const content = `
      <form id="cycle-form" style="display:flex;flex-direction:column;gap:14px">
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Nome *</label>
          <input name="name" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Início *</label>
            <input name="start_date" type="date" required value="${now.toISOString().split('T')[0]}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
          <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Fim *</label>
            <input name="end_date" type="date" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button type="button" id="cancel-cycle" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Criar</button>
        </div>
      </form>`;
    openModal('Novo Ciclo de Avaliação', content);
    document.getElementById('cancel-cycle')?.addEventListener('click', closeModal);
    (document.getElementById('cycle-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      await onSave({ name: fd.get('name') as string, start_date: fd.get('start_date') as string, end_date: fd.get('end_date') as string });
    });
  }

  async function openPdiForm(
    cycles: EvaluationCycle[],
    onSave: (data: Partial<DevelopmentPlan>) => Promise<void>,
  ): Promise<void> {
    const res = await window.gero.invoke('employees:list', token, { page: 1, pageSize: 1000, active: true }) as { data: Array<{ id: string; name: string }> };
    const emps = res.data ?? [];
    const inp = 'width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none';
    const lbl = 'display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px';
    const content = `
      <form id="pdi-form" style="display:flex;flex-direction:column;gap:14px">
        <div><label style="${lbl}">Funcionário *</label>
          <select name="employee_id" required style="${inp}">
            <option value="">Selecione…</option>
            ${emps.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
          </select></div>
        <div><label style="${lbl}">Ciclo de avaliação</label>
          <select name="cycle_id" style="${inp}">
            <option value="">Nenhum</option>
            ${cycles.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select></div>
        <div><label style="${lbl}">Objetivo *</label>
          <textarea name="objective" required rows="3" style="${inp};resize:vertical"></textarea></div>
        <div><label style="${lbl}">Ações de desenvolvimento</label>
          <textarea name="actions" rows="3" style="${inp};resize:vertical"></textarea></div>
        <div><label style="${lbl}">Prazo</label>
          <input name="deadline" type="date" style="${inp}"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button type="button" id="cancel-pdi" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Criar</button>
        </div>
      </form>`;
    openModal('Novo PDI', content);
    document.getElementById('cancel-pdi')?.addEventListener('click', closeModal);
    (document.getElementById('pdi-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      await onSave({
        employee_id: fd.get('employee_id') as string,
        cycle_id:    (fd.get('cycle_id') as string) || undefined,
        objective:   fd.get('objective') as string,
        actions:     (fd.get('actions') as string) || undefined,
        deadline:    (fd.get('deadline') as string) || undefined,
      });
    });
  }

  function openEvaluationForm(formId: string, onSave: (answers: Array<{ competency: string; score: number; comment?: string }>) => Promise<void>): void {
    const sliders = COMPETENCIES.map(c => `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <label style="font-size:13px;font-weight:500">${c}</label>
          <span id="score-val-${c.replace(/\s/g,'_')}" style="font-family:'JetBrains Mono',monospace;color:#EF9F27;font-size:14px;font-weight:700">3</span>
        </div>
        <input type="range" name="score_${c}" min="1" max="5" value="3" data-comp="${c}" class="score-slider" style="width:100%;accent-color:#EF9F27">
        <input type="text" name="comment_${c}" placeholder="Comentário (opcional)" style="width:100%;margin-top:6px;padding:6px 10px;border-radius:6px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:12px;outline:none">
      </div>`).join('');

    openModal('Preencher Avaliação', `
      <form id="eval-form" style="max-height:60vh;overflow-y:auto;padding-right:4px">
        ${sliders}
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A;position:sticky;bottom:0;background:#1A1D27;margin-top:8px">
          <button type="button" id="cancel-eval" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Enviar</button>
        </div>
      </form>`);

    document.querySelectorAll('.score-slider').forEach(slider => {
      slider.addEventListener('input', function() {
        const comp = (this as HTMLInputElement).getAttribute('data-comp')!.replace(/\s/g,'_');
        const val = document.getElementById(`score-val-${comp}`);
        if (val) val.textContent = (this as HTMLInputElement).value;
      });
    });
    document.getElementById('cancel-eval')?.addEventListener('click', closeModal);
    (document.getElementById('eval-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const answers = COMPETENCIES.map(c => ({
        competency: c,
        score: parseInt(fd.get(`score_${c}`) as string),
        comment: fd.get(`comment_${c}`) as string || undefined,
      }));
      await onSave(answers);
    });
  }

  await load();
}
