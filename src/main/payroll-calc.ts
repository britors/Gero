import type { PayrollEntry, Decimo13Entry, RescisaoResult } from '../shared/types';

function calcInss(salary: number): number {
  const brackets = [
    { limit: 1412.00,  rate: 0.075 },
    { limit: 2666.68,  rate: 0.090 },
    { limit: 4000.03,  rate: 0.120 },
    { limit: 7786.02,  rate: 0.140 },
  ];
  let inss = 0;
  let prev = 0;
  for (const b of brackets) {
    if (salary <= prev) break;
    const base = Math.min(salary, b.limit) - prev;
    inss += base * b.rate;
    prev = b.limit;
    if (salary <= b.limit) break;
  }
  return Math.min(parseFloat(inss.toFixed(2)), 908.86);
}

function calcIrrf(base: number): number {
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return parseFloat((base * 0.075 - 169.44).toFixed(2));
  if (base <= 3751.05) return parseFloat((base * 0.15  - 381.44).toFixed(2));
  if (base <= 4664.68) return parseFloat((base * 0.225 - 662.77).toFixed(2));
  return parseFloat((base * 0.275 - 896.00).toFixed(2));
}

export function calculatePayroll(
  baseSalary: number,
  overtime = 0,
  bonus = 0,
  otherEarnings = 0,
  absenceDiscount = 0,
  otherDiscounts = 0
): Omit<PayrollEntry, 'id' | 'period_id' | 'employee_id' | 'meal_allowance' | 'transport_voucher' | 'health_plan' | 'created_at' | 'updated_at'> {
  const grossSalary    = parseFloat((baseSalary + overtime + bonus + otherEarnings).toFixed(2));
  const inss           = calcInss(grossSalary);
  const irrfBase       = grossSalary - inss;
  const irrf           = calcIrrf(irrfBase);
  const fgts           = parseFloat((grossSalary * 0.08).toFixed(2));
  const netSalary      = parseFloat((grossSalary - inss - irrf - absenceDiscount - otherDiscounts).toFixed(2));

  return {
    base_salary:       baseSalary,
    overtime_value:    overtime,
    bonus,
    other_earnings:    otherEarnings,
    gross_salary:      grossSalary,
    inss,
    irrf,
    absence_discount:  absenceDiscount,
    other_discounts:   otherDiscounts,
    fgts,
    net_salary:        netSalary,
  };
}

// months_worked: 1–12, calculated from hire_date (day > 15 in hire month = that month doesn't count)
export function calcDecimo13MonthsWorked(hireDate: Date, year: number): number {
  const hireYear = hireDate.getFullYear();
  if (hireYear < year) return 12;
  if (hireYear > year) return 0;
  const hireMonth = hireDate.getMonth() + 1;
  const hireDay   = hireDate.getDate();
  const firstMonth = hireDay > 15 ? hireMonth + 1 : hireMonth;
  return Math.max(0, 12 - firstMonth + 1);
}

// Lei 12.506/2011: 30 days + 3 days per completed year after the first, capped at 90
export function calcNoticeDays(hireDate: Date, terminationDate: Date): number {
  const msPerYear = 365.25 * 24 * 3600 * 1000;
  const yearsWorked = Math.floor((terminationDate.getTime() - hireDate.getTime()) / msPerYear);
  return Math.min(30 + Math.max(0, yearsWorked - 1) * 3, 90);
}

