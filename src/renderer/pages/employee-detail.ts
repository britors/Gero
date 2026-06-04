import type { Employee, EmployeeBenefit, Timesheet, VacationEntitlement, EvaluationForm, EmployeeDocument } from '../../shared/types';
import { getToken } from '../index';
import { contractBadge, statusBadge } from '../components/badge';
import { showToast } from '../components/toast';
import { openConfirm, openModal, closeModal } from '../components/modal';
import { navigate } from '../router';

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export async function renderEmployeeDetail(container: HTMLElement, params: Record<string, string>): Promise<void> {
  const { id } = params;
  const token = getToken();
  const emp = await window.gero.invoke('employees:get', token, id) as Employee | null;

  if (!emp) {
    container.innerHTML = `<div style="padding:40px;color:#D85A30">Funcionário não encontrado.</div>`;
    return;
  }

  let activeTab = 'pessoal';

  function renderContent(): void {
    container.innerHTML = `
      <div style="max-width:1200px">
        <!-- Back & actions -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <button id="btn-back" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer;font-size:13px">
            <i class="ti ti-arrow-left"></i> Funcionários
          </button>
          <div style="flex:1"></div>
          ${emp.is_active
            ? `<button id="btn-terminate" style="padding:7px 14px;border-radius:8px;border:1px solid #D85A3044;background:#D85A3011;color:#D85A30;cursor:pointer;font-size:13px;font-weight:500">
                <i class="ti ti-user-minus"></i> Desligar
              </button>
               <button id="btn-edit" style="padding:7px 14px;border-radius:8px;border:none;background:#EF9F27;color:#fff;cursor:pointer;font-size:13px;font-weight:600">
                <i class="ti ti-edit"></i> Editar
              </button>`
            : `<button id="btn-reactivate" style="padding:7px 14px;border-radius:8px;border:1px solid #1D9E7544;background:#1D9E7511;color:#1D9E75;cursor:pointer;font-size:13px;font-weight:500">
                <i class="ti ti-user-plus"></i> Reativar
              </button>`}
        </div>

        <!-- Profile header -->
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:24px;margin-bottom:16px;display:flex;align-items:center;gap:20px">
          <div style="width:64px;height:64px;border-radius:50%;background:#EF9F2722;border:2px solid #EF9F27;
                      display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#EF9F27;flex-shrink:0">
            ${emp.name.slice(0,2).toUpperCase()}
          </div>
          <div style="flex:1">
            <div style="font-size:22px;font-weight:700;display:flex;align-items:center;gap:10px">
              ${emp.name}
              ${statusBadge(emp.is_active ? 'active' : 'inactive')}
            </div>
            <div style="font-size:13px;color:#9CA3AF;margin-top:4px">
              ${emp.position_title ?? '—'} &bull; ${emp.department_name ?? '—'}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:700;color:#EF9F27;font-family:'JetBrains Mono',monospace">${fmtBRL(Number(emp.base_salary))}</div>
            <div style="font-size:12px;color:#6B7280;margin-top:2px">${contractBadge(emp.contract_type)}</div>
          </div>
        </div>

        <!-- Integration badges -->
        ${(emp.orbi_user_id || emp.filo_user_id) ? `
          <div style="display:flex;gap:8px;margin-bottom:16px">
            ${emp.orbi_user_id ? `<span style="padding:4px 12px;border-radius:20px;background:#3B6FE822;color:#3B6FE8;font-size:12px;font-weight:500"><i class="ti ti-check"></i> Sincronizado com Orbi</span>` : ''}
            ${emp.filo_user_id ? `<span style="padding:4px 12px;border-radius:20px;background:#7F77DD22;color:#7F77DD;font-size:12px;font-weight:500"><i class="ti ti-check"></i> Sincronizado com Filo</span>` : ''}
          </div>` : ''}

        <!-- Tabs -->
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          <div style="display:flex;border-bottom:1px solid #2A2D3A;overflow-x:auto">
            ${[
              ['pessoal',    'Dados Pessoais',   'ti-id'],
              ['cargo',      'Cargo & Contrato', 'ti-briefcase'],
              ['beneficios', 'Benefícios',       'ti-gift'],
              ['ponto',      'Ponto',            'ti-clock'],
              ['ferias',     'Férias',           'ti-beach'],
              ['desempenho', 'Desempenho',       'ti-chart-bar'],
              ['documentos', 'Documentos',       'ti-file-text'],
            ].map(([tab, label, icon]) => `
              <button class="tab-btn" data-tab="${tab}" style="
                display:flex;align-items:center;gap:6px;
                padding:12px 16px;border:none;background:transparent;
                color:${activeTab===tab?'#EF9F27':'#9CA3AF'};
                border-bottom:2px solid ${activeTab===tab?'#EF9F27':'transparent'};
                cursor:pointer;font-size:13px;font-weight:${activeTab===tab?'600':'400'};
                white-space:nowrap;transition:all 0.15s">
                <i class="ti ${icon}" style="font-size:14px"></i>${label}
              </button>
            `).join('')}
          </div>
          <div id="tab-content" style="padding:24px">Loading...</div>
        </div>
      </div>
    `;

    attachHandlers();
    loadTab();
  }

  async function loadTab(): Promise<void> {
    const tc = document.getElementById('tab-content')!;
    switch (activeTab) {
      case 'pessoal':    tc.innerHTML = tabPessoal(emp); break;
      case 'cargo':      tc.innerHTML = tabCargo(emp); break;
      case 'beneficios': await loadBenefits(tc); break;
      case 'ponto':      await loadPonto(tc); break;
      case 'ferias':     await loadFerias(tc); break;
      case 'desempenho': await loadDesempenho(tc); break;
      case 'documentos': await loadDocumentos(tc); break;
    }
  }

  function attachHandlers(): void {
    document.getElementById('btn-back')?.addEventListener('click', () => navigate('/employees'));
    document.getElementById('btn-edit')?.addEventListener('click', () => {
      // Simple edit: just navigate back for now (full edit form in employees list)
      showToast('Use a lista de funcionários para editar', 'info');
    });
    document.getElementById('btn-terminate')?.addEventListener('click', () => {
      openConfirm(`Desligar ${emp.name}? Esta ação desativará o funcionário.`, async () => {
        try {
          await window.gero.invoke('employees:terminate', token, id, 'resignation', new Date().toISOString().split('T')[0]);
          showToast('Funcionário desligado.', 'success');
          closeModal();
          navigate('/employees');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Erro', 'error');
        }
      }, 'Desligar', true);
    });
    document.getElementById('btn-reactivate')?.addEventListener('click', async () => {
      try {
        await window.gero.invoke('employees:reactivate', token, id);
        showToast('Funcionário reativado.', 'success');
        navigate('/employees');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Erro', 'error');
      }
    });
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab')!;
        container.querySelectorAll('.tab-btn').forEach(b => {
          const isActive = b.getAttribute('data-tab') === activeTab;
          (b as HTMLElement).style.color = isActive ? '#EF9F27' : '#9CA3AF';
          (b as HTMLElement).style.borderBottomColor = isActive ? '#EF9F27' : 'transparent';
          (b as HTMLElement).style.fontWeight = isActive ? '600' : '400';
        });
        loadTab();
      });
    });
  }

  renderContent();
}

