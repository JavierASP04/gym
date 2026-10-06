import { Router } from 'express';
import { z } from 'zod';
import { requireRole, STAFF } from '../auth.js';
import { db, tx } from '../db.js';
import { getRate } from '../lib/bcv.js';
import { nowStr, today } from '../lib/dates.js';
import { badRequest, idParam, notFound, parse, round2 } from '../lib/http.js';
import { paymentLinesSchema, recordPayments } from '../lib/payments.js';

export const storeRouter = Router();

const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  sku: z.string().trim().max(40).optional().nullable().transform((v) => v || null),
  category: z.string().trim().min(2).max(40).default('General'),
  price_usd: z.coerce.number().min(0).max(100000),
  cost_usd: z.coerce.number().min(0).max(100000).default(0),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  min_stock: z.coerce.number().int().min(0).max(100000).default(0),
  active: z.coerce.boolean().default(true),
});

storeRouter.get('/products', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const onlyActive = req.query.active === '1';
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    where.push('(name LIKE ? OR sku LIKE ? OR category LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (onlyActive) where.push('active = 1');
  res.json(
    db
      .prepare(`SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY active DESC, category, name`)
      .all(...params),
  );
});

storeRouter.get('/categories', (_req, res) => {
  res.json((db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all() as { category: string }[]).map((r) => r.category));
});

storeRouter.post('/products', requireRole('admin'), (req, res) => {
  const d = parse(productSchema, req.body);
  const r = db
    .prepare('INSERT INTO products(name, sku, category, price_usd, cost_usd, stock, min_stock, active, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(d.name, d.sku, d.category, d.price_usd, d.cost_usd, d.stock, d.min_stock, d.active ? 1 : 0, nowStr());
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

storeRouter.put('/products/:id', requireRole('admin'), (req, res) => {
  const id = idParam(req);
  const d = parse(productSchema, req.body);
  const r = db
    .prepare('UPDATE products SET name=?, sku=?, category=?, price_usd=?, cost_usd=?, stock=?, min_stock=?, active=? WHERE id=?')
    .run(d.name, d.sku, d.category, d.price_usd, d.cost_usd, d.stock, d.min_stock, d.active ? 1 : 0, id);
  if (!r.changes) throw notFound('Producto');
  res.json({ ok: true });
});

storeRouter.post('/products/:id/stock', requireRole(...STAFF), (req, res) => {
  const id = idParam(req);
  const { delta } = parse(z.object({ delta: z.coerce.number().int().refine((n) => n !== 0) }), req.body);
  const r = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND stock + ? >= 0').run(delta, id, delta);
  if (!r.changes) throw badRequest('Ajuste inválido: el stock no puede quedar negativo');
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

storeRouter.get('/sales', (req, res) => {
  const from = String(req.query.from || today());
  const to = String(req.query.to || today());
  const sales = db
    .prepare(
      `SELECT s.*, c.first_name, c.last_name, c.document, u.name AS created_by_name,
              (SELECT GROUP_CONCAT(si.qty || '× ' || si.name, ', ') FROM sale_items si WHERE si.sale_id = s.id) AS summary,
              (SELECT GROUP_CONCAT(DISTINCT pm.method) FROM payments pm WHERE pm.sale_id = s.id) AS methods
         FROM sales s LEFT JOIN clients c ON c.id = s.client_id LEFT JOIN users u ON u.id = s.created_by
        WHERE substr(s.created_at,1,10) BETWEEN ? AND ?
        ORDER BY s.created_at DESC, s.id DESC LIMIT 300`,
    )
    .all(from, to);
  res.json(sales);
});

storeRouter.post('/sales', requireRole(...STAFF), async (req, res) => {
  const d = parse(
    z.object({
      client_id: z.coerce.number().int().positive().optional().nullable(),
      items: z
        .array(z.object({ product_id: z.coerce.number().int().positive(), qty: z.coerce.number().int().min(1).max(999) }))
        .min(1, 'El carrito está vacío'),
      payments: paymentLinesSchema,
    }),
    req.body,
  );
  const { rate } = await getRate();

  const result = tx(() => {
    const getProduct = db.prepare('SELECT id, name, price_usd, stock, active FROM products WHERE id = ?');
    const merged = new Map<number, number>();
    for (const it of d.items) merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.qty);

    const lines = [...merged].map(([productId, qty]) => {
      const p = getProduct.get(productId) as { id: number; name: string; price_usd: number; stock: number; active: number } | undefined;
      if (!p || !p.active) throw badRequest('Producto no disponible');
      if (p.stock < qty) throw badRequest(`Stock insuficiente de "${p.name}" (disponible: ${p.stock})`);
      return { p, qty, subtotal: round2(p.price_usd * qty) };
    });
    const totalUsd = round2(lines.reduce((s, l) => s + l.subtotal, 0));
    const createdAt = nowStr();

    const sale = db
      .prepare('INSERT INTO sales(client_id, total_usd, rate, total_bs, created_by, created_at) VALUES (?,?,?,?,?,?)')
      .run(d.client_id ?? null, totalUsd, rate, round2(totalUsd * rate), req.user!.id, createdAt);
    const saleId = Number(sale.lastInsertRowid);

    const insItem = db.prepare('INSERT INTO sale_items(sale_id, product_id, name, qty, unit_price_usd, subtotal_usd) VALUES (?,?,?,?,?,?)');
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const l of lines) {
      insItem.run(saleId, l.p.id, l.p.name, l.qty, l.p.price_usd, l.subtotal);
      decStock.run(l.qty, l.p.id);
    }
    const pay = recordPayments({ lines: d.payments, totalUsd, rate, concept: 'tienda', clientId: d.client_id ?? null, saleId, userId: req.user!.id });
    return { id: saleId, totalUsd, totalBs: round2(totalUsd * rate), rate, ...pay };
  });
  res.status(201).json(result);
});

storeRouter.get('/sales/:id', (req, res) => {
  const id = idParam(req);
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) throw notFound('Venta');
  res.json({
    sale,
    items: db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id),
    payments: db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(id),
  });
});

storeRouter.post('/sales/:id/cancel', requireRole('admin'), (req, res) => {
  const id = idParam(req);
  tx(() => {
    const s = db.prepare('SELECT cancelled_at FROM sales WHERE id = ?').get(id) as { cancelled_at: string | null } | undefined;
    if (!s) throw notFound('Venta');
    if (s.cancelled_at) throw badRequest('La venta ya fue anulada');
    const now = nowStr();
    db.prepare('UPDATE sales SET cancelled_at = ? WHERE id = ?').run(now, id);
    db.prepare('UPDATE payments SET voided_at = ? WHERE sale_id = ? AND voided_at IS NULL').run(now, id);
    const items = db.prepare('SELECT product_id, qty FROM sale_items WHERE sale_id = ?').all(id) as { product_id: number; qty: number }[];
    const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    for (const it of items) inc.run(it.qty, it.product_id);
  });
  res.json({ ok: true });
});
