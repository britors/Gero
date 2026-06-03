import { contextBridge, ipcRenderer } from 'electron';

const channels = [
  // Auth
  'auth:login', 'auth:logout', 'auth:me', 'auth:listUsers', 'auth:createUser',
  'auth:updateUser', 'auth:deactivateUser', 'auth:changePassword',
  'auth:listRoles', 'auth:createRole',
  // Dashboard
  'dashboard:getData',
  // Employees
  'employees:list', 'employees:get', 'employees:create', 'employees:update',
  'employees:terminate', 'employees:reactivate', 'employees:listByDepartment',
  'employees:getOrgChart', 'employees:linkToOrbi', 'employees:linkToFilo',
  'employees:syncToOrbi', 'employees:syncToFilo',
  // Departments
  'departments:list', 'departments:get', 'departments:create',
  'departments:update', 'departments:delete', 'departments:getHeadcount',
  // Positions
  'positions:list', 'positions:get', 'positions:create',
  'positions:update', 'positions:delete',
  // Payroll
  'payroll:listPeriods', 'payroll:getPeriod', 'payroll:createPeriod',
  'payroll:generateEntries', 'payroll:getEntry', 'payroll:updateEntry',
  'payroll:approvePeriod', 'payroll:markPaid', 'payroll:generatePayslip',
  'payroll:recalculate', 'payroll:listEntries',
  // Timesheet
  'timesheet:list', 'timesheet:get', 'timesheet:createOrGet',
  'timesheet:listEntries', 'timesheet:addEntry', 'timesheet:updateEntry',
  'timesheet:deleteEntry', 'timesheet:submit', 'timesheet:approve',
  'timesheet:reject', 'timesheet:getMonthSummary',
  // Vacation
  'vacation:listEntitlements', 'vacation:getEntitlement', 'vacation:calculateEntitlement',
  'vacation:listRequests', 'vacation:createRequest', 'vacation:approveRequest',
  'vacation:rejectRequest', 'vacation:cancelRequest', 'vacation:getBalance',
  // Recruitment
  'recruitment:listOpenings', 'recruitment:getOpening', 'recruitment:createOpening',
  'recruitment:updateOpening', 'recruitment:closeOpening', 'recruitment:listCandidates',
  'recruitment:getCandidate', 'recruitment:createCandidate', 'recruitment:updateCandidate',
  'recruitment:scheduleInterview', 'recruitment:updateInterview', 'recruitment:hireCandidate',
  // Evaluation
  'evaluation:listCycles', 'evaluation:getCycle', 'evaluation:createCycle',
  'evaluation:startCycle', 'evaluation:listForms', 'evaluation:getForm',
  'evaluation:submitForm', 'evaluation:calibrate', 'evaluation:completeCycle',
  'evaluation:listDevelopmentPlans', 'evaluation:createPlan', 'evaluation:updatePlan',
  // Benefits
  'benefits:listBenefits', 'benefits:getBenefit', 'benefits:createBenefit',
  'benefits:updateBenefit', 'benefits:toggleBenefit', 'benefits:listEmployeeBenefits',
  'benefits:assignBenefit', 'benefits:updateAssignment', 'benefits:removeBenefit',
  // Documents
  'documents:list', 'documents:getDocument', 'documents:createRecord', 'documents:deleteRecord',
  // Modules / Studio
  'modules:list', 'modules:install', 'modules:uninstall', 'modules:toggle',
  'studio:scaffold', 'studio:readFile', 'studio:writeFile',
  'studio:runBuild', 'studio:getLogs',
  // Setup
  'setup:checkPgConnection', 'setup:checkPgExists', 'setup:complete',
  // Window controls
  'window:minimize', 'window:toggleMaximize', 'window:close',
] as const;

contextBridge.exposeInMainWorld('gero', {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!(channels as readonly string[]).includes(channel)) {
      throw new Error(`IPC channel not allowed: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, handler: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => handler(...args));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  off: (channel: string, handler: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, handler as Parameters<typeof ipcRenderer.removeListener>[1]);
  },
});
