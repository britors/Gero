import type { User } from '../../shared/types';
import { navigate } from '../router';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  permission?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { icon: 'ti-dashboard', label: 'Dashboard', route: '/dashboard' },
    ],
  },
  {
    title: 'Pessoas',
    items: [
      { icon: 'ti-users', label: 'Funcionários', route: '/employees' },
      { icon: 'ti-building', label: 'Departamentos', route: '/departments' },
      { icon: 'ti-briefcase', label: 'Cargos', route: '/positions' },
    ],
  },
  {
    title: 'Folha',
    items: [
      { icon: 'ti-cash', label: 'Períodos', route: '/payroll' },
      { icon: 'ti-file-invoice', label: 'Holerites', route: '/payslip' },
      { icon: 'ti-file-x', label: 'Rescisão', route: '/rescisao' },
    ],
  },
  {
    title: 'Ponto',
    items: [
      { icon: 'ti-clock', label: 'Timesheets', route: '/timesheet' },
    ],
  },
  {
    title: 'Férias',
    items: [
      { icon: 'ti-beach', label: 'Solicitações', route: '/vacation' },
    ],
  },
  {
    title: 'Recrutamento',
    items: [
      { icon: 'ti-speakerphone', label: 'Vagas', route: '/recruitment' },
    ],
  },
  {
    title: 'Desempenho',
    items: [
      { icon: 'ti-chart-bar', label: 'Ciclos', route: '/evaluation' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { icon: 'ti-gift', label: 'Benefícios', route: '/benefits' },
      { icon: 'ti-file-text', label: 'Documentos', route: '/documents' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { icon: 'ti-chart-line', label: 'Relatórios', route: '/reports' },
      { icon: 'ti-code', label: 'Studio', route: '/studio', permission: 'studio:access' },
      { icon: 'ti-settings', label: 'Configurações', route: '/settings' },
    ],
  },
];

const PEOPLE_ICON_SVG = `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="11" r="5" fill="#EF9F27"/>
  <circle cx="6"  cy="23" r="4" fill="#EF9F27" opacity="0.7"/>
  <circle cx="26" cy="23" r="4" fill="#EF9F27" opacity="0.7"/>
  <line x1="12" y1="14" x2="8"  y2="20" stroke="#EF9F27" stroke-width="1.5" opacity="0.6"/>
  <line x1="20" y1="14" x2="24" y2="20" stroke="#EF9F27" stroke-width="1.5" opacity="0.6"/>
</svg>`;

export function renderSidebar(container: HTMLElement, user: User): void {
  const userPerms: string[] = (user.role as { permissions?: string[] } | undefined)?.permissions ?? [];
  const canAccess = (perm?: string) => {
    if (!perm) return true;
    if (userPerms.includes('*')) return true;
    return userPerms.includes(perm);
  };

  container.innerHTML = `
    <div style="padding:16px 16px 8px">
      <div style="display:flex;align-items:center;gap:10px;padding-bottom:16px;border-bottom:1px solid #2A2D3A">
        ${PEOPLE_ICON_SVG}
        <div>
          <div style="font-size:18px;font-weight:700;color:#EF9F27;line-height:1">Gero</div>
          <div style="font-size:10px;color:#6B7280;line-height:1.2">Pessoas que geram resultados.</div>
        </div>
      </div>
    </div>
    <nav id="sidebar-nav" style="flex:1;padding:8px 0;overflow-y:auto">
      ${NAV_GROUPS.map(group => {
        const visibleItems = group.items.filter(i => canAccess(i.permission));
        if (visibleItems.length === 0) return '';
        return `
          <div class="nav-group">
            <div style="padding:8px 16px 4px;font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em">
              ${group.title}
            </div>
            ${visibleItems.map(item => `
              <a class="nav-item" data-route="${item.route}" href="#${item.route}"
                 style="display:flex;align-items:center;gap:10px;padding:8px 16px;
                        color:#9CA3AF;text-decoration:none;border-radius:0;cursor:pointer;
                        font-size:13px;font-weight:500;transition:all 0.15s;
                        border-right:2px solid transparent;">
                <i class="ti ${item.icon}" style="font-size:16px;flex-shrink:0;width:16px;text-align:center"></i>
                ${item.label}
              </a>
            `).join('')}
          </div>
        `;
      }).join('')}
    </nav>
    <style>
      .nav-item:hover { background:#2A2D3A22; color:#fff !important; }
      .nav-item.active { background:#EF9F2718; color:#EF9F27 !important; border-right-color:#EF9F27 !important; }
      .nav-item.active i { color:#EF9F27 !important; }
    </style>
  `;

  // Active route highlighting
  function updateActive(): void {
    const current = location.hash.slice(1) || '/dashboard';
    container.querySelectorAll('.nav-item').forEach(el => {
      const route = el.getAttribute('data-route') ?? '';
      const isActive = current === route || (current.startsWith(route + '/') && route !== '/');
      el.classList.toggle('active', isActive);
    });
  }

  updateActive();
  window.addEventListener('hashchange', updateActive);
}
