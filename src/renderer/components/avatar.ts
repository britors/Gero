export function renderAvatar(initials: string, color = '#EF9F27', size = 32): string {
  return `<div style="
    width:${size}px; height:${size}px; border-radius:50%;
    background:${color}22; border:2px solid ${color};
    display:inline-flex; align-items:center; justify-content:center;
    font-size:${Math.round(size * 0.35)}px; font-weight:700; color:${color};
    flex-shrink:0; user-select:none;
  ">${initials}</div>`;
}
