import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Ban, CreditCard, Download, Plus, Search } from 'lucide-react';
import { ClientPicker, type PickedClient } from '@/components/ClientPicker';
import { emptyLine, PaymentForm, summarize, toPayload, type DraftLine } from '@/components/PaymentForm';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingBlock, Modal, Money, PageHeader, Pagination, Select, Stat, Table, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CONCEPTS, METHOD_COLORS, PAYMENT_METHODS } from '@/lib/constants';
import { addDays, bs, dateTime, downloadCsv, fullName, rateStr, todayStr, usd } from '@/lib/format';
import { useAction, useDebounced, useRate } from '@/lib/hooks';
import type { Paged, Payment } from '@/lib/types';

type Res = Paged<Payment> & { totals: { count: number; total_usd: number; total_bs: number } };

function ManualPaymentModal({ onClose }: { onClose: () => void }) {
  const { data: rate } = useRate();
  const [client, setClient] = useState<PickedClient | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine('efectivo_usd')]);
  const total = Number(amount) || 0;
  const r = rate?.rate ?? 0;
  const ok = total > 0 && notes.trim().length >= 3 && summarize(lines, total, r).complete;

  const save = useAction(() => api.post('/payments', { client_id: client?.id ?? null, amount_usd: total, notes, payments: toPayload(lines) }), {
    success: 'Ingreso registrado',
    invalidate: [['payments'], ['dashboard']],
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Registrar otro ingreso"
      subtitle="Entrenamiento personal, casillero, evaluaciones, etc."
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!ok} loading={save.isPending} onClick={() => save.mutate(undefined)}>Registrar</Button></>}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Cliente (opcional)"><ClientPicker value={client} onChange={setClient} /></Field>
          <Field label="Monto ($) *" hint={`≈ ${bs(total * r)}`}>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))} autoFocus />
          </Field>
          <Field label="Concepto *"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: 4 sesiones de entrenamiento personal" /></Field>
        </div>
        {total > 0 ? <PaymentForm lines={lines} onChange={setLines} totalUsd={total} rate={r} /> : <div className="grid place-items-center rounded-2xl border border-dashed border-line p-6 text-sm text-muted">Ingresa el monto</div>}
      </div>
    </Modal>
  );
}

function VoidModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const v = useAction(() => api.post(`/payments/${payment.id}/void`, { reason }), { success: 'Pago anulado', invalidate: [['payments'], ['dashboard'], ['client']], onSuccess: onClose });
  return (
    <Modal open onClose={onClose} size="sm" title="Anular pago" subtitle={`${usd(payment.amount_usd)} · ${PAYMENT_METHODS[payment.method]?.label}`}
      footer={<><Button variant="outline" onClick={onClose}>Volver</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={v.isPending} onClick={() => v.mutate(undefined)}>Anular pago</Button></>}>
      <Field label="Motivo *"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
    </Modal>
  );
}

