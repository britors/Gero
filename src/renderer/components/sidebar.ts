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
  primary?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    primary: true,
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

const CHEVRON_SVG = `
<svg class="nav-group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="6 9 12 15 18 9"/>
</svg>`;

// ─── Estado do accordion (apenas um grupo aberto por vez) ─────────────────────

let openGroupEl: HTMLElement | null = null;

function openGroup(groupWrap: HTMLElement): void {
  if (openGroupEl && openGroupEl !== groupWrap) closeGroup(openGroupEl);
  groupWrap.classList.add('nav-group-open');
  openGroupEl = groupWrap;
}

function closeGroup(groupWrap: HTMLElement): void {
  groupWrap.classList.remove('nav-group-open');
  if (openGroupEl === groupWrap) openGroupEl = null;
}

function toggleGroup(groupWrap: HTMLElement): void {
  groupWrap.classList.contains('nav-group-open') ? closeGroup(groupWrap) : openGroup(groupWrap);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function renderSidebar(container: HTMLElement, user: User): void {
  const userPerms: string[] = (user.role as { permissions?: string[] } | undefined)?.permissions ?? [];
  const canAccess = (perm?: string) => !perm || userPerms.includes('*') || userPerms.includes(perm);

  const currentRoute = location.hash.slice(1).split('?')[0] || '/dashboard';
  const inGroup = (g: NavGroup) => g.items.some(i =>
    currentRoute === i.route || (currentRoute.startsWith(i.route + '/') && i.route !== '/'));

  const navItem = (item: NavItem) => `
    <a class="nav-item" data-route="${item.route}" href="#${item.route}">
      <i class="ti ${item.icon}"></i><span>${esc(item.label)}</span>
    </a>`;

  const navHtml = NAV_GROUPS.map(group => {
    const visible = group.items.filter(i => canAccess(i.permission));
    if (visible.length === 0) return '';

    if (group.primary) {
      return `
        <div class="nav-group-label">${esc(group.title)}</div>
        ${visible.map(navItem).join('')}`;
    }

    const openClass = inGroup(group) ? ' nav-group-open' : '';
    return `
      <div class="nav-group${openClass}" data-group="${esc(group.title)}">
        <div class="nav-group-header">
          <span class="nav-group-header-label">${esc(group.title)}</span>
          ${CHEVRON_SVG}
        </div>
        <div class="nav-group-items"><div>
          ${visible.map(navItem).join('')}
        </div></div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="padding:16px 16px 8px">
      <div style="display:flex;align-items:center;gap:10px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        ${PEOPLE_ICON_SVG}
        <div>
          <div style="font-size:18px;font-weight:700;color:var(--amber);line-height:1">Gero</div>
          <div style="font-size:10px;color:var(--text-3);line-height:1.2">Pessoas que geram resultados.</div>
        </div>
      </div>
    </div>
    <nav class="sidebar-nav" id="sidebar-nav">${navHtml}</nav>
  `;

  // Track which group starts open (matches the active route)
  openGroupEl = container.querySelector<HTMLElement>('.nav-group.nav-group-open');

  // Accordion toggle
  container.querySelectorAll<HTMLElement>('.nav-group-header').forEach(header => {
    header.addEventListener('click', () => {
      const groupWrap = header.closest<HTMLElement>('.nav-group');
      if (groupWrap) toggleGroup(groupWrap);
    });
  });

  // Navegação por item
  container.querySelectorAll<HTMLElement>('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.route ?? '/dashboard');
    });
  });

  // Realce da rota ativa + auto-expansão do grupo correspondente
  function updateActive(): void {
    const current = location.hash.slice(1).split('?')[0] || '/dashboard';
    container.querySelectorAll<HTMLElement>('.nav-item').forEach(el => {
      const route = el.dataset.route ?? '';
      const isActive = current === route || (current.startsWith(route + '/') && route !== '/');
      el.classList.toggle('active', isActive);
      if (isActive) {
        const groupWrap = el.closest<HTMLElement>('.nav-group');
        if (groupWrap) openGroup(groupWrap);
      }
    });
  }

  updateActive();
  window.addEventListener('hashchange', updateActive);
}
