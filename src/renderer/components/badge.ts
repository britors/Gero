type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'purple' | 'default';

const BADGE_COLORS: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: '#1D9E7522', color: '#1D9E75' },
  error:   { bg: '#D85A3022', color: '#D85A30' },
  warning: { bg: '#EF9F2722', color: '#EF9F27' },
  info:    { bg: '#3B6FE822', color: '#3B6FE8' },
  purple:  { bg: '#7F77DD22', color: '#7F77DD' },
  default: { bg: '#2A2D3A',   color: '#9CA3AF' },
};

export function renderBadge(label: string, variant: BadgeVariant = 'default'): string {
  const { bg, color } = BADGE_COLORS[variant];
  return `<span style="
    display:inline-flex; align-items:center; gap:4px;
    padding:2px 8px; border-radius:4px;
    background:${bg}; color:${color};
    font-size:11px; font-weight:600; white-space:nowrap;
  ">${label}</span>`;
}

export function contractBadge(type: string): string {
  const map: Record<string, [string, BadgeVariant]> = {
    clt:       ['CLT',        'success'],
    pj:        ['PJ',         'info'],
    intern:    ['Estágio',    'purple'],
    temporary: ['Temporário', 'warning'],
  };
  const [label, variant] = map[type] ?? [type.toUpperCase(), 'default'];
  return renderBadge(label, variant);
}

export function statusBadge(status: string): string {
  const map: Record<string, [string, BadgeVariant]> = {
    active:      ['Ativo',         'success'],
    inactive:    ['Inativo',       'default'],
    draft:       ['Rascunho',      'default'],
    approved:    ['Aprovado',      'success'],
    paid:        ['Pago',          'success'],
    open:        ['Aberto',        'success'],
    submitted:   ['Enviado',       'info'],
    rejected:    ['Rejeitado',     'error'],
    pending:     ['Pendente',      'warning'],
    cancelled:   ['Cancelado',     'default'],
    hired:       ['Contratado',    'success'],
    applied:     ['Inscrito',      'default'],
    screening:   ['Triagem',       'info'],
    interview:   ['Entrevista',    'purple'],
    offer:       ['Oferta',        'warning'],
    in_progress: ['Em andamento',  'info'],
    completed:   ['Concluído',     'success'],
    calibrated:  ['Calibrado',     'purple'],
    paused:      ['Pausado',       'warning'],
    closed:      ['Encerrado',     'default'],
    error:       ['Erro',          'error'],
    dev:         ['Dev',           'purple'],
  };
  const [label, variant] = map[status] ?? [status, 'default'];
  return renderBadge(label, variant);
}
