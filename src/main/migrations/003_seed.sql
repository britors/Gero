-- Migration 003: Sample data
-- Uses gen_random_uuid() for stable cross-reference

DO $$
DECLARE
  dept_ti        uuid := gen_random_uuid();
  dept_comercial uuid := gen_random_uuid();
  dept_financeiro uuid := gen_random_uuid();

  pos_dev        uuid := gen_random_uuid();
  pos_lead       uuid := gen_random_uuid();
  pos_vendas     uuid := gen_random_uuid();
  pos_gerente    uuid := gen_random_uuid();
  pos_financeiro uuid := gen_random_uuid();

  emp1  uuid := gen_random_uuid();
  emp2  uuid := gen_random_uuid();
  emp3  uuid := gen_random_uuid();
  emp4  uuid := gen_random_uuid();
  emp5  uuid := gen_random_uuid();
  emp6  uuid := gen_random_uuid();
  emp7  uuid := gen_random_uuid();
  emp8  uuid := gen_random_uuid();

  sched uuid := gen_random_uuid();

  period1 uuid := gen_random_uuid();
  period2 uuid := gen_random_uuid();

  opening1 uuid := gen_random_uuid();
  opening2 uuid := gen_random_uuid();
  opening3 uuid := gen_random_uuid();

  cycle1 uuid := gen_random_uuid();

  ben_health    uuid := gen_random_uuid();
  ben_meal      uuid := gen_random_uuid();
  ben_transport uuid := gen_random_uuid();

  admin_user uuid;
  hr_user    uuid;

