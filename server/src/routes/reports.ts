import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { addDays, diffDays, today } from '../lib/dates.js';
import { parse, round2 } from '../lib/http.js';
import { statusSql } from '../lib/memberships.js';

export const reportsRouter = Router();
export const dashboardRouter = Router();

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const VALID = 'voided_at IS NULL';

function income(from: string, to: string) {
  return db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount_usd),0) AS usd, COALESCE(SUM(amount_bs),0) AS bs
         FROM payments WHERE ${VALID} AND substr(created_at,1,10) BETWEEN ? AND ?`,
    )
    .get(from, to) as { count: number; usd: number; bs: number };
}

const pct = (cur: number, prev: number) => (prev ? round2(((cur - prev) / prev) * 100) : null);

reportsRouter.get('/summary', (req, res) => {
  const t = today();
  const { from, to } = parse(
    z.object({ from: dateStr.default(addDays(t, -29)), to: dateStr.default(t) }),
    req.query,
  );
  const span = diffDays(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(span - 1));

  const cur = income(from, to);
  const prev = income(prevFrom, prevTo);

  const range = [from, to];
  const byConcept = db
    .prepare(`SELECT concept, COUNT(*) count, SUM(amount_usd) usd, SUM(amount_bs) bs FROM payments
               WHERE ${VALID} AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY concept ORDER BY usd DESC`)
    .all(...range);
  const byMethod = db
    .prepare(`SELECT method, currency, COUNT(*) count, SUM(amount_usd) usd, SUM(amount_bs) bs FROM payments
               WHERE ${VALID} AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY method ORDER BY usd DESC`)
    .all(...range);
  const byDay = db
    .prepare(`SELECT substr(created_at,1,10) date, SUM(amount_usd) usd, SUM(amount_bs) bs, COUNT(*) count FROM payments
               WHERE ${VALID} AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY date ORDER BY date`)
    .all(...range);
  const byPlan = db
    .prepare(`SELECT p.name, p.color, COUNT(*) count, SUM(m.total_usd) usd,
                     SUM(m.kind = 'inscripcion') inscripciones, SUM(m.kind = 'renovacion') renovaciones
                FROM memberships m JOIN plans p ON p.id = m.plan_id
               WHERE m.cancelled_at IS NULL AND substr(m.created_at,1,10) BETWEEN ? AND ?
               GROUP BY p.id ORDER BY count DESC`)
    .all(...range);
  const memberships = db
    .prepare(`SELECT SUM(kind='inscripcion') inscripciones, SUM(kind='renovacion') renovaciones FROM memberships
               WHERE cancelled_at IS NULL AND substr(created_at,1,10) BETWEEN ? AND ?`)
    .get(...range) as { inscripciones: number | null; renovaciones: number | null };
  const attendance = db
    .prepare(`SELECT COUNT(*) visits, COUNT(DISTINCT client_id) unique_clients FROM attendance
               WHERE substr(check_in_at,1,10) BETWEEN ? AND ?`)
    .get(...range) as { visits: number; unique_clients: number };
  const byHour = db
    .prepare(`SELECT CAST(substr(check_in_at,12,2) AS INTEGER) hour, COUNT(*) visits FROM attendance
               WHERE substr(check_in_at,1,10) BETWEEN ? AND ? GROUP BY hour ORDER BY hour`)
    .all(...range);
  const byWeekday = db
    .prepare(`SELECT CAST(strftime('%w', substr(check_in_at,1,10)) AS INTEGER) weekday, COUNT(*) visits FROM attendance
               WHERE substr(check_in_at,1,10) BETWEEN ? AND ? GROUP BY weekday ORDER BY weekday`)
    .all(...range);
  const attendanceByDay = db
    .prepare(`SELECT substr(check_in_at,1,10) date, COUNT(*) visits FROM attendance
               WHERE substr(check_in_at,1,10) BETWEEN ? AND ? GROUP BY date ORDER BY date`)
    .all(...range);
  const topProducts = db
    .prepare(`SELECT si.name, SUM(si.qty) qty, SUM(si.subtotal_usd) usd FROM sale_items si JOIN sales s ON s.id = si.sale_id
               WHERE s.cancelled_at IS NULL AND substr(s.created_at,1,10) BETWEEN ? AND ?
               GROUP BY si.product_id ORDER BY usd DESC LIMIT 8`)
    .all(...range);
  const topClients = db
    .prepare(`SELECT c.id, c.first_name, c.last_name, COUNT(*) visits FROM attendance a JOIN clients c ON c.id = a.client_id
               WHERE substr(a.check_in_at,1,10) BETWEEN ? AND ? GROUP BY c.id ORDER BY visits DESC LIMIT 8`)
    .all(...range);
  const newClients = (db
    .prepare('SELECT COUNT(*) c FROM clients WHERE substr(created_at,1,10) BETWEEN ? AND ?')
    .get(...range) as { c: number }).c;

  res.json({
    range: { from, to, days: span, prevFrom, prevTo },
    income: { ...cur, avgTicket: cur.count ? round2(cur.usd / cur.count) : 0, prevUsd: prev.usd, changePct: pct(cur.usd, prev.usd) },
    byConcept,
    byMethod,
    byDay,
    byPlan,
    memberships: { inscripciones: memberships.inscripciones ?? 0, renovaciones: memberships.renovaciones ?? 0 },
    attendance: { ...attendance, avgPerDay: round2(attendance.visits / span), byHour, byWeekday, byDay: attendanceByDay },
    topProducts,
    topClients,
    newClients,
  });
});

dashboardRouter.get('/', (_req, res) => {
  const t = today();
  const monthStart = `${t.slice(0, 8)}01`;
  const st = statusSql('m');

  const members = db
    .prepare(
      `SELECT ${st} AS status, COUNT(*) AS c FROM memberships m
        JOIN clients c ON c.id = m.client_id AND c.active = 1
        WHERE m.cancelled_at IS NULL
          AND m.end_date = (SELECT MAX(end_date) FROM memberships x WHERE x.client_id = m.client_id AND x.cancelled_at IS NULL)
        GROUP BY status`,
    )
    .all() as { status: string; c: number }[];
  const count = (s: string) => members.find((m) => m.status === s)?.c ?? 0;

  const todayIncome = income(t, t);
  const monthIncome = income(monthStart, t);
  const todayVisits = db
    .prepare(`SELECT COUNT(*) visits, SUM(check_out_at IS NULL) inside FROM attendance WHERE substr(check_in_at,1,10) = ?`)
    .get(t) as { visits: number; inside: number | null };

  const last30 = db
    .prepare(
      `WITH RECURSIVE d(date) AS (SELECT date(?, '-29 days') UNION ALL SELECT date(date, '+1 day') FROM d WHERE date < ?)
       SELECT d.date,
              COALESCE((SELECT SUM(amount_usd) FROM payments WHERE ${VALID} AND substr(created_at,1,10) = d.date),0) AS usd,
              (SELECT COUNT(*) FROM attendance WHERE substr(check_in_at,1,10) = d.date) AS visits
         FROM d`,
    )
    .all(t, t);

  const lowStock = db
    .prepare('SELECT id, name, stock, min_stock FROM products WHERE active = 1 AND stock <= min_stock ORDER BY stock LIMIT 6')
    .all();
  const recentPayments = db
    .prepare(
      `SELECT pm.id, pm.concept, pm.method, pm.amount_usd, pm.amount_bs, pm.created_at, c.first_name, c.last_name
         FROM payments pm LEFT JOIN clients c ON c.id = pm.client_id
        WHERE pm.${VALID} ORDER BY pm.id DESC LIMIT 6`,
    )
    .all();
  const expiring = db
    .prepare(
      `SELECT m.id, m.client_id, m.end_date, CAST(julianday(m.end_date) - julianday(?) AS INTEGER) days_left,
              c.first_name, c.last_name, c.phone, p.name plan_name, p.color plan_color
         FROM memberships m JOIN clients c ON c.id = m.client_id AND c.active = 1 JOIN plans p ON p.id = m.plan_id
        WHERE m.cancelled_at IS NULL AND ${st} IN ('por_vencer','gracia')
          AND m.end_date = (SELECT MAX(end_date) FROM memberships x WHERE x.client_id = m.client_id AND x.cancelled_at IS NULL)
        ORDER BY m.end_date LIMIT 8`,
    )
    .all(t);
  const birthdays = db
    .prepare(
      `SELECT id, first_name, last_name, birth_date FROM clients
        WHERE active = 1 AND birth_date IS NOT NULL AND substr(birth_date,6,5) = substr(?,6,5) LIMIT 5`,
    )
    .all(t);

  res.json({
    members: {
      active: count('activa') + count('por_vencer'),
      expiring: count('por_vencer'),
      grace: count('gracia'),
      expired: count('vencida'),
      scheduled: count('programada'),
    },
    today: { ...todayIncome, visits: todayVisits.visits, inside: todayVisits.inside ?? 0 },
    month: monthIncome,
    last30,
    lowStock,
    recentPayments,
    expiring,
    birthdays,
  });
});
