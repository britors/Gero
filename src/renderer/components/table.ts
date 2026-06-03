export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  render?: (row: T, idx: number) => string;
  sortable?: boolean;
}

export interface TableOptions<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string;
}

export function renderTable<T extends Record<string, unknown>>(opts: TableOptions<T>): string {
  const { columns, data, emptyMessage = 'Nenhum registro encontrado.' } = opts;

  if (data.length === 0) {
    return `<div style="text-align:center;padding:48px 20px;color:#6B7280">
      <i class="ti ti-database-off" style="font-size:32px;display:block;margin-bottom:8px"></i>
      ${emptyMessage}
    </div>`;
  }

  const header = columns.map(c =>
    `<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#9CA3AF;
               text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;
               ${c.width ? `width:${c.width}` : ''}">
       ${c.label}
     </th>`
  ).join('');

  const rows = data.map((row, idx) => {
    const cells = columns.map(c => {
      const value = c.render ? c.render(row, idx) : String(row[c.key] ?? '');
      return `<td style="padding:10px 14px;vertical-align:middle;font-size:13px">${value}</td>`;
    }).join('');
    const key = opts.rowKey ? opts.rowKey(row) : String(idx);
    return `<tr class="table-row" data-row-idx="${key}"
               style="border-bottom:1px solid #2A2D3A;transition:background 0.12s;cursor:${opts.onRowClick ? 'pointer' : 'default'}">
              ${cells}
            </tr>`;
  }).join('');

  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#1A1D27">${header}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <style>.table-row:hover { background:#2A2D3A44; }</style>
  `;
}

export function attachTableRowHandlers<T extends Record<string, unknown>>(
  container: Element,
  data: T[],
  handler: (row: T) => void,
  rowKey: (row: T) => string
): void {
  container.querySelectorAll('.table-row').forEach(tr => {
    const key = tr.getAttribute('data-row-idx');
    const row = data.find(r => rowKey(r) === key);
    if (row) tr.addEventListener('click', () => handler(row));
  });
}

export function renderPagination(total: number, page: number, pageSize: number, onPage: (p: number) => void): string {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return '';
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  const btn = (p: number, label: string, disabled = false, active = false) =>
    `<button data-page="${p}" ${disabled ? 'disabled' : ''} style="
      padding:6px 10px;border-radius:6px;border:1px solid #2A2D3A;
      background:${active ? '#EF9F27' : 'transparent'};
      color:${active ? '#fff' : disabled ? '#6B7280' : '#9CA3AF'};
      cursor:${disabled ? 'not-allowed' : 'pointer'};font-size:12px;
    ">${label}</button>`;

  let pageBtns = btn(page - 1, '‹', page <= 1);
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) {
    pageBtns += btn(p, String(p), false, p === page);
  }
  pageBtns += btn(page + 1, '›', page >= pages);

  const id = 'pag-' + Math.random().toString(36).slice(2);
  setTimeout(() => {
    document.getElementById(id)?.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page') ?? '1');
        onPage(p);
      });
    });
  }, 0);

  return `<div id="${id}" style="display:flex;align-items:center;justify-content:space-between;
                padding:12px 0;font-size:12px;color:#6B7280">
    <span>Exibindo ${start}–${end} de ${total}</span>
    <div style="display:flex;gap:4px">${pageBtns}</div>
  </div>`;
}
