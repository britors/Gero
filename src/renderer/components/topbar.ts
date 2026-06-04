import type { User, SearchResult } from '../../shared/types';
import { renderAvatar } from './avatar';
import { openModal } from './modal';
import { navigate } from '../router';
import { filterTCodes, executeTCode, type TCode } from './tcode';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/employees':   'Funcionários',
  '/departments': 'Departamentos',
  '/positions':   'Cargos',
  '/payroll':     'Folha de Pagamento',
  '/payslip':     'Holerites',
  '/rescisao':    'Rescisão',
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

const TX_PREFIX = '/t ';

let searchDebounce: ReturnType<typeof setTimeout>;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderTopbar(container: HTMLElement, user: User, token: string): void {
  const initials = user.avatar_initials ?? user.name.slice(0, 2).toUpperCase();
  const color    = user.avatar_color ?? '#EF9F27';

  container.innerHTML = `
    <span class="topbar-title" id="topbar-title">Dashboard</span>

    <div class="gs-wrap" id="gs-wrap">
      <span class="gs-mode-badge" id="gs-mode-badge" style="display:none">tx</span>
      <i class="ti ti-search gs-icon" id="gs-icon"></i>
      <input id="gs-input" class="gs-input" type="text"
        placeholder="Buscar ou /t código…" autocomplete="off" spellcheck="false" />
      <span class="gs-kbd" id="gs-kbd">Ctrl K</span>
      <div id="gs-dropdown" class="gs-dropdown" style="display:none"></div>
    </div>

    <div style="display:flex;align-items:center;gap:12px">
      <div id="user-menu-btn" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 8px;border-radius:8px;transition:background 0.15s"
           onmouseover="this.style.background='#2A2D3A'" onmouseout="this.style.background='transparent'">
        ${renderAvatar(initials, color, 30)}
        <span style="font-size:13px;font-weight:500;color:#fff;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(user.name)}</span>
        <i class="ti ti-chevron-down" style="font-size:12px;color:#6B7280"></i>
      </div>
    </div>

    <div class="win-controls" id="win-controls">
      <button class="wc-btn" id="wc-min" title="Minimizar" aria-label="Minimizar"><i class="ti ti-minus"></i></button>
      <button class="wc-btn" id="wc-max" title="Maximizar" aria-label="Maximizar"><i class="ti ti-square" id="wc-max-icon"></i></button>
      <button class="wc-btn wc-close" id="wc-close" title="Fechar" aria-label="Fechar"><i class="ti ti-x"></i></button>
    </div>
  `;

  // ── Título por rota ───────────────────────────────────────────────────────
  function updateTitle(): void {
    const path = location.hash.slice(1).split('?')[0] || '/dashboard';
    let title = 'Gero';
    for (const [route, label] of Object.entries(PAGE_TITLES)) {
      if (path === route || path.startsWith(route + '/')) { title = label; break; }
    }
    const el = document.getElementById('topbar-title');
    if (el) el.textContent = title;
  }
  updateTitle();
  window.addEventListener('hashchange', updateTitle);

  // ── Busca unificada ───────────────────────────────────────────────────────
  initUnifiedSearch(container, token);

  // ── Controles de janela ───────────────────────────────────────────────────
  initWindowControls(container);

  // ── Menu do usuário ───────────────────────────────────────────────────────
  document.getElementById('user-menu-btn')?.addEventListener('click', () => {
    const roleName = (user.role as { name?: string } | undefined)?.name ?? 'Usuário';
    openModal('Minha Conta', `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
        ${renderAvatar(initials, color, 48)}
        <div>
          <div style="font-size:16px;font-weight:600">${esc(user.name)}</div>
          <div style="font-size:13px;color:#9CA3AF">${esc(user.email)}</div>
          <div style="font-size:12px;color:#EF9F27;margin-top:2px;text-transform:capitalize">${esc(roleName)}</div>
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

// ─── Controles de janela (min / max / close) ──────────────────────────────────

function initWindowControls(root: HTMLElement): void {
  const maxIcon = root.querySelector('#wc-max-icon') as HTMLElement | null;
  const maxBtn  = root.querySelector('#wc-max')      as HTMLElement | null;

  root.querySelector('#wc-min')?.addEventListener('click', () => void window.gero.invoke('window:minimize'));
  maxBtn?.addEventListener('click', () => void window.gero.invoke('window:toggleMaximize'));
  root.querySelector('#wc-close')?.addEventListener('click', () => void window.gero.invoke('window:close'));

  // Mantém o ícone em sincronia com o estado real da janela (inclui maximizar via SO)
  function setMaximized(maximized: boolean): void {
    if (maxIcon) maxIcon.className = `ti ${maximized ? 'ti-copy' : 'ti-square'}`;
    maxBtn?.setAttribute('title', maximized ? 'Restaurar' : 'Maximizar');
    maxBtn?.setAttribute('aria-label', maximized ? 'Restaurar' : 'Maximizar');
  }
  window.gero.on('window:maximized',   () => setMaximized(true));
  window.gero.on('window:unmaximized', () => setMaximized(false));
}

// ─── Busca global + códigos de transação ──────────────────────────────────────

function isTxMode(val: string): boolean {
  return val.startsWith(TX_PREFIX);
}

function initUnifiedSearch(root: HTMLElement, token: string): void {
  const wrap     = root.querySelector('#gs-wrap')       as HTMLElement;
  const input    = root.querySelector('#gs-input')      as HTMLInputElement;
  const dropdown = root.querySelector('#gs-dropdown')   as HTMLElement;
  const kbd      = root.querySelector('#gs-kbd')        as HTMLElement;
  const badge    = root.querySelector('#gs-mode-badge') as HTMLElement;
  const icon     = root.querySelector('#gs-icon')       as HTMLElement;

  function hide(): void {
    dropdown.innerHTML = '';
    dropdown.style.display = 'none';
  }

  function setTxMode(active: boolean): void {
    wrap.classList.toggle('gs-tx-mode', active);
    badge.style.display = active ? 'flex' : 'none';
    icon.style.display  = active ? 'none' : '';
    kbd.style.display   = active ? 'none' : '';
  }

  function close(): void {
    hide();
    kbd.style.display = '';
    setTxMode(false);
  }

  input.addEventListener('focus', () => {
    kbd.style.display = 'none';
    if (isTxMode(input.value)) {
      setTxMode(true);
      renderTxDropdown(input.value.slice(TX_PREFIX.length).trim());
    }
  });

  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const val = input.value;

    if (isTxMode(val)) {
      setTxMode(true);
      renderTxDropdown(val.slice(TX_PREFIX.length).trim());
    } else {
      setTxMode(false);
      const q = val.trim();
      if (q.length < 2) { hide(); return; }
      searchDebounce = setTimeout(() => void runSearch(q), 200);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); input.value = ''; input.blur(); return; }
    if (e.key === 'Enter') {
      const first = dropdown.querySelector<HTMLElement>('[data-action]');
      first?.click();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      dropdown.querySelector<HTMLElement>('[data-action]')?.focus();
    }
  });

  dropdown.addEventListener('keydown', (e) => {
    const items = [...dropdown.querySelectorAll<HTMLElement>('[data-action]')];
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[idx + 1]?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); idx > 0 ? items[idx - 1]?.focus() : input.focus(); }
    if (e.key === 'Escape')    { close(); input.value = ''; input.blur(); }
  });

  // Ctrl+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  document.addEventListener('click', (e) => {
    if (!(e.target as Node).closest?.('#gs-wrap')) close();
  }, { capture: true });

  // ── Dropdown de códigos de transação ────────────────────────────────────────
  function renderTxDropdown(q: string): void {
    const matches: TCode[] = filterTCodes(q);

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="gs-empty">Código não encontrado — ex: <b>FN00</b>, <b>FP00</b></div>`;
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = matches.map(t => `
      <div class="gs-item gs-item-tx" data-action="${t.code}" tabindex="-1">
        <span class="tx-code">${t.code}</span>
        <i class="ti ${t.icon} tx-item-icon"></i>
        <div class="gs-item-info">
          <div class="gs-item-title">${t.label}</div>
          <div class="gs-item-sub">${t.description}</div>
        </div>
        ${t.create ? '<span class="tx-badge">criar</span>' : ''}
      </div>
    `).join('');
    dropdown.style.display = 'block';

    dropdown.querySelectorAll<HTMLElement>('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const code = el.dataset.action!;
        close();
        input.value = '';
        executeTCode(code);
      });
    });
  }

  // ── Dropdown de busca global ────────────────────────────────────────────────
  async function runSearch(q: string): Promise<void> {
    try {
      const res = await window.gero.invoke('search:global', token, q) as SearchResult;
      const total = res.employees.length + res.openings.length + res.candidates.length;

      if (total === 0) {
        dropdown.innerHTML = `<div class="gs-empty">Nenhum resultado para "<b>${esc(q)}</b>"</div>`;
        dropdown.style.display = 'block';
        return;
      }

      let html = '';

      if (res.employees.length) {
        html += gsSec('Funcionários');
        html += res.employees.map(e => gsItem(
          iconBox('amber', 'ti-user'),
          e.name,
          [e.position_title, e.department_name].filter(Boolean).join(' · ') + (e.is_active ? '' : ' · inativo'),
          `/employees/${e.id}`,
        )).join('');
      }
      if (res.openings.length) {
        html += gsSec('Vagas');
        html += res.openings.map(o => gsItem(
          iconBox('blue', 'ti-briefcase'),
          o.title,
          [o.department_name, txStatus(o.status)].filter(Boolean).join(' · '),
          '/recruitment',
        )).join('');
      }
      if (res.candidates.length) {
        html += gsSec('Candidatos');
        html += res.candidates.map(c => gsItem(
          iconBox('green', 'ti-user-search'),
          c.name,
          [c.opening_title, txStatus(c.status)].filter(Boolean).join(' · '),
          `/candidates/${c.id}`,
        )).join('');
      }

      dropdown.innerHTML = html;
      dropdown.style.display = 'block';

      dropdown.querySelectorAll<HTMLElement>('[data-action]').forEach(el => {
        el.addEventListener('click', () => {
          close();
          input.value = '';
          navigate(el.dataset.action!);
        });
      });
    } catch { /* silenciosamente ignora */ }
  }
}

// ─── Helpers de HTML ──────────────────────────────────────────────────────────

function gsSec(label: string): string {
  return `<div class="gs-section">${label}</div>`;
}
function gsItem(icon: string, title: string, sub: string, route: string): string {
  return `<div class="gs-item" data-action="${route}" tabindex="-1">${icon}<div class="gs-item-info"><div class="gs-item-title">${esc(title)}</div>${sub ? `<div class="gs-item-sub">${esc(sub)}</div>` : ''}</div></div>`;
}
function iconBox(color: 'amber' | 'blue' | 'green', icon: string): string {
  return `<div class="gs-icon-box gs-icon-${color}"><i class="ti ${icon}"></i></div>`;
}
function txStatus(s: string): string {
  return s ? s.replace(/_/g, ' ') : '';
}
