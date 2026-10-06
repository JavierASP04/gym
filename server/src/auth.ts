import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';
import { HttpError } from './lib/http.js';

export type Role = 'admin' | 'recepcion' | 'entrenador';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

const findUser = db.prepare('SELECT id, name, username, role FROM users WHERE id = ? AND active = 1');

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Sesión requerida'));
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as { sub: number };
    const user = findUser.get(payload.sub) as AuthUser | undefined;
    if (!user) return next(new HttpError(401, 'Usuario inactivo o inexistente'));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, 'Sesión expirada, ingrese nuevamente'));
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'No tiene permisos para esta acción'));
    }
    next();
  };

export const STAFF: Role[] = ['admin', 'recepcion'];
