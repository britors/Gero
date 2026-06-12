interface PgConfig {
  host:     string;
  port:     number;
  database: string;
  user:     string;
  password: string;
}

interface CompanyProfile {
  nomeFantasia: string;
  razaoSocial:  string;
  cnpj:         string;
  telefone?:    string;
  email?:       string;
  logradouro?:  string;
  numero?:      string;
  bairro?:      string;
  cidade?:      string;
  estado?:      string;
  cep?:         string;
}

// ─── State ────────────────────────────────────────────────────────────────────

let dbTestPassed = false;
let dbIsExisting = false;

window.toggleDbType = (type: 'postgres' | 'sqlite') => {
  const isPg = type === 'postgres';
  document.getElementById('pg-config')!.style.display = isPg ? 'grid' : 'none';
  document.getElementById('sqlite-config')!.style.display = isPg ? 'none' : 'block';
  document.getElementById('opt-postgres')!.style.borderColor = isPg ? '#EF9F27' : '#2A2D3A';
  document.getElementById('opt-postgres')!.style.background = isPg ? '#1A1204' : '#0F1117';
  document.getElementById('opt-sqlite')!.style.borderColor = isPg ? '#2A2D3A' : '#EF9F27';
  document.getElementById('opt-sqlite')!.style.background = isPg ? '#0F1117' : '#1A1204';
  
  dbTestPassed = false;
  document.getElementById('db-test-status')!.textContent = '';
  document.getElementById('pg-exists-banner')!.classList.remove('show');
  document.getElementById('pg-new-banner')!.classList.remove('show');
  updateFooter(1);
};
declare global { interface Window { toggleDbType: (type: 'postgres' | 'sqlite') => void; } }


// ─── DOM helpers ──────────────────────────────────────────────────────────────

function showError(id: string, msg: string): void {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function hideError(id: string): void {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
function getVal(id: string): string {
  return (document.getElementById(id) as HTMLInputElement)?.value.trim() ?? '';
}
// Senhas não são trimadas: preservam exatamente o que foi digitado (consistente com o login).
function getRaw(id: string): string {
  return (document.getElementById(id) as HTMLInputElement)?.value ?? '';
}
function applyMask(el: HTMLInputElement, fn: (v: string) => string): void {
  el.addEventListener('input', () => { el.value = fn(el.value); });
}

function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, '$1.$2')
          .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/\.(\d{3})(\d)/, '.$1/$2')
          .replace(/(\d{4})(\d)/, '$1-$2');
}
function maskCEP(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}
function validateCNPJ(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (w: number[]) => w.reduce((s, x, i) => s + parseInt(d[i]!) * x, 0);
  const r1 = calc([5,4,3,2,9,8,7,6,5,4,3,2]) % 11;
  if (parseInt(d[12]!) !== (r1 < 2 ? 0 : 11 - r1)) return false;
  const r2 = calc([6,5,4,3,2,9,8,7,6,5,4,3,2]) % 11;
  return parseInt(d[13]!) === (r2 < 2 ? 0 : 11 - r2);
}

// ─── Footer ───────────────────────────────────────────────────────────────────

const ICON_NEXT  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>`;
const ICON_CHECK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>`;

type FooterCfg = { backVisible: boolean; label: string; icon?: 'next'|'check'; disabled: boolean; hidden?: boolean; success?: boolean };

function setFooter(cfg: FooterCfg): void {
  const footer  = document.getElementById('shared-footer')!;
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  const btnAct  = document.getElementById('btn-action') as HTMLButtonElement;

  footer.style.display = cfg.hidden ? 'none' : '';
  btnBack.classList.toggle('hidden', !cfg.backVisible);
  btnAct.disabled = cfg.disabled;
  btnAct.className = `btn ${cfg.success ? 'btn-success' : 'btn-primary'}`;
  const icon = cfg.icon === 'check' ? ICON_CHECK : ICON_NEXT;
  btnAct.innerHTML = `${cfg.label} ${icon}`;
}

// ─── Step display & nav ───────────────────────────────────────────────────────

