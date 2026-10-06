import { Router } from 'express';
import { z } from 'zod';
import { requireRole, STAFF } from '../auth.js';
import { db, tx } from '../db.js';
import { getRate } from '../lib/bcv.js';
import { nowStr, today } from '../lib/dates.js';
import { badRequest, idParam, notFound, parse, round2 } from '../lib/http.js';
import { quoteMembership, statusSql } from '../lib/memberships.js';
import { paymentLinesSchema, recordPayments } from '../lib/payments.js';

export const membershipsRouter = Router();

const quoteSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  plan_id: z.coerce.number().int().positive(),
  discount_usd: z.coerce.number().min(0).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')).transform((v) => v || null),
  waive_fee: z.coerce.boolean().optional(),
});

membershipsRouter.get('/', (req, res) => {
  const kind = String(req.query.kind ?? '');
  const status = String(req.query.status ?? '');
  const q = String(req.query.q ?? '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 20));

  const st = statusSql('m');
  const where: string[] = [];
  const params: unknown[] = [];
  if (kind === 'inscripcion' || kind === 'renovacion') {
    where.push('m.kind = ?');
    params.push(kind);
  }
  if (status) {
    where.push(`${st} = ?`);
    params.push(status);
  }
  if (q) {
    where.push("(c.document LIKE ? OR (c.first_name || ' ' || c.last_name) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  const from = `FROM memberships m JOIN clients c ON c.id = m.client_id JOIN plans p ON p.id = m.plan_id
                LEFT JOIN users u ON u.id = m.created_by ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;

  const total = (db.prepare(`SELECT COUNT(*) c ${from}`).get(...params) as { c: number }).c;
  const rows = db
    .prepare(
      `SELECT m.*, ${st} AS status, c.document, c.first_name, c.last_name, p.name AS plan_name, p.color AS plan_color,
              u.name AS created_by_name
       ${from} ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  res.json({ rows, total, page, pageSize });
});

/** Vencimientos próximos y recientes: base del módulo de renovaciones. */
membershipsRouter.get('/expiring', (req, res) => {
  const days = Math.min(60, Math.max(1, Number(req.query.days) || 7));
  const past = Math.min(90, Math.max(0, Number(req.query.past) || 15));
  const t = today();
  const rows = db
    .prepare(
      `SELECT m.id, m.client_id, m.end_date, ${statusSql('m')} AS status,
              CAST(julianday(m.end_date) - julianday(?) AS INTEGER) AS days_left,
              c.document, c.first_name, c.last_name, c.phone, p.id AS plan_id, p.name AS plan_name, p.color AS plan_color,
              p.price_usd
         FROM memberships m
         JOIN clients c ON c.id = m.client_id AND c.active = 1
         JOIN plans p ON p.id = m.plan_id
        WHERE m.cancelled_at IS NULL
          AND m.end_date = (SELECT MAX(end_date) FROM memberships x WHERE x.client_id = m.client_id AND x.cancelled_at IS NULL)
          AND m.end_date BETWEEN date(?, ?) AND date(?, ?)
        ORDER BY m.end_date`,
    )
    .all(t, t, `-${past} days`, t, `+${days} days`);
  res.json(rows);
});

membershipsRouter.post('/quote', async (req, res) => {
  const d = parse(quoteSchema, req.body);
  const q = quoteMembership({ clientId: d.client_id, planId: d.plan_id, discountUsd: d.discount_usd, startDate: d.start_date, waiveFee: d.waive_fee });
  const rate = await getRate();
  res.json({ ...q, rate: rate.rate, totalBs: round2(q.totalUsd * rate.rate) });
});

membershipsRouter.post('/', requireRole(...STAFF), async (req, res) => {
  const d = parse(
    quoteSchema.extend({ payments: paymentLinesSchema, notes: z.string().trim().max(300).optional().nullable() }),
    req.body,
  );
  const { rate } = await getRate();

  const result = tx(() => {
    const q = quoteMembership({ clientId: d.client_id, planId: d.plan_id, discountUsd: d.discount_usd, startDate: d.start_date, waiveFee: d.waive_fee });
    const r = db
      .prepare(
        `INSERT INTO memberships(client_id, plan_id, kind, start_date, end_date, price_usd, fee_usd, discount_usd, total_usd, notes, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(d.client_id, d.plan_id, q.kind, q.startDate, q.endDate, q.priceUsd, q.feeUsd, q.discountUsd, q.totalUsd, d.notes ?? null, req.user!.id, nowStr());
    const membershipId = Number(r.lastInsertRowid);
    db.prepare('UPDATE clients SET active = 1 WHERE id = ?').run(d.client_id);

    const pay =
      q.totalUsd > 0
        ? recordPayments({ lines: d.payments, totalUsd: q.totalUsd, rate, concept: q.kind, clientId: d.client_id, membershipId, userId: req.user!.id })
        : { paymentIds: [], paidUsd: 0, changeUsd: 0, changeBs: 0 };
    return { id: membershipId, ...q, ...pay, rate };
  });
  res.status(201).json(result);
});

membershipsRouter.post('/:id/cancel', requireRole('admin'), (req, res) => {
  const id = idParam(req);
  const { reason, void_payments } = parse(
    z.object({ reason: z.string().trim().min(3).max(200), void_payments: z.coerce.boolean().default(false) }),
    req.body,
  );
  tx(() => {
    const m = db.prepare('SELECT id, cancelled_at, notes FROM memberships WHERE id = ?').get(id) as
      | { id: number; cancelled_at: string | null; notes: string | null }
      | undefined;
    if (!m) throw notFound('Membresía');
    if (m.cancelled_at) throw badRequest('La membresía ya está anulada');
    const now = nowStr();
    db.prepare('UPDATE memberships SET cancelled_at = ?, notes = ? WHERE id = ?').run(
      now,
      [m.notes, `Anulada: ${reason}`].filter(Boolean).join(' · '),
      id,
    );
    if (void_payments) {
      db.prepare('UPDATE payments SET voided_at = ?, notes = ? WHERE membership_id = ? AND voided_at IS NULL').run(now, `Anulado: ${reason}`, id);
    }
  });
  res.json({ ok: true });
});
