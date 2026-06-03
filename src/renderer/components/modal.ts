export function openModal(title: string, content: string, onClose?: () => void): void {
  const overlay = document.getElementById('modal-overlay')!;
  const box = document.getElementById('modal-box')!;

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="font-size:16px;font-weight:600">${title}</h2>
      <button id="modal-close-btn" style="background:none;border:none;color:#9CA3AF;cursor:pointer;padding:4px">
        <i class="ti ti-x" style="font-size:18px"></i>
      </button>
    </div>
    <div id="modal-content">${content}</div>
  `;

  overlay.classList.add('visible');

  const closeBtn = document.getElementById('modal-close-btn')!;
  const close = () => {
    overlay.classList.remove('visible');
    onClose?.();
  };
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

export function closeModal(): void {
  document.getElementById('modal-overlay')?.classList.remove('visible');
}

export function openConfirm(message: string, onConfirm: () => void, confirmLabel = 'Confirmar', danger = false): void {
  const content = `
    <p style="color:#9CA3AF;margin-bottom:24px">${message}</p>
    <div style="display:flex;gap:12px;justify-content:flex-end">
      <button id="modal-cancel" style="
        padding:8px 16px;border-radius:8px;border:1px solid #2A2D3A;
        background:transparent;color:#fff;cursor:pointer;font-size:13px">
        Cancelar
      </button>
      <button id="modal-confirm" style="
        padding:8px 16px;border-radius:8px;border:none;
        background:${danger ? '#D85A30' : '#EF9F27'};color:#fff;cursor:pointer;font-weight:600;font-size:13px">
        ${confirmLabel}
      </button>
    </div>
  `;

  openModal('Confirmar ação', content);

  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-confirm')?.addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}
