import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { calculatePayroll, calculateDecimo13, calcDecimo13MonthsWorked, calculateRescisao, calcNoticeDays } from '../src/main/payroll-calc';

// ─── Brazilian payroll calculation tests ─────────────────────────────────────

describe('INSS progressive table', () => {
  test('bracket 1: salary <= R$1.412 → 7.5%', () => {
    const { inss } = calculatePayroll(1412.00);
    assert.equal(inss, parseFloat((1412.00 * 0.075).toFixed(2)));
  });

  test('bracket 2: R$2.000 salary', () => {
    // 1412 * 0.075 = 105.90, (2000 - 1412) * 0.09 = 52.92 → 158.82
    const { inss } = calculatePayroll(2000.00);
    const expected = parseFloat((1412.00 * 0.075 + (2000.00 - 1412.00) * 0.09).toFixed(2));
    assert.equal(inss, expected);
  });

  test('bracket 3: R$3.500 salary', () => {
    // 1412 * 0.075 = 105.90
    // (2666.68 - 1412) * 0.09 = 112.93
    // (3500 - 2666.68) * 0.12 = 99.99
    const { inss } = calculatePayroll(3500.00);
    const expected = parseFloat((
      1412.00 * 0.075 +
      (2666.68 - 1412.00) * 0.09 +
      (3500.00 - 2666.68) * 0.12
    ).toFixed(2));
    assert.equal(inss, expected);
  });

  test('bracket 4: R$6.000 salary', () => {
    const { inss } = calculatePayroll(6000.00);
    const expected = parseFloat((
      1412.00 * 0.075 +
      (2666.68 - 1412.00) * 0.09 +
      (4000.03 - 2666.68) * 0.12 +
      (6000.00 - 4000.03) * 0.14
    ).toFixed(2));
    assert.equal(inss, expected);
  });

  test('INSS capped at R$908.86', () => {
    const { inss } = calculatePayroll(20000.00);
    assert.equal(inss, 908.86);
  });
});

describe('IRRF calculation', () => {
  test('exempt when base <= R$2.259,20', () => {
    const { irrf } = calculatePayroll(2000.00);
    assert.equal(irrf, 0);
  });

  test('IRRF at 7.5% bracket', () => {
    const gross = 2500;
    const { inss, irrf } = calculatePayroll(gross);
    const base = gross - inss;
    if (base <= 2259.20) {
      assert.equal(irrf, 0);
    } else {
      const expected = parseFloat((base * 0.075 - 169.44).toFixed(2));
      assert.equal(irrf, Math.max(0, expected));
    }
  });

  test('IRRF at 27.5% for high earner', () => {
    const { inss, irrf, gross_salary } = calculatePayroll(15000);
    const base = gross_salary - inss;
    const expected = parseFloat((base * 0.275 - 896.00).toFixed(2));
    assert.equal(irrf, expected);
  });
});

describe('net salary calculation', () => {
  test('net = gross - inss - irrf - absences - discounts', () => {
    const { gross_salary, inss, irrf, net_salary } = calculatePayroll(5000, 200, 100, 0, 50, 0);
    const expected = parseFloat((gross_salary - inss - irrf - 50).toFixed(2));
    assert.equal(net_salary, expected);
  });

  test('overtime is added to gross', () => {
    const { gross_salary } = calculatePayroll(3000, 500);
    assert.equal(gross_salary, 3500);
  });

  test('FGTS is 8% of gross (not deducted from net)', () => {
    const { gross_salary, fgts, net_salary, inss, irrf } = calculatePayroll(4000);
    assert.equal(fgts, parseFloat((gross_salary * 0.08).toFixed(2)));
    assert.equal(net_salary, parseFloat((gross_salary - inss - irrf).toFixed(2)));
  });

  test('bonus and other_earnings added to gross', () => {
    const { gross_salary } = calculatePayroll(3000, 0, 500, 200);
    assert.equal(gross_salary, 3700);
  });
});

describe('generateEntries coverage', () => {
  test('calculatePayroll returns all required fields', () => {
    const result = calculatePayroll(5000);
    assert.ok('base_salary' in result);
    assert.ok('gross_salary' in result);
    assert.ok('inss' in result);
    assert.ok('irrf' in result);
    assert.ok('fgts' in result);
    assert.ok('net_salary' in result);
  });
});

describe('calcDecimo13MonthsWorked', () => {
  test('hired before the year → 12 months', () => {
    assert.equal(calcDecimo13MonthsWorked(new Date('2024-03-10'), 2025), 12);
  });

  test('hired Jan 10 of year → 12 months (day ≤ 15)', () => {
    assert.equal(calcDecimo13MonthsWorked(new Date('2025-01-10'), 2025), 12);
  });

  test('hired Jan 20 of year → 11 months (day > 15, Jan doesn\'t count)', () => {
    assert.equal(calcDecimo13MonthsWorked(new Date('2025-01-20'), 2025), 11);
  });

  test('hired Dec 10 → 1 month', () => {
    assert.equal(calcDecimo13MonthsWorked(new Date('2025-12-10'), 2025), 1);
  });

  test('hired Dec 20 → 0 months (day > 15)', () => {
    assert.equal(calcDecimo13MonthsWorked(new Date('2025-12-20'), 2025), 0);
  });

  test('hired after the year → 0 months', () => {
    assert.equal(calcDecimo13MonthsWorked(new Date('2026-01-01'), 2025), 0);
  });
});