export function calculateRescisao(params: {
  baseSalary: number;
  hireDate: Date;
  terminationDate: Date;
  terminationReason: 'resignation' | 'dismissal' | 'mutual' | 'retirement' | 'other';
  noticePeriodWorked: boolean;
  vacationDaysVencidas: number;
  vacationMonthsProportional: number;
  decimo13MonthsWorked: number;
  decimo13AlreadyPaid: number;
}): RescisaoResult {
  const { baseSalary, hireDate, terminationDate, terminationReason, noticePeriodWorked,
          vacationDaysVencidas, vacationMonthsProportional, decimo13MonthsWorked, decimo13AlreadyPaid } = params;

  const msPerMonth = 365.25 * 24 * 3600 * 1000 / 12;
  const totalMonths = Math.floor((terminationDate.getTime() - hireDate.getTime()) / msPerMonth);
  const daysInLastMonth = terminationDate.getDate();
  const dailyRate = baseSalary / 30;
  const noticeDays = calcNoticeDays(hireDate, terminationDate);
  const isDismissal = terminationReason === 'dismissal';

  // 1. Saldo de salário
  const saldoSalario = parseFloat((dailyRate * daysInLastMonth).toFixed(2));

  // 2. Aviso prévio indenizado (only dismissal + not worked)
  const avisoPrevio = (isDismissal && !noticePeriodWorked)
    ? parseFloat((dailyRate * noticeDays).toFixed(2))
    : 0;

  // 3. 13th proportional (notice period months added for indenizado dismissal)
  const d13Months = isDismissal && !noticePeriodWorked
    ? Math.min(12, decimo13MonthsWorked + Math.ceil(noticeDays / 30))
    : decimo13MonthsWorked;
  const d13Gross = parseFloat(((baseSalary / 12) * d13Months).toFixed(2));
  const decimo13Proporcional = parseFloat(Math.max(0, d13Gross - decimo13AlreadyPaid).toFixed(2));

  // 4. Férias vencidas (+ constitutional 1/3) — IRRF exempt
  const feriasVencidas = vacationDaysVencidas > 0
    ? parseFloat((dailyRate * vacationDaysVencidas * (4 / 3)).toFixed(2))
    : 0;

  // 5. Férias proporcionais (+ 1/3) — IRRF exempt
  const feriasProporcionais = parseFloat(((baseSalary / 12) * vacationMonthsProportional * (4 / 3)).toFixed(2));

  // 6. FGTS accumulated (informational employer cost)
  const fgtsDepositos = parseFloat((baseSalary * 0.08 * totalMonths).toFixed(2));

  // 7. FGTS multa 40% (dismissal sem justa causa only)
  const fgtsMulta = isDismissal ? parseFloat((fgtsDepositos * 0.40).toFixed(2)) : 0;

  // INSS: on saldo + 13th (férias and aviso prévio indenizado are exempt per current legislation)
  const inssBase = saldoSalario + decimo13Proporcional;
  const inss = calcInss(inssBase);

  // IRRF: on (saldo + 13th - INSS); férias and aviso prévio indenizado are exempt
  const irrf = calcIrrf(inssBase - inss);

  const grossTotal = parseFloat(
    (saldoSalario + avisoPrevio + feriasVencidas + feriasProporcionais + decimo13Proporcional + fgtsMulta).toFixed(2)
  );
  const netTotal = parseFloat((grossTotal - inss - irrf).toFixed(2));

  return {
    saldo_salario: saldoSalario,
    aviso_previo: avisoPrevio,
    aviso_previo_days: isDismissal ? noticeDays : 0,
    ferias_vencidas: feriasVencidas,
    ferias_proporcionais: feriasProporcionais,
    decimo13_proporcional: decimo13Proporcional,
    fgts_depositos: fgtsDepositos,
    fgts_multa: fgtsMulta,
    inss,
    irrf,
    gross_total: grossTotal,
    net_total: netTotal,
    notice_days: noticeDays,
    total_months: totalMonths,
    days_in_last_month: daysInLastMonth,
  };
}

export function calculateDecimo13(
  baseSalary: number,
  monthsWorked: number
): Omit<Decimo13Entry, 'id' | 'employee_id' | 'employee_name' | 'department_name' | 'position_title' | 'year' | 'status' | 'first_paid_at' | 'second_paid_at' | 'created_at' | 'updated_at'> {
  const months           = Math.max(1, Math.min(12, monthsWorked));
  const gross            = parseFloat(((baseSalary / 12) * months).toFixed(2));
  const inss             = calcInss(gross);
  const irrf             = calcIrrf(gross - inss);
  const fgts             = parseFloat((gross * 0.08).toFixed(2));
  const firstInstallment = parseFloat((gross / 2).toFixed(2));
  const secondInstallment = parseFloat((gross / 2 - inss - irrf).toFixed(2));
  const netTotal         = parseFloat((gross - inss - irrf).toFixed(2));
  return { months_worked: months, gross, first_installment: firstInstallment, inss, irrf, fgts, second_installment: secondInstallment, net_total: netTotal };
}
