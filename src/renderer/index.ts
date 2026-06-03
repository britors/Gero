import type { User } from '../shared/types';
import { initRouter, navigate } from './router';
import { renderSidebar } from './components/sidebar';
import { renderTopbar } from './components/topbar';
import { showToast } from './components/toast';

// ─── App state ────────────────────────────────────────────────────────────────

let _token: string | null = null;
let _user: User | null = null;

export function getToken(): string {
  if (!_token) throw new Error('Not authenticated');
  return _token;
}
export function getUser(): User { return _user!; }
export function isAuthenticated(): boolean { return !!_token && !!_user; }

export async function login(email: string, password: string): Promise<void> {
  const result = await (window as Window & typeof globalThis & { gero: { invoke: Function } }).gero.invoke('auth:login', email, password) as { token: string; user: User };
  _token = result.token;
  _user = result.user;
  localStorage.setItem('gero_token', _token);
  initApp();
}

export async function logout(): Promise<void> {
  if (_token) {
    try { await (window as Window & typeof globalThis & { gero: { invoke: Function } }).gero.invoke('auth:logout', _token); } catch { /* ignore */ }
  }
  _token = null;
  _user = null;
  localStorage.removeItem('gero_token');
  showLoginPage();
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  const saved = localStorage.getItem('gero_token');
  if (saved) {
    try {
      const user = await gero.invoke('auth:me', saved) as User | null;
      if (user) {
        _token = saved;
        _user = user;
        initApp();
        return;
      }
    } catch { /* expired */ }
    localStorage.removeItem('gero_token');
  }
  showLoginPage();
}

function showLoginPage(): void {
  const app = document.getElementById('app')!;
  const loading = document.getElementById('loading-screen')!;
  loading.classList.add('hidden');
  app.style.display = 'none';

  // Render login directly in body
  document.body.insertAdjacentHTML('beforeend', '<div id="login-root"></div>');
  import('./pages/login').then(m => m.renderLoginPage(document.getElementById('login-root')!));
}

function initApp(): void {
  const loading = document.getElementById('loading-screen')!;
  const app = document.getElementById('app')!;
  loading.classList.add('hidden');
  app.style.display = 'flex';

  // Remove login if present
  document.getElementById('login-root')?.remove();

  // Render shell
  const sidebar = document.getElementById('sidebar')!;
  const topbar  = document.getElementById('topbar')!;
  renderSidebar(sidebar, _user!);
  renderTopbar(topbar, _user!, _token!);

  // Init router and SDK event listeners
  initRouter();
  setupModuleEvents();

  navigate(location.hash.slice(1) || '/dashboard');
}

function setupModuleEvents(): void {
  (window as Window & typeof globalThis & { gero: { on: Function } }).gero.on('module:toast', (data: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => {
    showToast(data.message, data.type);
  });
  (window as Window & typeof globalThis & { gero: { on: Function } }).gero.on('module:navigate', (data: { route: string }) => {
    navigate(data.route);
  });
}

// Global alias for convenience
declare global {
  interface Window {
    gero: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, handler: (...args: unknown[]) => void) => void;
      off: (channel: string, handler: (...args: unknown[]) => void) => void;
    };
    __geroToken: () => string;
    __geroUser: () => User;
    __geroLogout: () => Promise<void>;
    __geroNavigate: (route: string) => void;
  }
}
const gero = (window as Window).gero;

window.__geroToken = getToken;
window.__geroUser  = getUser;
window.__geroLogout = logout;

window.addEventListener('DOMContentLoaded', () => boot());
