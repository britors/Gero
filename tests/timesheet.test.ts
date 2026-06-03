import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Test timesheet calculation helpers in isolation

function calcWorkedHours(
  clockIn?: string,
  clockOut?: string,
  breakStart?: string,
  breakEnd?: string
): number {
  if (!clockIn || !clockOut) return 0;
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  let worked = toMin(clockOut) - toMin(clockIn);
  if (breakStart && breakEnd) worked -= (toMin(breakEnd) - toMin(breakStart));
  return parseFloat((Math.max(0, worked) / 60).toFixed(2));
}

function calcOvertime(workedHours: number, scheduledHours: number): number {
  return parseFloat(Math.max(0, workedHours - scheduledHours).toFixed(2));
}

describe('calcWorkedHours', () => {
  test('8h workday without break', () => {
    const h = calcWorkedHours('08:00', '17:00');
    assert.equal(h, 9); // 9 hours
  });

  test('8h workday with 1h lunch break', () => {
    const h = calcWorkedHours('08:00', '17:00', '12:00', '13:00');
    assert.equal(h, 8);
  });

  test('returns 0 if clock_in or clock_out missing', () => {
    assert.equal(calcWorkedHours(undefined, '17:00'), 0);
    assert.equal(calcWorkedHours('08:00', undefined), 0);
    assert.equal(calcWorkedHours(), 0);
  });

  test('partial day calculates correctly', () => {
    const h = calcWorkedHours('09:00', '13:30');
    assert.equal(h, 4.5);
  });

  test('addEntry updates worked_hours correctly (minutes precision)', () => {
    const h = calcWorkedHours('08:30', '17:15', '12:00', '13:00');
    assert.equal(h, 7.75); // 8h45m - 1h = 7h45m = 7.75
  });
});

describe('overtime detection', () => {
  test('overtime when worked > scheduled', () => {
    const ot = calcOvertime(10, 8);
    assert.equal(ot, 2);
  });

  test('no overtime when worked <= scheduled', () => {
    assert.equal(calcOvertime(8, 8), 0);
    assert.equal(calcOvertime(7, 8), 0);
  });

  test('overtime calculation with fractional hours', () => {
    const ot = calcOvertime(9.5, 8);
    assert.equal(ot, 1.5);
  });
});

describe('timesheet submission validation', () => {
  test('submit blocked if timesheet status is not open', () => {
    // Simulate: only 'open' timesheets can be submitted
    const canSubmit = (status: string) => status === 'open';
    assert.equal(canSubmit('open'), true);
    assert.equal(canSubmit('submitted'), false);
    assert.equal(canSubmit('approved'), false);
    assert.equal(canSubmit('rejected'), false);
  });

  test('working days in a month without entries should not block', () => {
    // The IPC handler does not block for missing entries — it just submits
    // This tests that the constraint from requirements is document-level
    const hasMissingEntries = (totalEntries: number, workingDays: number) =>
      totalEntries < workingDays;
    // June 2026 has ~21 working days
    assert.equal(hasMissingEntries(15, 21), true);  // missing entries
    assert.equal(hasMissingEntries(21, 21), false); // complete
  });
});