function showStep(n: number): void {
  document.querySelectorAll<HTMLElement>('.step').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${n}`)?.classList.add('active');
  updateNav(n);
  updateFooter(n);
}

function updateNav(active: number): void {
  [1, 2, 3].forEach((s, idx) => {
    const item = document.getElementById(`nav-${s}`)!;
    item.classList.remove('active', 'done');
    const numEl = item.querySelector('.lp-num')!;
    if (s < active) {
      item.classList.add('done');
      numEl.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>`;
    } else {
      item.classList.toggle('active', s === active);
      numEl.textContent = String(idx + 1);
    }
  });
}

function updateFooter(step: number): void {
  switch (step) {
    case 1:
      if (!dbTestPassed) {
        setFooter({ backVisible: false, label: 'Continuar', disabled: true });
      } else if (dbIsExisting) {
        setFooter({ backVisible: false, label: 'Conectar ao banco existente', icon: 'check', disabled: false, success: true });
      } else {
        setFooter({ backVisible: false, label: 'Continuar', disabled: false });
      }
      break;
    case 2: setFooter({ backVisible: true,  label: 'Continuar', disabled: false }); break;
    case 3: setFooter({ backVisible: true,  label: 'Finalizar configuração', icon: 'check', disabled: false }); break;
    case 4: setFooter({ backVisible: false, label: '', disabled: true, hidden: true }); break;
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function handleAction(): void {
  const id = document.querySelector('.step.active')?.id ?? 'step-1';
  const n  = parseInt(id.replace('step-', ''), 10);
  switch (n) {
    case 1: onNext1(); break;
    case 2: onNext2(); break;
    case 3: void onFinish(); break;
  }
}

function handleBack(): void {
  const id = document.querySelector('.step.active')?.id ?? 'step-1';
  const n  = parseInt(id.replace('step-', ''), 10);
  if (n === 2) showStep(1);
  if (n === 3) showStep(2);
}

// ─── Step 1: PostgreSQL ───────────────────────────────────────────────────────

function onNext1(): void {
  if (!dbTestPassed) return;
  dbIsExisting ? void finalizeExisting() : showStep(2);
}

function initStep1(): void {
  document.getElementById('test-db')!.addEventListener('click', async () => {
    hideError('error-step1');
    const btn      = document.getElementById('test-db') as HTMLButtonElement;
    const statusEl = document.getElementById('db-test-status')!;
    const existsBanner = document.getElementById('pg-exists-banner')!;
    const newBanner    = document.getElementById('pg-new-banner')!;

    btn.disabled = true;
    statusEl.textContent = 'Testando…';
    statusEl.className = 'pg-status testing';
    existsBanner.classList.remove('show');
    newBanner.classList.remove('show');

    const dbType = (document.querySelector('input[name="db-type"]:checked') as HTMLInputElement).value;
    const dbCfg: any = dbType === 'postgres' ? {
      host:     getVal('pg-host') || 'localhost',
      port:     parseInt(getVal('pg-port') || '5432', 10),
      database: getVal('pg-database') || 'gero',
      user:     getVal('pg-user') || 'postgres',
      password: getRaw('pg-password'),
    } : {
      file: getVal('sqlite-file') || 'gero.db'
    };

    try {
      const connRes = await window.gero.invoke('setup:checkPgConnection', { type: dbType, ...dbCfg }) as { ok: boolean; error?: string };
      if (!connRes.ok) {
        dbTestPassed = false;
        statusEl.textContent = `Falha: ${connRes.error ?? 'Erro desconhecido'}`;
        statusEl.className = 'pg-status error';
        updateFooter(1);
        return;
      }

      statusEl.textContent = 'Conexão OK!';
      statusEl.className = 'pg-status ok';
      dbTestPassed = true;

      const existsRes = await window.gero.invoke('setup:checkPgExists', { type: dbType, ...dbCfg }) as { exists: boolean; userCount?: number };
      dbIsExisting = existsRes.exists;

      if (dbIsExisting) {
        document.getElementById('pg-exists-detail')!.textContent =
          `${existsRes.userCount} usuário(s) encontrado(s) — configure apenas a conexão.`;
        existsBanner.classList.add('show');
      } else {
        newBanner.classList.add('show');
      }
    } catch (err) {
      dbTestPassed = false;
      statusEl.textContent = `Erro: ${err instanceof Error ? err.message : String(err)}`;
      statusEl.className = 'pg-status error';
    } finally {
      btn.disabled = false;
      updateFooter(1);
    }
  });
}

// ─── Step 2: Company data ─────────────────────────────────────────────────────

function onNext2(): void {
  hideError('error-step2');
  const nomeFantasia = getVal('nome-fantasia');
  const razaoSocial  = getVal('razao-social');
  const cnpj         = getVal('cnpj');
  if (!nomeFantasia) return showError('error-step2', 'Nome Fantasia é obrigatório.');
  if (!razaoSocial)  return showError('error-step2', 'Razão Social é obrigatória.');
  if (!cnpj)         return showError('error-step2', 'CNPJ é obrigatório.');
  if (!validateCNPJ(cnpj)) return showError('error-step2', 'CNPJ inválido. Verifique os dígitos.');
  showStep(3);
}

function initStep2(): void {
  applyMask(document.getElementById('cnpj') as HTMLInputElement, maskCNPJ);
  applyMask(document.getElementById('cep')  as HTMLInputElement, maskCEP);
}

// ─── Step 3: Admin user ───────────────────────────────────────────────────────

async function onFinish(): Promise<void> {
  hideError('error-step3');
  const name     = getVal('admin-name');
  const email    = getVal('admin-email').toLowerCase();
  const password = getRaw('admin-password');
  const confirm  = getRaw('admin-confirm');

  if (!name)  return showError('error-step3', 'Nome é obrigatório.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return showError('error-step3', 'E-mail inválido.');
  if (password.length < 6)
    return showError('error-step3', 'Senha deve ter ao menos 6 caracteres.');
  if (password !== confirm)
    return showError('error-step3', 'As senhas não coincidem.');

  const dbType = (document.querySelector('input[name="db-type"]:checked') as HTMLInputElement).value;
  const dbCfg: any = dbType === 'postgres' ? {
    host:     getVal('pg-host') || 'localhost',
    port:     parseInt(getVal('pg-port') || '5432', 10),
    database: getVal('pg-database') || 'gero',
    user:     getVal('pg-user') || 'postgres',
    password: getRaw('pg-password'),
  } : {
    file: getVal('sqlite-file') || 'gero.db'
  };

  const company: CompanyProfile = {
    nomeFantasia: getVal('nome-fantasia'),
    razaoSocial:  getVal('razao-social'),
    cnpj:         getVal('cnpj'),
    logradouro:   getVal('logradouro') || undefined,
    numero:       getVal('numero') || undefined,
    bairro:       getVal('bairro') || undefined,
    cidade:       getVal('cidade') || undefined,
    estado:       getVal('estado') || undefined,
    cep:          getVal('cep') || undefined,
    telefone:     getVal('telefone') || undefined,
    email:        getVal('company-email') || undefined,
  };

  await complete({ type: dbType, ...dbCfg }, company, { name, email, password });
}

// ─── Finalize: existing DB ────────────────────────────────────────────────────

async function finalizeExisting(): Promise<void> {
  const dbType = (document.querySelector('input[name="db-type"]:checked') as HTMLInputElement).value;
  const dbCfg: any = dbType === 'postgres' ? {
    host:     getVal('pg-host') || 'localhost',
    port:     parseInt(getVal('pg-port') || '5432', 10),
    database: getVal('pg-database') || 'gero',
    user:     getVal('pg-user') || 'postgres',
    password: getRaw('pg-password'),
  } : {
    file: getVal('sqlite-file') || 'gero.db'
  };
  await complete({ type: dbType, ...dbCfg }, undefined, undefined);
}

async function complete(
  db: any,
  company: CompanyProfile | undefined,
  admin: { name: string; email: string; password: string } | undefined,
): Promise<void> {
  showStep(4);
  try {
    await window.gero.invoke('setup:complete', {
      db,
      company,
      admin,
      isExistingDb: dbIsExisting,
      setupCompletedAt: new Date().toISOString(),
    });
  } catch (err) {
    const backStep = dbIsExisting ? 1 : 3;
    showStep(backStep);
    showError(`error-step${backStep}`, `Erro: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initStep1();
  initStep2();

  document.getElementById('btn-action')!.addEventListener('click', handleAction);
  document.getElementById('btn-back')!.addEventListener('click', handleBack);

  document.getElementById('swc-min')?.addEventListener('click',   () => window.gero.invoke('window:minimize'));
  document.getElementById('swc-max')?.addEventListener('click',   () => window.gero.invoke('window:toggleMaximize'));
  document.getElementById('swc-close')?.addEventListener('click', () => window.gero.invoke('window:close'));

  showStep(1);
});
