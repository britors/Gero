import { navigate } from '../router';

export interface TCode {
  code:        string;
  label:       string;
  description: string;
  icon:        string;
  route:       string;
  create?:     boolean;
}

// Códigos de transação (estilo SAP) para navegação rápida no Gero RH
export const TCODES: TCode[] = [
  { code: 'DB00', label: 'Dashboard',              description: 'Painel geral do sistema',            icon: 'ti-layout-dashboard', route: '/dashboard'   },
  { code: 'FN00', label: 'Funcionários',           description: 'Cadastro de colaboradores',          icon: 'ti-users',            route: '/employees'   },
  { code: 'FN01', label: 'Novo Funcionário',       description: 'Admitir novo colaborador',           icon: 'ti-user-plus',        route: '/employees',  create: true },
  { code: 'DP00', label: 'Departamentos',          description: 'Estrutura organizacional',           icon: 'ti-building',         route: '/departments' },
  { code: 'DP01', label: 'Novo Departamento',      description: 'Cadastrar departamento',             icon: 'ti-building',         route: '/departments', create: true },
  { code: 'CG00', label: 'Cargos',                 description: 'Cargos e funções',                   icon: 'ti-briefcase',        route: '/positions'   },
  { code: 'CG01', label: 'Novo Cargo',             description: 'Cadastrar cargo',                    icon: 'ti-briefcase',        route: '/positions',  create: true },
  { code: 'FP00', label: 'Folha de Pagamento',     description: 'Processamento da folha',             icon: 'ti-cash',             route: '/payroll'     },
  { code: 'HL00', label: 'Holerites',              description: 'Recibos de pagamento',               icon: 'ti-file-dollar',      route: '/payslip'     },
  { code: 'RC00', label: 'Rescisão',               description: 'Cálculo de rescisão',                icon: 'ti-file-off',         route: '/rescisao'    },
  { code: 'PT00', label: 'Controle de Ponto',      description: 'Registro de jornada',                icon: 'ti-clock',            route: '/timesheet'   },
  { code: 'FE00', label: 'Férias',                 description: 'Gestão de férias',                   icon: 'ti-beach',            route: '/vacation'    },
  { code: 'RE00', label: 'Recrutamento',           description: 'Vagas e candidatos',                 icon: 'ti-user-search',      route: '/recruitment' },
  { code: 'AD00', label: 'Avaliação de Desempenho', description: 'Ciclos de avaliação',               icon: 'ti-target-arrow',     route: '/evaluation'  },
  { code: 'BN00', label: 'Benefícios',             description: 'Gestão de benefícios',               icon: 'ti-gift',             route: '/benefits'    },
  { code: 'DC00', label: 'Documentos',             description: 'Documentos de RH',                   icon: 'ti-files',            route: '/documents'   },
  { code: 'RL00', label: 'Relatórios',             description: 'Relatórios gerenciais',              icon: 'ti-chart-bar',        route: '/reports'     },
  { code: 'ST00', label: 'Studio',                 description: 'Desenvolvimento de módulos',         icon: 'ti-code',             route: '/studio'      },
  { code: 'CF00', label: 'Configurações',          description: 'Parâmetros do sistema',              icon: 'ti-settings',         route: '/settings'    },
];

export function executeTCode(code: string): void {
  const tc = TCODES.find(t => t.code === code);
  if (!tc) return;
  navigate(tc.route);
  if (tc.create) {
    setTimeout(() => window.dispatchEvent(new CustomEvent('gero:new', { detail: { code } })), 150);
  }
}

export function filterTCodes(q: string): TCode[] {
  if (!q) return TCODES;
  const u = q.toUpperCase();
  const lower = q.toLowerCase();
  return TCODES.filter(t =>
    t.code.startsWith(u) ||
    t.label.toLowerCase().includes(lower) ||
    t.description.toLowerCase().includes(lower)
  );
}
