-- Migration 001: Initial schema

-- Enums
CREATE TYPE payroll_status       AS ENUM ('draft','approved','paid');
CREATE TYPE timesheet_status     AS ENUM ('open','submitted','approved','rejected');
CREATE TYPE time_entry_type      AS ENUM ('regular','overtime','absence','holiday');
CREATE TYPE recruitment_status   AS ENUM ('open','paused','closed','cancelled');
CREATE TYPE candidate_status     AS ENUM ('applied','screening','interview','offer','hired','rejected');
CREATE TYPE evaluation_status    AS ENUM ('draft','in_progress','completed','calibrated');
CREATE TYPE benefit_type         AS ENUM ('health','dental','meal','transport','education','other');
CREATE TYPE contract_type        AS ENUM ('clt','pj','intern','temporary');
CREATE TYPE termination_reason   AS ENUM ('resignation','dismissal','mutual','retirement','other');

-- Roles and access
CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar NOT NULL UNIQUE,
  description varchar,
  permissions text[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar NOT NULL,
  email           varchar NOT NULL UNIQUE,
  password_hash   varchar NOT NULL,
  role_id         uuid REFERENCES roles(id),
  avatar_initials varchar(3),
  avatar_color    varchar(7) DEFAULT '#EF9F27',
  is_active       boolean DEFAULT true,
  last_login_at   timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE user_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id),
  token_hash varchar NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Company structure
CREATE TABLE departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar NOT NULL,
  manager_id  uuid,
  cost_center varchar,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE positions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         varchar NOT NULL,
  department_id uuid REFERENCES departments(id),
  level         varchar,
  min_salary    numeric(15,2),
  max_salary    numeric(15,2),
  created_at    timestamptz DEFAULT now()
);

-- Employees (core entity)
CREATE TABLE employees (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               varchar NOT NULL,
  cpf                varchar(14) UNIQUE,
  rg                 varchar(20),
  birth_date         date,
  gender             varchar(20),
  email              varchar,
  phone              varchar,
  address            text,
  city               varchar,
  state              varchar(2),
  zip_code           varchar(9),
  department_id      uuid REFERENCES departments(id),
  position_id        uuid REFERENCES positions(id),
  manager_id         uuid REFERENCES employees(id),
  contract_type      contract_type NOT NULL DEFAULT 'clt',
  hire_date          date NOT NULL,
  termination_date   date,
  termination_reason termination_reason,
  base_salary        numeric(15,2) NOT NULL DEFAULT 0,
  bank_name          varchar,
  bank_agency        varchar,
  bank_account       varchar,
  is_active          boolean DEFAULT true,
  orbi_user_id       uuid,
  filo_user_id       uuid,
  created_by         uuid REFERENCES users(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE departments ADD CONSTRAINT fk_dept_manager
  FOREIGN KEY (manager_id) REFERENCES employees(id);

-- Benefits
CREATE TABLE benefits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar NOT NULL,
  type        benefit_type NOT NULL,
  description text,
  value       numeric(15,2),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE employee_benefits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  benefit_id  uuid REFERENCES benefits(id),
  start_date  date NOT NULL,
  end_date    date,
  value       numeric(15,2),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(employee_id, benefit_id)
);

-- Payroll
CREATE TABLE payroll_periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month       integer NOT NULL,
  year        integer NOT NULL,
  status      payroll_status NOT NULL DEFAULT 'draft',
  closed_at   timestamptz,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(month, year)
);

CREATE TABLE payroll_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id         uuid REFERENCES payroll_periods(id),
  employee_id       uuid REFERENCES employees(id),
  base_salary       numeric(15,2) NOT NULL,
  overtime_value    numeric(15,2) DEFAULT 0,
  bonus             numeric(15,2) DEFAULT 0,
  other_earnings    numeric(15,2) DEFAULT 0,
  gross_salary      numeric(15,2) NOT NULL,
  inss              numeric(15,2) NOT NULL,
  irrf              numeric(15,2) NOT NULL,
  absence_discount  numeric(15,2) DEFAULT 0,
  other_discounts   numeric(15,2) DEFAULT 0,
  fgts              numeric(15,2) NOT NULL,
  net_salary        numeric(15,2) NOT NULL,
  meal_allowance    numeric(15,2) DEFAULT 0,
  transport_voucher numeric(15,2) DEFAULT 0,
  health_plan       numeric(15,2) DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(period_id, employee_id)
);

-- Time tracking
CREATE TABLE work_schedules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             varchar NOT NULL,
  weekly_hours     numeric(4,1) DEFAULT 40,
  monday_start     time, monday_end     time,
  tuesday_start    time, tuesday_end    time,
  wednesday_start  time, wednesday_end  time,
  thursday_start   time, thursday_end   time,
  friday_start     time, friday_end     time,
  saturday_start   time, saturday_end   time,
  sunday_start     time, sunday_end     time,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE employee_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  schedule_id uuid REFERENCES work_schedules(id),
  start_date  date NOT NULL,
  end_date    date,
  UNIQUE(employee_id, start_date)
);

