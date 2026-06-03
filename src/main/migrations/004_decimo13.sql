-- Migration 004: Décimo Terceiro (13th Salary)

CREATE TYPE decimo13_status AS ENUM ('draft', 'paid_first', 'paid_both');

CREATE TABLE decimo13_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        uuid NOT NULL REFERENCES employees(id),
  year               int NOT NULL,
  months_worked      int NOT NULL CHECK (months_worked BETWEEN 1 AND 12),
  gross              numeric(15,2) NOT NULL,
  first_installment  numeric(15,2) NOT NULL,
  inss               numeric(15,2) NOT NULL,
  irrf               numeric(15,2) NOT NULL,
  fgts               numeric(15,2) NOT NULL,
  second_installment numeric(15,2) NOT NULL,
  net_total          numeric(15,2) NOT NULL,
  status             decimo13_status NOT NULL DEFAULT 'draft',
  first_paid_at      timestamptz,
  second_paid_at     timestamptz,
  created_by         uuid REFERENCES users(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (employee_id, year)
);
