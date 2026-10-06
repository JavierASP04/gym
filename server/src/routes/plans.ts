import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { db } from '../db.js';
import { nowStr, today } from '../lib/dates.js';
import { idParam, notFound, parse } from '../lib/http.js';

export const plansRouter = Router();

const planSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional().nullable(),
  price_usd: z.coerce.number().min(0).max(100000),
  duration_days: z.coerce.number().int().min(1).max(3650),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#22c55e'),
  features: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  active: z.coerce.boolean().default(true),
});

plansRouter.get('/', (_req, res) => {
  const t = today();
  const rows = db
    .prepare(
      `SELECT p.*,
              (SELECT COUNT(DISTINCT client_id) FROM memberships m
                WHERE m.plan_id = p.id AND m.cancelled_at IS NULL AND m.start_date <= ? AND m.end_date >= ?) AS active_members
         FROM plans p ORDER BY p.active DESC, p.duration_days, p.price_usd`,
    )
    .all(t, t) as Array<Record<string, unknown> & { features: string }>;
  res.json(rows.map((r) => ({ ...r, features: JSON.parse(r.features || '[]') })));
});

plansRouter.post('/', requireRole('admin'), (req, res) => {
  const d = parse(planSchema, req.body);
  const r = db
    .prepare('INSERT INTO plans(name, description, price_usd, duration_days, color, features, active, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(d.name, d.description ?? null, d.price_usd, d.duration_days, d.color, JSON.stringify(d.features), d.active ? 1 : 0, nowStr());
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

plansRouter.put('/:id', requireRole('admin'), (req, res) => {
  const id = idParam(req);
  const d = parse(planSchema, req.body);
  const r = db
    .prepare('UPDATE plans SET name=?, description=?, price_usd=?, duration_days=?, color=?, features=?, active=? WHERE id=?')
    .run(d.name, d.description ?? null, d.price_usd, d.duration_days, d.color, JSON.stringify(d.features), d.active ? 1 : 0, id);
  if (!r.changes) throw notFound('Plan');
  res.json({ ok: true });
});
