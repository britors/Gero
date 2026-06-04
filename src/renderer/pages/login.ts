import { login } from '../index';
import { showToast } from '../components/toast';

export function renderLoginPage(container: HTMLElement): void {
  container.innerHTML = `
    <div style="
      position:fixed;inset:0;background:#0F1117;
      display:flex;align-items:center;justify-content:center;
      font-family:'Inter',sans-serif;
    ">
      <div style="width:380px;padding:0 16px">
        <!-- Logo -->
        <div style="text-align:center;margin-bottom:32px">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:12px">
            <circle cx="32" cy="20" r="10" fill="#EF9F27"/>
            <circle cx="12" cy="46" r="8"  fill="#EF9F27" opacity="0.7"/>
            <circle cx="52" cy="46" r="8"  fill="#EF9F27" opacity="0.7"/>
            <line x1="24" y1="27" x2="16" y2="39" stroke="#EF9F27" stroke-width="2.5" opacity="0.5"/>
            <line x1="40" y1="27" x2="48" y2="39" stroke="#EF9F27" stroke-width="2.5" opacity="0.5"/>
            <line x1="32" y1="30" x2="32" y2="42" stroke="#EF9F27" stroke-width="2" opacity="0.3"/>
          </svg>
          <div style="font-size:32px;font-weight:700;color:#EF9F27;letter-spacing:-0.5px">Gero</div>
          <div style="font-size:13px;color:#6B7280;margin-top:4px">Pessoas que geram resultados.</div>
        </div>

        <!-- Card -->
        <div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:28px">
          <h2 style="font-size:16px;font-weight:600;color:#fff;margin-bottom:20px">Entrar na sua conta</h2>

          <div id="login-error" style="display:none;background:#D85A3011;border:1px solid #D85A3033;
               border-radius:8px;padding:10px 14px;color:#D85A30;font-size:13px;margin-bottom:16px"></div>

          <form id="login-form">
            <div style="margin-bottom:16px">
              <label style="display:block;font-size:12px;font-weight:500;color:#9CA3AF;margin-bottom:6px">E-mail</label>
              <input id="login-email" type="email" placeholder="seu@email.com"
                     autocomplete="email" style="
                width:100%;padding:10px 12px;border-radius:8px;
                border:1px solid #2A2D3A;background:#0F1117;
                color:#fff;font-size:14px;outline:none;font-family:'Inter',sans-serif;
                transition:border-color 0.15s;
              ">
            </div>
            <div style="margin-bottom:24px">
              <label style="display:block;font-size:12px;font-weight:500;color:#9CA3AF;margin-bottom:6px">Senha</label>
              <input id="login-password" type="password" placeholder="••••••••"
                     autocomplete="current-password" style="
                width:100%;padding:10px 12px;border-radius:8px;
                border:1px solid #2A2D3A;background:#0F1117;
                color:#fff;font-size:14px;outline:none;font-family:'Inter',sans-serif;
                transition:border-color 0.15s;
              ">
            </div>
            <button id="login-btn" type="submit" style="
              width:100%;padding:11px;border-radius:8px;border:none;
              background:#EF9F27;color:#fff;font-size:14px;font-weight:600;
              cursor:pointer;font-family:'Inter',sans-serif;transition:background 0.15s;
            ">Entrar</button>
          </form>
        </div>

        <div style="text-align:center;margin-top:20px;font-size:11px;color:#6B7280">
          W3TI SERVIÇOS DE INFORMÁTICA LTDA &bull; © 2026
        </div>
      </div>
    </div>
    <style>
      #login-email:focus, #login-password:focus { border-color:#EF9F27 !important; }
      #login-btn:hover { background:#B86E00 !important; }
    </style>
  `;

  const form     = document.getElementById('login-form') as HTMLFormElement;
  const emailEl  = document.getElementById('login-email') as HTMLInputElement;
  const passEl   = document.getElementById('login-password') as HTMLInputElement;
  const btnEl    = document.getElementById('login-btn') as HTMLButtonElement;
  const errorEl  = document.getElementById('login-error') as HTMLDivElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnEl.disabled = true;
    btnEl.textContent = 'Entrando...';
    errorEl.style.display = 'none';

    try {
      await login(emailEl.value.trim().toLowerCase(), passEl.value);
      container.remove();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login';
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
      btnEl.disabled = false;
      btnEl.textContent = 'Entrar';
    }
  });
}
