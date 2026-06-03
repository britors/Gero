type ToastType = 'success' | 'error' | 'info' | 'warning';

const COLORS: Record<ToastType, string> = {
  success: '#1D9E75',
  error:   '#D85A30',
  info:    '#3B6FE8',
  warning: '#EF9F27',
};
const ICONS: Record<ToastType, string> = {
  success: 'ti-check',
  error:   'ti-x',
  info:    'ti-info-circle',
  warning: 'ti-alert-triangle',
};

export function showToast(message: string, type: ToastType = 'info', durationMs = 4000): void {
  const container = document.getElementById('toast-container')!;
  const toast = document.createElement('div');
  toast.style.cssText = `
    display:flex; align-items:center; gap:10px;
    background:#1A1D27; border:1px solid #2A2D3A; border-left:3px solid ${COLORS[type]};
    padding:12px 16px; border-radius:8px; min-width:280px; max-width:380px;
    box-shadow:0 4px 24px rgba(0,0,0,0.4);
    animation: slideIn 0.2s ease;
    color:#fff; font-size:13px;
  `;
  toast.innerHTML = `
    <i class="ti ${ICONS[type]}" style="color:${COLORS[type]};font-size:16px;flex-shrink:0"></i>
    <span style="flex:1">${message}</span>
    <i class="ti ti-x" style="color:#6B7280;cursor:pointer;font-size:14px" onclick="this.parentElement.remove()"></i>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
  `;
  if (!document.head.querySelector('#toast-style')) {
    style.id = 'toast-style';
    document.head.appendChild(style);
  }

  container.appendChild(toast);
  setTimeout(() => toast.remove(), durationMs);
}
