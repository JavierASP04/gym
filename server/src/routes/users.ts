import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { db } from '../db.js';
import { nowStr } from '../lib/dates.js';
import { badRequest, idParam, notFound, parse } from '../lib/http.js';

export const usersRouter = Router();
usersRouter.use(requireRole('admin'));

const role = z.enum(['admin', 'recepcion', 'entrenador']);
const base = z.object({
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, 'Solo letras, números, punto, guion'),
  role,
  active: z.coerce.boolean().default(true),
});

usersRouter.get('/', (_req, res) => {
  res.json(
    db.prepare('SELECT id, name, username, role, active, last_login_at, created_at FROM users ORDER BY name').all(),
  );
});

usersRouter.post('/', (req, res) => {
  const data = parse(base.extend({ password: z.string().min(6, 'Mínimo 6 caracteres') }), req.body);
  const r = db
    .prepare('INSERT INTO users(name, username, password_hash, role, active, created_at) VALUES (?,?,?,?,?,?)')
    .run(data.name, data.username, bcrypt.hashSync(data.password, 10), data.role, data.active ? 1 : 0, nowStr());
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

usersRouter.put('/:id', (req, res) => {
  const id = idParam(req);
  const data = parse(base.extend({ password: z.string().min(6).optional().or(z.literal('')) }), req.body);
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) throw notFound('Usuario');

  if (id === req.user!.id && (data.role !== 'admin' || !data.active)) {
    throw badRequest('No puede quitarse permisos de administrador ni desactivarse a sí mismo');
  }
  if (data.role !== 'admin' || !data.active) {
    const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND active = 1 AND id <> ?").get(id) as { c: number };
    if (admins.c === 0) throw badRequest('Debe existir al menos un administrador activo');
  }

  db.prepare('UPDATE users SET name = ?, username = ?, role = ?, active = ? WHERE id = ?').run(
    data.name,
    data.username,
    data.role,
    data.active ? 1 : 0,
    id,
  );
  if (data.password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(data.password, 10), id);
  }
  res.json({ ok: true });
});
