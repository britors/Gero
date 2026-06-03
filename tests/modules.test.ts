import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateManifest } from '../src/main/runtime/module-loader';
import { createSandbox, runInSandbox } from '../src/main/runtime/sandbox';
import type { GeroSDK } from '../src/shared/types';

// Minimal SDK stub for sandbox tests
const stubSdk = {
  data:   { query: async () => [], queryOne: async () => null, execute: async () => 0 },
  ui:     { showTab: () => {}, navigate: () => {}, toast: () => {}, openModal: () => {} },
  events: { emit: () => {}, on: () => () => {} },
  utils:  { formatCurrency: (v: number) => String(v), formatDate: (d: string|Date) => String(d), uuid: () => 'test-uuid' },
  meta:   { moduleId: 'test', version: '1.0.0', appVersion: '1.0.0' },
} as GeroSDK;

describe('manifest validation', () => {
  test('valid manifest passes', () => {
    const raw = { id: 'com.test.module', name: 'Test Module', version: '1.0.0', main: 'index.js' };
    const manifest = validateManifest(raw);
    assert.equal(manifest.id, 'com.test.module');
    assert.equal(manifest.name, 'Test Module');
  });

  test('missing id throws', () => {
    assert.throws(() => validateManifest({ name: 'No ID', version: '1.0.0', main: 'index.js' }));
  });

  test('missing name throws', () => {
    assert.throws(() => validateManifest({ id: 'test', version: '1.0.0', main: 'index.js' }));
  });

  test('missing version throws', () => {
    assert.throws(() => validateManifest({ id: 'test', name: 'Test', main: 'index.js' }));
  });

  test('missing main throws', () => {
    assert.throws(() => validateManifest({ id: 'test', name: 'Test', version: '1.0.0' }));
  });

  test('non-object throws', () => {
    assert.throws(() => validateManifest('not an object'));
    assert.throws(() => validateManifest(null));
    assert.throws(() => validateManifest(undefined));
  });
});

describe('sandbox security', () => {
  test('sandbox blocks require', () => {
    const ctx = createSandbox(stubSdk);
    assert.throws(() => runInSandbox('require("fs")', ctx, 'test.js'));
  });

  test('sandbox blocks process', () => {
    const ctx = createSandbox(stubSdk);
    assert.throws(() => runInSandbox('process.exit(0)', ctx, 'test.js'));
  });

  test('sandbox blocks global', () => {
    const ctx = createSandbox(stubSdk);
    assert.throws(() => runInSandbox('global.foo', ctx, 'test.js'));
  });

  test('sandbox allows GeroSDK access', () => {
    const ctx = createSandbox(stubSdk);
    const result = runInSandbox('GeroSDK.meta.moduleId', ctx, 'test.js');
    assert.equal(result, 'test');
  });

  test('sandbox allows JSON and Math', () => {
    const ctx = createSandbox(stubSdk);
    assert.doesNotThrow(() => runInSandbox('JSON.stringify({a:1})', ctx, 'test.js'));
    assert.doesNotThrow(() => runInSandbox('Math.round(1.5)', ctx, 'test.js'));
  });

  test('sandbox allows console methods', () => {
    const ctx = createSandbox(stubSdk);
    assert.doesNotThrow(() => runInSandbox('console.log("hello")', ctx, 'test.js'));
  });
});

describe('module loader error handling', () => {
  test('invalid manifest does not crash loader', () => {
    assert.throws(() => validateManifest({}), /missing required field/i);
  });

  test('sandbox handles syntax error gracefully', () => {
    const ctx = createSandbox(stubSdk);
    assert.throws(() => runInSandbox('this is not valid javascript }{', ctx, 'bad.js'), Error);
  });

  test('sandbox enforces timeout', () => {
    const ctx = createSandbox(stubSdk);
    assert.throws(
      () => runInSandbox('while(true){}', ctx, 'infinite.js', 100),
      /Script execution timed out/i
    );
  });
});
