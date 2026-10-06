import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.DB_PATH = ':memory:';

let server: Server;
let base = '';
let token = '';
let addDays: (d: string, n: number) => string;
let today: () => string;
let db: typeof import('./db.js')['db'];

async function call<T = any>(method: string, path: string, body?: unknown, auth = token): Promise<{ status: number; body: T }> {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as T };
}

before(async () => {
  ({ db } = await import('./db.js'));
  ({ addDays, today } = await import('./lib/dates.js'));
  const { saveSettings } = await import('./lib/settings.js');
  saveSettings({ rate_mode: 'manual', manual_rate: '100', enrollment_fee_usd: '10', grace_days: '2' });
  const { createApp } = await import('./app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const login = await call<{ token: string }>('POST', '/auth/login', { username: 'admin', password: 'admin123' }, '');
  token = login.body.token;
});

after(() => server.close());

describe('API IronPulse', () => {
  let clientId = 0;
  const monthly = () => (db.prepare("SELECT id, price_usd FROM plans WHERE name = 'Mensual'").get() as { id: number; price_usd: number });

  test('rechaza peticiones sin sesión', async () => {
    const r = await call('GET', '/clients', undefined, '');
    assert.equal(r.status, 401);
  });

  test('registra cliente y normaliza la cédula', async () => {
    const r = await call<{ id: number }>('POST', '/clients', { document: 'v-12.345.678', first_name: 'Ana', last_name: 'Pérez', phone: '04141234567' });
    assert.equal(r.status, 201);
    clientId = r.body.id;
    const dup = await call('POST', '/clients', { document: 'V-12345678', first_name: 'Otra', last_name: 'Persona' });
    assert.equal(dup.status, 409);
  });

  test('la primera membresía es inscripción y cobra la cuota', async () => {
    const plan = monthly();
    const q = await call('POST', '/memberships/quote', { client_id: clientId, plan_id: plan.id });
    assert.equal(q.body.kind, 'inscripcion');
    assert.equal(q.body.totalUsd, plan.price_usd + 10);
    assert.equal(q.body.totalBs, (plan.price_usd + 10) * 100);
    assert.equal(q.body.startDate, today());
    assert.equal(q.body.endDate, addDays(today(), 29));
  });

  test('rechaza pagos incompletos', async () => {
    const r = await call('POST', '/memberships', { client_id: clientId, plan_id: monthly().id, payments: [{ method: 'efectivo_usd', amount: 5 }] });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /Pago incompleto/);
  });

  test('pago mixto $ + Bs con vuelto', async () => {
    const plan = monthly();
    const total = plan.price_usd + 10;
    const r = await call('POST', '/memberships', {
      client_id: clientId,
      plan_id: plan.id,
      payments: [
        { method: 'efectivo_usd', amount: 20 },
        { method: 'pago_movil', amount: (total - 20) * 100 + 500, reference: '123456' },
      ],
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.changeUsd, 5);
    const paid = db.prepare('SELECT SUM(amount_usd) s FROM payments WHERE membership_id = ?').get(r.body.id) as { s: number };
    assert.equal(paid.s, total, 'el vuelto no se contabiliza como ingreso');
  });

  test('la renovación anticipada continúa desde el vencimiento sin perder días', async () => {
    const q = await call('POST', '/memberships/quote', { client_id: clientId, plan_id: monthly().id });
    assert.equal(q.body.kind, 'renovacion');
    assert.equal(q.body.feeUsd, 0);
    assert.equal(q.body.startDate, addDays(today(), 30));
  });

  test('check-in valida la membresía y evita duplicados del día', async () => {
    const first = await call('POST', '/attendance/check-in', { document: 'V12345678' });
    assert.equal(first.status, 201);
    assert.equal(first.body.allowed, true);
    const second = await call('POST', '/attendance/check-in', { client_id: clientId });
    assert.equal(second.body.duplicate, true);

    const c = await call<{ id: number }>('POST', '/clients', { document: 'V999', first_name: 'Sin', last_name: 'Plan' });
    const denied = await call('POST', '/attendance/check-in', { client_id: c.body.id });
    assert.equal(denied.body.allowed, false);
  });

  test('venta en tienda descuenta stock y anularla lo restituye', async () => {
    const p = await call<{ id: number }>('POST', '/store/products', { name: 'Agua', category: 'Bebidas', price_usd: 1.5, stock: 10 });
    const sale = await call('POST', '/store/sales', { items: [{ product_id: p.body.id, qty: 3 }], payments: [{ method: 'punto_venta', amount: 450 }] });
    assert.equal(sale.status, 201);
    assert.equal(sale.body.totalUsd, 4.5);
    const stock = () => (db.prepare('SELECT stock FROM products WHERE id = ?').get(p.body.id) as { stock: number }).stock;
    assert.equal(stock(), 7);

    const tooMany = await call('POST', '/store/sales', { items: [{ product_id: p.body.id, qty: 50 }], payments: [{ method: 'efectivo_usd', amount: 100 }] });
    assert.equal(tooMany.status, 400);

    await call('POST', `/store/sales/${sale.body.id}/cancel`);
    assert.equal(stock(), 10);
  });

  test('reportes y panel responden con totales coherentes', async () => {
    const r = await call('GET', '/reports/summary');
    assert.equal(r.status, 200);
    assert.equal(r.body.memberships.inscripciones, 1);
    assert.ok(r.body.income.usd > 0);
    const d = await call('GET', '/dashboard');
    assert.equal(d.body.members.active, 1);
  });

  test('el rol entrenador no puede ver pagos ni reportes', async () => {
    await call('POST', '/users', { name: 'Coach Uno', username: 'coach', password: 'secret1', role: 'entrenador' });
    const login = await call<{ token: string }>('POST', '/auth/login', { username: 'coach', password: 'secret1' }, '');
    assert.equal((await call('GET', '/payments', undefined, login.body.token)).status, 403);
    assert.equal((await call('GET', '/reports/summary', undefined, login.body.token)).status, 403);
    assert.equal((await call('GET', '/clients', undefined, login.body.token)).status, 200);
  });
});
