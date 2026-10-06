import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Cake, CalendarCheck2, DollarSign, MessageCircle, Package, RefreshCcw, UserPlus, Users, Wallet } from 'lucide-react';
import { AreaTrend, Bars } from '@/components/charts';
import { Badge, Button, Card, CardHeader, EmptyState, LoadingBlock, Money, PageHeader, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CONCEPTS, PAYMENT_METHODS } from '@/lib/constants';
import { bs, fullName, int, relativeDays, shortDate, time, usd, whatsappLink } from '@/lib/format';
import { useSettings } from '@/lib/hooks';
import type { Concept, PaymentMethod } from '@/lib/types';

interface DashboardData {
  members: { active: number; expiring: number; grace: number; expired: number; scheduled: number };
  today: { count: number; usd: number; bs: number; visits: number; inside: number };
  month: { count: number; usd: number; bs: number };
  last30: { date: string; usd: number; visits: number }[];
  lowStock: { id: number; name: string; stock: number; min_stock: number }[];
  recentPayments: { id: number; concept: Concept; method: PaymentMethod; amount_usd: number; amount_bs: number; created_at: string; first_name: string | null; last_name: string | null }[];
  expiring: { id: number; client_id: number; end_date: string; days_left: number; first_name: string; last_name: string; phone: string | null; plan_name: string; plan_color: string }[];
  birthdays: { id: number; first_name: string; last_name: string }[];
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const { data: settings } = useSettings();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard'), refetchInterval: 60_000 });
  const staff = can('admin', 'recepcion');

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name.split(' ')[0]}`}
        subtitle={new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <>
            <Link to="/asistencias">
              <Button variant="outline" icon={<CalendarCheck2 className="size-4" />}>Check-in</Button>
            </Link>
            {staff && (
              <Link to="/inscripciones">
                <Button icon={<UserPlus className="size-4" />}>Nueva inscripción</Button>
              </Link>
            )}
          </>
        }
      />

      {isLoading || !data ? (
        <Card><LoadingBlock rows={6} /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat accent label="Miembros activos" value={int(data.members.active)} sub={`${data.members.scheduled} programados`} icon={<Users className="size-4" />} />
            <Stat label="Asistencias hoy" value={int(data.today.visits)} sub={<><span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> {data.today.inside} en sala ahora</>} icon={<CalendarCheck2 className="size-4" />} />
            {staff ? (
              <>
                <Stat label="Ingresos hoy" value={usd(data.today.usd)} sub={bs(data.today.bs)} icon={<DollarSign className="size-4" />} />
                <Stat label="Ingresos del mes" value={usd(data.month.usd)} sub={`${bs(data.month.bs)} · ${data.month.count} pagos`} icon={<Wallet className="size-4" />} />
              </>
            ) : (
              <>
                <Stat label="Por vencer" value={int(data.members.expiring)} sub={`próximos ${settings?.expiring_alert_days ?? 5} días`} icon={<RefreshCcw className="size-4" />} />
                <Stat label="Vencidos" value={int(data.members.expired)} icon={<AlertTriangle className="size-4" />} />
              </>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={staff ? 'Ingresos · últimos 30 días' : 'Asistencias · últimos 30 días'} subtitle={staff ? 'Total diario en USD (todas las monedas convertidas a la tasa del día)' : 'Visitas diarias'} />
              <div className="px-3 pb-4">
                {staff ? (
                  <AreaTrend data={data.last30} x="date" y="usd" format={(v) => usd(v)} xFormat={shortDate} labelFormat={(l) => shortDate(String(l))} />
                ) : (
                  <Bars data={data.last30} x="date" y="visits" xFormat={(v: string) => shortDate(v)} />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Estado de membresías" subtitle="Clientes activos según su último plan" />
              <div className="grid grid-cols-2 gap-3 px-5 pb-5">
                {[
                  { label: 'Activas', v: data.members.active - data.members.expiring, tone: 'bg-emerald-400' },
                  { label: 'Por vencer', v: data.members.expiring, tone: 'bg-amber-400' },
                  { label: 'En gracia', v: data.members.grace, tone: 'bg-orange-400' },
                  { label: 'Vencidas', v: data.members.expired, tone: 'bg-red-400' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className={`size-2 rounded-full ${s.tone}`} /> {s.label}
                    </div>
                    <p className="mt-1 font-display text-2xl font-bold tabular">{int(s.v)}</p>
                  </div>
                ))}
              </div>
              {staff && (
                <div className="px-5 pb-5">
                  <Bars data={data.last30.slice(-14)} x="date" y="visits" height={120} xFormat={(v: string) => shortDate(v)} highlightMax />
                  <p className="text-center text-xs text-muted">Asistencias últimos 14 días</p>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Vencimientos próximos"
                subtitle="Contacta a tus clientes antes de que se vayan"
                icon={<RefreshCcw className="size-4" />}
                action={staff && <Link to="/renovaciones" className="text-xs font-medium text-accent-ink hover:underline">Ver todos</Link>}
              />
              {data.expiring.length === 0 ? (
                <EmptyState title="Todo al día" description="No hay membresías por vencer" />
              ) : (
                <div className="divide-y divide-line">
                  {data.expiring.map((m) => {
                    const wa = whatsappLink(m.phone, `Hola ${m.first_name}, te recordamos que tu plan ${m.plan_name} en ${settings?.gym_name ?? 'el gimnasio'} ${m.days_left >= 0 ? `vence ${relativeDays(m.days_left)}` : `venció ${relativeDays(m.days_left)}`}. ¡Te esperamos para renovar!`);
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="h-9 w-1 rounded-full" style={{ background: m.plan_color }} />
                        <Link to={`/clientes/${m.client_id}`} className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium hover:underline">{fullName(m)}</p>
                          <p className="text-xs text-muted">{m.plan_name} · vence {shortDate(m.end_date)}</p>
                        </Link>
                        <Badge tone={m.days_left < 0 ? 'orange' : m.days_left <= 1 ? 'red' : 'amber'}>{relativeDays(m.days_left)}</Badge>
                        {wa && (
                          <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-muted hover:bg-emerald-500/10 hover:text-emerald-400" title="Recordar por WhatsApp">
                            <MessageCircle className="size-4" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="space-y-6">
              {staff && (
                <Card>
                  <CardHeader title="Últimos pagos" icon={<Wallet className="size-4" />} action={<Link to="/pagos" className="text-xs font-medium text-accent-ink hover:underline">Ver todos</Link>} />
                  <div className="divide-y divide-line pb-2">
                    {data.recentPayments.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="size-2 rounded-full" style={{ background: CONCEPTS[p.concept].color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{p.first_name ? fullName(p) : CONCEPTS[p.concept].label}</p>
                          <p className="text-xs text-muted">{PAYMENT_METHODS[p.method]?.label} · {time(p.created_at)}</p>
                        </div>
                        <Money value={p.amount_usd} bsValue={p.amount_bs} size="sm" align="right" />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {(data.lowStock.length > 0 || data.birthdays.length > 0) && (
                <Card className="p-5 space-y-4">
                  {data.birthdays.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Cake className="size-4 text-pink-400" /> Cumpleaños de hoy</p>
                      <div className="flex flex-wrap gap-2">
                        {data.birthdays.map((b) => (
                          <Link key={b.id} to={`/clientes/${b.id}`}><Badge tone="violet">{fullName(b)}</Badge></Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.lowStock.length > 0 && staff && (
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Package className="size-4 text-amber-400" /> Stock bajo</p>
                      <div className="space-y-1.5">
                        {data.lowStock.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="truncate text-muted">{p.name}</span>
                            <Badge tone={p.stock === 0 ? 'red' : 'amber'}>{p.stock} uds</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
