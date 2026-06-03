import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── Auth tests ───────────────────────────────────────────────────────────────
// These test the permission helper and session validation logic in isolation.

import { hasPermission } from '../src/main/middleware/permissions';

describe('hasPermission', () => {
  test('wildcard grants everything', () => {
    assert.equal(hasPermission(['*'], 'employees:read'), true);
    assert.equal(hasPermission(['*'], 'studio:access'), true);
    assert.equal(hasPermission(['*'], 'any:thing:deep'), true);
  });

  test('exact match', () => {
    assert.equal(hasPermission(['employees:read', 'payroll:read'], 'employees:read'), true);
    assert.equal(hasPermission(['employees:read'], 'employees:write'), false);
  });

  test('namespace wildcard', () => {
    assert.equal(hasPermission(['employees:*'], 'employees:read'), true);
    assert.equal(hasPermission(['employees:*'], 'employees:write'), true);
    assert.equal(hasPermission(['employees:*'], 'payroll:read'), false);
  });

  test('empty permissions denies all', () => {
    assert.equal(hasPermission([], 'employees:read'), false);
    assert.equal(hasPermission([], '*'), false);
  });

  test('hr_manager cannot access studio', () => {
    const hrPerms = [
      'employees:read','employees:write',
      'payroll:read','payroll:write',
      'timesheet:read','timesheet:write','timesheet:approve',
      'reports:read',
    ];
    assert.equal(hasPermission(hrPerms, 'studio:access'), false);
    assert.equal(hasPermission(hrPerms, 'employees:read'), true);
  });

  test('manager cannot write employees', () => {
    const managerPerms = ['employees:read', 'timesheet:read', 'timesheet:approve'];
    assert.equal(hasPermission(managerPerms, 'employees:write'), false);
    assert.equal(hasPermission(managerPerms, 'employees:read'), true);
  });
});