describe('calculateDecimo13', () => {
  test('gross = base_salary * months / 12', () => {
    const { gross } = calculateDecimo13(6000, 12);
    assert.equal(gross, 6000);
  });

  test('proportional with 6 months', () => {
    const { gross } = calculateDecimo13(6000, 6);
    assert.equal(gross, 3000);
  });

  test('first_installment = gross / 2', () => {
    const { gross, first_installment } = calculateDecimo13(6000, 12);
    assert.equal(first_installment, parseFloat((gross / 2).toFixed(2)));
  });

  test('net_total = gross - inss - irrf', () => {
    const { gross, inss, irrf, net_total } = calculateDecimo13(6000, 12);
    assert.equal(net_total, parseFloat((gross - inss - irrf).toFixed(2)));
  });

  test('second_installment = gross/2 - inss - irrf', () => {
    const { gross, inss, irrf, second_installment } = calculateDecimo13(6000, 12);
    assert.equal(second_installment, parseFloat((gross / 2 - inss - irrf).toFixed(2)));
  });

  test('fgts = 8% of gross', () => {
    const { gross, fgts } = calculateDecimo13(5000, 12);
    assert.equal(fgts, parseFloat((gross * 0.08).toFixed(2)));
  });

  test('low salary has zero IRRF', () => {
    const { irrf } = calculateDecimo13(2000, 12);
    assert.equal(irrf, 0);
  });

  test('months clamped to 12 max', () => {
    const { months_worked } = calculateDecimo13(5000, 15);
    assert.equal(months_worked, 12);
  });
});

describe('calcNoticeDays (Lei 12.506/2011)', () => {
  const hire = new Date('2022-01-01');

  test('less than 1 year → 30 days', () => {
    assert.equal(calcNoticeDays(new Date('2025-01-01'), new Date('2025-06-01')), 30);
  });

  test('1 year → 30 days', () => {
    assert.equal(calcNoticeDays(new Date('2024-01-01'), new Date('2025-01-15')), 30);
  });

  test('2 years → 33 days', () => {
    assert.equal(calcNoticeDays(new Date('2023-01-01'), new Date('2025-06-01')), 33);
  });

  test('10 years → 57 days (30 + 9×3)', () => {
    assert.equal(calcNoticeDays(new Date('2015-01-01'), new Date('2025-06-01')), 57);
  });

  test('capped at 90 days for 21+ years', () => {
    assert.equal(calcNoticeDays(new Date('2000-01-01'), new Date('2025-06-01')), 90);
  });
});

describe('calculateRescisao', () => {
  const base = {
    baseSalary: 6000,
    hireDate: new Date('2022-01-01'),
    terminationDate: new Date('2025-06-15'),
    terminationReason: 'dismissal' as const,
    noticePeriodWorked: false,
    vacationDaysVencidas: 0,
    vacationMonthsProportional: 5,
    decimo13MonthsWorked: 5,
    decimo13AlreadyPaid: 0,
  };

  test('saldo_salario = daily_rate × day_of_month', () => {
    const { saldo_salario, days_in_last_month } = calculateRescisao(base);
    assert.equal(saldo_salario, parseFloat(((6000 / 30) * days_in_last_month).toFixed(2)));
  });

  test('aviso_previo > 0 for dismissal indenizado', () => {
    const { aviso_previo, notice_days } = calculateRescisao(base);
    assert.ok(aviso_previo > 0);
    assert.ok(notice_days >= 30);
  });

  test('aviso_previo = 0 for resignation', () => {
    const { aviso_previo } = calculateRescisao({ ...base, terminationReason: 'resignation' });
    assert.equal(aviso_previo, 0);
  });

  test('aviso_previo = 0 when notice period was worked', () => {
    const { aviso_previo } = calculateRescisao({ ...base, noticePeriodWorked: true });
    assert.equal(aviso_previo, 0);
  });

  test('fgts_multa = 40% of fgts_depositos for dismissal', () => {
    const { fgts_depositos, fgts_multa } = calculateRescisao(base);
    assert.equal(fgts_multa, parseFloat((fgts_depositos * 0.40).toFixed(2)));
  });

  test('fgts_multa = 0 for resignation', () => {
    const { fgts_multa } = calculateRescisao({ ...base, terminationReason: 'resignation' });
    assert.equal(fgts_multa, 0);
  });

  test('ferias_proporcionais includes 1/3', () => {
    const { ferias_proporcionais } = calculateRescisao({ ...base, vacationMonthsProportional: 6 });
    const expected = parseFloat(((6000 / 12) * 6 * (4 / 3)).toFixed(2));
    assert.equal(ferias_proporcionais, expected);
  });

  test('net_total = gross_total - inss - irrf', () => {
    const { gross_total, inss, irrf, net_total } = calculateRescisao(base);
    assert.equal(net_total, parseFloat((gross_total - inss - irrf).toFixed(2)));
  });

  test('decimo13 notice months added for indenizado dismissal', () => {
    const base5 = calculateRescisao({ ...base, decimo13MonthsWorked: 5, noticePeriodWorked: false });
    const worked = calculateRescisao({ ...base, decimo13MonthsWorked: 5, noticePeriodWorked: true });
    assert.ok(base5.decimo13_proporcional >= worked.decimo13_proporcional);
  });
});
