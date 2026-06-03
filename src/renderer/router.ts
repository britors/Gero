type PageRenderer = (container: HTMLElement, params: Record<string, string>) => void | Promise<void>;

const routes = new Map<string, PageRenderer>();
let _content: HTMLElement | null = null;

export function registerRoute(path: string, renderer: PageRenderer): void {
  routes.set(path, renderer);
}

export function navigate(path: string): void {
  const normalized = path.startsWith('/') ? path : '/' + path;
  location.hash = '#' + normalized;
}

function parseHash(): { path: string; params: Record<string, string> } {
  const raw = location.hash.slice(1) || '/dashboard';
  const [pathPart, queryPart] = raw.split('?');
  const params: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      const [k, v] = pair.split('=');
      if (k) params[k] = decodeURIComponent(v ?? '');
    }
  }
  return { path: pathPart ?? '/dashboard', params };
}

async function render(): Promise<void> {
  const container = _content ?? document.getElementById('content');
  if (!container) return;
  _content = container;

  const { path, params } = parseHash();

  // Match exact path first, then pattern match (e.g. /employees/:id)
  let handler = routes.get(path);
  let resolvedParams = params;

  if (!handler) {
    for (const [pattern, fn] of routes) {
      if (pattern.includes(':')) {
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');
        if (patternParts.length !== pathParts.length) continue;
        const matched: Record<string, string> = { ...params };
        let ok = true;
        for (let i = 0; i < patternParts.length; i++) {
          const pp = patternParts[i]!;
          const vp = pathParts[i]!;
          if (pp.startsWith(':')) {
            matched[pp.slice(1)] = vp;
          } else if (pp !== vp) {
            ok = false;
            break;
          }
        }
        if (ok) { handler = fn; resolvedParams = matched; break; }
      }
    }
  }

  if (!handler) {
    container.innerHTML = `<div style="padding:40px;color:#9CA3AF;text-align:center">
      <i class="ti ti-error-404" style="font-size:48px;display:block;margin-bottom:12px"></i>
      Página não encontrada: ${path}
    </div>`;
    return;
  }

  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>';
  try {
    await handler(container, resolvedParams);
  } catch (err) {
    console.error('[router] Page render error:', err);
    container.innerHTML = `<div style="padding:40px;color:#D85A30">Erro ao carregar página: ${err instanceof Error ? err.message : String(err)}</div>`;
  }
}

export function initRouter(): void {
  // Register all page routes
  import('./pages/dashboard')    .then(m => registerRoute('/dashboard',        m.renderDashboard));
  import('./pages/employees')    .then(m => registerRoute('/employees',        m.renderEmployees));
  import('./pages/employee-detail').then(m => registerRoute('/employees/:id', m.renderEmployeeDetail));
  import('./pages/departments')  .then(m => registerRoute('/departments',      m.renderDepartments));
  import('./pages/positions')    .then(m => registerRoute('/positions',        m.renderPositions));
  import('./pages/payroll')      .then(m => registerRoute('/payroll',          m.renderPayroll));
  import('./pages/payslip')      .then(m => registerRoute('/payslip',          m.renderPayslip));
  import('./pages/rescisao')     .then(m => registerRoute('/rescisao',         m.renderRescisao));
  import('./pages/timesheet')    .then(m => registerRoute('/timesheet',        m.renderTimesheet));
  import('./pages/vacation')     .then(m => registerRoute('/vacation',         m.renderVacation));
  import('./pages/recruitment')  .then(m => registerRoute('/recruitment',      m.renderRecruitment));
  import('./pages/candidate-detail').then(m => registerRoute('/candidates/:id', m.renderCandidateDetail));
  import('./pages/evaluation')   .then(m => registerRoute('/evaluation',       m.renderEvaluation));
  import('./pages/benefits')     .then(m => registerRoute('/benefits',         m.renderBenefits));
  import('./pages/documents')    .then(m => registerRoute('/documents',        m.renderDocuments));
  import('./pages/reports')      .then(m => registerRoute('/reports',          m.renderReports));
  import('./pages/studio')       .then(m => registerRoute('/studio',           m.renderStudio));
  import('./pages/settings')     .then(m => registerRoute('/settings',         m.renderSettings));

  window.addEventListener('hashchange', () => render());
}

// Expose for use after initRouter
export { render as renderCurrentRoute };
