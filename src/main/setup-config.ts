import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface PgConfig {
  host:     string;
  port:     number;
  database: string;
  user:     string;
  password: string;
}

export interface SqliteConfig {
  file: string;
}

export interface CompanyProfile {
  nomeFantasia: string;
  razaoSocial:  string;
  cnpj:         string;
  telefone?:    string;
  email?:       string;
  logradouro?:  string;
  numero?:      string;
  bairro?:      string;
  cidade?:      string;
  estado?:      string;
  cep?:         string;
}

export interface SetupConfig {
  dbType:           'postgres' | 'sqlite';
  selectedPlan:     'gratuito' | 'basico' | 'dedicado';
  pg?:              PgConfig;
  sqlite?:          SqliteConfig;
  company?:         CompanyProfile;
  setupCompletedAt: string;
}


// ─── Encryption helpers ───────────────────────────────────────────────────────

const ENC_PREFIX = 'enc:';

function encryptPwd(plain: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return ENC_PREFIX + safeStorage.encryptString(plain).toString('base64');
  }
  return plain;
}

function decryptPwd(stored: string): string {
  if (stored.startsWith(ENC_PREFIX)) {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
    return safeStorage.decryptString(buf);
  }
  return stored;
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

function configPath(): string {
  return path.join(app.getPath('userData'), 'setup_config.json');
}

export function readSetupConfig(): SetupConfig | null {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf8')) as SetupConfig;
    if (cfg.pg?.password) cfg.pg.password = decryptPwd(cfg.pg.password);
    return cfg;
  } catch {
    return null;
  }
}

export function writeSetupConfig(cfg: SetupConfig): void {
  const toWrite: SetupConfig = {
    ...cfg,
  };
  if (toWrite.pg) {
    toWrite.pg.password = encryptPwd(toWrite.pg.password);
  }
  fs.writeFileSync(configPath(), JSON.stringify(toWrite, null, 2), 'utf8');
}
