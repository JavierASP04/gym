import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeftRight, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { bs, dateTime, rateStr, round2, usd } from '@/lib/format';
import { useRate } from '@/lib/hooks';
import type { Rate } from '@/lib/types';

export function RateWidget() {
  const { data, isLoading, isError } = useRate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState('1');
  const [dir, setDir] = useState<'usd' | 'bs'>('usd');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      qc.setQueryData(['rate'], await api.get<Rate>('/rates/current', { refresh: 1 }));
    } finally {
      setRefreshing(false);
    }
  };

  const rate = data?.rate ?? 0;
  const n = Number(amount.replace(',', '.')) || 0;
  const result = dir === 'usd' ? bs(n * rate) : usd(rate ? n / rate : 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 py-1.5 pl-2 pr-3 text-left transition hover:border-accent/50"
      >
        <span className={clsx('grid size-7 place-items-center rounded-lg', isError ? 'bg-red-500/15 text-red-400' : 'bg-accent text-accent-fg')}>
          <TrendingUp className="size-4" />
        </span>
        <span className="leading-tight">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-muted">
            BCV {data?.mode === 'manual' ? '· manual' : ''}
          </span>
          <span className="block font-display text-sm font-semibold tabular">{isLoading ? '…' : isError ? 'Sin tasa' : `Bs ${rateStr(rate)}`}</span>
        </span>
        {data?.stale && <span className="size-2 rounded-full bg-amber-400" title="Tasa desactualizada" />}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-line bg-surface p-4 shadow-2xl animate-pop">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted">Tasa oficial USD → VES</p>
              <p className="font-display text-2xl font-bold tabular">Bs {rateStr(rate)}</p>
            </div>
            <button onClick={refresh} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" title="Actualizar ahora" disabled={data?.mode === 'manual'}>
              <RefreshCw className={clsx('size-4', refreshing && 'animate-spin')} />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            Fuente: {data?.source ?? '—'}
            <br />
            Actualizada: {dateTime(data?.fetchedAt)}
            {data?.rateDate && ` · Valor del ${data.rateDate.slice(0, 10)}`}
          </p>

          <div className="mt-4 rounded-xl bg-surface-2 p-3">
            <p className="mb-2 text-xs font-medium text-muted">Conversor rápido</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-xs font-semibold text-muted">{dir === 'usd' ? '$' : 'Bs'}</span>
                <input className="field pl-9 tabular" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
              </div>
              <button
                onClick={() => {
                  setDir((d) => (d === 'usd' ? 'bs' : 'usd'));
                  setAmount(String(round2(dir === 'usd' ? n * rate : rate ? n / rate : 0)));
                }}
                className="grid size-10 place-items-center rounded-xl border border-line text-muted hover:text-accent-ink"
                title="Invertir"
              >
                <ArrowLeftRight className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-right font-display text-lg font-semibold tabular">= {result}</p>
          </div>
        </div>
      )}
    </div>
  );
}
