import clsx from 'clsx';
import { Banknote, Plus, Trash2, Wand2 } from 'lucide-react';
import { PAYMENT_METHODS } from '@/lib/constants';
import { bs, rateStr, round2, usd } from '@/lib/format';
import type { PaymentMethod } from '@/lib/types';
import { Button, Input, Select } from './ui';

export interface DraftLine {
  method: PaymentMethod;
  amount: string;
  reference: string;
}

export const emptyLine = (method: PaymentMethod = 'pago_movil'): DraftLine => ({ method, amount: '', reference: '' });

const toUsd = (l: DraftLine, rate: number) => {
  const n = Number(l.amount) || 0;
  return PAYMENT_METHODS[l.method].currency === 'USD' ? n : rate ? n / rate : 0;
};

export function summarize(lines: DraftLine[], totalUsd: number, rate: number) {
  const paid = round2(lines.reduce((s, l) => s + toUsd(l, rate), 0));
  const diff = round2(paid - totalUsd);
  return {
    paidUsd: paid,
    remainingUsd: diff < -0.005 ? -diff : 0,
    changeUsd: diff > 0.005 ? diff : 0,
    complete: diff >= -0.005,
  };
}

export const toPayload = (lines: DraftLine[]) =>
  lines
    .filter((l) => Number(l.amount) > 0)
    .map((l) => ({ method: l.method, amount: Number(l.amount), reference: l.reference.trim() || null }));

export function PaymentForm({ lines, onChange, totalUsd, rate }: { lines: DraftLine[]; onChange: (l: DraftLine[]) => void; totalUsd: number; rate: number }) {
  const s = summarize(lines, totalUsd, rate);

  const update = (i: number, patch: Partial<DraftLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  /** Completa la línea con lo que falte, expresado en la moneda del método. */
  const fillRemaining = (i: number) => {
    const others = lines.filter((_, j) => j !== i).reduce((sum, l) => sum + toUsd(l, rate), 0);
    const remaining = Math.max(0, totalUsd - others);
    const isUsd = PAYMENT_METHODS[lines[i].method].currency === 'USD';
    update(i, { amount: String(round2(isUsd ? remaining : remaining * rate)) });
  };

  const setMethod = (i: number, method: PaymentMethod) => {
    const prev = lines[i];
    const prevUsd = toUsd(prev, rate);
    const isUsd = PAYMENT_METHODS[method].currency === 'USD';
    const amount = prev.amount ? String(round2(isUsd ? prevUsd : prevUsd * rate)) : '';
    update(i, { method, amount });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface-2 p-4">
        <div>
          <p className="text-xs text-muted">Total a cobrar</p>
          <p className="font-display text-2xl font-bold tabular">{usd(totalUsd)}</p>
          <p className="text-sm text-muted tabular">{bs(totalUsd * rate)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Tasa BCV</p>
          <p className="font-display text-lg font-semibold tabular">{rateStr(rate)}</p>
          <p className="text-xs text-muted">Bs por $</p>
        </div>
      </div>

      {lines.map((l, i) => {
        const m = PAYMENT_METHODS[l.method];
        const lineUsd = toUsd(l, rate);
        return (
          <div key={i} className="rounded-2xl border border-line p-3 animate-pop">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Select value={l.method} onChange={(e) => setMethod(i, e.target.value as PaymentMethod)} aria-label="Método de pago">
                <optgroup label="Dólares">
                  {Object.entries(PAYMENT_METHODS).filter(([, v]) => v.currency === 'USD').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </optgroup>
                <optgroup label="Bolívares">
                  {Object.entries(PAYMENT_METHODS).filter(([, v]) => v.currency === 'VES').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </optgroup>
              </Select>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-xs font-semibold text-muted">{m.currency === 'USD' ? '$' : 'Bs'}</span>
                <input
                  className="field pl-9 pr-9 tabular"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={l.amount}
                  onChange={(e) => update(i, { amount: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })}
                  aria-label="Monto"
                />
                <button type="button" title="Completar restante" onClick={() => fillRemaining(i)} className="absolute inset-y-0 right-2 grid place-items-center text-muted hover:text-accent-ink">
                  <Wand2 className="size-4" />
                </button>
              </div>
              <Button variant="ghost" size="icon" type="button" disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, j) => j !== i))} aria-label="Quitar">
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {m.needsRef && (
                <Input className="h-8 text-xs" placeholder="Referencia (últimos dígitos)" value={l.reference} onChange={(e) => update(i, { reference: e.target.value })} />
              )}
              <span className="ml-auto shrink-0 text-xs text-muted tabular">
                ≈ {m.currency === 'USD' ? bs(lineUsd * rate) : usd(lineUsd)}
              </span>
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" icon={<Plus className="size-3.5" />} disabled={lines.length >= 6} onClick={() => onChange([...lines, emptyLine(lines.at(-1)?.method === 'efectivo_usd' ? 'pago_movil' : 'efectivo_usd')])}>
          Pago mixto
        </Button>
        <Button type="button" variant="ghost" size="sm" icon={<Banknote className="size-3.5" />} onClick={() => onChange([{ ...emptyLine('efectivo_usd'), amount: String(round2(totalUsd)) }])}>
          Todo en $
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([{ ...emptyLine('pago_movil'), amount: String(round2(totalUsd * rate)) }])}>
          Todo en Bs
        </Button>
      </div>

      <div
        className={clsx(
          'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium',
          s.remainingUsd > 0 ? 'bg-amber-500/10 text-amber-400 light:text-amber-700' : s.changeUsd > 0 ? 'bg-sky-500/10 text-sky-400 light:text-sky-700' : 'bg-emerald-500/10 text-emerald-400 light:text-emerald-700',
        )}
      >
        <span>{s.remainingUsd > 0 ? 'Restante por cobrar' : s.changeUsd > 0 ? 'Vuelto a entregar' : 'Pago completo'}</span>
        <span className="tabular">
          {s.remainingUsd > 0 ? `${usd(s.remainingUsd)} · ${bs(s.remainingUsd * rate)}` : s.changeUsd > 0 ? `${usd(s.changeUsd)} · ${bs(s.changeUsd * rate)}` : '✓'}
        </span>
      </div>
    </div>
  );
}
