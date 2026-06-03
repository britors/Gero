// ─── Enums ────────────────────────────────────────────────────────────────────

export type PayrollStatus     = 'draft' | 'approved' | 'paid';
export type Decimo13Status    = 'draft' | 'paid_first' | 'paid_both';
export type TimesheetStatus   = 'open' | 'submitted' | 'approved' | 'rejected';
export type TimeEntryType     = 'regular' | 'overtime' | 'absence' | 'holiday';
export type RecruitmentStatus = 'open' | 'paused' | 'closed' | 'cancelled';
export type CandidateStatus   = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
export type EvaluationStatus  = 'draft' | 'in_progress' | 'completed' | 'calibrated';
export type BenefitType       = 'health' | 'dental' | 'meal' | 'transport' | 'education' | 'other';
export type ContractType      = 'clt' | 'pj' | 'intern' | 'temporary';
export type TerminationReason = 'resignation' | 'dismissal' | 'mutual' | 'retirement' | 'other';

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role_id?: string;
  role?: Role;
  avatar_initials?: string;
  avatar_color: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  manager_id?: string;
  manager_name?: string;
  cost_center?: string;
  headcount?: number;
  created_at: string;
}

export interface Position {
  id: string;
  title: string;
  department_id?: string;
  department_name?: string;
  level?: string;
  min_salary?: number;
  max_salary?: number;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  cpf?: string;
  rg?: string;
  birth_date?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  department_id?: string;
  department_name?: string;
  position_id?: string;
  position_title?: string;
  manager_id?: string;
  manager_name?: string;
  contract_type: ContractType;
  hire_date: string;
  termination_date?: string;
  termination_reason?: TerminationReason;
  base_salary: number;
  bank_name?: string;
  bank_agency?: string;
  bank_account?: string;
  is_active: boolean;
  orbi_user_id?: string;
  filo_user_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Benefit {
  id: string;
  name: string;
  type: BenefitType;
  description?: string;
  value?: number;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeBenefit {
  id: string;
  employee_id: string;
  benefit_id: string;
  benefit_name?: string;
  benefit_type?: BenefitType;
  start_date: string;
  end_date?: string;
  value?: number;
  is_active: boolean;
  created_at: string;
}

export interface PayrollPeriod {
  id: string;
  month: number;
  year: number;
  status: PayrollStatus;
  closed_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  entry_count?: number;
  total_net?: number;
}

export interface PayrollEntry {
  id: string;
  period_id: string;
  employee_id: string;
  employee_name?: string;
  department_name?: string;
  position_title?: string;
  base_salary: number;
  overtime_value: number;
  bonus: number;
  other_earnings: number;
  gross_salary: number;
  inss: number;
  irrf: number;
  absence_discount: number;
  other_discounts: number;
  fgts: number;
  net_salary: number;
  meal_allowance: number;
  transport_voucher: number;
  health_plan: number;
  created_at: string;
  updated_at: string;
}

export interface RescisaoResult {
  saldo_salario: number;
  aviso_previo: number;
  aviso_previo_days: number;
  ferias_vencidas: number;
  ferias_proporcionais: number;
  decimo13_proporcional: number;
  fgts_depositos: number;
  fgts_multa: number;
  inss: number;
  irrf: number;
  gross_total: number;
  net_total: number;
  notice_days: number;
  total_months: number;
  days_in_last_month: number;
}

export interface RescisaoEntry extends RescisaoResult {
  id: string;
  employee_id: string;
  employee_name?: string;
  department_name?: string;
  position_title?: string;
  termination_reason: TerminationReason;
  termination_date: string;
  notice_period_worked: boolean;
  vacation_days_vencidas: number;
  vacation_months_proportional: number;
  decimo13_months_worked: number;
  decimo13_already_paid: number;
  created_by?: string;
  created_at: string;
}

export interface Decimo13Entry {
  id: string;
  employee_id: string;
  employee_name?: string;
  department_name?: string;
  position_title?: string;
  year: number;
  months_worked: number;
  gross: number;
  first_installment: number;
  inss: number;
  irrf: number;
  fgts: number;
  second_installment: number;
  net_total: number;
  status: Decimo13Status;
  first_paid_at?: string;
  second_paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkSchedule {
  id: string;
  name: string;
  weekly_hours: number;
  monday_start?: string;    monday_end?: string;
  tuesday_start?: string;   tuesday_end?: string;
  wednesday_start?: string; wednesday_end?: string;
  thursday_start?: string;  thursday_end?: string;
  friday_start?: string;    friday_end?: string;
  saturday_start?: string;  saturday_end?: string;
  sunday_start?: string;    sunday_end?: string;
  created_at: string;
}

export interface Timesheet {
  id: string;
  employee_id: string;
  employee_name?: string;
  month: number;
  year: number;
  status: TimesheetStatus;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  timesheet_id: string;
  entry_date: string;
  type: TimeEntryType;
  clock_in?: string;
  clock_out?: string;
  break_start?: string;
  break_end?: string;
  worked_hours?: number;
  overtime: number;
  absence: boolean;
  notes?: string;
  created_at: string;
}

export interface VacationEntitlement {
  id: string;
  employee_id: string;
  employee_name?: string;
  acquisition_start: string;
  acquisition_end: string;
  days_entitled: number;
  days_taken: number;
  days_sold: number;
  expires_at?: string;
  created_at: string;
}

export interface VacationRequest {
  id: string;
  entitlement_id: string;
  employee_id: string;
  employee_name?: string;
  start_date: string;
  end_date: string;
  days_count: number;
  days_sold: number;
  status: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
}

export interface JobOpening {
  id: string;
  title: string;
  department_id?: string;
  department_name?: string;
  position_id?: string;
  position_title?: string;
  description?: string;
  requirements?: string;
  salary_range?: string;
  location?: string;
  remote: boolean;
  openings_count: number;
  status: RecruitmentStatus;
  opened_at?: string;
  closed_at?: string;
  candidate_count?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  opening_id: string;
  opening_title?: string;
  name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  resume_path?: string;
  status: CandidateStatus;
  rating?: number;
  notes?: string;
  applied_at: string;
  hired_at?: string;
  employee_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  candidate_name?: string;
  interviewer_id: string;
  interviewer_name?: string;
  scheduled_at: string;
  duration_min: number;
  type: string;
  status: string;
  feedback?: string;
  rating?: number;
  created_at: string;
}

export interface EvaluationCycle {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: EvaluationStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
  form_count?: number;
  completed_count?: number;
}

export interface EvaluationForm {
  id: string;
  cycle_id: string;
  cycle_name?: string;
  evaluatee_id: string;
  evaluatee_name?: string;
  evaluator_id: string;
  evaluator_name?: string;
  type: string;
  status: string;
  submitted_at?: string;
  overall_score?: number;
  created_at: string;
  updated_at: string;
}

export interface EvaluationAnswer {
  id: string;
  form_id: string;
  competency: string;
  score?: number;
  comment?: string;
  created_at: string;
}

export interface DevelopmentPlan {
  id: string;
  employee_id: string;
  employee_name?: string;
  cycle_id?: string;
  cycle_name?: string;
  objective: string;
  actions?: string;
  deadline?: string;
  status: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  employee_name?: string;
  type: string;
  name: string;
  file_path?: string;
  month?: number;
  year?: number;
  created_by?: string;
  created_at: string;
}

export interface InstalledModule {
  id: string;
  manifest_id: string;
  manifest: ModuleManifest;
  status: 'active' | 'inactive' | 'error' | 'dev';
  source_path: string;
  error_message?: string;
  installed_by?: string;
  installed_at: string;
  updated_at: string;
}

// ─── Module SDK ────────────────────────────────────────────────────────────────

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
  permissions?: string[];
  tabs?: ModuleTabDef[];
  menuItems?: ModuleMenuDef[];
}

export interface ModuleTabDef {
  id: string;
  label: string;
  target: 'employee' | 'candidate' | 'evaluation';
  component: string;
}

export interface ModuleMenuDef {
  id: string;
  label: string;
  icon?: string;
  route: string;
}

export interface GeroSDK {
  data: {
    query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
    queryOne: <T>(sql: string, params?: unknown[]) => Promise<T | null>;
    execute: (sql: string, params?: unknown[]) => Promise<number>;
  };
  ui: {
    showTab: (target: 'employee' | 'candidate' | 'evaluation', tabId: string, context: Record<string, unknown>) => void;
    navigate: (route: string, params?: Record<string, unknown>) => void;
    toast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    openModal: (title: string, content: string) => void;
  };
  events: {
    emit: (event: string, payload?: unknown) => void;
    on: (event: string, handler: (payload: unknown) => void) => () => void;
  };
  utils: {
    formatCurrency: (value: number) => string;
    formatDate: (date: string | Date) => string;
    uuid: () => string;
  };
  meta: {
    moduleId: string;
    version: string;
    appVersion: string;
  };
}

// ─── API shapes ───────────────────────────────────────────────────────────────

export interface SearchResult {
  employees: { id: string; name: string; position_title?: string; department_name?: string; is_active: boolean }[];
  openings:  { id: string; title: string; department_name?: string; status: string }[];
  candidates:{ id: string; name: string; opening_title?: string; status: string }[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface UnauthorizedError {
  code: 'UNAUTHORIZED';
  message: string;
  requiredPermission?: string;
}

export interface DashboardData {
  metrics: {
    totalEmployees: number;
    activeEmployees: number;
    newHiresThisMonth: number;
    terminationsThisMonth: number;
    openPositions: number;
    totalCandidates: number;
    pendingTimesheets: number;
    pendingVacations: number;
    monthPayrollTotal: number;
    averageSalary: number;
  };
  headcountByDept: { dept: string; count: number }[];
  payrollChart: { month: string; total: number; headcount: number }[];
  recentHires: Employee[];
  birthdaysThisMonth: Employee[];
  openJobOpenings: JobOpening[];
  evaluationProgress: { cycle: EvaluationCycle; completion: number }[];
}

// ─── IPC channel map ──────────────────────────────────────────────────────────

export type IpcChannels =
  | 'auth:login' | 'auth:logout' | 'auth:me' | 'auth:listUsers' | 'auth:createUser'
  | 'auth:updateUser' | 'auth:deactivateUser' | 'auth:changePassword' | 'auth:listRoles'
  | 'auth:createRole'
  | 'dashboard:getData'
  | 'employees:list' | 'employees:get' | 'employees:create' | 'employees:update'
  | 'employees:terminate' | 'employees:reactivate' | 'employees:listByDepartment'
  | 'employees:getOrgChart' | 'employees:linkToOrbi' | 'employees:linkToFilo'
  | 'employees:syncToOrbi' | 'employees:syncToFilo'
  | 'departments:list' | 'departments:get' | 'departments:create' | 'departments:update'
  | 'departments:delete' | 'departments:getHeadcount'
  | 'positions:list' | 'positions:get' | 'positions:create' | 'positions:update' | 'positions:delete'
  | 'payroll:listPeriods' | 'payroll:getPeriod' | 'payroll:createPeriod' | 'payroll:generateEntries'
  | 'payroll:getEntry' | 'payroll:updateEntry' | 'payroll:approvePeriod' | 'payroll:markPaid'
  | 'payroll:generatePayslip' | 'payroll:recalculate' | 'payroll:listEntries'
  | 'payroll:listDecimo13' | 'payroll:generateDecimo13' | 'payroll:payDecimo13First' | 'payroll:payDecimo13Second'
  | 'payroll:calcRescisao' | 'payroll:saveRescisao' | 'payroll:listRescisao' | 'payroll:getRescisao'
  | 'timesheet:list' | 'timesheet:get' | 'timesheet:createOrGet' | 'timesheet:listEntries'
  | 'timesheet:addEntry' | 'timesheet:updateEntry' | 'timesheet:deleteEntry'
  | 'timesheet:submit' | 'timesheet:approve' | 'timesheet:reject' | 'timesheet:getMonthSummary'
  | 'vacation:listEntitlements' | 'vacation:getEntitlement' | 'vacation:calculateEntitlement'
  | 'vacation:listRequests' | 'vacation:createRequest' | 'vacation:approveRequest'
  | 'vacation:rejectRequest' | 'vacation:cancelRequest' | 'vacation:getBalance'
  | 'recruitment:listOpenings' | 'recruitment:getOpening' | 'recruitment:createOpening'
  | 'recruitment:updateOpening' | 'recruitment:closeOpening' | 'recruitment:listCandidates'
  | 'recruitment:getCandidate' | 'recruitment:createCandidate' | 'recruitment:updateCandidate'
  | 'recruitment:scheduleInterview' | 'recruitment:updateInterview' | 'recruitment:hireCandidate'
  | 'evaluation:listCycles' | 'evaluation:getCycle' | 'evaluation:createCycle'
  | 'evaluation:startCycle' | 'evaluation:listForms' | 'evaluation:getForm'
  | 'evaluation:submitForm' | 'evaluation:calibrate' | 'evaluation:completeCycle'
  | 'evaluation:listDevelopmentPlans' | 'evaluation:createPlan' | 'evaluation:updatePlan'
  | 'benefits:listBenefits' | 'benefits:getBenefit' | 'benefits:createBenefit'
  | 'benefits:updateBenefit' | 'benefits:toggleBenefit' | 'benefits:listEmployeeBenefits'
  | 'benefits:assignBenefit' | 'benefits:updateAssignment' | 'benefits:removeBenefit'
  | 'documents:list' | 'documents:getDocument' | 'documents:createRecord' | 'documents:deleteRecord'
  | 'modules:list' | 'modules:install' | 'modules:uninstall' | 'modules:toggle'
  | 'studio:scaffold' | 'studio:readFile' | 'studio:writeFile' | 'studio:runBuild' | 'studio:getLogs'
  | 'search:global'
  | 'setup:checkPgConnection' | 'setup:checkPgExists' | 'setup:complete'
  | 'window:minimize' | 'window:toggleMaximize' | 'window:close';
