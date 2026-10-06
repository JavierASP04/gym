import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { nowStr, today } from '../lib/dates.js';
import { HttpError, idParam, notFound, parse } from '../lib/http.js';
import { currentMembership } from '../lib/memberships.js';
import { getSetting } from '../lib/settings.js';
import { normalizeDocument } from './clients.js';

export const attendanceRouter = Router();

attendanceRouter.get('/', (req, res) => {
  const date = String(req.query.date || today());
  const rows = db
    .prepare(
      `SELECT a.*, c.document, c.first_name, c.last_name, p.name AS plan_name, p.color AS plan_color, m.end_date
         FROM attendance a
         JOIN clients c ON c.id = a.client_id
         LEFT JOIN memberships m ON m.id = a.membership_id
         LEFT JOIN plans p ON p.id = m.plan_id
        WHERE substr(a.check_in_at,1,10) = ?
        ORDER BY a.check_in_at DESC`,
    )
    .all(date) as Array<{ check_out_at: string | null }>;
  res.json({ date, rows, inside: rows.filter((r) => !r.check_out_at).length });
});

/**
 * Registro de entrada por cédula o ID. Valida membresía vigente (incluye días de gracia).
 * Responde 200 con `allowed:false` cuando se niega el acceso, para que la recepción vea el motivo.
 */
attendanceRouter.post('/check-in', (req, res) => {
  const d = parse(
    z.object({ document: z.string().trim().optional(), client_id: z.coerce.number().int().positive().optional() }).refine(
      (v) => v.document || v.client_id,
      'Indique cédula o cliente',
    ),
    req.body,
  );
  const client = (
    d.client_id
      ? db.prepare('SELECT id, document, first_name, last_name, active FROM clients WHERE id = ?').get(d.client_id)
      : db
          .prepare('SELECT id, document, first_name, last_name, active FROM clients WHERE document = ?')
          .get(normalizeDocument(d.document!))
  ) as { id: number; document: string; first_name: string; last_name: string; active: number } | undefined;

  if (!client) throw notFound('Cliente');
  const membership = currentMembership(client.id);
  const base = { client, membership };

  if (!client.active) return res.json({ ...base, allowed: false, reason: 'Cliente inactivo' });
  if (!membership) return res.json({ ...base, allowed: false, reason: 'No tiene membresía registrada' });
  if (membership.status === 'programada') {
    return res.json({ ...base, allowed: false, reason: `Su plan inicia el ${membership.start_date}` });
  }
  if (membership.status === 'vencida') {
    return res.json({ ...base, allowed: false, reason: `Membresía vencida desde el ${membership.end_date}` });
  }

  if (getSetting('one_checkin_per_day') === '1') {
    const existing = db
      .prepare('SELECT * FROM attendance WHERE client_id = ? AND substr(check_in_at,1,10) = ? ORDER BY id DESC LIMIT 1')
      .get(client.id, today());
    if (existing) return res.json({ ...base, allowed: true, duplicate: true, attendance: existing, reason: 'Ya registró entrada hoy' });
  }

  const r = db
    .prepare('INSERT INTO attendance(client_id, membership_id, check_in_at, created_by) VALUES (?,?,?,?)')
    .run(client.id, membership.id, nowStr(), req.user!.id);
  const attendance = db.prepare('SELECT * FROM attendance WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json({
    ...base,
    allowed: true,
    attendance,
    warning: membership.status === 'gracia' ? 'Membresía vencida: está en días de gracia' : membership.status === 'por_vencer' ? `Vence en ${membership.days_left} día(s)` : undefined,
  });
});

attendanceRouter.post('/:id/check-out', (req, res) => {
  const id = idParam(req);
  const r = db.prepare('UPDATE attendance SET check_out_at = ? WHERE id = ? AND check_out_at IS NULL').run(nowStr(), id);
  if (!r.changes) throw new HttpError(400, 'La salida ya fue registrada');
  res.json({ ok: true });
});
