import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { reconfigurePool, runMigrations, closePool } from './database';
import { readSetupConfig } from './setup-config';
import { registerSetupHandlers } from './ipc/setup';
import { registerAuthHandlers } from './ipc/auth';
import { registerEmployeeHandlers } from './ipc/employees';
import { registerDepartmentHandlers } from './ipc/departments';
import { registerPositionHandlers } from './ipc/positions';
import { registerPayrollHandlers } from './ipc/payroll';
import { registerTimesheetHandlers } from './ipc/timesheet';
import { registerVacationHandlers } from './ipc/vacation';
import { registerRecruitmentHandlers } from './ipc/recruitment';
import { registerEvaluationHandlers } from './ipc/evaluation';
import { registerBenefitHandlers } from './ipc/benefits';
import { registerDocumentHandlers } from './ipc/documents';
import { registerModuleHandlers, registerStudioHandlers } from './ipc/modules';
import { registerDashboardHandlers } from './ipc/dashboard';
import { registerSearchHandlers } from './ipc/search';
import { loadActiveModules } from './runtime/module-loader';
import { setSdkWebContents } from './runtime/sdk-bridge';
import { eventBus, GeroEvents } from './runtime/event-bus';

app.setName('Gero');
loadEnv();

let mainWindow:   BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let setupWindow:  BrowserWindow | null = null;
let handlersRegistered = false;

function loadEnv(): void {
  const envPath = path.join(process.cwd(), '.env');
  try {
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 0) continue;
        const k = t.slice(0, eq).trim();
        const v = t.slice(eq + 1).trim();
        if (k && !(k in process.env)) process.env[k] = v;
      }
    }
  } catch {}
}

// ─── Window factories ─────────────────────────────────────────────────────────

function createSplashWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 700,
    height: 380,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: '#0F1117',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'splash.html'));
  win.once('ready-to-show', () => win.show());
  return win;
}

function createSetupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 860,
    height: 620,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: '#0F1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'setup.html'));
  win.once('ready-to-show', () => win.show());
  return win;
}

// ─── Register integration events ─────────────────────────────────────────────

function registerIntegrationEvents(): void {
  eventBus.on(GeroEvents.EMPLOYEE_HIRED, (emp: unknown) => {
    const employee = emp as { orbi_user_id?: string; filo_user_id?: string; id?: string };
    if (employee?.orbi_user_id) eventBus.emit('gero.employee_hired', { employee, target: 'orbi' });
    if (employee?.filo_user_id) eventBus.emit('gero.employee_hired', { employee, target: 'filo' });
  });
  eventBus.on(GeroEvents.EMPLOYEE_TERMINATED, (emp: unknown) => {
    const employee = emp as { orbi_user_id?: string; filo_user_id?: string };
    if (employee?.orbi_user_id) eventBus.emit('gero.employee_terminated', { employee, target: 'orbi' });
    if (employee?.filo_user_id) eventBus.emit('gero.employee_terminated', { employee, target: 'filo' });
  });
  eventBus.on(GeroEvents.PAYROLL_PAID, (data) => {
    eventBus.emit('gero.payroll_paid', data);
  });
}

// ─── Launch main app ──────────────────────────────────────────────────────────

async function launchMainApp(): Promise<void> {
  if (!handlersRegistered) {
    registerAuthHandlers();
    registerEmployeeHandlers();
    registerDepartmentHandlers();
    registerPositionHandlers();
    registerPayrollHandlers();
    registerTimesheetHandlers();
    registerVacationHandlers();
    registerRecruitmentHandlers();
    registerEvaluationHandlers();
    registerBenefitHandlers();
    registerDocumentHandlers();
    registerModuleHandlers();
    registerStudioHandlers();
    registerDashboardHandlers();
    registerSearchHandlers();
    registerIntegrationEvents();
    handlersRegistered = true;
  }

  try {
    await loadActiveModules();
    eventBus.emit(GeroEvents.APP_READY, { timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[gero] Falha ao carregar módulos:', err);
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0F1117',
    title: 'Gero',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) { splashWindow.close(); splashWindow = null; }
    if (setupWindow  && !setupWindow.isDestroyed())  { setupWindow.close();  setupWindow  = null; }
    mainWindow?.show();
    if (process.argv.includes('--dev')) mainWindow?.webContents.openDevTools();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window:maximized'));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:unmaximized'));
  setSdkWebContents(mainWindow.webContents);
}

// ─── Main entry ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await app.whenReady();

  // Window controls — registered once, available to all windows
  ipcMain.handle('window:minimize',       (ev) => BrowserWindow.fromWebContents(ev.sender)?.minimize());
  ipcMain.handle('window:toggleMaximize', (ev) => {
    const w = BrowserWindow.fromWebContents(ev.sender);
    w?.isMaximized() ? w.unmaximize() : w?.maximize();
  });
  ipcMain.handle('window:close',          (ev) => BrowserWindow.fromWebContents(ev.sender)?.close());

  splashWindow = createSplashWindow();

  const setupCfg = readSetupConfig();

  if (!setupCfg) {
    registerSetupHandlers(launchMainApp);
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) { splashWindow.close(); splashWindow = null; }
      setupWindow = createSetupWindow();
    }, 1600);
    return;
  }

  // Config exists — connect and migrate
  reconfigurePool(setupCfg.pg);
  try {
    await runMigrations();
  } catch (err) {
    console.error('[gero] Falha nas migrações:', err);
  }

  await launchMainApp();
}

app.on('window-all-closed', async () => {
  eventBus.emit(GeroEvents.APP_BEFORE_SHUTDOWN, {});
  await closePool();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void launchMainApp();
});

main().catch(console.error);
