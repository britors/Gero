import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { query, queryOne, execute } from '../database';
import { validateSession, hasPermission } from '../middleware/permissions';
import { activateModule, deactivateModule, getModuleLogs, validateManifest } from '../runtime/module-loader';
import { InstalledModule, ModuleManifest } from '../../shared/types';

const MODULES_DIR = path.join(os.homedir(), 'gero-modulos');

export function registerModuleHandlers(): void {
  ipcMain.handle('modules:list', async (_e, token: string) => {
    await validateSession(token);
    return query<InstalledModule>('SELECT * FROM installed_modules ORDER BY installed_at DESC');
  });

  ipcMain.handle('modules:install', async (_e, token: string, sourcePath: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'studio:install_module')) throw new Error('Sem permissão');

    const manifestPath = path.join(sourcePath, 'gero-module.json');
    if (!fs.existsSync(manifestPath)) throw new Error('gero-module.json não encontrado');

    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const manifest: ModuleManifest = validateManifest(raw);

    const existing = await queryOne<InstalledModule>('SELECT * FROM installed_modules WHERE manifest_id=$1', [manifest.id]);

    if (existing) {
      await execute(
        `UPDATE installed_modules SET manifest=$1, source_path=$2, status='inactive', updated_at=now() WHERE id=$3`,
        [JSON.stringify(manifest), sourcePath, existing.id]
      );
      return existing.id;
    }

    const row = await queryOne<InstalledModule>(`
      INSERT INTO installed_modules (manifest_id, manifest, source_path, status, installed_by)
      VALUES ($1,$2,$3,'inactive',$4) RETURNING *
    `, [manifest.id, JSON.stringify(manifest), sourcePath, sess.id]);

    return row?.id;
  });

  ipcMain.handle('modules:uninstall', async (_e, token: string, moduleId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'studio:delete_module')) throw new Error('Sem permissão');

    const mod = await queryOne<InstalledModule>('SELECT * FROM installed_modules WHERE id=$1', [moduleId]);
    if (!mod) throw new Error('Módulo não encontrado');

    await deactivateModule(mod.manifest_id);
    return execute('DELETE FROM installed_modules WHERE id=$1', [moduleId]);
  });

  ipcMain.handle('modules:toggle', async (_e, token: string, moduleId: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'studio:install_module')) throw new Error('Sem permissão');

    const mod = await queryOne<InstalledModule>('SELECT * FROM installed_modules WHERE id=$1', [moduleId]);
    if (!mod) throw new Error('Módulo não encontrado');

    if (mod.status === 'active') {
      await deactivateModule(mod.manifest_id);
      await execute(`UPDATE installed_modules SET status='inactive', updated_at=now() WHERE id=$1`, [moduleId]);
      return 'inactive';
    } else {
      await activateModule(mod);
      return mod.status;
    }
  });
}

export function registerStudioHandlers(): void {
  ipcMain.handle('studio:scaffold', async (_e, token: string, moduleName: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'studio:create_module')) throw new Error('Sem permissão');

    const slug = moduleName.toLowerCase().replace(/\s+/g, '-');
    const dir = path.join(MODULES_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });

    const manifest: ModuleManifest = {
      id: `com.w3ti.gero.${slug}`,
      name: moduleName,
      version: '1.0.0',
      description: `Módulo ${moduleName}`,
      author: 'W3TI',
      main: 'index.js',
      permissions: ['data:read'],
    };

    fs.writeFileSync(path.join(dir, 'gero-module.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(dir, 'index.js'), `// Módulo ${moduleName}
// Acesse GeroSDK para interagir com o sistema

console.log('Módulo ${moduleName} carregado!');

GeroSDK.events.on('app.ready', () => {
  console.log('App pronto!');
});
`);

    return { dir, manifest };
  });

  ipcMain.handle('studio:readFile', async (_e, token: string, filePath: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'studio:access')) throw new Error('Sem permissão');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(MODULES_DIR) && !resolved.startsWith(path.join(os.homedir(), 'gero-modulos'))) {
      throw new Error('Acesso negado: fora do diretório de módulos');
    }
    return fs.readFileSync(resolved, 'utf-8');
  });

  ipcMain.handle('studio:writeFile', async (_e, token: string, filePath: string, content: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'studio:access')) throw new Error('Sem permissão');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(MODULES_DIR)) throw new Error('Acesso negado: fora do diretório de módulos');
    fs.writeFileSync(resolved, content, 'utf-8');
    return true;
  });

  ipcMain.handle('studio:runBuild', async (_e, token: string, modulePath: string) => {
    const sess = await validateSession(token);
    if (!sess || !hasPermission(sess.permissions, 'studio:create_module')) throw new Error('Sem permissão');
    // Placeholder — actual build is module's responsibility
    return { success: true, message: 'Build não configurado para este módulo' };
  });

  ipcMain.handle('studio:getLogs', async (_e, token: string, manifestId: string) => {
    await validateSession(token);
    return getModuleLogs(manifestId);
  });
}
