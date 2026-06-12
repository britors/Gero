# Gero — Sistema de Gestão de RH

> **Pessoas que geram resultados.**

Gero é um sistema completo de gestão de recursos humanos para empresas de todos os portes, desenvolvido como aplicação desktop pela **W3TI SERVIÇOS DE INFORMÁTICA LTDA**.

---

## Stack Tecnológica

- **Electron** (latest stable) — aplicação desktop multiplataforma
- **TypeScript** (strict mode) — linguagem principal
- **PostgreSQL** via `node-postgres` (pg) — banco de dados, SQL puro sem ORM
- **bcrypt** — hash de senhas (saltRounds: 12)
- **esbuild** — bundler e modo watch
- **Node.js `node:test`** — testes unitários
- **SVG inline** — todos os gráficos e charts
- **Node.js `vm`** — sandbox para módulos customizados (Studio)

---

## Pré-requisitos

- Node.js 20+
- PostgreSQL 14+
- npm 9+

---

## Instalação e Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/w3ti/gero
cd gero
npm install
```

### 2. Configure o banco de dados

Copie o arquivo de exemplo de variáveis de ambiente:

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais do PostgreSQL:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/gero

# Ou individualmente:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gero
DB_USER=postgres
DB_PASS=postgres
```

Crie o banco:

```sql
CREATE DATABASE gero;
```

### 3. Execute as migrações

```bash
npm run migrate
```

### 4. Populte os usuários seed

```bash
npm run seed-users
```

Usuários criados:

| Nome | E-mail | Senha | Perfil |
|------|--------|-------|--------|
| Rodrigo Brito | rodrigo@w3ti.com.br | Admin@123 | admin |
| RH Demo | rh@w3ti.com.br | RH@123 | hr_manager |
| Gestor Demo | gestor@w3ti.com.br | Manager@123 | manager |
| Dev Demo | dev@w3ti.com.br | Dev@123 | developer |

### 5. Inicie a aplicação

```bash
# Build + iniciar
npm start

# Modo desenvolvimento (watch + DevTools)
npm run dev
```

---

## Funcionalidades

- **Dashboard** — visão geral com métricas, gráficos SVG, aniversariantes e vagas abertas
- **Funcionários** — cadastro completo, perfil com abas, organograma, integração Orbi/Filo
- **Departamentos e Cargos** — estrutura organizacional
- **Folha de Pagamento** — cálculo automático com regras brasileiras (INSS progressivo, IRRF, FGTS), holerites em HTML
- **Controle de Ponto** — calendário mensal com clock-in/clock-out, horas extras, aprovação
- **Férias** — períodos aquisitivos, solicitações, aprovação, saldo
- **Recrutamento** — kanban de candidatos por etapa, entrevistas, contratação
- **Avaliação de Desempenho** — ciclos, formulários por competência, PDIs, calibração
- **Benefícios** — cadastro e atribuição por funcionário
- **Documentos** — registro de contratos, holerites e certificados
- **Relatórios** — headcount, folha, rotatividade, benefícios
- **Studio** — editor Monaco para módulos customizados (role developer)
- **Configurações** — usuários, perfis, integrações, sobre

---

## Regras de Folha Brasileira

### INSS (tabela progressiva)

| Faixa | Alíquota |
|-------|---------|
| Até R$ 1.412,00 | 7,5% |
| R$ 1.412,01 – R$ 2.666,68 | 9,0% |
| R$ 2.666,69 – R$ 4.000,03 | 12,0% |
| R$ 4.000,04 – R$ 7.786,02 | 14,0% |
| Teto máximo | R$ 908,86 |

### IRRF (sobre base = bruto - INSS)

| Faixa | Alíquota | Parcela a deduzir |
|-------|---------|-------------------|
| Até R$ 2.259,20 | Isento | — |
| R$ 2.259,21 – R$ 2.826,65 | 7,5% | R$ 169,44 |
| R$ 2.826,66 – R$ 3.751,05 | 15% | R$ 381,44 |
| R$ 3.751,06 – R$ 4.664,68 | 22,5% | R$ 662,77 |
| Acima de R$ 4.664,68 | 27,5% | R$ 896,00 |

### FGTS
- 8% do salário bruto (custo do empregador, não descontado do líquido)

---

## Gero SDK — Módulos Customizados

O Gero Studio permite criar módulos que estendem a aplicação. Módulos são executados em sandbox `vm` com acesso ao `GeroSDK`.

### Interface GeroSDK

