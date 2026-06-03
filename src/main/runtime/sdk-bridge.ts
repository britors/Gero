import { query as dbQuery, queryOne as dbQueryOne, execute as dbExecute } from '../database';
import { eventBus } from './event-bus';
import { GeroSDK } from '../../shared/types';
import { randomUUID } from 'node:crypto';

// Allowed SQL prefixes for module data API (read + limited write)
const ALLOWED_PREFIXES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'];

function validateSql(sql: string): void {
  const first = sql.trim().toUpperCase().split(/\s/)[0] ?? '';
  if (!ALLOWED_PREFIXES.includes(first)) {
    throw new Error(`SQL operation '${first}' not permitted in module sandbox`);
  }
  // Block system table access
  const lower = sql.toLowerCase();
  for (const t of ['_migrations', 'user_sessions', 'users', 'roles']) {
    if (lower.includes(t)) {
      throw new Error(`Access to system table '${t}' is not allowed in modules`);
    }
  }
}

// webContents reference set by main process after window creation
let _webContents: Electron.WebContents | null = null;
export function setSdkWebContents(wc: Electron.WebContents): void {
  _webContents = wc;
}

export function buildSdk(moduleId: string, appVersion: string): GeroSDK {
  return {
    data: {
      async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
        validateSql(sql);
        return dbQuery<T>(sql, params);
      },
      async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
        validateSql(sql);
        return dbQueryOne<T>(sql, params);
      },
      async execute(sql: string, params?: unknown[]): Promise<number> {
        validateSql(sql);
        return dbExecute(sql, params);
      },
    },
    ui: {
      showTab(target, tabId, context) {
        _webContents?.send('module:show-tab', { target, tabId, context, moduleId });
      },
      navigate(route, params) {
        _webContents?.send('module:navigate', { route, params });
      },
      toast(message, type = 'info') {
        _webContents?.send('module:toast', { message, type });
      },
      openModal(title, content) {
        _webContents?.send('module:modal', { title, content });
      },
    },
    events: {
      emit(event, payload) {
        eventBus.emit(event, payload, true);
      },
      on(event, handler) {
        return eventBus.on(event, handler);
      },
    },
    utils: {
      formatCurrency: (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      formatDate: (d) => new Date(d).toLocaleDateString('pt-BR'),
      uuid: () => randomUUID(),
    },
    meta: {
      moduleId,
      version: '1.0.0',
      appVersion,
    },
  };
}
