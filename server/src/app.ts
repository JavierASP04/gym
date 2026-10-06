import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { authenticate, requireRole, STAFF } from './auth.js';
import { config } from './config.js';
import { errorHandler, HttpError } from './lib/http.js';
import { attendanceRouter } from './routes/attendance.js';
import { authRouter } from './routes/auth.js';
import { clientsRouter } from './routes/clients.js';
import { membershipsRouter } from './routes/memberships.js';
import { paymentsRouter } from './routes/payments.js';
import { plansRouter } from './routes/plans.js';
import { dashboardRouter, reportsRouter } from './routes/reports.js';
import { ratesRouter, settingsRouter } from './routes/settings.js';
import { storeRouter } from './routes/store.js';
import { usersRouter } from './routes/users.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRouter);
  api.use(authenticate);
  api.use('/dashboard', dashboardRouter);
  api.use('/clients', clientsRouter);
  api.use('/plans', plansRouter);
  api.use('/memberships', membershipsRouter);
  api.use('/payments', requireRole(...STAFF), paymentsRouter);
  api.use('/store', storeRouter);
  api.use('/attendance', attendanceRouter);
  api.use('/settings', settingsRouter);
  api.use('/rates', ratesRouter);
  api.use('/reports', requireRole('admin'), reportsRouter);
  api.use('/users', usersRouter);
  api.use((_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada')));

  app.use('/api', api);

  if (fs.existsSync(config.webDist)) {
    app.use(express.static(config.webDist, { maxAge: '7d', index: false }));
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(config.webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