function row(label: string, value: string): string {
  return `<div style="display:flex;padding:8px 0;border-bottom:1px solid #2A2D3A22">
    <span style="width:180px;font-size:12px;color:#9CA3AF;font-weight:500;flex-shrink:0">${label}</span>
    <span style="font-size:13px">${value || '—'}</span>
  </div>`;
}

function tabPessoal(e: Employee): string {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div>
        <h4 style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;margin-bottom:12px">Identificação</h4>
        ${row('Nome Completo', e.name)}
        ${row('CPF', e.cpf ?? '')}
        ${row('RG', e.rg ?? '')}
        ${row('Nascimento', fmtDate(e.birth_date))}
        ${row('Gênero', e.gender ?? '')}
      </div>
      <div>
        <h4 style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;margin-bottom:12px">Contato</h4>
        ${row('E-mail', e.email ?? '')}
        ${row('Telefone', e.phone ?? '')}
        ${row('Endereço', e.address ?? '')}
        ${row('Cidade/UF', `${e.city ?? ''} ${e.state ?? ''}`.trim())}
        ${row('CEP', e.zip_code ?? '')}
      </div>
    </div>
    <div style="margin-top:24px">
      <h4 style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;margin-bottom:12px">Dados Bancários</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        ${row('Banco', e.bank_name ?? '')}
        ${row('Agência', e.bank_agency ?? '')}
        ${row('Conta', e.bank_account ?? '')}
      </div>
    </div>`;
}

function tabCargo(e: Employee): string {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div>
        <h4 style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;margin-bottom:12px">Cargo & Departamento</h4>
        ${row('Cargo', e.position_title ?? '')}
        ${row('Departamento', e.department_name ?? '')}
        ${row('Gestor', e.manager_name ?? '')}
      </div>
      <div>
        <h4 style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;margin-bottom:12px">Contrato & Salário</h4>
        ${row('Tipo de Contrato', e.contract_type?.toUpperCase() ?? '')}
        ${row('Data de Admissão', fmtDate(e.hire_date))}
        ${row('Salário Base', fmtBRL(Number(e.base_salary)))}
        ${e.termination_date ? row('Data Desligamento', fmtDate(e.termination_date)) : ''}
        ${e.termination_reason ? row('Motivo Desligamento', e.termination_reason) : ''}
      </div>
    </div>`;
}

