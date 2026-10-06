import { Router } from 'express';
import { z } from 'zod';
import { requireRole, STAFF } from '../auth.js';
import { db, tx } from '../db.js';
import { getRate } from '../lib/bcv.js';
import { nowStr, today } from '../lib/dates.js';
import { badRequest, idParam, notFound, parse } from '../lib/http.js';
import { PAYMENT_METHODS, paymentLinesSchema, recordPayments } from '../lib/payments.js';

export const paymentsRouter = Router();

paymentsRouter.get('/methods', (_req, res) => {
  res.json(Object.entries(PAYMENT_METHODS).map(([id, m]) => ({ id, ...m })));
});

paymentsRouter.get('/', (req, res) => {
  const from = String(req.query.from || today());
  const to = String(req.query.to || today());
  const method = String(req.query.method ?? '');
  const concept = String(req.query.concept ?? '');
  const q = String(req.query.q ?? '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(5, Number(req.query.pageSize) || 25));

  const where = ['substr(pm.created_at,1,10) BETWEEN ? AND ?'];
  const params: unknown[] = [from, to];
  if (method) {
    where.push('pm.method = ?');
    params.push(method);
  }
  if (concept) {
    where.push('pm.concept = ?');
    params.push(concept);
  }
  if (q) {
    where.push("(pm.reference LIKE ? OR c.document LIKE ? OR (c.first_name || ' ' || c.last_name) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const fromSql = `FROM payments pm LEFT JOIN clients c ON c.id = pm.client_id LEFT JOIN users u ON u.id = pm.created_by
                   WHERE ${where.join(' AND ')}`;

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN pm.voided_at IS NULL THEN pm.amount_usd END),0) AS total_usd,
              COALESCE(SUM(CASE WHEN pm.voided_at IS NULL THEN pm.amount_bs END),0) AS total_bs
       ${fromSql}`,
    )
    .get(...params) as { count: number; total_usd: number; total_bs: number };

  const rows = db
    .prepare(
      `SELECT pm.*, c.document, c.first_name, c.last_name, u.name AS created_by_name
       ${fromSql} ORDER BY pm.created_at DESC, pm.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);

  res.json({ rows, total: totals.count, totals, page, pageSize });
});

/** Ingreso manual (ej. clase personalizada, alquiler de casillero). */
paymentsRouter.post('/', requireRole(...STAFF), async (req, res) => {
  const d = parse(
    z.object({
      client_id: z.coerce.number().int().positive().optional().nullable(),
      amount_usd: z.coerce.number().positive(),
      notes: z.string().trim().min(3, 'Indique el concepto').max(200),
      payments: paymentLinesSchema,
    }),
    req.body,
  );
  const { rate } = await getRate();
  const result = tx(() =>
    recordPayments({ lines: d.payments, totalUsd: d.amount_usd, rate, concept: 'otro', clientId: d.client_id ?? null, userId: req.user!.id, notes: d.notes }),
  );
  res.status(201).json({ ...result, rate });
});

paymentsRouter.post('/:id/void', requireRole('admin'), (req, res) => {
  const id = idParam(req);
  const { reason } = parse(z.object({ reason: z.string().trim().min(3).max(200) }), req.body);
  const p = db.prepare('SELECT voided_at FROM payments WHERE id = ?').get(id) as { voided_at: string | null } | undefined;
  if (!p) throw notFound('Pago');
  if (p.voided_at) throw badRequest('El pago ya está anulado');
  db.prepare("UPDATE payments SET voided_at = ?, notes = COALESCE(notes || ' · ', '') || ? WHERE id = ?").run(nowStr(), `Anulado: ${reason}`, id);
  res.json({ ok: true });
});
