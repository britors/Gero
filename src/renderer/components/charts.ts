// All charts rendered as inline SVG

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function renderBarChart(
  data: { label: string; value: number }[],
  opts: { width?: number; height?: number; color?: string; yFormatter?: (v: number) => string } = {}
): string {
  const W = opts.width ?? 400;
  const H = opts.height ?? 220;
  const color = opts.color ?? '#EF9F27';
  const yFmt = opts.yFormatter ?? ((v) => String(Math.round(v)));
  const PAD = { top: 20, right: 20, bottom: 48, left: 50 };

  if (!data.length) return `<svg width="${W}" height="${H}"><text x="50%" y="50%" text-anchor="middle" fill="#6B7280" font-size="13">Sem dados</text></svg>`;

  const max = Math.max(...data.map(d => d.value), 1);
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW   = Math.min(chartW / data.length * 0.6, 48);
  const gap    = chartW / data.length;

  const bars = data.map((d, i) => {
    const bh = (d.value / max) * chartH;
    const x  = PAD.left + i * gap + (gap - barW) / 2;
    const y  = PAD.top + chartH - bh;
    const labelX = PAD.left + i * gap + gap / 2;
    const labelY = PAD.top + chartH + 18;
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}"
            fill="${color}" rx="4" opacity="0.85"/>
      <text x="${labelX.toFixed(1)}" y="${labelY}" text-anchor="middle" fill="#9CA3AF" font-size="11">${d.label}</text>
    `;
  }).join('');

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const val = max * t;
    const y = PAD.top + chartH - t * chartH;
    return `
      <line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${W - PAD.right}" y2="${y.toFixed(1)}" stroke="#2A2D3A" stroke-width="1"/>
      <text x="${PAD.left - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#6B7280" font-size="10">${yFmt(val)}</text>
    `;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    ${ticks}${bars}
  </svg>`;
}

export function renderLineChart(
  data: { label: string; value: number; value2?: number }[],
  opts: { width?: number; height?: number; color?: string; color2?: string; yFormatter?: (v: number) => string } = {}
): string {
  const W = opts.width ?? 500;
  const H = opts.height ?? 200;
  const color  = opts.color  ?? '#EF9F27';
  const color2 = opts.color2 ?? '#3B6FE8';
  const yFmt   = opts.yFormatter ?? ((v) => String(Math.round(v)));
  const PAD = { top: 20, right: 20, bottom: 40, left: 60 };

  if (!data.length) return `<svg width="${W}" height="${H}"><text x="50%" y="50%" text-anchor="middle" fill="#6B7280" font-size="13">Sem dados</text></svg>`;

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const max1 = Math.max(...data.map(d => d.value), 1);
  const max2 = data.some(d => d.value2 !== undefined) ? Math.max(...data.map(d => d.value2 ?? 0), 1) : 1;
  const has2  = data.some(d => d.value2 !== undefined);

  const xPos  = (i: number) => PAD.left + (i / (data.length - 1 || 1)) * chartW;
  const yPos1 = (v: number) => PAD.top + chartH - (v / max1) * chartH;
  const yPos2 = (v: number) => PAD.top + chartH - (v / max2) * chartH;

  const path1 = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos1(d.value).toFixed(1)}`).join(' ');
  const path2 = has2 ? data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos2(d.value2 ?? 0).toFixed(1)}`).join(' ') : '';
  const area1 = `${path1} L ${xPos(data.length - 1).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${PAD.left} ${(PAD.top + chartH).toFixed(1)} Z`;

  const dots1 = data.map((d, i) =>
    `<circle cx="${xPos(i).toFixed(1)}" cy="${yPos1(d.value).toFixed(1)}" r="3" fill="${color}" stroke="#0F1117" stroke-width="1.5"/>
     <title>${d.label}: ${yFmt(d.value)}</title>`
  ).join('');

  const dots2 = has2 ? data.map((d, i) =>
    `<circle cx="${xPos(i).toFixed(1)}" cy="${yPos2(d.value2 ?? 0).toFixed(1)}" r="3" fill="${color2}" stroke="#0F1117" stroke-width="1.5"/>
     <title>${d.label} (2): ${yFmt(d.value2 ?? 0)}</title>`
  ).join('') : '';

  const labels = data.map((d, i) =>
    `<text x="${xPos(i).toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle" fill="#9CA3AF" font-size="10">${d.label}</text>`
  ).join('');

  const ticks = [0, 0.5, 1].map(t => {
    const val = max1 * t;
    const y = PAD.top + chartH - t * chartH;
    return `
      <line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${W - PAD.right}" y2="${y.toFixed(1)}" stroke="#2A2D3A" stroke-width="1"/>
      <text x="${PAD.left - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#6B7280" font-size="10">${yFmt(val)}</text>
    `;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    <defs>
      <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${ticks}
    <path d="${area1}" fill="url(#lg1)"/>
    <path d="${path1}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    ${has2 ? `<path d="${path2}" fill="none" stroke="${color2}" stroke-width="2" stroke-linejoin="round" stroke-dasharray="4 2"/>` : ''}
    ${dots1}${dots2}${labels}
  </svg>`;
}

export function renderDonutChart(
  data: { label: string; value: number; color?: string }[],
  opts: { size?: number; innerLabel?: string } = {}
): string {
  const SIZE = opts.size ?? 160;
  const R = SIZE / 2;
  const INNER_R = R * 0.6;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return `<svg width="${SIZE}" height="${SIZE}"><text x="50%" y="50%" text-anchor="middle" fill="#6B7280" font-size="12">Sem dados</text></svg>`;

  const COLORS = ['#EF9F27', '#3B6FE8', '#1D9E75', '#D85A30', '#7F77DD', '#F5C842'];
  let angle = -Math.PI / 2;

  const arcs = data.map((d, i) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = R + R * Math.cos(angle);
    const y1 = R + R * Math.sin(angle);
    angle += sweep;
    const x2 = R + R * Math.cos(angle);
    const y2 = R + R * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const c = d.color ?? COLORS[i % COLORS.length];
    return `<path d="M ${R} ${R} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${c}" opacity="0.9"/>`;
  }).join('');

  const inner = `<circle cx="${R}" cy="${R}" r="${INNER_R}" fill="#0F1117"/>`;
  const label = opts.innerLabel ? `<text x="${R}" y="${R}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="14" font-weight="600">${opts.innerLabel}</text>` : '';

  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">${arcs}${inner}${label}</svg>`;
}
