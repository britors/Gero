-- Migration 005: Rescisão (Termination Severance)

CREATE TABLE rescisao_entries (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 uuid NOT NULL REFERENCES employees(id),
  termination_date            date NOT NULL,
  termination_reason          termination_reason NOT NULL,
  notice_period_worked        boolean NOT NULL DEFAULT false,
  vacation_days_vencidas      int NOT NULL DEFAULT 0,
  vacation_months_proportional int NOT NULL DEFAULT 0,
  decimo13_months_worked      int NOT NULL DEFAULT 0,
  decimo13_already_paid       numeric(15,2) NOT NULL DEFAULT 0,
  -- Calculated proventos
  saldo_salario               numeric(15,2) NOT NULL,
  aviso_previo                numeric(15,2) NOT NULL DEFAULT 0,
  aviso_previo_days           int NOT NULL DEFAULT 0,
  ferias_vencidas             numeric(15,2) NOT NULL DEFAULT 0,
  ferias_proporcionais        numeric(15,2) NOT NULL DEFAULT 0,
  decimo13_proporcional       numeric(15,2) NOT NULL DEFAULT 0,
  fgts_depositos              numeric(15,2) NOT NULL DEFAULT 0,
  fgts_multa                  numeric(15,2) NOT NULL DEFAULT 0,
  -- Descontos
  inss                        numeric(15,2) NOT NULL,
  irrf                        numeric(15,2) NOT NULL,
  -- Totals
  gross_total                 numeric(15,2) NOT NULL,
  net_total                   numeric(15,2) NOT NULL,
  -- Meta
  notice_days                 int NOT NULL,
  total_months                int NOT NULL,
  days_in_last_month          int NOT NULL,
  created_by                  uuid REFERENCES users(id),
  created_at                  timestamptz DEFAULT now(),
  UNIQUE (employee_id, termination_date)
);
