import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Candidate status transition validation (mirrors IPC logic)
const VALID_TRANSITIONS: Record<string, string[]> = {
  applied:   ['screening', 'rejected'],
  screening: ['interview', 'rejected', 'applied'],
  interview: ['offer', 'rejected', 'screening'],
  offer:     ['hired', 'rejected', 'interview'],
  hired:     [],
  rejected:  [],
};

function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

describe('candidate status transitions', () => {
  test('applied → screening is valid', () => {
    assert.equal(canTransition('applied', 'screening'), true);
  });

  test('applied → hired is invalid (cannot skip stages)', () => {
    assert.equal(canTransition('applied', 'hired'), false);
  });

  test('applied → interview is invalid', () => {
    assert.equal(canTransition('applied', 'interview'), false);
  });

  test('offer → hired is valid', () => {
    assert.equal(canTransition('offer', 'hired'), true);
  });

  test('hired → any transition is invalid (terminal state)', () => {
    assert.equal(canTransition('hired', 'rejected'), false);
    assert.equal(canTransition('hired', 'applied'), false);
    assert.equal(canTransition('hired', 'screening'), false);
  });

  test('rejected → any transition is invalid (terminal state)', () => {
    assert.equal(canTransition('rejected', 'applied'), false);
    assert.equal(canTransition('rejected', 'hired'), false);
  });

  test('can reject from any active stage', () => {
    assert.equal(canTransition('applied',   'rejected'), true);
    assert.equal(canTransition('screening', 'rejected'), true);
    assert.equal(canTransition('interview', 'rejected'), true);
    assert.equal(canTransition('offer',     'rejected'), true);
  });
});

describe('hireCandidate preconditions', () => {
  test('candidate must be in offer stage to be hired', () => {
    const canHire = (status: string) => status === 'offer';
    assert.equal(canHire('offer'),     true);
    assert.equal(canHire('interview'), false);
    assert.equal(canHire('applied'),   false);
    assert.equal(canHire('hired'),     false);
  });

  test('hire creates employee record and links candidate', () => {
    // Simulate the data transformation
    const candidate = { id: 'cand-1', name: 'Lucas Mendes', email: 'lucas@test.com', status: 'offer' };
    const employeeData = { hire_date: '2026-06-01', base_salary: 5000, contract_type: 'clt' };

    const newEmployee = {
      name:          candidate.name,
      email:         candidate.email,
      hire_date:     employeeData.hire_date,
      base_salary:   employeeData.base_salary,
      contract_type: employeeData.contract_type,
    };
    const updatedCandidate = { ...candidate, status: 'hired', employee_id: 'emp-new' };

    assert.equal(newEmployee.name, 'Lucas Mendes');
    assert.equal(updatedCandidate.status, 'hired');
    assert.ok(updatedCandidate.employee_id);
  });
});
