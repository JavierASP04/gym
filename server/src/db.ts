import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { nowStr } from './lib/dates.js';

const schema = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','recepcion','entrenador')),
  active        INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id                INTEGER PRIMARY KEY,
  document          TEXT NOT NULL UNIQUE,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  birth_date        TEXT,
  gender            TEXT CHECK (gender IN ('M','F','O') OR gender IS NULL),
  address           TEXT,
  emergency_contact TEXT,
  notes             TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(first_name, last_name);

CREATE TABLE IF NOT EXISTS plans (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  price_usd     REAL NOT NULL CHECK (price_usd >= 0),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  color         TEXT NOT NULL DEFAULT '#22c55e',
  features      TEXT NOT NULL DEFAULT '[]',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id           INTEGER PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES clients(id),
  plan_id      INTEGER NOT NULL REFERENCES plans(id),
  kind         TEXT NOT NULL CHECK (kind IN ('inscripcion','renovacion')),
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  price_usd    REAL NOT NULL,
  fee_usd      REAL NOT NULL DEFAULT 0,
  discount_usd REAL NOT NULL DEFAULT 0,
  total_usd    REAL NOT NULL,
  notes        TEXT,
  cancelled_at TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memberships_client ON memberships(client_id, end_date);
CREATE INDEX IF NOT EXISTS idx_memberships_end ON memberships(end_date);

CREATE TABLE IF NOT EXISTS products (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  sku        TEXT UNIQUE,
  category   TEXT NOT NULL DEFAULT 'General',
  price_usd  REAL NOT NULL CHECK (price_usd >= 0),
  cost_usd   REAL NOT NULL DEFAULT 0,
  stock      INTEGER NOT NULL DEFAULT 0,
  min_stock  INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id           INTEGER PRIMARY KEY,
  client_id    INTEGER REFERENCES clients(id),
  total_usd    REAL NOT NULL,
  rate         REAL NOT NULL,
  total_bs     REAL NOT NULL,
  cancelled_at TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id             INTEGER PRIMARY KEY,
  sale_id        INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  name           TEXT NOT NULL,
  qty            INTEGER NOT NULL CHECK (qty > 0),
  unit_price_usd REAL NOT NULL,
  subtotal_usd   REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY,
  client_id     INTEGER REFERENCES clients(id),
  membership_id INTEGER REFERENCES memberships(id),
  sale_id       INTEGER REFERENCES sales(id),
  concept       TEXT NOT NULL CHECK (concept IN ('inscripcion','renovacion','tienda','otro')),
  method        TEXT NOT NULL,
  currency      TEXT NOT NULL CHECK (currency IN ('USD','VES')),
  amount_usd    REAL NOT NULL,
  amount_bs     REAL NOT NULL,
  rate          REAL NOT NULL,
  reference     TEXT,
  notes         TEXT,
  voided_at     TEXT,
  created_by    INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);

CREATE TABLE IF NOT EXISTS attendance (
  id            INTEGER PRIMARY KEY,
  client_id     INTEGER NOT NULL REFERENCES clients(id),
  membership_id INTEGER REFERENCES memberships(id),
  check_in_at   TEXT NOT NULL,
  check_out_at  TEXT,
  created_by    INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_checkin ON attendance(check_in_at);
CREATE INDEX IF NOT EXISTS idx_attendance_client ON attendance(client_id, check_in_at);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id         INTEGER PRIMARY KEY,
  rate       REAL NOT NULL CHECK (rate > 0),
  source     TEXT NOT NULL,
  rate_date  TEXT,
  fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rates_fetched ON exchange_rates(fetched_at);
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  gym_name: 'IronPulse Gym',
  gym_rif: 'J-00000000-0',
  gym_phone: '',
  gym_address: '',
  gym_email: '',
  enrollment_fee_usd: '10',
  grace_days: '3',
  expiring_alert_days: '5',
  rate_mode: 'auto',
  manual_rate: '0',
  rate_refresh_minutes: '60',
  one_checkin_per_day: '1',
  receipt_footer: '¡Gracias por entrenar con nosotros!',
};

function openDb(file: string) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.exec(schema);
  bootstrap(db);
  return db;
}

function bootstrap(db: Database.Database) {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

  const hasUsers = db.prepare('SELECT 1 FROM users LIMIT 1').get();
  if (!hasUsers) {
    db.prepare(
      `INSERT INTO users(name, username, password_hash, role, created_at) VALUES (?,?,?,?,?)`,
    ).run('Administrador', 'admin', bcrypt.hashSync('admin123', 10), 'admin', nowStr());
    console.log('[db] Usuario inicial creado → admin / admin123 (cámbialo al ingresar)');
  }

  const hasPlans = db.prepare('SELECT 1 FROM plans LIMIT 1').get();
  if (!hasPlans) {
    const p = db.prepare(
      `INSERT INTO plans(name, description, price_usd, duration_days, color, features, created_at)
       VALUES (?,?,?,?,?,?,?)`,
    );
    const now = nowStr();
    p.run('Pase diario', 'Acceso por un día', 3, 1, '#38bdf8', '["Acceso a sala de pesas"]', now);
    p.run('Mensual', 'Acceso ilimitado por 30 días', 25, 30, '#22c55e', '["Sala de pesas","Cardio","Clases grupales"]', now);
    p.run('Trimestral', '90 días con descuento', 65, 90, '#a855f7', '["Todo lo del mensual","Evaluación física"]', now);
    p.run('Anual', 'El mejor precio por día', 230, 365, '#f59e0b', '["Todo incluido","Plan nutricional","2 invitados/mes"]', now);
  }
}

export const db = openDb(config.dbPath);

export function tx<T>(fn: () => T): T {
  return db.transaction(fn)();
}
