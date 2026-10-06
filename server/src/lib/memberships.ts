import { db } from '../db.js';
import { addDays, diffDays, maxDate, today } from './dates.js';
import { notFound, badRequest, round2 } from './http.js';
import { getNumberSetting } from './settings.js';

export type MembershipStatus = 'activa' | 'por_vencer' | 'gracia' | 'vencida' | 'programada' | 'cancelada';

/** Expresión SQL reutilizable con el estado efectivo de una membresía (alias `m`). */
export function statusSql(alias = 'm') {
  const t = `'${today()}'`;
  const grace = getNumberSetting('grace_days');
  const alert = getNumberSetting('expiring_alert_days');
  return `CASE
    WHEN ${alias}.cancelled_at IS NOT NULL THEN 'cancelada'
    WHEN ${alias}.start_date > ${t} THEN 'programada'
    WHEN ${alias}.end_date >= ${t} AND julianday(${alias}.end_date) - julianday(${t}) <= ${alert} THEN 'por_vencer'
    WHEN ${alias}.end_date >= ${t} THEN 'activa'
    WHEN julianday(${t}) - julianday(${alias}.end_date) <= ${grace} THEN 'gracia'
    ELSE 'vencida' END`;
}

export interface MembershipRow {
  id: number;
  client_id: number;
  plan_id: number;
  plan_name: string;
  plan_color: string;
  kind: string;
  start_date: string;
  end_date: string;
  total_usd: number;
  status: MembershipStatus;
  days_left: number;
}

/** Membresía más relevante del cliente: la vigente o, si no hay, la última. */
export function currentMembership(clientId: number): MembershipRow | null {
  const t = today();
  const row = db
    .prepare(
      `SELECT m.id, m.client_id, m.plan_id, p.name AS plan_name, p.color AS plan_color, m.kind,
              m.start_date, m.end_date, m.total_usd, ${statusSql()} AS status,
              CAST(julianday(m.end_date) - julianday(?) AS INTEGER) AS days_left
         FROM memberships m JOIN plans p ON p.id = m.plan_id
        WHERE m.client_id = ? AND m.cancelled_at IS NULL
        ORDER BY (m.start_date <= ? AND m.end_date >= ?) DESC, m.end_date DESC
        LIMIT 1`,
    )
    .get(t, clientId, t, t) as MembershipRow | undefined;
  return row ?? null;
}

export function hasAnyMembership(clientId: number): boolean {
  return !!db.prepare('SELECT 1 FROM memberships WHERE client_id = ? AND cancelled_at IS NULL LIMIT 1').get(clientId);
}

export interface QuoteInput {
  clientId: number;
  planId: number;
  discountUsd?: number;
  startDate?: string | null;
  waiveFee?: boolean;
}

/**
 * Calcula fechas y montos de una inscripción o renovación.
 * - Inscripción: primera membresía del cliente → cobra cuota de inscripción.
 * - Renovación: continúa desde el día siguiente al vencimiento si aún está vigente (no se pierden días),
 *   o desde hoy si ya venció.
 */
export function quoteMembership(input: QuoteInput) {
  const plan = db.prepare('SELECT id, name, price_usd, duration_days, active FROM plans WHERE id = ?').get(input.planId) as
    | { id: number; name: string; price_usd: number; duration_days: number; active: number }
    | undefined;
  if (!plan) throw notFound('Plan');
  if (!plan.active) throw badRequest('El plan está inactivo');

  const client = db.prepare('SELECT id, active FROM clients WHERE id = ?').get(input.clientId) as
    | { id: number; active: number }
    | undefined;
  if (!client) throw notFound('Cliente');

  const kind = hasAnyMembership(input.clientId) ? 'renovacion' : 'inscripcion';
  const t = today();
  const last = db
    .prepare('SELECT MAX(end_date) AS end_date FROM memberships WHERE client_id = ? AND cancelled_at IS NULL')
    .get(input.clientId) as { end_date: string | null };

  let start = input.startDate ?? t;
  if (!input.startDate && last.end_date && last.end_date >= t) start = addDays(last.end_date, 1);
  start = maxDate(start, addDays(t, -30));

  const end = addDays(start, plan.duration_days - 1);
  const fee = kind === 'inscripcion' && !input.waiveFee ? getNumberSetting('enrollment_fee_usd') : 0;
  const subtotal = round2(plan.price_usd + fee);
  const discount = round2(Math.min(Math.max(input.discountUsd ?? 0, 0), subtotal));
  const total = round2(subtotal - discount);

  return {
    kind: kind as 'inscripcion' | 'renovacion',
    plan,
    startDate: start,
    endDate: end,
    days: diffDays(start, end) + 1,
    priceUsd: plan.price_usd,
    feeUsd: fee,
    discountUsd: discount,
    totalUsd: total,
    previousEndDate: last.end_date,
  };
}
