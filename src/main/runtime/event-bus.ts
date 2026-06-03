type EventHandler = (payload: unknown) => void;

const PROTECTED_PREFIXES = ['gero.', 'orbi.', 'filo.'];

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  emit(event: string, payload?: unknown, fromModule = false): void {
    if (fromModule && PROTECTED_PREFIXES.some(p => event.startsWith(p))) {
      console.warn(`[event-bus] Module attempted to emit protected event: ${event}`);
      return;
    }
    const set = this.handlers.get(event);
    if (!set) return;
    set.forEach(h => {
      try { h(payload); }
      catch (err) { console.error(`[event-bus] Handler error for ${event}:`, err); }
    });
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  removeAllListeners(event?: string): void {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
  }
}

export const eventBus = new EventBus();

// Gero system events
export const GeroEvents = {
  EMPLOYEE_HIRED:       'employee.hired',
  EMPLOYEE_TERMINATED:  'employee.terminated',
  EMPLOYEE_UPDATED:     'employee.updated',
  EMPLOYEE_TRANSFERRED: 'employee.transferred',
  PAYROLL_GENERATED:    'payroll.generated',
  PAYROLL_APPROVED:     'payroll.approved',
  PAYROLL_PAID:         'payroll.paid',
  TIMESHEET_SUBMITTED:  'timesheet.submitted',
  TIMESHEET_APPROVED:   'timesheet.approved',
  TIMESHEET_REJECTED:   'timesheet.rejected',
  VACATION_REQUESTED:   'vacation.requested',
  VACATION_APPROVED:    'vacation.approved',
  VACATION_REJECTED:    'vacation.rejected',
  CANDIDATE_APPLIED:    'candidate.applied',
  CANDIDATE_HIRED:      'candidate.hired',
  CANDIDATE_REJECTED:   'candidate.rejected',
  EVAL_CYCLE_STARTED:   'evaluation.cycle_started',
  EVAL_FORM_SUBMITTED:  'evaluation.form_submitted',
  EVAL_CYCLE_COMPLETED: 'evaluation.cycle_completed',
  APP_READY:            'app.ready',
  APP_BEFORE_SHUTDOWN:  'app.before_shutdown',
} as const;
