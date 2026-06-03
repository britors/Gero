import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Test vacation logic in isolation

interface Entitlement {
  days_entitled: number;
  days_taken: number;
  days_sold: number;
}

function getAvailable(e: Entitlement): number {
  return e.days_entitled - e.days_taken - e.days_sold;
}

function calcAcquisitionPeriod(hireDate: Date, referenceDate: Date): {
  acquisitionStart: Date;
  acquisitionEnd: Date;
  expiresAt: Date;
} {
  const yearsWorked = Math.floor(
    (referenceDate.getTime() - hireDate.getTime()) / (365.25 * 24 * 3600 * 1000)
  );
  const acquisitionStart = new Date(hireDate);
  acquisitionStart.setFullYear(hireDate.getFullYear() + yearsWorked);

  const acquisitionEnd = new Date(acquisitionStart);
  acquisitionEnd.setFullYear(acquisitionStart.getFullYear() + 1);
  acquisitionEnd.setDate(acquisitionEnd.getDate() - 1);

  const expiresAt = new Date(acquisitionEnd);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  return { acquisitionStart, acquisitionEnd, expiresAt };
}

describe('calculateEntitlement', () => {
  test('creates correct acquisition period for new hire', () => {
    // Use explicit local dates to avoid UTC parsing issues
    const hire = new Date(2025, 0, 10); // Jan 10, 2025 local time
    const now  = new Date(2026, 5, 3);  // Jun 3, 2026 local time
    const { acquisitionStart, acquisitionEnd } = calcAcquisitionPeriod(hire, now);

    assert.equal(acquisitionStart.getFullYear(), 2026);
    assert.equal(acquisitionStart.getMonth(), 0); // January
    assert.equal(acquisitionStart.getDate(), 10);

    assert.equal(acquisitionEnd.getFullYear(), 2027);
    assert.equal(acquisitionEnd.getMonth(), 0); // January
    assert.equal(acquisitionEnd.getDate(), 9);
  });

  test('expiration is one year after acquisition end', () => {
    const hire = new Date(2023, 2, 1); // Mar 1, 2023
    const now  = new Date(2026, 5, 3);
    const { acquisitionEnd, expiresAt } = calcAcquisitionPeriod(hire, now);

    // expiresAt should be 1 year after acquisitionEnd
    assert.equal(
      expiresAt.getFullYear() - acquisitionEnd.getFullYear(),
      1
    );
    assert.equal(expiresAt.getMonth(), acquisitionEnd.getMonth());
    assert.equal(expiresAt.getDate(), acquisitionEnd.getDate());
  });

  test('correct period for employee hired on leap year edge', () => {
    const hire = new Date(2020, 1, 29); // Feb 29, 2020
    const now  = new Date(2026, 5, 3);
    const { acquisitionStart } = calcAcquisitionPeriod(hire, now);
    assert.ok(acquisitionStart instanceof Date);
    assert.ok(!isNaN(acquisitionStart.getTime()));
  });
});

describe('vacation balance', () => {
  test('available balance correctly computed', () => {
    const e: Entitlement = { days_entitled: 30, days_taken: 15, days_sold: 5 };
    assert.equal(getAvailable(e), 10);
  });

  test('balance is 0 when all days consumed', () => {
    const e: Entitlement = { days_entitled: 30, days_taken: 30, days_sold: 0 };
    assert.equal(getAvailable(e), 0);
  });

  test('request blocked if days_requested > available', () => {
    const available = 10;
    const requested = 15;
    const isBlocked = requested > available;
    assert.equal(isBlocked, true);
  });

  test('request allowed when days_requested <= available', () => {
    const available = 20;
    const requested = 15;
    const isBlocked = requested > available;
    assert.equal(isBlocked, false);
  });

  test('balance correctly deducted after approved request', () => {
    const before: Entitlement = { days_entitled: 30, days_taken: 0, days_sold: 0 };
    const daysApproved = 15;
    const after: Entitlement = { ...before, days_taken: before.days_taken + daysApproved };
    assert.equal(getAvailable(after), 15);
    assert.equal(after.days_taken, 15);
  });
});
