-- Migration 002: Roles and seed users

INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Acesso total ao sistema', ARRAY['*']),
('hr_manager', 'Acesso completo de RH, sem configurações do sistema', ARRAY[
  'employees:read','employees:write',
  'payroll:read','payroll:write',
  'timesheet:read','timesheet:write','timesheet:approve',
  'recruitment:read','recruitment:write',
  'evaluation:read','evaluation:write',
  'benefits:read','benefits:write',
  'vacation:read','vacation:write','vacation:approve',
  'reports:read',
  'modules:read'
]),
('manager', 'Acesso de gestão de equipe', ARRAY[
  'employees:read',
  'timesheet:read','timesheet:approve',
  'evaluation:read','evaluation:write',
  'vacation:read','vacation:approve',
  'reports:read'
]),
('employee', 'Acesso de autoatendimento', ARRAY[
  'employees:read_own',
  'timesheet:read_own','timesheet:write_own',
  'vacation:read_own','vacation:request',
  'evaluation:read_own','evaluation:write_own'
]),
('developer', 'Acesso total mais Studio', ARRAY[
  '*',
  'studio:access','studio:create_module','studio:install_module',
  'studio:delete_module','studio:run_module','studio:publish_module',
  'sdk:data_api','sdk:ui_api','sdk:events_api','sdk:utils_api'
]);

-- Note: actual user records are inserted by seed-users.ts (needs bcrypt hashing)
-- Users to seed:
-- Rodrigo Brito  / admin       / rodrigo@w3ti.com.br / Admin@123
-- RH Demo        / hr_manager  / rh@w3ti.com.br      / RH@123
-- Gestor Demo    / manager     / gestor@w3ti.com.br  / Manager@123
-- Dev Demo       / developer   / dev@w3ti.com.br     / Dev@123