CREATE TABLE timesheets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  month       integer NOT NULL,
  year        integer NOT NULL,
  status      timesheet_status NOT NULL DEFAULT 'open',
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(employee_id, month, year)
);

CREATE TABLE time_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id uuid REFERENCES timesheets(id),
  entry_date   date NOT NULL,
  type         time_entry_type NOT NULL DEFAULT 'regular',
  clock_in     time,
  clock_out    time,
  break_start  time,
  break_end    time,
  worked_hours numeric(4,2),
  overtime     numeric(4,2) DEFAULT 0,
  absence      boolean DEFAULT false,
  notes        varchar,
  created_at   timestamptz DEFAULT now()
);

-- Vacations
CREATE TABLE vacation_entitlements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid REFERENCES employees(id),
  acquisition_start date NOT NULL,
  acquisition_end   date NOT NULL,
  days_entitled     integer DEFAULT 30,
  days_taken        integer DEFAULT 0,
  days_sold         integer DEFAULT 0,
  expires_at        date,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE vacation_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid REFERENCES vacation_entitlements(id),
  employee_id    uuid REFERENCES employees(id),
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  days_count     integer NOT NULL,
  days_sold      integer DEFAULT 0,
  status         varchar DEFAULT 'pending',
  approved_by    uuid REFERENCES users(id),
  approved_at    timestamptz,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- Recruitment
CREATE TABLE job_openings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          varchar NOT NULL,
  department_id  uuid REFERENCES departments(id),
  position_id    uuid REFERENCES positions(id),
  description    text,
  requirements   text,
  salary_range   varchar,
  location       varchar,
  remote         boolean DEFAULT false,
  openings_count integer DEFAULT 1,
  status         recruitment_status NOT NULL DEFAULT 'open',
  opened_at      date,
  closed_at      date,
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE candidates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_id  uuid REFERENCES job_openings(id),
  name        varchar NOT NULL,
  email       varchar,
  phone       varchar,
  linkedin    varchar,
  resume_path text,
  status      candidate_status NOT NULL DEFAULT 'applied',
  rating      integer CHECK (rating BETWEEN 1 AND 5),
  notes       text,
  applied_at  timestamptz DEFAULT now(),
  hired_at    timestamptz,
  employee_id uuid REFERENCES employees(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE interviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   uuid REFERENCES candidates(id),
  interviewer_id uuid REFERENCES employees(id),
  scheduled_at   timestamptz NOT NULL,
  duration_min   integer DEFAULT 60,
  type           varchar DEFAULT 'video',
  status         varchar DEFAULT 'scheduled',
  feedback       text,
  rating         integer CHECK (rating BETWEEN 1 AND 5),
  created_at     timestamptz DEFAULT now()
);

-- Performance evaluation
CREATE TABLE evaluation_cycles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar NOT NULL,
  description text,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  status      evaluation_status NOT NULL DEFAULT 'draft',
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE evaluation_forms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     uuid REFERENCES evaluation_cycles(id),
  evaluatee_id uuid REFERENCES employees(id),
  evaluator_id uuid REFERENCES employees(id),
  type         varchar NOT NULL,
  status       varchar DEFAULT 'pending',
  submitted_at timestamptz,
  overall_score numeric(3,1),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE evaluation_answers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id    uuid REFERENCES evaluation_forms(id),
  competency varchar NOT NULL,
  score      integer CHECK (score BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE development_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  cycle_id    uuid REFERENCES evaluation_cycles(id),
  objective   text NOT NULL,
  actions     text,
  deadline    date,
  status      varchar DEFAULT 'open',
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Documents
CREATE TABLE employee_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  type        varchar NOT NULL,
  name        varchar NOT NULL,
  file_path   text,
  month       integer,
  year        integer,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- Custom modules
CREATE TABLE installed_modules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id   varchar NOT NULL UNIQUE,
  manifest      jsonb NOT NULL,
  status        varchar NOT NULL DEFAULT 'inactive'
                CHECK (status IN ('active','inactive','error','dev')),
  source_path   text NOT NULL,
  error_message text,
  installed_by  uuid REFERENCES users(id),
  installed_at  timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_employees_dept     ON employees(department_id);
CREATE INDEX idx_employees_active   ON employees(is_active);
CREATE INDEX idx_employees_manager  ON employees(manager_id);
CREATE INDEX idx_payroll_period     ON payroll_entries(period_id);
CREATE INDEX idx_payroll_employee   ON payroll_entries(employee_id);
CREATE INDEX idx_timesheet_employee ON timesheets(employee_id, year, month);
CREATE INDEX idx_time_entries_sheet ON time_entries(timesheet_id, entry_date);
CREATE INDEX idx_candidates_opening ON candidates(opening_id, status);
CREATE INDEX idx_eval_forms_cycle   ON evaluation_forms(cycle_id, evaluatee_id);
CREATE INDEX idx_vacation_employee  ON vacation_entitlements(employee_id);