```typescript
interface GeroSDK {
  data: {
    query<T>(sql: string, params?: unknown[]): Promise<T[]>;
    queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
    execute(sql: string, params?: unknown[]): Promise<number>;
  };
  ui: {
    showTab(target: 'employee' | 'candidate' | 'evaluation', tabId: string, context: Record<string, unknown>): void;
    navigate(route: string, params?: Record<string, unknown>): void;
    toast(message: string, type?: 'success' | 'error' | 'info' | 'warning'): void;
    openModal(title: string, content: string): void;
  };
  events: {
    emit(event: string, payload?: unknown): void;
    on(event: string, handler: (payload: unknown) => void): () => void;
  };
  utils: {
    formatCurrency(value: number): string;
    formatDate(date: string | Date): string;
    uuid(): string;
  };
  meta: {
    moduleId: string;
    version: string;
    appVersion: string;
  };
}
```

### Estrutura de um módulo

```
~/gero-modulos/meu-modulo/
├── gero-module.json   # manifest
└── index.js           # entry point (executado no sandbox)
```

### Manifest (`gero-module.json`)

```json
{
  "id": "com.suaempresa.meu-modulo",
  "name": "Meu Módulo",
  "version": "1.0.0",
  "description": "Descrição do módulo",
  "author": "Sua Empresa",
  "main": "index.js",
  "permissions": ["data:read"]
}
```

### Eventos disponíveis

```
employee.hired | employee.terminated | employee.updated | employee.transferred
payroll.generated | payroll.approved | payroll.paid
timesheet.submitted | timesheet.approved | timesheet.rejected
vacation.requested | vacation.approved | vacation.rejected
candidate.applied | candidate.hired | candidate.rejected
evaluation.cycle_started | evaluation.form_submitted | evaluation.cycle_completed
app.ready | app.before_shutdown
```

> **Atenção:** Módulos não podem emitir eventos com prefixo `gero.*`, `orbi.*` ou `filo.*`.

---

## Integração Orbi & Filo

O Gero integra com o **Orbi (ERP)** e **Filo (CRM)** via banco de dados PostgreSQL compartilhado e event bus interno.

### Campos de integração no funcionário

```sql
orbi_user_id uuid  -- links to Orbi users table
filo_user_id uuid  -- links to Filo users table
```

### IPC disponíveis

```typescript
employees:linkToOrbi(employeeId, orbiUserId)    // vincula ao Orbi
employees:linkToFilo(employeeId, filoUserId)    // vincula ao Filo
employees:syncToOrbi(employeeId)                // sincroniza dados
employees:syncToFilo(employeeId)                // sincroniza dados
```

### Eventos emitidos para outras aplicações

| Evento Gero | Ação esperada |
|-------------|---------------|
| `payroll.paid` | Orbi cria transação financeira de despesa |
| `employee.hired` | Orbi/Filo ativam usuário se vinculado |
| `employee.terminated` | Orbi/Filo desativam usuário |

---

## Testes

```bash
npm test
```

Cobertura mínima: 14 testes em 5 arquivos.

| Arquivo | Testes |
|---------|--------|
| auth.test.ts | hasPermission (6 casos) |
| payroll.test.ts | INSS, IRRF, salário líquido (9 casos) |
| timesheet.test.ts | horas trabalhadas, horas extras (8 casos) |
| vacation.test.ts | período aquisitivo, saldo (7 casos) |
| recruitment.test.ts | transições de status, contratação (7 casos) |
| modules.test.ts | manifest, sandbox, segurança (10 casos) |

---

## Scripts

```bash
npm run build     # build único
npm run watch     # watch mode
npm start         # build + electron
npm run dev       # watch + electron (DevTools abertos)
npm test          # testes unitários
npm run migrate   # aplica migrações pendentes
npm run seed-users # cria usuários iniciais
```

---

## Metadados

- **App ID:** `br.com.w3ti.gero`
- **Versão:** 1.0.0
- **Copyright:** © 2026 W3TI SERVIÇOS DE INFORMÁTICA LTDA
- **Website:** https://w3ti.com.br
- **Suporte:** suporte@w3ti.com.br

---

## Roadmap

- [ ] Décimo terceiro (13th salary)
- [ ] Ponto eletrônico via integração
- [ ] Exportação de relatórios em PDF/Excel
- [ ] Notificações push para aprovações pendentes
- [ ] App mobile para autoatendimento do funcionário

---

## Screenshots

> *(Em breve)*

---

## Licença

Este projeto está licenciado sob a [GPLv3](LICENSE).