BEGIN
  SELECT id INTO admin_user FROM users WHERE email = 'rodrigo@w3ti.com.br' LIMIT 1;
  SELECT id INTO hr_user    FROM users WHERE email = 'rh@w3ti.com.br' LIMIT 1;

  -- Departments (manager_id updated after employees)
  INSERT INTO departments (id, name, cost_center) VALUES
    (dept_ti,        'TI',         'CC-001'),
    (dept_comercial, 'Comercial',  'CC-002'),
    (dept_financeiro,'Financeiro', 'CC-003');

  -- Positions
  INSERT INTO positions (id, title, department_id, level, min_salary, max_salary) VALUES
    (pos_dev,        'Desenvolvedor',        dept_ti,         'mid',     4000,  8000),
    (pos_lead,       'Tech Lead',            dept_ti,         'lead',    8000, 14000),
    (pos_vendas,     'Consultor de Vendas',  dept_comercial,  'mid',     3000,  6000),
    (pos_gerente,    'Gerente Comercial',    dept_comercial,  'manager', 7000, 12000),
    (pos_financeiro, 'Analista Financeiro',  dept_financeiro, 'mid',     4000,  7000);

  -- Employees
  INSERT INTO employees (id, name, cpf, birth_date, gender, email, phone, department_id, position_id, contract_type, hire_date, base_salary, city, state, created_by) VALUES
    (emp1, 'Carlos Silva',     '123.456.789-01', '1985-03-15', 'M', 'carlos.silva@empresa.com',    '11999990001', dept_ti,         pos_lead,       'clt', '2020-01-10', 10500.00, 'São Paulo', 'SP', admin_user),
    (emp2, 'Ana Souza',        '234.567.890-12', '1990-07-22', 'F', 'ana.souza@empresa.com',       '11999990002', dept_ti,         pos_dev,        'clt', '2021-03-01',  6200.00, 'São Paulo', 'SP', admin_user),
    (emp3, 'Pedro Oliveira',   '345.678.901-23', '1988-11-30', 'M', 'pedro.oliveira@empresa.com',  '11999990003', dept_ti,         pos_dev,        'pj',  '2022-06-15',  7000.00, 'Campinas',  'SP', admin_user),
    (emp4, 'Marina Costa',     '456.789.012-34', '1992-05-18', 'F', 'marina.costa@empresa.com',    '11999990004', dept_comercial,  pos_gerente,    'clt', '2019-08-20',  9000.00, 'São Paulo', 'SP', admin_user),
    (emp5, 'Roberto Lima',     '567.890.123-45', '1987-09-05', 'M', 'roberto.lima@empresa.com',    '11999990005', dept_comercial,  pos_vendas,     'clt', '2021-11-01',  4500.00, 'São Paulo', 'SP', admin_user),
    (emp6, 'Juliana Ferreira', '678.901.234-56', '1993-02-14', 'F', 'juliana.ferreira@empresa.com','11999990006', dept_comercial,  pos_vendas,     'clt', '2022-02-14',  4200.00, 'São Paulo', 'SP', admin_user),
    (emp7, 'Fernando Alves',   '789.012.345-67', '1986-12-25', 'M', 'fernando.alves@empresa.com',  '11999990007', dept_financeiro, pos_financeiro, 'clt', '2020-05-03',  5800.00, 'São Paulo', 'SP', admin_user),
    (emp8, 'Beatriz Santos',   '890.123.456-78', '1995-08-10', 'F', 'beatriz.santos@empresa.com',  '11999990008', dept_financeiro, pos_financeiro, 'pj',  '2023-01-16',  5200.00, 'São Paulo', 'SP', admin_user);

  -- Set managers
  UPDATE employees SET manager_id = emp1 WHERE id IN (emp2, emp3);
  UPDATE employees SET manager_id = emp4 WHERE id IN (emp5, emp6);
  UPDATE departments SET manager_id = emp1 WHERE id = dept_ti;
  UPDATE departments SET manager_id = emp4 WHERE id = dept_comercial;
  UPDATE departments SET manager_id = emp7 WHERE id = dept_financeiro;

  -- Work schedule
  INSERT INTO work_schedules (id, name, weekly_hours, monday_start, monday_end, tuesday_start, tuesday_end, wednesday_start, wednesday_end, thursday_start, thursday_end, friday_start, friday_end) VALUES
    (sched, 'Jornada Padrão 8h', 40,
     '08:00', '17:00', '08:00', '17:00', '08:00', '17:00', '08:00', '17:00', '08:00', '17:00');

  INSERT INTO employee_schedules (employee_id, schedule_id, start_date)
    SELECT id, sched, hire_date FROM employees;

  -- Payroll periods
  INSERT INTO payroll_periods (id, month, year, status, created_by) VALUES
    (period1, 4, 2026, 'paid',     admin_user),
    (period2, 5, 2026, 'approved', admin_user);

  -- Payroll entries for period1 (April 2026 - paid)
  INSERT INTO payroll_entries (period_id, employee_id, base_salary, gross_salary, inss, irrf, fgts, net_salary)
  SELECT period1, id, base_salary, base_salary,
    LEAST(ROUND(
      CASE WHEN base_salary <= 1412.00 THEN base_salary * 0.075
           WHEN base_salary <= 2666.68 THEN 1412.00 * 0.075 + (base_salary - 1412.00) * 0.09
           WHEN base_salary <= 4000.03 THEN 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (base_salary - 2666.68) * 0.12
           WHEN base_salary <= 7786.02 THEN 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (4000.03 - 2666.68) * 0.12 + (base_salary - 4000.03) * 0.14
           ELSE 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (4000.03 - 2666.68) * 0.12 + (7786.02 - 4000.03) * 0.14
      END, 2), 908.86),
    0,
    ROUND(base_salary * 0.08, 2),
    0
  FROM employees WHERE is_active = true;

  -- Recalculate IRRF and net for period1
  UPDATE payroll_entries pe
  SET irrf = CASE
    WHEN (pe.gross_salary - pe.inss) <= 2259.20 THEN 0
    WHEN (pe.gross_salary - pe.inss) <= 2826.65 THEN ROUND((pe.gross_salary - pe.inss) * 0.075 - 169.44, 2)
    WHEN (pe.gross_salary - pe.inss) <= 3751.05 THEN ROUND((pe.gross_salary - pe.inss) * 0.15 - 381.44, 2)
    WHEN (pe.gross_salary - pe.inss) <= 4664.68 THEN ROUND((pe.gross_salary - pe.inss) * 0.225 - 662.77, 2)
    ELSE ROUND((pe.gross_salary - pe.inss) * 0.275 - 896.00, 2)
  END
  WHERE pe.period_id = period1;

  UPDATE payroll_entries pe
  SET net_salary = gross_salary - inss - irrf
  WHERE pe.period_id = period1;

  -- Payroll entries for period2 (May 2026 - approved)
  INSERT INTO payroll_entries (period_id, employee_id, base_salary, gross_salary, inss, irrf, fgts, net_salary)
  SELECT period2, id, base_salary, base_salary,
    LEAST(ROUND(
      CASE WHEN base_salary <= 1412.00 THEN base_salary * 0.075
           WHEN base_salary <= 2666.68 THEN 1412.00 * 0.075 + (base_salary - 1412.00) * 0.09
           WHEN base_salary <= 4000.03 THEN 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (base_salary - 2666.68) * 0.12
           WHEN base_salary <= 7786.02 THEN 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (4000.03 - 2666.68) * 0.12 + (base_salary - 4000.03) * 0.14
           ELSE 1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (4000.03 - 2666.68) * 0.12 + (7786.02 - 4000.03) * 0.14
      END, 2), 908.86),
    0,
    ROUND(base_salary * 0.08, 2),
    0
  FROM employees WHERE is_active = true;

  UPDATE payroll_entries pe
  SET irrf = CASE
    WHEN (pe.gross_salary - pe.inss) <= 2259.20 THEN 0
    WHEN (pe.gross_salary - pe.inss) <= 2826.65 THEN ROUND((pe.gross_salary - pe.inss) * 0.075 - 169.44, 2)
    WHEN (pe.gross_salary - pe.inss) <= 3751.05 THEN ROUND((pe.gross_salary - pe.inss) * 0.15 - 381.44, 2)
    WHEN (pe.gross_salary - pe.inss) <= 4664.68 THEN ROUND((pe.gross_salary - pe.inss) * 0.225 - 662.77, 2)
    ELSE ROUND((pe.gross_salary - pe.inss) * 0.275 - 896.00, 2)
  END
  WHERE pe.period_id = period2;

  UPDATE payroll_entries pe
  SET net_salary = gross_salary - inss - irrf
  WHERE pe.period_id = period2;

  -- Timesheets for current month (June 2026) for 3 employees
  INSERT INTO timesheets (employee_id, month, year, status) VALUES
    (emp1, 6, 2026, 'submitted'),
    (emp2, 6, 2026, 'open'),
    (emp3, 6, 2026, 'approved');

  -- Job openings
  INSERT INTO job_openings (id, title, department_id, position_id, description, requirements, salary_range, location, status, opened_at, created_by) VALUES
    (opening1, 'Desenvolvedor Full Stack Sênior', dept_ti, pos_dev,
     'Vaga para desenvolvedor com experiência em Node.js e React',
     'Node.js, TypeScript, PostgreSQL, 5+ anos', 'R$ 8.000 - R$ 12.000', 'São Paulo - SP', 'open', '2026-05-01', admin_user),
    (opening2, 'Consultor de Vendas B2B', dept_comercial, pos_vendas,
     'Vaga para consultor focado em vendas corporativas',
     'Experiência em vendas B2B, CRM, Comunicação', 'R$ 4.000 - R$ 6.000 + comissão', 'São Paulo - SP', 'open', '2026-05-15', admin_user),
    (opening3, 'Analista de Sistemas Jr', dept_ti, pos_dev,
     'Vaga encerrada para analista júnior',
     'Lógica de programação, SQL básico', 'R$ 3.000 - R$ 4.500', 'Remoto', 'closed', '2026-03-01', admin_user);

  -- Candidates
  INSERT INTO candidates (opening_id, name, email, phone, status, rating) VALUES
    (opening1, 'Lucas Mendes',      'lucas.mendes@email.com',   '11988880001', 'interview', 4),
    (opening1, 'Carla Rodrigues',   'carla.rod@email.com',      '11988880002', 'screening', 3),
    (opening1, 'Paulo Xavier',      'paulo.x@email.com',        '11988880003', 'applied',   NULL),
    (opening1, 'Fernanda Gomes',    'fernanda.g@email.com',     '11988880004', 'offer',     5),
    (opening2, 'Ricardo Nunes',     'ricardo.n@email.com',      '11988880005', 'screening', 3),
    (opening2, 'Tatiane Pires',     'tatiane.p@email.com',      '11988880006', 'interview', 4),
    (opening2, 'Marcelo Dias',      'marcelo.d@email.com',      '11988880007', 'applied',   NULL),
    (opening3, 'Aline Castro',      'aline.c@email.com',        '11988880008', 'hired',     5),
    (opening3, 'Bruno Azevedo',     'bruno.a@email.com',        '11988880009', 'rejected',  2),
    (opening3, 'Cristina Moura',    'cristina.m@email.com',     '11988880010', 'rejected',  3);

  -- Evaluation cycle
  INSERT INTO evaluation_cycles (id, name, description, start_date, end_date, status, created_by) VALUES
    (cycle1, 'Avaliação de Desempenho 2026.1', 'Ciclo semestral Jan-Jun 2026', '2026-01-01', '2026-06-30', 'in_progress', admin_user);

  -- Evaluation forms (5 forms)
  INSERT INTO evaluation_forms (cycle_id, evaluatee_id, evaluator_id, type, status) VALUES
    (cycle1, emp1, emp1, 'self', 'completed'),
    (cycle1, emp2, emp2, 'self', 'in_progress'),
    (cycle1, emp2, emp1, 'manager', 'pending'),
    (cycle1, emp3, emp3, 'self', 'pending'),
    (cycle1, emp4, emp4, 'self', 'completed');

  -- Benefits
  INSERT INTO benefits (id, name, type, description, value, is_active) VALUES
    (ben_health,    'Plano de Saúde Bradesco', 'health',    'Plano de saúde completo com cobertura nacional', 450.00, true),
    (ben_meal,      'Vale Refeição',           'meal',      'Vale refeição via cartão Flash',                 800.00, true),
    (ben_transport, 'Vale Transporte',         'transport', 'Vale transporte mensal',                         200.00, true);

  -- Assign benefits to all employees
  INSERT INTO employee_benefits (employee_id, benefit_id, start_date, is_active)
  SELECT e.id, ben_health, e.hire_date, true FROM employees e;

  INSERT INTO employee_benefits (employee_id, benefit_id, start_date, is_active)
  SELECT e.id, ben_meal, e.hire_date, true FROM employees e;

  INSERT INTO employee_benefits (employee_id, benefit_id, start_date, is_active)
  SELECT e.id, ben_transport, e.hire_date, true FROM employees e
  WHERE e.contract_type = 'clt';

  -- Vacation entitlements
  INSERT INTO vacation_entitlements (employee_id, acquisition_start, acquisition_end, days_entitled, days_taken, expires_at)
  VALUES
    (emp1, '2024-01-10', '2025-01-09', 30, 15, '2026-01-09'),
    (emp2, '2024-03-01', '2025-02-28', 30,  0, '2026-02-28');

  INSERT INTO vacation_requests (entitlement_id, employee_id, start_date, end_date, days_count, status)
  SELECT ve.id, ve.employee_id, '2024-07-01', '2024-07-15', 15, 'approved'
  FROM vacation_entitlements ve WHERE ve.employee_id = emp1;

END $$;
