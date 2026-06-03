import type { Timesheet, TimeEntry, Employee } from '../../shared/types';
import { getToken } from '../index';
import { statusBadge } from '../components/badge';
import { openModal, closeModal } from '../components/modal';
import { showToast } from '../components/toast';

const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export async function renderTimesheet(container: HTMLElement): Promise<void> {
  const token = getToken();
  const now = new Date();
  let selMonth = now.getMonth() + 1;
  let selYear  = now.getFullYear();
  let selEmpId = '';

  async function load(): Promise<void> {
    const [timesheets, employees] = await Promise.all([
      window.gero.invoke('timesheet:list', token, { month: selMonth, year: selYear }) as Promise<Timesheet[]>,
      window.gero.invoke('employees:list', token, { active: true, pageSize: 200 }) as Promise<{ data: Employee[] }>,
    ]);

    container.innerHTML = `
      <div style="max-width:1400px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">Controle de Ponto</h1>
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center">
          <button id="btn-prev-month" style="padding:7px 12px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer">
            <i class="ti ti-chevron-left"></i>
          </button>
          <span style="font-size:14px;font-weight:600;min-width:140px;text-align:center">${MONTHS[selMonth-1]} / ${selYear}</span>
          <button id="btn-next-month" style="padding:7px 12px;border-radius:8px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer">
            <i class="ti ti-chevron-right"></i>
          </button>
          <select id="emp-filter" style="padding:8px 12px;border-radius:8px;border:1px solid #2A2D3A;background:#1A1D27;color:#fff;font-size:13px;outline:none;flex:1;max-width:280px">
            <option value="">Todos os funcionários</option>
            ${employees.data.map(e => `<option value="${e.id}" ${selEmpId===e.id?'selected':''}>${e.name}</option>`).join('')}
          </select>
        </div>

        <!-- Timesheets list -->
        <div style="display:grid;gap:12px">
          ${timesheets.length === 0 ? `<div style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:40px;text-align:center;color:#6B7280">
            Nenhum timesheet para ${MONTHS[selMonth-1]}/${selYear}
          </div>` :
          timesheets.map(ts => `
            <div class="ts-card" data-id="${ts.id}" style="background:#1A1D27;border:1px solid #2A2D3A;border-radius:12px;padding:16px;cursor:pointer;transition:border-color 0.15s">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:36px;height:36px;border-radius:50%;background:#EF9F2722;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#EF9F27;flex-shrink:0">
                  ${ts.employee_name?.slice(0,2).toUpperCase() ?? 'XX'}
                </div>
                <div style="flex:1">
                  <div style="font-weight:600">${ts.employee_name ?? '—'}</div>
                  <div style="font-size:12px;color:#9CA3AF">${MONTHS[ts.month-1]}/${ts.year}</div>
                </div>
                ${statusBadge(ts.status)}
                <div style="display:flex;gap:6px">
                  ${ts.status === 'submitted'
                    ? `<button class="btn-approve-ts" data-id="${ts.id}" style="padding:5px 10px;border-radius:6px;border:none;background:#1D9E7522;color:#1D9E75;cursor:pointer;font-size:12px;font-weight:500">Aprovar</button>
                       <button class="btn-reject-ts" data-id="${ts.id}" style="padding:5px 10px;border-radius:6px;border:none;background:#D85A3022;color:#D85A30;cursor:pointer;font-size:12px">Rejeitar</button>`
                    : ''}
                  <button class="btn-view-ts" data-id="${ts.id}" data-emp="${ts.employee_id}" style="padding:5px 10px;border-radius:6px;border:1px solid #2A2D3A;background:transparent;color:#9CA3AF;cursor:pointer;font-size:12px">
                    <i class="ti ti-calendar"></i> Ver
                  </button>
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <style>.ts-card:hover { border-color:#EF9F2766 !important; }</style>
    `;

    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
      selMonth--; if (selMonth < 1) { selMonth = 12; selYear--; } load();
    });
    document.getElementById('btn-next-month')?.addEventListener('click', () => {
      selMonth++; if (selMonth > 12) { selMonth = 1; selYear++; } load();
    });
    (document.getElementById('emp-filter') as HTMLSelectElement)?.addEventListener('change', function() {
      selEmpId = this.value; load();
    });

    container.querySelectorAll('.btn-view-ts').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tsId = btn.getAttribute('data-id')!;
        openTimesheetCalendar(tsId, selMonth, selYear);
      });
    });

    container.querySelectorAll('.btn-approve-ts').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await window.gero.invoke('timesheet:approve', token, btn.getAttribute('data-id')!);
          showToast('Ponto aprovado!', 'success'); load();
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });

    container.querySelectorAll('.btn-reject-ts').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await window.gero.invoke('timesheet:reject', token, btn.getAttribute('data-id')!);
          showToast('Ponto rejeitado.', 'warning'); load();
        } catch (err) { showToast(err instanceof Error ? err.message : 'Erro', 'error'); }
      });
    });
  }

  async function openTimesheetCalendar(tsId: string, month: number, year: number): Promise<void> {
    const entries = await window.gero.invoke('timesheet:listEntries', token, tsId) as TimeEntry[];
    const entryMap = new Map(entries.map(e => [e.entry_date.split('T')[0], e]));

    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: string[] = [];

    for (let i = 0; i < firstDay; i++) cells.push(`<div></div>`);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const entry = entryMap.get(dateStr);
      const dow = new Date(year, month - 1, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      let bg = isWeekend ? '#2A2D3A33' : 'transparent';
      let textColor = isWeekend ? '#6B7280' : '#fff';

      if (entry) {
        if (entry.absence) bg = '#D85A3022';
        else if (entry.overtime > 0) bg = '#EF9F2722';
        else bg = '#1D9E7511';
      }

      cells.push(`
        <div style="
          background:${bg};border-radius:6px;padding:6px;
          min-height:60px;border:1px solid #2A2D3A22;
        ">
          <div style="font-size:11px;font-weight:600;color:${textColor};margin-bottom:4px">${d}</div>
          ${entry ? `
            ${entry.absence
              ? `<div style="font-size:10px;color:#D85A30;font-weight:500">Falta</div>`
              : `<div style="font-size:10px;color:#9CA3AF">${entry.clock_in ?? '—'} – ${entry.clock_out ?? '—'}</div>
                 <div style="font-size:10px;color:#EF9F27;font-family:'JetBrains Mono',monospace">${entry.worked_hours ?? 0}h</div>
                 ${Number(entry.overtime) > 0 ? `<div style="font-size:10px;color:#F5C842">+${entry.overtime}h extra</div>` : ''}`
            }` : ''}
        </div>`);
    }

    openModal(`Ponto — ${MONTHS[month-1]}/${year}`, `
      <div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px">
          ${DAYS.map(d => `<div style="text-align:center;font-size:11px;font-weight:600;color:#6B7280;padding:4px">${d}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
          ${cells.join('')}
        </div>
        <div style="display:flex;gap:12px;margin-top:12px;font-size:11px;color:#9CA3AF">
          <span><span style="display:inline-block;width:10px;height:10px;background:#1D9E7511;border-radius:2px;vertical-align:middle;margin-right:4px"></span>Normal</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#EF9F2722;border-radius:2px;vertical-align:middle;margin-right:4px"></span>Horas extras</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#D85A3022;border-radius:2px;vertical-align:middle;margin-right:4px"></span>Falta</span>
        </div>
      </div>
    `);
  }

  await load();
}
