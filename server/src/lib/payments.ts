import { z } from 'zod';
import { db } from '../db.js';
import { nowStr } from './dates.js';
import { badRequest, round2 } from './http.js';

export const PAYMENT_METHODS = {
  efectivo_usd: { label: 'Efectivo $', currency: 'USD' },
  zelle: { label: 'Zelle', currency: 'USD' },
  binance: { label: 'Binance / USDT', currency: 'USD' },
  efectivo_bs: { label: 'Efectivo Bs', currency: 'VES' },
  pago_movil: { label: 'Pago móvil', currency: 'VES' },
  transferencia: { label: 'Transferencia Bs', currency: 'VES' },
  punto_venta: { label: 'Punto de venta', currency: 'VES' },
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export type Concept = 'inscripcion' | 'renovacion' | 'tienda' | 'otro';

export const paymentLineSchema = z.object({
  method: z.enum(Object.keys(PAYMENT_METHODS) as [PaymentMethod, ...PaymentMethod[]]),
  /** Monto en la moneda del método (USD o Bs). */
  amount: z.coerce.number().positive(),
  reference: z.string().trim().max(60).optional().nullable(),
});
export type PaymentLine = z.infer<typeof paymentLineSchema>;

export const paymentLinesSchema = z.array(paymentLineSchema).min(1, 'Debe registrar al menos un pago').max(6);

interface RecordOpts {
  lines: PaymentLine[];
  totalUsd: number;
  rate: number;
  concept: Concept;
  clientId?: number | null;
  membershipId?: number | null;
  saleId?: number | null;
  userId: number;
  notes?: string | null;
}

/**
 * Registra uno o varios pagos (pago mixto USD/Bs) que deben cubrir `totalUsd`.
 * Si el cliente paga de más, el excedente se descuenta de la última línea y se devuelve como vuelto.
 * Debe ejecutarse dentro de una transacción.
 */
export function recordPayments(o: RecordOpts) {
  const normalized = o.lines.map((l) => {
    const currency = PAYMENT_METHODS[l.method].currency;
    const usd = currency === 'USD' ? l.amount : l.amount / o.rate;
    const bs = currency === 'VES' ? l.amount : l.amount * o.rate;
    return { ...l, currency, usd, bs };
  });

  const paidUsd = normalized.reduce((s, l) => s + l.usd, 0);
  const total = round2(o.totalUsd);
  if (paidUsd + 0.005 < total) {
    throw badRequest(
      `Pago incompleto: faltan $${round2(total - paidUsd).toFixed(2)} (Bs ${round2((total - paidUsd) * o.rate).toFixed(2)})`,
    );
  }

  let changeUsd = round2(Math.max(0, paidUsd - total));
  if (changeUsd > 0) {
    for (let i = normalized.length - 1; i >= 0 && changeUsd > 0; i--) {
      const l = normalized[i];
      const take = Math.min(l.usd, changeUsd);
      l.usd -= take;
      l.bs -= take * o.rate;
      changeUsd = round2(changeUsd - take);
    }
  }

  const insert = db.prepare(
    `INSERT INTO payments(client_id, membership_id, sale_id, concept, method, currency, amount_usd, amount_bs, rate, reference, notes, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const createdAt = nowStr();
  const ids: number[] = [];
  for (const l of normalized) {
    if (l.usd < 0.005) continue;
    const r = insert.run(
      o.clientId ?? null,
      o.membershipId ?? null,
      o.saleId ?? null,
      o.concept,
      l.method,
      l.currency,
      round2(l.usd),
      round2(l.bs),
      o.rate,
      l.reference || null,
      o.notes ?? null,
      o.userId,
      createdAt,
    );
    ids.push(Number(r.lastInsertRowid));
  }

  const change = round2(Math.max(0, paidUsd - total));
  return { paymentIds: ids, paidUsd: round2(paidUsd), changeUsd: change, changeBs: round2(change * o.rate) };
}
