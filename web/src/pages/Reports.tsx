import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart3, Download, Printer } from 'lucide-react';
import { AreaTrend, Bars, Donut, Legend } from '@/components/charts';
import { Button, Card, CardHeader, EmptyState, Input, LoadingBlock, PageHeader, Segmented, Stat, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { CONCEPTS, METHOD_COLORS, PAYMENT_METHODS, WEEKDAYS } from '@/lib/constants';
import { addDays, bs, downloadCsv, int, rateStr, shortDate, todayStr, usd } from '@/lib/format';
import type { Concept, PaymentMethod } from '@/lib/types';

interface Summary {
  range: { from: string; to: string; days: number; prevFrom: string; prevTo: string };
  income: { count: number; usd: number; bs: number; avgTicket: number; prevUsd: number; changePct: number | null };
  byConcept: { concept: Concept; count: number; usd: number; bs: number }[];
  byMethod: { method: PaymentMethod; currency: string; count: number; usd: number; bs: number }[];
  byDay: { date: string; usd: number; bs: number; count: number }[];
  byPlan: { name: string; color: string; count: number; usd: number; inscripciones: number; renovaciones: number }[];
  memberships: { inscripciones: number; renovaciones: number };
  attendance: { visits: number; unique_clients: number; avgPerDay: number; byHour: { hour: number; visits: number }[]; byWeekday: { weekday: number; visits: number }[]; byDay: { date: string; visits: number }[] };
  topProducts: { name: string; qty: number; usd: number }[];
  topClients: { id: number; first_name: string; last_name: string; visits: number }[];
  newClients: number;
}

type Preset = 'hoy' | '7' | '30' | 'mes' | '90' | 'custom';

function rangeFor(p: Preset, t: string): [string, string] {
  if (p === 'hoy') return [t, t];
  if (p === 'mes') return [`${t.slice(0, 8)}01`, t];
  return [addDays(t, -Number(p) + 1), t];
}

export default function Reports() {
  const t = todayStr();
  const [preset, setPreset] = useState<Preset>('30');
  const [[from, to], setRange] = useState<[string, string]>(rangeFor('30', t));

  const { data, isLoading } = useQuery({ queryKey: ['reports', from, to], queryFn: () => api.get<Summary>('/reports/summary', { from, to }), placeholderData: keepPreviousData });
  const { data: rates = [] } = useQuery({ queryKey: ['rates', 'history'], queryFn: () => api.get<{ rate: number; fetched_at: string; rate_date: string | null }[]>('/rates/history', { limit: 90 }) });

  const choose = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(rangeFor(p, t));
  };

  const hours = Array.from({ length: 17 }, (_, i) => i + 5).map((h) => ({ hour: `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`, visits: data?.attendance.byHour.find((x) => x.hour === h)?.visits ?? 0 }));
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: WEEKDAYS[d], visits: data?.attendance.byWeekday.find((x) => x.weekday === d)?.visits ?? 0 }));
  const rateSeries = [...rates].reverse().map((r) => ({ date: (r.rate_date ?? r.fetched_at).slice(0, 10), rate: r.rate }));

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle={data ? `${shortDate(from)} – ${shortDate(to)} · comparado con ${shortDate(data.range.prevFrom)} – ${shortDate(data.range.prevTo)}` : ' '}
        icon={<BarChart3 className="size-5" />}
        actions={
          <>
            <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Imprimir</Button>
            <Button variant="outline" icon={<Download className="size-4" />} disabled={!data?.byDay.length} onClick={() => data && downloadCsv(`ingresos_${from}_${to}.csv`, data.byDay.map((d) => ({ fecha: d.date, pagos: d.count, total_usd: d.usd.toFixed(2), total_bs: d.bs.toFixed(2) })))}>
              CSV
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented value={preset} onChange={choose} options={[{ value: 'hoy', label: 'Hoy' }, { value: '7', label: '7 días' }, { value: '30', label: '30 días' }, { value: 'mes', label: 'Este mes' }, { value: '90', label: '90 días' }, { value: 'custom', label: 'Personalizado' }]} />
        {preset === 'custom' && (
          <div className="flex gap-2">
            <Input type="date" value={from} max={to} onChange={(e) => setRange([e.target.value, to])} />
            <Input type="date" value={to} min={from} max={t} onChange={(e) => setRange([from, e.target.value])} />
          </div>
        )}
      </div>

      {isLoading || !data ? <Card><LoadingBlock rows={8} /></Card> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat accent label="Ingresos" value={usd(data.income.usd)} sub={bs(data.income.bs)} trend={data.income.changePct} />
            <Stat label="Ticket promedio" value={usd(data.income.avgTicket)} sub={`${int(data.income.count)} pagos`} />
            <Stat label="Inscripciones / renovaciones" value={`${data.memberships.inscripciones} / ${data.memberships.renovaciones}`} sub={`${data.newClients} clientes nuevos`} />
            <Stat label="Asistencias" value={int(data.attendance.visits)} sub={`${data.attendance.unique_clients} únicos · ${data.attendance.avgPerDay}/día`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Ingresos por día" subtitle="USD (Bs convertidos a la tasa del día de cada pago)" />
              <div className="px-3 pb-4">{data.byDay.length ? <AreaTrend data={data.byDay} x="date" y="usd" height={280} format={(v) => usd(v)} xFormat={shortDate} labelFormat={(l) => shortDate(String(l))} /> : <EmptyState title="Sin ingresos" />}</div>
            </Card>
            <Card>
              <CardHeader title="Métodos de pago" />
              <div className="px-5 pb-5">
                <Donut
                  data={data.byMethod.map((m) => ({ name: PAYMENT_METHODS[m.method]?.label ?? m.method, value: m.usd, color: METHOD_COLORS[m.method] ?? '#888' }))}
                  format={(v) => usd(v)}
                  center={<div><p className="text-xs text-muted">Total</p><p className="font-display text-lg font-bold">{usd(data.income.usd)}</p></div>}
                />
                <div className="mt-4">
                  <Legend items={data.byMethod.map((m) => ({ name: PAYMENT_METHODS[m.method]?.label ?? m.method, value: m.usd, color: METHOD_COLORS[m.method] ?? '#888' }))} format={(v) => usd(v)} />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title="Ingresos por concepto" />
              <div className="px-5 pb-5">
                <Legend items={data.byConcept.map((c) => ({ name: `${CONCEPTS[c.concept].label} (${c.count})`, value: c.usd, color: CONCEPTS[c.concept].color }))} format={(v) => usd(v)} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Horas pico" subtitle="Entradas por hora del día" />
              <div className="px-3 pb-4"><Bars data={hours} x="hour" y="visits" highlightMax /></div>
            </Card>
            <Card>
              <CardHeader title="Días más concurridos" />
              <div className="px-3 pb-4"><Bars data={weekdays} x="day" y="visits" color="#38bdf8" highlightMax /></div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title="Planes vendidos" />
              {data.byPlan.length ? (
                <Table>
                  <thead><tr><th>Plan</th><th>Insc.</th><th>Renov.</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {data.byPlan.map((p) => (
                      <tr key={p.name}>
                        <td><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span></td>
                        <td className="tabular">{p.inscripciones}</td>
                        <td className="tabular">{p.renovaciones}</td>
                        <td className="text-right tabular font-medium">{usd(p.usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : <EmptyState title="Sin ventas de planes" />}
            </Card>
            <Card>
              <CardHeader title="Productos más vendidos" />
              {data.topProducts.length ? (
                <Table>
                  <thead><tr><th>Producto</th><th>Uds</th><th className="text-right">Total</th></tr></thead>
                  <tbody>{data.topProducts.map((p) => <tr key={p.name}><td>{p.name}</td><td className="tabular">{p.qty}</td><td className="text-right tabular font-medium">{usd(p.usd)}</td></tr>)}</tbody>
                </Table>
              ) : <EmptyState title="Sin ventas en tienda" />}
            </Card>
            <Card>
              <CardHeader title="Clientes más constantes" />
              {data.topClients.length ? (
                <div className="divide-y divide-line">
                  {data.topClients.map((c, i) => (
                    <Link key={c.id} to={`/clientes/${c.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
                      <span className="w-5 font-display font-bold text-muted">{i + 1}</span>
                      <span className="flex-1 truncate text-sm">{c.first_name} {c.last_name}</span>
                      <span className="text-sm font-semibold tabular">{c.visits} visitas</span>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState title="Sin asistencias" />}
            </Card>
          </div>

          {rateSeries.length > 1 && (
            <Card>
              <CardHeader title="Evolución de la tasa BCV" subtitle={`Último valor registrado: Bs ${rateStr(rateSeries.at(-1)?.rate)}`} />
              <div className="px-3 pb-4"><AreaTrend data={rateSeries} x="date" y="rate" color="#38bdf8" height={220} format={(v) => `Bs ${rateStr(v)}`} xFormat={shortDate} labelFormat={(l) => shortDate(String(l))} /></div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
