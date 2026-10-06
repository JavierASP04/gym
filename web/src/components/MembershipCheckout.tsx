import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, CalendarRange, Check, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { bs, date, fullName, usd } from '@/lib/format';
import { useAction, usePlans, useRate } from '@/lib/hooks';
import { ClientFormModal } from './ClientForm';
import { ClientPicker, type PickedClient } from './ClientPicker';
import { emptyLine, PaymentForm, summarize, toPayload, type DraftLine } from './PaymentForm';
import { ReceiptModal, type ReceiptData } from './Receipt';
import { Badge, Button, Field, Input, Modal, Skeleton, Switch } from './ui';

interface Quote {
  kind: 'inscripcion' | 'renovacion';
  startDate: string;
  endDate: string;
  days: number;
  priceUsd: number;
  feeUsd: number;
  discountUsd: number;
  totalUsd: number;
  totalBs: number;
  rate: number;
  previousEndDate: string | null;
  plan: { name: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  client?: PickedClient | null;
  planId?: number;
  title?: string;
}

export function MembershipCheckout({ open, onClose, client: initialClient = null, planId: initialPlan, title }: Props) {
  const { data: plans = [] } = usePlans();
  const { data: rateInfo } = useRate();
  const [client, setClient] = useState<PickedClient | null>(initialClient);
  const [planId, setPlanId] = useState<number | undefined>(initialPlan);
  const [discount, setDiscount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [waiveFee, setWaiveFee] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [newClient, setNewClient] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const quoteBody = { client_id: client?.id, plan_id: planId, discount_usd: Number(discount) || 0, start_date: startDate || null, waive_fee: waiveFee };
  const { data: quote, isFetching, error } = useQuery({
    queryKey: ['quote', quoteBody],
    queryFn: () => api.post<Quote>('/memberships/quote', quoteBody),
    enabled: !!client && !!planId,
  });

  const rate = quote?.rate ?? rateInfo?.rate ?? 0;
  const summary = quote ? summarize(lines, quote.totalUsd, rate) : null;

  const submit = useAction(
    () => api.post<{ id: number; changeUsd: number; rate: number; totalUsd: number; kind: string; startDate: string; endDate: string; feeUsd: number; priceUsd: number; discountUsd: number }>('/memberships', { ...quoteBody, payments: toPayload(lines) }),
    {
      success: (r) => (r.kind === 'inscripcion' ? 'Inscripción registrada' : 'Renovación registrada'),
      invalidate: [['memberships'], ['clients'], ['client'], ['dashboard'], ['payments'], ['expiring'], ['plans']],
      onSuccess: (r) => {
        const plan = plans.find((p) => p.id === planId);
        setReceipt({
          title: r.kind === 'inscripcion' ? 'Inscripción' : 'Renovación',
          number: r.id,
          client: client ? `${fullName(client)} · ${client.document}` : null,
          items: [
            { label: `Plan ${plan?.name}`, detail: `${date(r.startDate)} → ${date(r.endDate)}`, usd: r.priceUsd },
            ...(r.feeUsd ? [{ label: 'Cuota de inscripción', usd: r.feeUsd }] : []),
            ...(r.discountUsd ? [{ label: 'Descuento', usd: -r.discountUsd }] : []),
          ],
          totalUsd: r.totalUsd,
          rate: r.rate,
          payments: toPayload(lines).map((l) => ({ ...l, reference: l.reference ?? undefined })),
          changeUsd: r.changeUsd,
        });
      },
    },
  );

  if (receipt) return <ReceiptModal data={receipt} onClose={() => { setReceipt(null); onClose(); }} />;

  const activePlans = plans.filter((p) => p.active);
  const canSubmit = !!quote && (quote.totalUsd === 0 || summary?.complete) && !isFetching;

  return (
    <>
      <Modal
        open={open && !newClient}
        onClose={onClose}
        size="xl"
        title={title ?? (quote?.kind === 'renovacion' ? 'Renovar membresía' : 'Nueva inscripción')}
        subtitle="Selecciona el plan, revisa el período y registra el pago"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button size="lg" disabled={!canSubmit} loading={submit.isPending} onClick={() => submit.mutate(undefined)} icon={<Check className="size-4" />}>
              {quote ? `Cobrar ${usd(quote.totalUsd)}` : 'Cobrar'}
            </Button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">1 · Cliente</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <ClientPicker value={client} onChange={setClient} autoFocus={!client} />
                </div>
                {!client && (
                  <Button variant="outline" icon={<UserPlus className="size-4" />} onClick={() => setNewClient(true)}>Nuevo</Button>
                )}
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">2 · Plan</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {activePlans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={clsx(
                      'relative rounded-2xl border p-4 text-left transition',
                      planId === p.id ? 'border-accent bg-accent/5 ring-4 ring-[var(--ring)]' : 'border-line hover:border-muted/50 hover:bg-surface-2',
                    )}
                  >
                    <span className="absolute right-4 top-4 size-3 rounded-full" style={{ background: p.color }} />
                    <p className="font-display font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">{p.duration_days} {p.duration_days === 1 ? 'día' : 'días'}</p>
                    <p className="mt-2 font-display text-xl font-bold tabular">{usd(p.price_usd)}</p>
                    <p className="text-xs text-muted tabular">{bs(p.price_usd * rate)}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha de inicio" hint="Vacío = automático (continúa sin perder días)">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Descuento ($)">
                <Input inputMode="decimal" placeholder="0,00" value={discount} onChange={(e) => setDiscount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))} />
              </Field>
              {quote?.kind === 'inscripcion' && (
                <div className="sm:col-span-2">
                  <Switch checked={waiveFee} onChange={setWaiveFee} label="Exonerar cuota de inscripción" />
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            {error ? (
              <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400">{(error as Error).message}</p>
            ) : !quote ? (
              <div className="grid h-full min-h-60 place-items-center rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                {isFetching ? <Skeleton className="h-40 w-full" /> : 'Selecciona un cliente y un plan para ver el resumen'}
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between">
                    <Badge tone={quote.kind === 'inscripcion' ? 'lime' : 'blue'}>{quote.kind === 'inscripcion' ? 'Inscripción' : 'Renovación'}</Badge>
                    <span className="text-xs text-muted">{quote.days} días</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <CalendarRange className="size-4 text-muted" />
                    <span className="font-medium">{date(quote.startDate)}</span>
                    <ArrowRight className="size-3.5 text-muted" />
                    <span className="font-medium">{date(quote.endDate)}</span>
                  </div>
                  {quote.previousEndDate && quote.kind === 'renovacion' && (
                    <p className="mt-1 text-xs text-muted">Plan anterior vencía el {date(quote.previousEndDate)}</p>
                  )}
                  <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">Plan {quote.plan.name}</dt><dd className="tabular">{usd(quote.priceUsd)}</dd></div>
                    {quote.feeUsd > 0 && <div className="flex justify-between"><dt className="text-muted">Inscripción</dt><dd className="tabular">{usd(quote.feeUsd)}</dd></div>}
                    {quote.discountUsd > 0 && <div className="flex justify-between text-emerald-400"><dt>Descuento</dt><dd className="tabular">−{usd(quote.discountUsd)}</dd></div>}
                  </dl>
                </div>
                {quote.totalUsd > 0 ? (
                  <PaymentForm lines={lines} onChange={setLines} totalUsd={quote.totalUsd} rate={rate} />
                ) : (
                  <p className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-400">Sin monto a cobrar (cortesía).</p>
                )}
              </>
            )}
          </aside>
        </div>
      </Modal>

      {newClient && (
        <ClientFormModal
          open
          onClose={() => setNewClient(false)}
          onSaved={(c) => setClient({ id: c.id, document: c.document, first_name: c.first_name, last_name: c.last_name, phone: c.phone })}
        />
      )}
    </>
  );
}
