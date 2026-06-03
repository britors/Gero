import fs from 'fs';
import path from 'path';
import { query, execute } from '../database';
import { createSandbox, runInSandbox } from './sandbox';
import { buildSdk } from './sdk-bridge';
import { InstalledModule, ModuleManifest } from '../../shared/types';

const APP_VERSION = '1.0.0';
const activeModules = new Map<string, { manifest: ModuleManifest; cleanup?: () => void }>();
const moduleLogs = new Map<string, string[]>();

function appendLog(manifestId: string, line: string): void {
  if (!moduleLogs.has(manifestId)) moduleLogs.set(manifestId, []);
  const logs = moduleLogs.get(manifestId)!;
  logs.push(`[${new Date().toISOString()}] ${line}`);
  if (logs.length > 500) logs.splice(0, logs.length - 500);
}

export function validateManifest(raw: unknown): ModuleManifest {
  if (!raw || typeof raw !== 'object') throw new Error('Manifest must be an object');
  const m = raw as Record<string, unknown>;
  if (typeof m['id'] !== 'string' || !m['id']) throw new Error('Manifest missing required field: id');
  if (typeof m['name'] !== 'string' || !m['name']) throw new Error('Manifest missing required field: name');
  if (typeof m['version'] !== 'string' || !m['version']) throw new Error('Manifest missing required field: version');
  if (typeof m['main'] !== 'string' || !m['main']) throw new Error('Manifest missing required field: main');
  return m as unknown as ModuleManifest;
}

export async function loadActiveModules(): Promise<void> {
  const rows = await query<InstalledModule>(
    `SELECT * FROM installed_modules WHERE status = 'active' ORDER BY installed_at`
  );
  for (const mod of rows) {
    await activateModule(mod);
  }
}

export async function activateModule(mod: InstalledModule): Promise<void> {
  const mainPath = path.join(mod.source_path, mod.manifest.main);
  if (!fs.existsSync(mainPath)) {
    await execute(`UPDATE installed_modules SET status='error', error_message=$1 WHERE id=$2`,
      [`Main file not found: ${mainPath}`, mod.id]);
    return;
  }

  try {
    const code = fs.readFileSync(mainPath, 'utf-8');
    const sdk = buildSdk(mod.manifest_id, APP_VERSION);
    const ctx = createSandbox(sdk);
    runInSandbox(code, ctx, mainPath);

    activeModules.set(mod.manifest_id, { manifest: mod.manifest });
    appendLog(mod.manifest_id, `Module activated: ${mod.manifest.name} v${mod.manifest.version}`);
    await execute(`UPDATE installed_modules SET status='active', error_message=NULL WHERE id=$1`, [mod.id]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appendLog(mod.manifest_id, `Activation error: ${msg}`);
    await execute(`UPDATE installed_modules SET status='error', error_message=$1 WHERE id=$2`, [msg, mod.id]);
  }
}

export async function deactivateModule(manifestId: string): Promise<void> {
  const entry = activeModules.get(manifestId);
  if (entry?.cleanup) {
    try { entry.cleanup(); } catch { /* ignore */ }
  }
  activeModules.delete(manifestId);
  appendLog(manifestId, 'Module deactivated');
}

export function getModuleLogs(manifestId: string): string[] {
  return moduleLogs.get(manifestId) ?? [];
}

export function getActiveModules(): ModuleManifest[] {
  return Array.from(activeModules.values()).map(v => v.manifest);
}
