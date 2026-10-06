import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate, signToken, type AuthUser } from '../auth.js';
import { db } from '../db.js';
import { nowStr } from '../lib/dates.js';
import { HttpError, parse } from '../lib/http.js';

export const authRouter = Router();

const attempts = new Map<string, { count: number; until: number }>();

authRouter.post('/login', (req, res) => {
  const { username, password } = parse(
    z.object({ username: z.string().trim().min(1), password: z.string().min(1) }),
    req.body,
  );
  const key = `${req.ip}:${username.toLowerCase()}`;
  const a = attempts.get(key);
  if (a && a.count >= 5 && a.until > Date.now()) {
    throw new HttpError(429, 'Demasiados intentos. Espere un minuto.');
  }

  const row = db
    .prepare('SELECT id, name, username, role, password_hash, active FROM users WHERE username = ?')
    .get(username) as (AuthUser & { password_hash: string; active: number }) | undefined;

  if (!row || !row.active || !bcrypt.compareSync(password, row.password_hash)) {
    const next = { count: (a?.until ?? 0) > Date.now() ? (a!.count + 1) : 1, until: Date.now() + 60_000 };
    attempts.set(key, next);
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  attempts.delete(key);
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowStr(), row.id);

  const user: AuthUser = { id: row.id, name: row.name, username: row.username, role: row.role };
  res.json({ token: signToken(user), user });
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post('/change-password', authenticate, (req, res) => {
  const { current, next } = parse(
    z.object({ current: z.string().min(1), next: z.string().min(6, 'Mínimo 6 caracteres') }),
    req.body,
  );
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as { password_hash: string };
  if (!bcrypt.compareSync(current, row.password_hash)) throw new HttpError(400, 'La contraseña actual no coincide');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user!.id);
  res.json({ ok: true });
});
