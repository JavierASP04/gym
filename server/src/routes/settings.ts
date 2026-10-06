import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { getRate, rateHistory } from '../lib/bcv.js';
import { parse, round2 } from '../lib/http.js';
import { getSettings, saveSettings } from '../lib/settings.js';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  res.json(getSettings());
});

const num = (min: number, max: number) => z.coerce.number().min(min).max(max).transform(String);

settingsRouter.put('/', requireRole('admin'), (req, res) => {
  const d = parse(
    z
      .object({
        gym_name: z.string().trim().min(2).max(80),
        gym_rif: z.string().trim().max(20),
        gym_phone: z.string().trim().max(40),
        gym_address: z.string().trim().max(200),
        gym_email: z.string().trim().max(120),
        enrollment_fee_usd: num(0, 10000),
        grace_days: num(0, 60),
        expiring_alert_days: num(1, 60),
        rate_mode: z.enum(['auto', 'manual']),
        manual_rate: num(0, 1e9),
        rate_refresh_minutes: num(5, 1440),
        one_checkin_per_day: z.coerce.boolean().transform((v) => (v ? '1' : '0')),
        receipt_footer: z.string().trim().max(200),
      })
      .partial()
      .refine((v) => v.rate_mode !== 'manual' || Number(v.manual_rate) > 0, {
        message: 'Ingrese una tasa manual mayor a 0',
        path: ['manual_rate'],
      }),
    req.body,
  );
  saveSettings(d);
  res.json(getSettings());
});

export const ratesRouter = Router();

ratesRouter.get('/current', async (req, res) => {
  const info = await getRate({ force: req.query.refresh === '1' });
  res.json(info);
});

ratesRouter.get('/history', (req, res) => {
  res.json(rateHistory(Math.min(365, Number(req.query.limit) || 30)));
});

ratesRouter.get('/convert', async (req, res) => {
  const { amount, to } = parse(
    z.object({ amount: z.coerce.number(), to: z.enum(['VES', 'USD']).default('VES') }),
    req.query,
  );
  const { rate } = await getRate();
  res.json({ amount, to, rate, result: round2(to === 'VES' ? amount * rate : amount / rate) });
});
