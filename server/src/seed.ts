/**
 * Datos de demostración: `npm run seed` (usar `-- --reset` para borrar la base de datos primero).
 */
import fs from 'node:fs';
import { config } from './config.js';

if (process.argv.includes('--reset')) {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.dbPath + suffix, { force: true });
  console.log('[seed] Base de datos eliminada');
}

const { db } = await import('./db.js');
const { addDays, nowStr, parseDate, today } = await import('./lib/dates.js');
const bcrypt = (await import('bcryptjs')).default;

if (db.prepare('SELECT 1 FROM clients LIMIT 1').get()) {
  console.log('[seed] Ya existen clientes. Use `npm run seed -- --reset` para reiniciar.');
  process.exit(0);
}

let s = 42;
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const firstM = ['José', 'Luis', 'Carlos', 'Miguel', 'Andrés', 'Daniel', 'Gabriel', 'Jesús', 'Alejandro', 'Ricardo', 'Diego', 'Manuel'];
const firstF = ['María', 'Ana', 'Valentina', 'Daniela', 'Gabriela', 'Andrea', 'Carolina', 'Sofía', 'Isabella', 'Paola', 'Mariana', 'Victoria'];
const lasts = ['González', 'Rodríguez', 'Pérez', 'Hernández', 'García', 'Martínez', 'López', 'Díaz', 'Ramírez', 'Torres', 'Rojas', 'Mendoza', 'Silva', 'Castillo', 'Morales'];

