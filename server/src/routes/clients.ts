import { Router } from 'express';
import { z } from 'zod';
import { requireRole, STAFF } from '../auth.js';
import { db } from '../db.js';
import { nowStr, today } from '../lib/dates.js';
import { idParam, notFound, parse } from '../lib/http.js';
import { currentMembership, statusSql } from '../lib/memberships.js';

export const clientsRouter = Router();

const MEMBERSHIP_STATUSES = ['activa', 'por_vencer', 'gracia', 'vencida', 'programada'];

export const normalizeDocument = (v: string) => v.toUpperCase().replace(/[\s.\-]/g, '');

const opt = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

const clientSchema = z.object({
  document: z.string().trim().min(4, 'Cédula muy corta').max(20).transform(normalizeDocument),
  first_name: z.string().trim().min(2).max(60),
  last_name: z.string().trim().min(2).max(60),
  phone: opt(30),
  email: z.string().trim().email('Correo inválido').max(120).optional().nullable().or(z.literal('')).transform((v) => v || null),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')).transform((v) => v || null),
  gender: z.enum(['M', 'F', 'O']).optional().nullable().or(z.literal('')).transform((v) => v || null),
  address: opt(200),
  emergency_contact: opt(120),
  notes: opt(500),
  active: z.coerce.boolean().default(true),
});

clientsRouter.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const status = String(req.query.status ?? '');
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 20));

  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    where.push("(c.document LIKE ? OR (c.first_name || ' ' || c.last_name) LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const membershipStatus = statusSql('m');
  if (status === 'inactivo') where.push('c.active = 0');
  else if (status === 'sin_plan') where.push('c.active = 1 AND m.id IS NULL');
  else if (MEMBERSHIP_STATUSES.includes(status)) {
    where.push(`c.active = 1 AND ${membershipStatus} = ?`);
    params.push(status);
  }

  const t = today();
  const filtered = `
    FROM clients c
    LEFT JOIN memberships m ON m.id = (
      SELECT id FROM memberships mm
       WHERE mm.client_id = c.id AND mm.cancelled_at IS NULL
       ORDER BY (mm.start_date <= '${t}' AND mm.end_date >= '${t}') DESC, mm.end_date DESC LIMIT 1)
    LEFT JOIN plans p ON p.id = m.plan_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;

  const total = (db.prepare(`SELECT COUNT(*) AS c ${filtered}`).get(...params) as { c: number }).c;
  const rows = db
    .prepare(
      `SELECT c.id, c.document, c.first_name, c.last_name, c.phone, c.email, c.active, c.created_at,
              m.id AS membership_id, m.end_date, p.name AS plan_name, p.color AS plan_color,
              CASE WHEN m.id IS NULL THEN 'sin_plan' ELSE ${membershipStatus} END AS membership_status,
              (SELECT MAX(check_in_at) FROM attendance a WHERE a.client_id = c.id) AS last_visit
       ${filtered}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);

  res.json({ rows, total, page, pageSize });
});

clientsRouter.get('/lookup', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT id, document, first_name, last_name, phone FROM clients
        WHERE active = 1 AND (document LIKE ? OR (first_name || ' ' || last_name) LIKE ?)
        ORDER BY (document = ?) DESC, first_name LIMIT 8`,
    )
    .all(like, like, q.toUpperCase());
  res.json(rows);
});

clientsRouter.get('/:id', (req, res) => {
  const id = idParam(req);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) throw notFound('Cliente');

  const memberships = db
    .prepare(
      `SELECT m.*, p.name AS plan_name, p.color AS plan_color, ${statusSql()} AS status, u.name AS created_by_name
         FROM memberships m JOIN plans p ON p.id = m.plan_id LEFT JOIN users u ON u.id = m.created_by
        WHERE m.client_id = ? ORDER BY m.start_date DESC, m.id DESC`,
    )
    .all(id);
  const payments = db
    .prepare('SELECT * FROM payments WHERE client_id = ? ORDER BY created_at DESC, id DESC LIMIT 50')
    .all(id);
  const attendance = db
    .prepare('SELECT * FROM attendance WHERE client_id = ? ORDER BY check_in_at DESC LIMIT 30')
    .all(id);
  const stats = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM attendance WHERE client_id = ?) AS visits,
         (SELECT COUNT(*) FROM attendance WHERE client_id = ? AND check_in_at >= date('now','localtime','-30 days')) AS visits_30d,
         (SELECT COALESCE(SUM(amount_usd),0) FROM payments WHERE client_id = ? AND voided_at IS NULL) AS total_paid_usd`,
    )
    .get(id, id, id);

  res.json({ client, current: currentMembership(id), memberships, payments, attendance, stats });
});

clientsRouter.post('/', requireRole(...STAFF), (req, res) => {
  const d = parse(clientSchema, req.body);
  const r = db
    .prepare(
      `INSERT INTO clients(document, first_name, last_name, phone, email, birth_date, gender, address, emergency_contact, notes, active, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(d.document, d.first_name, d.last_name, d.phone, d.email, d.birth_date, d.gender, d.address, d.emergency_contact, d.notes, d.active ? 1 : 0, nowStr());
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

clientsRouter.put('/:id', requireRole(...STAFF), (req, res) => {
  const id = idParam(req);
  const d = parse(clientSchema, req.body);
  const r = db
    .prepare(
      `UPDATE clients SET document=?, first_name=?, last_name=?, phone=?, email=?, birth_date=?, gender=?, address=?,
              emergency_contact=?, notes=?, active=? WHERE id = ?`,
    )
    .run(d.document, d.first_name, d.last_name, d.phone, d.email, d.birth_date, d.gender, d.address, d.emergency_contact, d.notes, d.active ? 1 : 0, id);
  if (!r.changes) throw notFound('Cliente');
  res.json({ ok: true });
});
