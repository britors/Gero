import type { User } from '../../shared/types';
import { renderAvatar } from './avatar';
import { openModal } from './modal';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/employees':   'Funcionários',
  '/departments': 'Departamentos',
  '/positions':   'Cargos',
  '/payroll':     'Folha de Pagamento',
  '/payslip':     'Holerites',
  '/timesheet':   'Controle de Ponto',
  '/vacation':    'Férias',
  '/recruitment': 'Recrutamento',
  '/evaluation':  'Avaliação de Desempenho',
  '/benefits':    'Benefícios',
  '/documents':   'Documentos',
  '/reports':     'Relatórios',
  '/studio':      'Gero Studio',
  '/settings':    'Configurações',
};

export function renderTopbar(container: HTMLElement, user: User): void {
  const initials = user.avatar_initials ?? user.name.slice(0, 2).toUpperCase();
  const color    = user.avatar_color ?? '#EF9F27';

  container.innerHTML = `
    <div id="topbar-title" style="flex:1;font-size:15px;font-weight:600;color:#fff">Dashboard</div>
    <div style="display:flex;align-items:center;gap:12px">
      <div id="user-menu-btn" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 8px;border-radius:8px;transition:background 0.15s"
           onmouseover="this.style.background='#2A2D3A'" onmouseout="this.style.background='transparent'">
        ${renderAvatar(initials, color, 30)}
        <span style="font-size:13px;font-weight:500;color:#fff;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.name}</span>
        <i class="ti ti-chevron-down" style="font-size:12px;color:#6B7280"></i>
      </div>
    </div>
  `;

  // Update title on route change
  function updateTitle(): void {
    const path = location.hash.slice(1) || '/dashboard';
    // Match exact or prefix
    let title = 'Gero';
    for (const [route, label] of Object.entries(PAGE_TITLES)) {
      if (path === route || path.startsWith(route + '/')) { title = label; break; }
    }
    const el = document.getElementById('topbar-title');
    if (el) el.textContent = title;
  }
  updateTitle();
  window.addEventListener('hashchange', updateTitle);

  // User menu
  document.getElementById('user-menu-btn')?.addEventListener('click', () => {
    const roleName = (user.role as { name?: string } | undefined)?.name ?? 'Usuário';
    openModal('Minha Conta', `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
        ${renderAvatar(initials, color, 48)}
        <div>
          <div style="font-size:16px;font-weight:600">${user.name}</div>
          <div style="font-size:13px;color:#9CA3AF">${user.email}</div>
          <div style="font-size:12px;color:#EF9F27;margin-top:2px;text-transform:capitalize">${roleName}</div>
        </div>
      </div>
      <button id="logout-btn" style="
        width:100%;padding:10px;border-radius:8px;border:1px solid #D85A3044;
        background:#D85A3011;color:#D85A30;cursor:pointer;font-size:13px;font-weight:600;
        display:flex;align-items:center;justify-content:center;gap:8px">
        <i class="ti ti-logout"></i> Sair do sistema
      </button>
    `);
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      window.__geroLogout();
    });
  });
}