async function loadBenefits(tc: HTMLElement): Promise<void> {
  const token = getToken();
  const id = location.hash.split('/')[2] ?? '';
  const bens = await window.gero.invoke('benefits:listEmployeeBenefits', token, id) as EmployeeBenefit[];
  tc.innerHTML = bens.length === 0
    ? `<p style="color:#6B7280">Nenhum benefício atribuído.</p>`
    : bens.map(b => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #2A2D3A">
        <div>
          <div style="font-weight:500">${b.benefit_name ?? ''}</div>
          <div style="font-size:12px;color:#9CA3AF">${b.benefit_type ?? ''} &bull; desde ${fmtDate(b.start_date)}</div>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;color:#EF9F27">${b.value ? fmtBRL(Number(b.value)) : '—'}</div>
      </div>`).join('');
}

async function loadPonto(tc: HTMLElement): Promise<void> {
  const token = getToken();
  const id = location.hash.split('/')[2] ?? '';
  const now = new Date();
  const ts = await window.gero.invoke('timesheet:createOrGet', token, id, now.getMonth() + 1, now.getFullYear()) as Timesheet | null;
  if (!ts) { tc.innerHTML = `<p style="color:#6B7280">Sem ponto registrado.</p>`; return; }
  const summary = await window.gero.invoke('timesheet:getMonthSummary', token, ts.id) as { total_hours: number; overtime_hours: number; absence_days: number } | null;
  tc.innerHTML = `
    <div style="display:flex;gap:24px;flex-wrap:wrap">
      <div style="background:#0F1117;border-radius:8px;padding:16px 24px;min-width:120px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#EF9F27;font-family:'JetBrains Mono',monospace">${summary?.total_hours ?? 0}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px">Horas Trabalhadas</div>
      </div>
      <div style="background:#0F1117;border-radius:8px;padding:16px 24px;min-width:120px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#F5C842;font-family:'JetBrains Mono',monospace">${summary?.overtime_hours ?? 0}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px">Horas Extras</div>
      </div>
      <div style="background:#0F1117;border-radius:8px;padding:16px 24px;min-width:120px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#D85A30;font-family:'JetBrains Mono',monospace">${summary?.absence_days ?? 0}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px">Faltas</div>
      </div>
    </div>
    <div style="margin-top:16px;font-size:13px;color:#6B7280">Status do ponto atual: <strong style="color:#fff">${ts.status}</strong></div>
  `;
}

async function loadFerias(tc: HTMLElement): Promise<void> {
  const token = getToken();
  const id = location.hash.split('/')[2] ?? '';
  const balance = await window.gero.invoke('vacation:getBalance', token, id) as { available: number; taken: number; sold: number } | null;
  const requests = await window.gero.invoke('vacation:listRequests', token, { employee: id }) as Array<{ start_date: string; end_date: string; days_count: number; status: string }>;
  tc.innerHTML = `
    <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">
      <div style="background:#0F1117;border-radius:8px;padding:16px 20px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#1D9E75;font-family:'JetBrains Mono',monospace">${balance?.available ?? 0}</div>
        <div style="font-size:11px;color:#6B7280">Dias Disponíveis</div>
      </div>
      <div style="background:#0F1117;border-radius:8px;padding:16px 20px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#9CA3AF;font-family:'JetBrains Mono',monospace">${balance?.taken ?? 0}</div>
        <div style="font-size:11px;color:#6B7280">Dias Tirados</div>
      </div>
    </div>
    <h4 style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;margin-bottom:8px">Histórico de Solicitações</h4>
    ${requests.length === 0 ? `<p style="color:#6B7280;font-size:13px">Nenhuma solicitação.</p>` :
      requests.map(r => `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #2A2D3A22">
        <span style="font-size:13px">${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</span>
        <span style="font-size:12px;color:#9CA3AF">${r.days_count} dias</span>
        <span style="margin-left:auto;font-size:12px;color:${r.status==='approved'?'#1D9E75':r.status==='rejected'?'#D85A30':'#EF9F27'}">${r.status}</span>
      </div>`).join('')}
  `;
}

async function loadDesempenho(tc: HTMLElement): Promise<void> {
  const token = getToken();
  const id = location.hash.split('/')[2] ?? '';
  const forms = await window.gero.invoke('evaluation:listForms', token, { evaluatee: id }) as EvaluationForm[];
  tc.innerHTML = forms.length === 0 ? `<p style="color:#6B7280">Nenhuma avaliação registrada.</p>` :
    forms.map(f => `<div style="padding:12px 0;border-bottom:1px solid #2A2D3A">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-weight:500">${f.cycle_name ?? '—'}</span>
        <span style="font-size:12px;color:#9CA3AF">${f.type}</span>
        <span style="margin-left:auto;font-size:12px;color:${f.status==='completed'?'#1D9E75':'#9CA3AF'}">${f.status}</span>
        ${f.overall_score ? `<span style="font-family:'JetBrains Mono',monospace;color:#EF9F27">${f.overall_score}/5</span>` : ''}
      </div>
    </div>`).join('');
}

async function loadDocumentos(tc: HTMLElement): Promise<void> {
  const token = getToken();
  const id = location.hash.split('/')[2] ?? '';
  const docs = await window.gero.invoke('documents:list', token, { employee: id }) as EmployeeDocument[];
  tc.innerHTML = docs.length === 0 ? `<p style="color:#6B7280">Nenhum documento registrado.</p>` :
    docs.map(d => `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #2A2D3A">
      <i class="ti ti-file-text" style="color:#9CA3AF;font-size:16px"></i>
      <div style="flex:1"><div style="font-size:13px;font-weight:500">${d.name}</div><div style="font-size:11px;color:#6B7280">${d.type} &bull; ${fmtDate(d.created_at)}</div></div>
    </div>`).join('');
}

const fmtBRL2 = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
