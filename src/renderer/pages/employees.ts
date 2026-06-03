import type { Employee, Department, Position, PaginatedResult } from '../../shared/types';
import { getToken } from '../index';
import { renderTable, attachTableRowHandlers, renderPagination } from '../components/table';
import { contractBadge, statusBadge } from '../components/badge';
import { openModal, closeModal, openConfirm } from '../components/modal';
import { showToast } from '../components/toast';
import { navigate } from '../router';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export async function renderEmployees(container: HTMLElement): Promise<void> {
  let page = 1;
  let search = '';
  let deptFilter = '';
  let activeFilter: boolean | undefined = true;
  const pageSize = 20;

  async function load(): Promise<void> {
    const token = getToken();
    const result = await window.gero.invoke('employees:list', token, {
      page, pageSize, search: search || undefined,
      department: deptFilter || undefined,
      active: activeFilter,
    }) as PaginatedResult<Employee>;
    const depts = await window.gero.invoke('departments:list', token) as Department[];

    container.innerHTML = `
      <div style="max-width:1400px">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div>
            <h1 style="font-size:20px;font-weight:700">Funcionários</h1>
            <p style="font-size:13px;color:#6B7280;margin-top:2px">${result.total} funcionário(s) encontrado(s)</p>
          </div>
          <button id="btn-new-employee" style="
            display:flex;align-items:center;gap:6px;padding:9px 16px;
            border-radius:8px;border:none;background:#EF9F27;color:#fff;
            font-size:13px;font-weight:600;cursor:pointer">
            <i class="ti ti-plus"></i> Novo Funcionário
          </button>
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
          <input id="search-input" type="search" placeholder="Buscar por nome, CPF ou e-mail..."
                 value="${search}" style="
            flex:1;min-width:200px;padding:8px 12px;border-radius:8px;
            border:1px solid #2A2D3A;background:#1A1D27;color:#fff;font-size:13px;outline:none">

          <select id="dept-filter" style="
            padding:8px 12px;border-radius:8px;border:1px solid #2A2D3A;
            background:#1A1D27;color:#fff;font-size:13px;outline:none">
            <option value="">Todos os departamentos</option>
            ${depts.map(d => `<option value="${d.id}" ${deptFilter===d.id?'selected':''}>${d.name}</option>`).join('')}
          </select>

          <select id="active-filter" style="
            padding:8px 12px;border-radius:8px;border:1px solid #2A2D3A;
            background:#1A1D27;color:#fff;font-size:13px;outline:none">
            <option value="true"  ${activeFilter===true?'selected':''}>Ativos</option>
            <option value="false" ${activeFilter===false?'selected':''}>Inativos</option>
            <option value=""      ${activeFilter===undefined?'selected':''}>Todos</option>
          </select>
        </div>

        <!-- Table card -->
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden">
          ${renderTable<Employee>({
            columns: [
              { key: 'name',        label: 'Nome',        render: r => `<div style="font-weight:500">${r.name}</div><div style="font-size:11px;color:#6B7280">${r.email ?? ''}</div>` },
              { key: 'department',  label: 'Departamento', render: r => r.department_name ?? '—' },
              { key: 'position',    label: 'Cargo',       render: r => r.position_title ?? '—' },
              { key: 'contract',    label: 'Contrato',    render: r => contractBadge(r.contract_type) },
              { key: 'salary',      label: 'Salário',     render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:13px">${fmtBRL(Number(r.base_salary))}</span>` },
              { key: 'hire_date',   label: 'Admissão',    render: r => fmtDate(r.hire_date) },
              { key: 'status',      label: 'Status',      render: r => statusBadge(r.is_active ? 'active' : 'inactive') },
            ],
            data: result.data,
            emptyMessage: 'Nenhum funcionário encontrado.',
            onRowClick: (r) => navigate(`/employees/${r.id}`),
            rowKey: r => r.id,
          })}
          <div style="padding:0 14px">
            ${renderPagination(result.total, page, pageSize, (p) => { page = p; load(); })}
          </div>
        </div>
      </div>
    `;

    // Attach row click
    attachTableRowHandlers(container, result.data, (r) => navigate(`/employees/${r.id}`), r => r.id);

    // Filter handlers
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    let searchTimer: ReturnType<typeof setTimeout>;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { search = searchInput.value; page = 1; load(); }, 350);
    });

    (document.getElementById('dept-filter') as HTMLSelectElement)?.addEventListener('change', function() {
      deptFilter = this.value; page = 1; load();
    });

    (document.getElementById('active-filter') as HTMLSelectElement)?.addEventListener('change', function() {
      activeFilter = this.value === '' ? undefined : this.value === 'true'; page = 1; load();
    });

    // New employee button
    document.getElementById('btn-new-employee')?.addEventListener('click', () => {
      openEmployeeForm(null, depts, async (data) => {
        try {
          await window.gero.invoke('employees:create', token, data);
          showToast('Funcionário criado com sucesso!', 'success');
          closeModal();
          load();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Erro ao criar funcionário', 'error');
        }
      });
    });
  }

  await load();
}

function openEmployeeForm(
  emp: Employee | null,
  depts: Department[],
  onSave: (data: Partial<Employee>) => Promise<void>
): void {
  const title = emp ? 'Editar Funcionário' : 'Novo Funcionário';
  const content = `
    <form id="emp-form" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${field('name',          'Nome *',         'text',   emp?.name          ?? '', 'span2')}
      ${field('cpf',           'CPF',            'text',   emp?.cpf           ?? '', '', '000.000.000-00')}
      ${field('email',         'E-mail',         'email',  emp?.email         ?? '')}
      ${field('phone',         'Telefone',       'text',   emp?.phone         ?? '')}
      ${field('birth_date',    'Nascimento',     'date',   emp?.birth_date?.split('T')[0] ?? '')}
      ${selectField('gender', 'Gênero', emp?.gender ?? '', [['M','Masculino'],['F','Feminino'],['O','Outro']])}
      ${selectField('department_id', 'Departamento', emp?.department_id ?? '', depts.map(d => [d.id, d.name]))}
      ${selectField('contract_type', 'Contrato *', emp?.contract_type ?? 'clt', [['clt','CLT'],['pj','PJ'],['intern','Estágio'],['temporary','Temporário']])}
      ${field('hire_date',     'Admissão *',     'date',   emp?.hire_date?.split('T')[0] ?? '')}
      ${field('base_salary',   'Salário Base *', 'number', String(emp?.base_salary ?? ''), '', '0.00')}
      ${field('city',          'Cidade',         'text',   emp?.city          ?? '')}
      ${selectField('state', 'UF', emp?.state ?? '', [['SP','SP'],['RJ','RJ'],['MG','MG'],['RS','RS'],['PR','PR'],['SC','SC'],['BA','BA'],['GO','GO'],['DF','DF'],['PE','PE'],['CE','CE'],['PA','PA'],['AM','AM'],['MT','MT'],['MS','MS'],['ES','ES'],['AL','AL'],['RN','RN'],['PI','PI'],['PB','PB'],['SE','SE'],['TO','TO'],['MA','MA'],['RO','RO'],['AC','AC'],['AP','AP'],['RR','RR']])}
      <div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:10px;margin-top:8px;padding-top:12px;border-top:1px solid #2A2D3A">
        <button type="button" id="cancel-emp" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
        <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Salvar</button>
      </div>
    </form>
  `;

  openModal(title, content);
  document.getElementById('cancel-emp')?.addEventListener('click', closeModal);

  (document.getElementById('emp-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const data: Partial<Employee> = {
      name:          fd.get('name') as string,
      cpf:           fd.get('cpf') as string || undefined,
      email:         fd.get('email') as string || undefined,
      phone:         fd.get('phone') as string || undefined,
      birth_date:    fd.get('birth_date') as string || undefined,
      gender:        fd.get('gender') as string || undefined,
      department_id: fd.get('department_id') as string || undefined,
      contract_type: fd.get('contract_type') as Employee['contract_type'],
      hire_date:     fd.get('hire_date') as string,
      base_salary:   parseFloat(fd.get('base_salary') as string) || 0,
      city:          fd.get('city') as string || undefined,
      state:         fd.get('state') as string || undefined,
    };
    await onSave(data);
  });
}

function field(name: string, label: string, type: string, value: string, cls = '', placeholder = ''): string {
  return `<div class="${cls}">
    <label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">${label}</label>
    <input name="${name}" type="${type}" value="${value}" placeholder="${placeholder}"
           style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
  </div>`;
}

function selectField(name: string, label: string, value: string, options: [string, string][], cls = ''): string {
  return `<div class="${cls}">
    <label style="display:block;font-size:11px;font-weight:500;color:#9CA3AF;margin-bottom:4px">${label}</label>
    <select name="${name}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
      <option value="">—</option>
      ${options.map(([v, l]) => `<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('')}
    </select>
  </div>`;
}