const t = today();
const START = addDays(t, -150);
const rateOn = (date: string) => {
  const days = (parseDate(date).getTime() - parseDate(START).getTime()) / 86_400_000;
  return Math.round((620 + days * 1.65 + Math.sin(days / 9) * 4) * 10000) / 10000;
};
const at = (date: string, h: number, m: number) => `${date} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

db.transaction(() => {
  const hash = bcrypt.hashSync('demo1234', 10);
  const insUser = db.prepare('INSERT OR IGNORE INTO users(name, username, password_hash, role, created_at) VALUES (?,?,?,?,?)');
  insUser.run('Laura Recepción', 'recepcion', hash, 'recepcion', nowStr());
  insUser.run('Pedro Entrenador', 'entrenador', hash, 'entrenador', nowStr());
  const staffIds = (db.prepare("SELECT id FROM users WHERE role IN ('admin','recepcion')").all() as { id: number }[]).map((u) => u.id);

  const insRate = db.prepare('INSERT INTO exchange_rates(rate, source, rate_date, fetched_at) VALUES (?,?,?,?)');
  for (let d = START; d <= addDays(t, -1); d = addDays(d, 1)) {
    if (parseDate(d).getDay() % 6 !== 0) insRate.run(rateOn(d), 'Histórico (demo)', d, at(d, 8, 0));
  }

  const insProduct = db.prepare('INSERT INTO products(name, sku, category, price_usd, cost_usd, stock, min_stock, created_at) VALUES (?,?,?,?,?,?,?,?)');
  const products = [
    ['Agua mineral 600ml', 'BEB-001', 'Bebidas', 1, 0.45, 80, 20],
    ['Gatorade 500ml', 'BEB-002', 'Bebidas', 2, 1.1, 45, 15],
    ['Bebida energética', 'BEB-003', 'Bebidas', 2.5, 1.3, 30, 10],
    ['Proteína Whey 2lb', 'SUP-001', 'Suplementos', 38, 26, 12, 4],
    ['Creatina 300g', 'SUP-002', 'Suplementos', 25, 16, 9, 3],
    ['Pre-entreno 30 serv.', 'SUP-003', 'Suplementos', 30, 19, 3, 4],
    ['Barra de proteína', 'SNK-001', 'Snacks', 2.5, 1.2, 60, 15],
    ['Batido de proteína', 'SNK-002', 'Snacks', 4, 1.8, 0, 0],
    ['Guantes de entrenamiento', 'ACC-001', 'Accesorios', 15, 8, 14, 5],
    ['Toalla deportiva', 'ACC-002', 'Accesorios', 8, 4, 2, 5],
    ['Shaker 700ml', 'ACC-003', 'Accesorios', 7, 3, 25, 8],
    ['Franela IronPulse', 'ROP-001', 'Ropa', 12, 6, 18, 6],
  ] as const;
  for (const p of products) insProduct.run(...p, nowStr());
  const productRows = db.prepare('SELECT id, name, price_usd FROM products').all() as { id: number; name: string; price_usd: number }[];

  const plans = db.prepare('SELECT id, price_usd, duration_days FROM plans WHERE duration_days > 1').all() as { id: number; price_usd: number; duration_days: number }[];
  const weights = [0.62, 0.26, 0.12];

  const insClient = db.prepare(
    'INSERT INTO clients(document, first_name, last_name, phone, email, birth_date, gender, created_at) VALUES (?,?,?,?,?,?,?,?)',
  );
  const insMem = db.prepare(
    `INSERT INTO memberships(client_id, plan_id, kind, start_date, end_date, price_usd, fee_usd, discount_usd, total_usd, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,0,?,?,?)`,
  );
  const insPay = db.prepare(
    `INSERT INTO payments(client_id, membership_id, sale_id, concept, method, currency, amount_usd, amount_bs, rate, reference, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insAtt = db.prepare('INSERT INTO attendance(client_id, membership_id, check_in_at, check_out_at, created_by) VALUES (?,?,?,?,?)');
  const methods = [
    ['pago_movil', 'VES'], ['pago_movil', 'VES'], ['efectivo_usd', 'USD'], ['efectivo_usd', 'USD'],
    ['punto_venta', 'VES'], ['transferencia', 'VES'], ['zelle', 'USD'], ['binance', 'USD'],
  ] as const;

  const pay = (clientId: number | null, membershipId: number | null, saleId: number | null, concept: string, usd: number, ts: string) => {
    const date = ts.slice(0, 10);
    const rate = date >= t ? rateOn(addDays(t, -1)) : rateOn(date);
    const [method, currency] = pick(methods);
    const ref = currency === 'VES' && method !== 'punto_venta' ? String(int(100000, 999999)) : null;
    insPay.run(clientId, membershipId, saleId, concept, method, currency, usd, Math.round(usd * rate * 100) / 100, rate, ref, pick(staffIds), ts);
  };

  for (let i = 0; i < 85; i++) {
    const gender = rnd() < 0.5 ? 'M' : 'F';
    const first = pick(gender === 'M' ? firstM : firstF);
    const last = `${pick(lasts)} ${pick(lasts)}`;
    const joined = addDays(START, int(0, 140));
    const year = int(1975, 2007);
    const birth = i % 23 === 0 ? `${year}-${t.slice(5)}` : `${year}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`;
    const clientId = Number(
      insClient.run(
        `V${int(8_000_000, 32_000_000)}`,
        first,
        last,
        `04${pick(['12', '14', '16', '24', '26'])}-${int(1000000, 9999999)}`,
        rnd() < 0.7 ? `${first}.${last.split(' ')[0]}${int(1, 99)}@mail.com`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : null,
        birth,
        gender,
        at(joined, int(7, 19), int(0, 59)),
      ).lastInsertRowid,
    );

    const loyalty = rnd();
    let start = joined;
    let first_ = true;
    while (start <= t) {
      const r = rnd();
      const plan = r < weights[0] ? plans[0] : r < weights[0] + weights[1] ? plans[1] : plans[2];
      const end = addDays(start, plan.duration_days - 1);
      const fee = first_ ? 10 : 0;
      const created = at(start, int(7, 20), int(0, 59));
      const memId = Number(
        insMem.run(clientId, plan.id, first_ ? 'inscripcion' : 'renovacion', start, end, plan.price_usd, fee, plan.price_usd + fee, pick(staffIds), created).lastInsertRowid,
      );
      pay(clientId, memId, null, first_ ? 'inscripcion' : 'renovacion', plan.price_usd + fee, created);

      const freq = 0.25 + loyalty * 0.5;
      for (let d = start; d <= end && d <= t; d = addDays(d, 1)) {
        if (parseDate(d).getDay() === 0 || rnd() > freq) continue;
        const h = pick([6, 6, 7, 7, 8, 9, 11, 12, 16, 17, 17, 18, 18, 18, 19, 19, 20]);
        const m = int(0, 59);
        const isNow = d === t;
        insAtt.run(clientId, memId, at(d, h, m), isNow && rnd() < 0.5 ? null : at(d, Math.min(h + int(1, 2), 22), int(0, 59)), pick(staffIds));
      }

      first_ = false;
      if (rnd() > 0.55 + loyalty * 0.4) break;
      start = addDays(end, rnd() < 0.7 ? 1 : int(2, 12));
    }
  }

  const insSale = db.prepare('INSERT INTO sales(client_id, total_usd, rate, total_bs, created_by, created_at) VALUES (?,?,?,?,?,?)');
  const insItem = db.prepare('INSERT INTO sale_items(sale_id, product_id, name, qty, unit_price_usd, subtotal_usd) VALUES (?,?,?,?,?,?)');
  for (let d = addDays(t, -60); d <= t; d = addDays(d, 1)) {
    for (let k = 0; k < int(1, 6); k++) {
      const items = Array.from({ length: int(1, 3) }, () => ({ p: pick(productRows.filter((p) => p.price_usd < 20 || rnd() < 0.15)), qty: int(1, 2) }));
      const total = Math.round(items.reduce((sum, it) => sum + it.p.price_usd * it.qty, 0) * 100) / 100;
      const ts = at(d, int(7, 20), int(0, 59));
      const rate = rateOn(d < t ? d : addDays(t, -1));
      const saleId = Number(insSale.run(null, total, rate, Math.round(total * rate * 100) / 100, pick(staffIds), ts).lastInsertRowid);
      for (const it of items) insItem.run(saleId, it.p.id, it.p.name, it.qty, it.p.price_usd, Math.round(it.p.price_usd * it.qty * 100) / 100);
      pay(null, null, saleId, 'tienda', total, ts);
    }
  }
})();

const c = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
console.log(
  `[seed] Listo: ${c('SELECT COUNT(*) c FROM clients')} clientes, ${c('SELECT COUNT(*) c FROM memberships')} membresías, ` +
    `${c('SELECT COUNT(*) c FROM payments')} pagos, ${c('SELECT COUNT(*) c FROM attendance')} asistencias.`,
);
console.log('[seed] Usuarios demo: admin/admin123 · recepcion/demo1234 · entrenador/demo1234');
