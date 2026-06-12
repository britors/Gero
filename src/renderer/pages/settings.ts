import type { User, Role } from '../../shared/types';
import { getToken, getUser } from '../index';
import { openModal, closeModal } from '../components/modal';
import { showToast } from '../components/toast';
import { renderAvatar } from '../components/avatar';
import { statusBadge } from '../components/badge';

export async function renderSettings(container: HTMLElement): Promise<void> {
  const token = getToken();
  let activeTab = 'empresa';

  async function load(): Promise<void> {
    const [users, roles, systemInfo] = await Promise.all([
      window.gero.invoke('auth:listUsers', token) as Promise<User[]>,
      window.gero.invoke('auth:listRoles', token) as Promise<Role[]>,
      window.gero.invoke('app:getInfo') as Promise<any>,
    ]);

    container.innerHTML = `
      <div style="max-width:1200px">
        <div style="margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Configurações</h1>
        </div>

        <div style="display:grid;grid-template-columns:200px 1fr;gap:16px">
          <!-- Settings nav -->
          <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;overflow:hidden;height:fit-content">
            ${[
              ['empresa',      'Empresa',       'ti-building'],
              ['usuarios',     'Usuários',      'ti-users'],
              ['perfis',       'Perfis',        'ti-shield'],
              ['integracoes',  'Integrações',   'ti-plug'],
              ['suporte',      'Contratar Suporte', 'ti-headset'],
              ['customizacao', 'Solicitar Customização', 'ti-wand'],
              ['banco',        'Banco de Dados','ti-database'],
              ['sobre',        'Sobre',         'ti-info-circle'],
            ].map(([tab,label,icon]) => `
              <button class="settings-tab" data-tab="${tab}" style="
                display:flex;align-items:center;gap:10px;width:100%;padding:12px 16px;
                border:none;background:${activeTab===tab?'#EF9F2711':'transparent'};
                color:${activeTab===tab?'#EF9F27':'#9CA3AF'};cursor:pointer;
                font-size:13px;text-align:left;border-right:2px solid ${activeTab===tab?'#EF9F27':'transparent'};
                transition:all 0.15s">
                <i class="ti ${icon}" style="font-size:14px;width:16px;text-align:center"></i>${label}
              </button>`).join('')}
          </div>

          <!-- Content -->
          <div id="settings-content" style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:24px">
            ${renderTabContent(activeTab, users, roles, systemInfo)}
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.settings-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab')!;
        container.querySelectorAll('.settings-tab').forEach(b => {
          const a = b.getAttribute('data-tab') === activeTab;
          (b as HTMLElement).style.background = a ? '#EF9F2711' : 'transparent';
          (b as HTMLElement).style.color = a ? '#EF9F27' : '#9CA3AF';
          (b as HTMLElement).style.borderRightColor = a ? '#EF9F27' : 'transparent';
        });
        document.getElementById('settings-content')!.innerHTML = renderTabContent(activeTab, users, roles, systemInfo);
        attachContentHandlers(activeTab, users, roles, systemInfo);
      });
    });

    attachContentHandlers(activeTab, users, roles, systemInfo);
  }

  function renderTabContent(tab: string, users: User[], roles: Role[], systemInfo: any): string {
    if (tab === 'empresa') return `
      <h2 style="font-size:16px;font-weight:600;margin-bottom:20px">Dados da Empresa</h2>
      <div style="display:flex;flex-direction:column;gap:16px;max-width:480px">
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Razão Social</label>
          <input value="W3TI SERVIÇOS DE INFORMÁTICA LTDA" readonly style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#9CA3AF;font-size:13px;outline:none"></div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Website</label>
          <input value="https://w3ti.com.br" readonly style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#9CA3AF;font-size:13px;outline:none"></div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Suporte</label>
          <input value="suporte@w3ti.com.br" readonly style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#9CA3AF;font-size:13px;outline:none"></div>
      </div>`;

    if (tab === 'usuarios') return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h2 style="font-size:16px;font-weight:600">Usuários do Sistema</h2>
        <button id="btn-new-user" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:none;background:#EF9F27;color:#fff;cursor:pointer;font-size:13px;font-weight:600"><i class="ti ti-plus"></i> Novo</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${users.map(u => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #2A2D3A22">
            ${renderAvatar(u.avatar_initials ?? u.name.slice(0,2).toUpperCase(), u.avatar_color, 36)}
            <div style="flex:1">
              <div style="font-weight:500">${u.name}</div>
              <div style="font-size:12px;color:#9CA3AF">${u.email}</div>
            </div>
            ${statusBadge(u.is_active ? 'active' : 'inactive')}
            <button class="btn-deactivate-user" data-id="${u.id}" data-active="${u.is_active}" style="padding:4px 10px;border-radius:6px;border:1px solid ${u.is_active?'#D85A3044':'#1D9E7544'};background:transparent;color:${u.is_active?'#D85A30':'#1D9E75'};cursor:pointer;font-size:12px">
              ${u.is_active ? 'Desativar' : 'Reativar'}
            </button>
          </div>`).join('')}
      </div>`;

    if (tab === 'perfis') return `
      <h2 style="font-size:16px;font-weight:600;margin-bottom:20px">Perfis de Acesso</h2>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${roles.map(r => `
          <div style="background:#0F1117;border-radius:8px;padding:14px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <i class="ti ti-shield" style="color:#EF9F27"></i>
              <span style="font-weight:600">${r.name}</span>
            </div>
            <div style="font-size:12px;color:#9CA3AF;margin-bottom:8px">${r.description ?? ''}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${(r.permissions ?? []).slice(0,8).map((p: string) => `<span style="padding:2px 8px;border-radius:4px;background:#2A2D3A;color:#9CA3AF;font-size:11px">${p}</span>`).join('')}
              ${(r.permissions ?? []).length > 8 ? `<span style="color:#6B7280;font-size:11px">+${(r.permissions ?? []).length - 8} mais</span>` : ''}
            </div>
          </div>`).join('')}
      </div>`;

    if (tab === 'customizacao') return `
      <h2 style="font-size:16px;font-weight:600;margin-bottom:8px">Solicitar Customização</h2>
      <p style="font-size:13px;color:#9CA3AF;margin-bottom:24px">Precisa de uma funcionalidade exclusiva ou integração sob medida para sua operação?</p>
      
      <div style="background:#0F1117;border:1px solid #2A2D3A;border-radius:12px;padding:32px;text-align:center">
        <div style="width:64px;height:64px;background:#EF9F2711;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
          <i class="ti ti-wand" style="font-size:32px;color:#EF9F27"></i>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:#fff;margin-bottom:12px">Desenvolvimento Sob Demanda</h3>
        <p style="font-size:14px;color:#9CA3AF;line-height:1.6;max-width:500px;margin:0 auto 24px">
          Nossa equipe de engenharia está pronta para expandir o Gero de acordo com suas necessidades. 
          Desde novos relatórios até módulos complexos de automação.
        </p>
        
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:32px">
          <div style="padding:16px;background:#1A1D27;border-radius:8px">
            <i class="ti ti-report-analytics" style="color:#EF9F27;font-size:20px;margin-bottom:8px"></i>
            <div style="font-size:13px;font-weight:600">Relatórios VIPS</div>
          </div>
          <div style="padding:16px;background:#1A1D27;border-radius:8px">
            <i class="ti ti-api" style="color:#EF9F27;font-size:20px;margin-bottom:8px"></i>
            <div style="font-size:13px;font-weight:600">Novas APIs</div>
          </div>
          <div style="padding:16px;background:#1A1D27;border-radius:8px">
            <i class="ti ti-components" style="color:#EF9F27;font-size:20px;margin-bottom:8px"></i>
            <div style="font-size:13px;font-weight:600">Módulos Extras</div>
          </div>
        </div>

        <button id="btn-request-custom" style="padding:12px 24px;border-radius:8px;border:none;background:#EF9F27;color:#fff;cursor:pointer;font-size:14px;font-weight:700;transition:all 0.2s">
          Descrever meu Projeto
        </button>
      </div>

      <div style="margin-top:24px;display:flex;align-items:center;gap:12px;padding:16px;border-radius:8px;border:1px solid #2A2D3A;background:#1A1D2722">
        <i class="ti ti-clock" style="color:#9CA3AF"></i>
        <div style="font-size:12px;color:#9CA3AF">
          O prazo médio de resposta para análise técnica de viabilidade é de <strong>48 horas úteis</strong>.
        </div>
      </div>
    `;

    if (tab === 'suporte') return `
      <h2 style="font-size:16px;font-weight:600;margin-bottom:8px">Contratar Suporte Técnico</h2>
      <p style="font-size:13px;color:#9CA3AF;margin-bottom:24px">Escolha o plano que melhor atende às necessidades da sua empresa.</p>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <!-- Plano Básico -->
        <div style="background:#0F1117;border:1px solid #2A2D3A;border-radius:12px;padding:20px;display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="font-size:18px;font-weight:700;color:#fff">Suporte Básico</h3>
            <span style="padding:4px 8px;border-radius:6px;background:#2A2D3A;color:#9CA3AF;font-size:11px;font-weight:600">RECOMENDADO</span>
          </div>
          <div style="font-size:24px;font-weight:800;color:#EF9F27;margin-bottom:16px">R$ 899<span style="font-size:14px;color:#9CA3AF;font-weight:400">/mês</span></div>
          <ul style="list-style:none;padding:0;margin:0 0 24px 0;display:flex;flex-direction:column;gap:10px;flex:1">
            <li style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9CA3AF"><i class="ti ti-check" style="color:#1D9E75"></i> Atendimento via E-mail e Ticket</li>
            <li style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9CA3AF"><i class="ti ti-check" style="color:#1D9E75"></i> Resposta em até 24h úteis</li>
            <li style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9CA3AF"><i class="ti ti-check" style="color:#1D9E75"></i> Atualizações de Segurança</li>
          </ul>
          <button class="btn-hire-support" data-plan="basico" style="width:100%;padding:10px;border-radius:8px;border:1px solid #EF9F27;background:transparent;color:#EF9F27;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s">Contratar Básico</button>
        </div>

        <!-- Plano Dedicado -->
        <div style="background:#0F1117;border:1px solid #EF9F27;border-radius:12px;padding:20px;display:flex;flex-direction:column;position:relative;overflow:hidden">
          <div style="position:absolute;top:0;right:0;background:#EF9F27;color:#fff;font-size:10px;font-weight:800;padding:4px 12px;transform:rotate(45deg) translate(15px, -10px);width:100px;text-align:center">PREMIUM</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="font-size:18px;font-weight:700;color:#fff">Suporte Dedicado</h3>
          </div>
          <div style="font-size:24px;font-weight:800;color:#EF9F27;margin-bottom:16px">R$ 1.300<span style="font-size:14px;color:#9CA3AF;font-weight:400">/mês</span></div>
          <ul style="list-style:none;padding:0;margin:0 0 24px 0;display:flex;flex-direction:column;gap:10px;flex:1">
            <li style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9CA3AF"><i class="ti ti-check" style="color:#1D9E75"></i> Banco de Dados Dedicado</li>
            <li style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9CA3AF"><i class="ti ti-check" style="color:#1D9E75"></i> Administração de infraestrutura dedicada</li>
            <li style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9CA3AF"><i class="ti ti-check" style="color:#1D9E75"></i> Resposta prioritária em até 2h</li>
          </ul>
          <button class="btn-hire-support" data-plan="dedicado" style="width:100%;padding:10px;border-radius:8px;border:none;background:#EF9F27;color:#fff;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s">Contratar Dedicado</button>
        </div>
      </div>
      
      <div style="margin-top:32px;padding:16px;background:#EF9F2711;border-radius:8px;border:1px solid #EF9F2722;text-align:center">
        <div style="font-size:14px;font-weight:600;color:#EF9F27;margin-bottom:4px">Precisa de um plano personalizado?</div>
        <div style="font-size:12px;color:#9CA3AF">Para empresas com mais de 500 funcionários, entre em contato com comercial@w3ti.com.br</div>
      </div>
    `;

    if (tab === 'integracoes') return `
      <h2 style="font-size:16px;font-weight:600;margin-bottom:20px">Integrações</h2>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${['Orbi (ERP)','Filo (CRM)'].map((name) => `
          <div style="background:#0F1117;border-radius:8px;padding:16px;display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-weight:600">${name}</div>
              <div style="font-size:12px;color:#9CA3AF;margin-top:2px">Integração via banco de dados compartilhado e event bus</div>
            </div>
            <span style="padding:4px 12px;border-radius:20px;background:#1D9E7522;color:#1D9E75;font-size:12px">Configurado</span>
          </div>`).join('')}
      </div>`;

    if (tab === 'banco') return `
      <h2 style="font-size:16px;font-weight:600;margin-bottom:20px">Banco de Dados</h2>
      <p style="font-size:13px;color:#9CA3AF;margin-bottom:16px">PostgreSQL via node-postgres (pg). Conexão gerenciada por pool de até 10 conexões.</p>
      <div style="background:#0F1117;border-radius:8px;padding:14px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#1D9E75">
        STATUS: Conectado &bull; Pool: max 10 conexões
      </div>`;

    if (tab === 'sobre') return `
      <div style="text-align:center;padding:20px 0">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style="margin-bottom:12px">
          <circle cx="28" cy="18" r="9" fill="#EF9F27"/>
          <circle cx="10" cy="40" r="7" fill="#EF9F27" opacity="0.7"/>
          <circle cx="46" cy="40" r="7" fill="#EF9F27" opacity="0.7"/>
          <line x1="21" y1="24" x2="14" y2="35" stroke="#EF9F27" stroke-width="2" opacity="0.5"/>
          <line x1="35" y1="24" x2="42" y2="35" stroke="#EF9F27" stroke-width="2" opacity="0.5"/>
        </svg>
        <div style="font-size:28px;font-weight:700;color:#EF9F27">Gero</div>
        <div style="font-size:13px;color:#9CA3AF;margin-top:4px">Pessoas que geram resultados.</div>

        <div style="margin:24px auto;max-width:320px;background:#0F1117;border-radius:12px;border:1px solid #2A2D3A;padding:16px;text-align:left">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#9CA3AF;font-size:12px">Versão</span>
            <span style="color:#fff;font-size:12px;font-weight:600">${systemInfo.version}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#9CA3AF;font-size:12px">Sistema Operacional</span>
            <span style="color:#fff;font-size:12px;font-weight:600">${systemInfo.osName} (${systemInfo.arch})</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#9CA3AF;font-size:12px">Kernel</span>
            <span style="color:#fff;font-size:12px;font-weight:600">${systemInfo.release}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:16px">
            <span style="color:#9CA3AF;font-size:12px">Empacotamento AUR</span>
            <span style="color:${systemInfo.isAur?'#1D9E75':'#D85A30'};font-size:12px;font-weight:600">${systemInfo.isAur?'Sim':'Não'}</span>
          </div>

          <button id="btn-check-update" style="width:100%;padding:10px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
            <i class="ti ti-refresh"></i> Verificar Atualizações
          </button>
        </div>

        <div style="font-size:12px;color:#6B7280;margin-top:8px">© 2026 W3TI SERVIÇOS DE INFORMÁTICA LTDA</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px">br.com.w3ti.gero &bull; suporte@w3ti.com.br</div>
      </div>`;

    return `<p style="color:#6B7280">Em desenvolvimento.</p>`;
  }

  function attachContentHandlers(tab: string, users: User[], roles: Role[], systemInfo: any): void {
    document.getElementById('btn-new-user')?.addEventListener('click', () => {
      openUserForm(roles, async (data) => {
        try { await window.gero.invoke('auth:createUser', token, data); showToast('Usuário criado!', 'success'); closeModal(); load(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    document.querySelectorAll('.btn-deactivate-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isActive = btn.getAttribute('data-active') === 'true';
        if (!isActive) { showToast('Reativação via banco de dados.', 'info'); return; }
        try { await window.gero.invoke('auth:deactivateUser', token, btn.getAttribute('data-id')!); showToast('Usuário desativado.', 'warning'); load(); }
        catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    document.querySelectorAll('.btn-hire-support').forEach(btn => {
      btn.addEventListener('click', () => {
        const plan = btn.getAttribute('data-plan');
        const planName = plan === 'dedicado' ? 'Suporte Dedicado' : 'Suporte Básico';
        showToast(`Solicitação de ${planName} enviada ao comercial!`, 'success');
      });
    });

    document.getElementById('btn-request-custom')?.addEventListener('click', () => {
      const modalContent = `
        <div style="display:flex;flex-direction:column;gap:16px">
          <p style="font-size:13px;color:#9CA3AF">Descreva abaixo as funcionalidades ou mudanças que você deseja no sistema.</p>
          <div>
            <label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Título do Projeto</label>
            <input type="text" placeholder="Ex: Novo módulo de integração com ERP X" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
          </div>
          <div>
            <label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Descrição Detalhada</label>
            <textarea rows="5" placeholder="Descreva como a funcionalidade deve funcionar..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none;resize:none"></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px">
            <button id="btn-close-custom-modal" style="padding:10px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
            <button id="btn-send-custom-request" style="padding:10px 20px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:700;cursor:pointer">Enviar para Orçamento</button>
          </div>
        </div>
      `;
      openModal('Solicitar Orçamento', modalContent);
      document.getElementById('btn-close-custom-modal')?.addEventListener('click', closeModal);
      document.getElementById('btn-send-custom-request')?.addEventListener('click', () => {
        showToast('Solicitação de orçamento enviada com sucesso!', 'success');
        closeModal();
      });
    });

    document.getElementById('btn-check-update')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-check-update') as HTMLButtonElement;
      const originalHtml = btn.innerHTML;
      
      btn.disabled = true;
      btn.innerHTML = `<i class="ti ti-loader spin"></i> Verificando...`;
      
      try {
        const update = await window.gero.invoke('app:checkForUpdates') as { available: boolean; version: string };
        
        if (update.available) {
          btn.innerHTML = `<i class="ti ti-download"></i> Baixar v${update.version}`;
          btn.style.background = '#1D9E75';
          btn.disabled = false;
          
          btn.onclick = async () => {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader spin"></i> Instalando...`;
            showToast('Baixando atualização...', 'info');
            
            const result = await window.gero.invoke('app:performUpdate') as { success: boolean };
            if (result.success) {
              showToast('Pronto para instalar. Reiniciando...', 'success');
              setTimeout(() => {
                window.gero.invoke('window:close');
              }, 2000);
            }
          };
        } else {
          showToast('Você já está na versão mais recente.', 'success');
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      } catch (err) {
        showToast('Erro ao verificar atualizações.', 'error');
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    });
  }

  function openUserForm(roles: Role[], onSave: (data: { name: string; email: string; password: string; role_id: string }) => Promise<void>): void {
    const content = `
      <form id="user-form" style="display:flex;flex-direction:column;gap:14px">
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Nome *</label>
          <input name="name" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">E-mail *</label>
          <input name="email" type="email" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Senha *</label>
          <input name="password" type="password" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none"></div>
        <div><label style="display:block;font-size:11px;color:#9CA3AF;margin-bottom:4px">Perfil *</label>
          <select name="role_id" required style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #2A2D3A;background:#0F1117;color:#fff;font-size:13px;outline:none">
            <option value="">— Selecione —</option>
            ${roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
          </select></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #2A2D3A">
          <button type="button" id="cancel-user" style="padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#fff;cursor:pointer;font-size:13px">Cancelar</button>
          <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#EF9F27;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Criar</button>
        </div>
      </form>`;
    openModal('Novo Usuário', content);
    document.getElementById('cancel-user')?.addEventListener('click', closeModal);
    (document.getElementById('user-form') as HTMLFormElement)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      await onSave({ name: fd.get('name') as string, email: fd.get('email') as string, password: fd.get('password') as string, role_id: fd.get('role_id') as string });
    });
  }

  await load();
}