export default function Payments() {
  const { can } = useAuth();
  const t = todayStr();
  const [from, setFrom] = useState(addDays(t, -6));
  const [to, setTo] = useState(t);
  const [method, setMethod] = useState('');
  const [concept, setConcept] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [manual, setManual] = useState(false);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const debounced = useDebounced(q);

  const params = { from, to, method, concept, q: debounced, page, pageSize: 25 };
  const { data, isLoading } = useQuery({ queryKey: ['payments', params], queryFn: () => api.get<Res>('/payments', params), placeholderData: keepPreviousData });

  const setRange = (days: number) => {
    setFrom(addDays(t, -days + 1));
    setTo(t);
    setPage(1);
  };

  const exportCsv = async () => {
    const all = await api.get<Res>('/payments', { ...params, page: 1, pageSize: 200 });
    downloadCsv(`pagos_${from}_${to}.csv`, all.rows.map((p) => ({
      fecha: p.created_at, cliente: p.first_name ? fullName(p) : '', cedula: p.document ?? '', concepto: CONCEPTS[p.concept].label,
      metodo: PAYMENT_METHODS[p.method]?.label, referencia: p.reference ?? '', monto_usd: p.amount_usd, monto_bs: p.amount_bs, tasa: p.rate,
      estado: p.voided_at ? 'Anulado' : 'Válido', usuario: p.created_by_name,
    })));
  };

  return (
    <>
      <PageHeader
        title="Pagos"
        subtitle="Todos los cobros registrados con su tasa BCV histórica"
        icon={<CreditCard className="size-5" />}
        actions={<><Button variant="outline" icon={<Download className="size-4" />} onClick={exportCsv}>Exportar CSV</Button><Button icon={<Plus className="size-4" />} onClick={() => setManual(true)}>Otro ingreso</Button></>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat accent label="Total en el período" value={usd(data?.totals.total_usd)} sub={bs(data?.totals.total_bs)} />
        <Stat label="Transacciones" value={data?.totals.count ?? '—'} sub={`${from} → ${to}`} />
        <Stat label="Ticket promedio" value={usd(data?.totals.count ? data.totals.total_usd / data.totals.count : 0)} />
      </div>

      <Card>
        <div className="grid gap-3 border-b border-line p-4 md:grid-cols-2 xl:grid-cols-[auto_auto_1fr_1fr_1.4fr]">
          <div className="flex gap-2">
            <Input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <Input type="date" value={to} min={from} max={t} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div className="flex gap-1">
            {[[1, 'Hoy'], [7, '7d'], [30, '30d']].map(([d, l]) => (
              <Button key={d} variant="secondary" size="sm" className="h-10" onClick={() => setRange(d as number)}>{l}</Button>
            ))}
          </div>
          <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}>
            <option value="">Todos los métodos</option>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select value={concept} onChange={(e) => { setConcept(e.target.value); setPage(1); }}>
            <option value="">Todos los conceptos</option>
            {Object.entries(CONCEPTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Input icon={<Search className="size-4" />} placeholder="Cliente o referencia…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>

        {isLoading ? <LoadingBlock rows={8} /> : !data?.rows.length ? <EmptyState title="No hay pagos en este período" /> : (
          <>
            <Table>
              <thead><tr><th>Fecha</th><th>Cliente</th><th>Concepto</th><th>Método</th><th className="hidden lg:table-cell">Tasa</th><th className="text-right">Monto</th><th /></tr></thead>
              <tbody>
                {data.rows.map((p) => (
                  <tr key={p.id} className={p.voided_at ? 'opacity-50' : ''}>
                    <td className="whitespace-nowrap text-muted">{dateTime(p.created_at)}</td>
                    <td>
                      {p.client_id ? <Link to={`/clientes/${p.client_id}`} className="font-medium hover:underline">{fullName(p)}</Link> : <span className="text-muted">Cliente general</span>}
                      {p.notes && <p className="max-w-56 truncate text-xs text-muted" title={p.notes}>{p.notes}</p>}
                    </td>
                    <td><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: CONCEPTS[p.concept].color }} />{CONCEPTS[p.concept].label}</span></td>
                    <td>
                      <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: METHOD_COLORS[p.method] }} />{PAYMENT_METHODS[p.method]?.label}</span>
                      {p.reference && <p className="text-xs text-muted">Ref. {p.reference}</p>}
                    </td>
                    <td className="hidden tabular text-muted lg:table-cell">{rateStr(p.rate)}</td>
                    <td>{p.voided_at ? <div className="text-right"><Badge tone="red">Anulado</Badge></div> : <Money value={p.amount_usd} bsValue={p.amount_bs} size="sm" align="right" />}</td>
                    <td className="text-right">
                      {can('admin') && !p.voided_at && <Button variant="ghost" size="icon" title="Anular" onClick={() => setVoiding(p)}><Ban className="size-4" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      {manual && <ManualPaymentModal onClose={() => setManual(false)} />}
      {voiding && <VoidModal payment={voiding} onClose={() => setVoiding(null)} />}
    </>
  );
}
