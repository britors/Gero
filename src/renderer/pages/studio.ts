import type { InstalledModule } from '../../shared/types';
import { getToken, getUser } from '../index';
import { showToast } from '../components/toast';
import { statusBadge } from '../components/badge';

const MONACO_URL = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs';

export async function renderStudio(container: HTMLElement): Promise<void> {
  const user = getUser();
  const userPerms: string[] = (user.role as { permissions?: string[] } | undefined)?.permissions ?? [];
  const hasStudio = userPerms.includes('*') || userPerms.includes('studio:access');

  if (!hasStudio) {
    container.innerHTML = `
      <div style="padding:60px;text-align:center;color:#9CA3AF">
        <i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:16px;color:#6B7280"></i>
        <div style="font-size:18px;font-weight:600;margin-bottom:8px">Acesso Restrito</div>
        <p>O Gero Studio está disponível apenas para <strong>administradores</strong> e <strong>desenvolvedores</strong>.</p>
      </div>`;
    return;
  }

  const token = getToken();
  let activeFile = '';
  let currentModulePath = '';

  async function load(): Promise<void> {
    const modules = await window.gero.invoke('modules:list', token) as InstalledModule[];

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;height:calc(100vh - 52px - 48px)">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-shrink:0">
          <h1 style="font-size:20px;font-weight:700">
            <i class="ti ti-code" style="color:#EF9F27;margin-right:8px"></i>
            Gero Studio
          </h1>
          <div style="display:flex;gap:8px">
            <button id="btn-scaffold" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid #3B6FE844;background:#3B6FE811;color:#3B6FE8;cursor:pointer;font-size:13px">
              <i class="ti ti-file-plus"></i> Novo Módulo
            </button>
            <button id="btn-install" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:none;background:#EF9F27;color:#fff;cursor:pointer;font-size:13px;font-weight:600">
              <i class="ti ti-package"></i> Instalar
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:280px 1fr;gap:12px;flex:1;overflow:hidden">
          <!-- Modules sidebar -->
          <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow-y:auto">
            <div style="padding:12px 16px;border-bottom:1px solid #2A2D3A;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase">
              Módulos Instalados (${modules.length})
            </div>
            ${modules.length === 0
              ? `<div style="padding:20px;text-align:center;color:#6B7280;font-size:13px">Nenhum módulo instalado.</div>`
              : modules.map(m => `
                  <div class="module-item" data-id="${m.id}" data-path="${m.source_path}" style="padding:12px 14px;border-bottom:1px solid #2A2D3A22;cursor:pointer;transition:background 0.12s">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                      <span style="font-weight:500;font-size:13px">${m.manifest.name}</span>
                      ${statusBadge(m.status)}
                    </div>
                    <div style="font-size:11px;color:#6B7280">v${m.manifest.version} &bull; ${m.manifest_id}</div>
                    <div style="display:flex;gap:6px;margin-top:8px">
                      <button class="btn-toggle-mod" data-id="${m.id}" style="padding:3px 8px;border-radius:4px;border:1px solid #2A2D3A;background:transparent;color:${m.status==='active'?'#D85A30':'#1D9E75'};cursor:pointer;font-size:11px">
                        ${m.status==='active'?'Desativar':'Ativar'}
                      </button>
                      <button class="btn-logs-mod" data-mid="${m.manifest_id}" style="padding:3px 8px;border-radius:4px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer;font-size:11px">Logs</button>
                      <button class="btn-open-mod" data-path="${m.source_path}" style="padding:3px 8px;border-radius:4px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer;font-size:11px">Abrir</button>
                    </div>
                  </div>`).join('')}
          </div>

          <!-- Editor area -->
          <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden;display:flex;flex-direction:column">
            <div id="editor-toolbar" style="padding:8px 12px;border-bottom:1px solid #2A2D3A;display:flex;align-items:center;gap:8px;font-size:12px;color:#9CA3AF">
              <i class="ti ti-code" style="font-size:14px"></i>
              <span id="editor-filename">${activeFile || 'Nenhum arquivo aberto'}</span>
              ${activeFile ? `<button id="btn-save-file" style="margin-left:auto;padding:4px 10px;border-radius:6px;border:none;background:#EF9F27;color:#fff;cursor:pointer;font-size:12px;font-weight:600">Salvar</button>` : ''}
            </div>
            <div id="monaco-container" style="flex:1"></div>
          </div>
        </div>
      </div>
      <style>.module-item:hover { background:#2A2D3A22 !important; }</style>
    `;

    attachHandlers(modules);
    loadMonaco();
  }

  function loadMonaco(): void {
    const monacoContainer = document.getElementById('monaco-container')!;
    if (!activeFile) {
      monacoContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#6B7280;gap:12px">
          <i class="ti ti-code" style="font-size:48px"></i>
          <div style="font-size:13px">Selecione um módulo e abra um arquivo para editar</div>
          <div style="font-size:11px;color:#6B7280">Módulos em: ~/gero-modulos/</div>
        </div>`;
      return;
    }

    const script = document.createElement('script');
    script.src = `${MONACO_URL}/loader.js`;
    script.onload = () => {
      (window as Window & typeof globalThis & { require: Function }).require.config({ paths: { vs: MONACO_URL } });
      (window as Window & typeof globalThis & { require: Function }).require(['vs/editor/editor.main'], (monaco: unknown) => {
        const m = monaco as {
          editor: { create: Function; setTheme: Function };
          languages: { typescript: { typescriptDefaults: { addExtraLib: Function } } };
        };
        m.editor.setTheme('vs-dark');
        const editor = m.editor.create(monacoContainer, {
          value: '// Carregando...',
          language: 'javascript',
          theme: 'vs-dark',
          fontSize: 13,
          minimap: { enabled: false },
          padding: { top: 12 },
        });

        // Load file content
        window.gero.invoke('studio:readFile', getToken(), activeFile).then(content => {
          editor.setValue(content as string);
        }).catch(() => editor.setValue('// Não foi possível carregar o arquivo.'));

        // Save handler
        document.getElementById('btn-save-file')?.addEventListener('click', async () => {
          try {
            await window.gero.invoke('studio:writeFile', getToken(), activeFile, editor.getValue());
            showToast('Arquivo salvo!', 'success');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Erro ao salvar', 'error');
          }
        });
      });
    };
    document.head.appendChild(script);
  }

  function attachHandlers(modules: InstalledModule[]): void {
    document.getElementById('btn-scaffold')?.addEventListener('click', async () => {
      const name = prompt('Nome do módulo:');
      if (!name) return;
      try {
        const result = await window.gero.invoke('studio:scaffold', token, name) as { dir: string };
        showToast(`Módulo criado em ${result.dir}`, 'success');
        load();
      } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
    });

    document.getElementById('btn-install')?.addEventListener('click', async () => {
      const path = prompt('Caminho do diretório do módulo:');
      if (!path) return;
      try {
        await window.gero.invoke('modules:install', token, path);
        showToast('Módulo instalado!', 'success');
        load();
      } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
    });

    document.querySelectorAll('.btn-toggle-mod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const status = await window.gero.invoke('modules:toggle', token, btn.getAttribute('data-id')!) as string;
          showToast(`Módulo ${status === 'active' ? 'ativado' : 'desativado'}`, 'success');
          load();
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    document.querySelectorAll('.btn-logs-mod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const logs = await window.gero.invoke('studio:getLogs', token, btn.getAttribute('data-mid')!) as string[];
        alert(logs.length ? logs.join('\n') : 'Sem logs.');
      });
    });

    document.querySelectorAll('.btn-open-mod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const modulePath = btn.getAttribute('data-path')!;
        currentModulePath = modulePath;
        activeFile = modulePath + '/index.js';
        load();
      });
    });
  }

  await load();
}
