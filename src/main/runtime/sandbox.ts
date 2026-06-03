import vm from 'node:vm';
import { GeroSDK } from '../../shared/types';

const BLOCKED_GLOBALS = ['require', 'process', 'global', '__dirname', '__filename', 'Buffer'];

export function createSandbox(sdk: GeroSDK): vm.Context {
  const sandbox: Record<string, unknown> = {
    GeroSDK: sdk,
    console: {
      log:   (...args: unknown[]) => console.log('[module]', ...args),
      warn:  (...args: unknown[]) => console.warn('[module]', ...args),
      error: (...args: unknown[]) => console.error('[module]', ...args),
      info:  (...args: unknown[]) => console.info('[module]', ...args),
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Promise,
    Error,
    Map,
    Set,
    // blocked
    require: undefined,
    process: undefined,
    global: undefined,
    __dirname: undefined,
    __filename: undefined,
    Buffer: undefined,
    module: undefined,
    exports: undefined,
  };

  for (const key of BLOCKED_GLOBALS) {
    Object.defineProperty(sandbox, key, {
      get() { throw new Error(`Access to '${key}' is not allowed in module sandbox`); },
      configurable: false,
    });
  }

  return vm.createContext(sandbox);
}

export function runInSandbox(
  code: string,
  context: vm.Context,
  filename: string,
  timeoutMs = 5000
): unknown {
  const script = new vm.Script(code, { filename });
  return script.runInContext(context, { timeout: timeoutMs });
}
