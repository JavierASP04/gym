import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CalendarCheck2, Cake, HeartPulse, Mail, MapPin, MessageCircle, Pencil, Phone, RefreshCcw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ClientFormModal } from '@/components/ClientForm';
import { MembershipCheckout } from '@/components/MembershipCheckout';
import { CancelMembershipModal } from '@/components/MembershipsTable';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, LoadingBlock, Money, Segmented, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CONCEPTS, PAYMENT_METHODS, STATUS } from '@/lib/constants';
import { age, date, dateTime, fullName, initials, int, relativeDays, time, usd, whatsappLink } from '@/lib/format';
import type { Client, Membership, Payment } from '@/lib/types';

interface Detail {
  client: Client;
  current: (Membership & { days_left: number }) | null;
  memberships: Membership[];
  payments: Payment[];
  attendance: { id: number; check_in_at: string; check_out_at: string | null }[];
  stats: { visits: number; visits_30d: number; total_paid_usd: number };
}

export default function ClientDetail() {
  const id = Number(useParams().id);
  const { can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'membresias' | 'pagos' | 'asistencias'>('membresias');
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [cancelling, setCancelling] = useState<Membership | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['client', id], queryFn: () => api.get<Detail>(`/clients/${id}`) });

  if (isLoading || !data) return <Card><LoadingBlock rows={8} /></Card>;
  const { client, current, stats } = data;
  const staff = can('admin', 'recepcion');

  const checkIn = async () => {
    const r = await api.post<{ allowed: boolean; reason?: string; duplicate?: boolean }>('/attendance/check-in', { client_id: id }).catch((e) => {
      toast.error(e.message);
      return null;
    });
    if (!r) return;
    if (!r.allowed) toast.error(r.reason);
    else if (r.duplicate) toast.info('Ya registró entrada hoy');
    else toast.success('Entrada registrada');
    qc.invalidateQueries({ queryKey: ['client', id] });
    qc.invalidateQueries({ queryKey: ['attendance'] });
  };

  const total = current ? Math.max(1, Math.round((new Date(current.end_date).getTime() - new Date(current.start_date).getTime()) / 86_400_000) + 1) : 1;
  const progress = current ? Math.min(100, Math.max(0, ((total - Math.max(0, current.days_left + 1)) / total) * 100)) : 0;
  const wa = whatsappLink(client.phone, `Hola ${client.first_name}, `);
  const a = age(client.birth_date);

  return (
    <>
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <Card className="relative mb-6 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-24 opacity-30" style={{ background: `linear-gradient(120deg, ${current?.plan_color ?? 'var(--surface-3)'}, transparent 70%)` }} />
        <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-center">
          <Avatar size="lg" name={initials(client.first_name, client.last_name)} color={current?.plan_color} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight">{fullName(client)}</h1>
              {!client.active ? <Badge>Inactivo</Badge> : current ? <Badge tone={STATUS[current.status].tone} dot>{STATUS[current.status].label}</Badge> : <Badge>Sin plan</Badge>}
            </div>
            <p className="text-sm text-muted">
              {client.document}
              {a !== null && ` · ${a} años`} · Cliente desde {date(client.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<CalendarCheck2 className="size-4" />} onClick={checkIn}>Check-in</Button>
            {staff && <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Editar</Button>}
            {staff && <Button icon={<RefreshCcw className="size-4" />} onClick={() => setRenewing(true)}>{data.memberships.length ? 'Renovar' : 'Inscribir'}</Button>}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Membresía actual</p>
            {current ? (
              <>
                <div className="mt-2 flex items-center justify-between">
                  <p className="font-display text-xl font-bold">{current.plan_name}</p>
                  <span className="text-sm text-muted">{relativeDays(current.days_left)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: current.plan_color }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted tabular">
                  <span>{date(current.start_date)}</span>
                  <span>{date(current.end_date)}</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">El cliente no tiene membresías.</p>
            )}
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
              <div><p className="font-display text-lg font-bold tabular">{int(stats.visits)}</p><p className="text-[11px] text-muted">Visitas</p></div>
              <div><p className="font-display text-lg font-bold tabular">{int(stats.visits_30d)}</p><p className="text-[11px] text-muted">Últ. 30 días</p></div>
              <div><p className="font-display text-lg font-bold tabular">{usd(stats.total_paid_usd)}</p><p className="text-[11px] text-muted">Pagado</p></div>
            </div>
          </Card>

          <Card className="space-y-3 p-5 text-sm">
            {[
              [Phone, client.phone],
              [Mail, client.email],
              [Cake, client.birth_date && date(client.birth_date)],
              [MapPin, client.address],
              [ShieldAlert, client.emergency_contact && `Emergencia: ${client.emergency_contact}`],
              [HeartPulse, client.notes],
            ]
              .filter(([, v]) => v)
              .map(([Icon, v], i) => {
                const I = Icon as typeof Phone;
                return (
                  <p key={i} className="flex items-start gap-3">
                    <I className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span className="min-w-0 break-words">{v as string}</span>
                  </p>
                );
              })}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="mt-2 w-full" icon={<MessageCircle className="size-4" />}>Escribir por WhatsApp</Button>
              </a>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Actividad"
            action={<Segmented value={tab} onChange={setTab} options={[{ value: 'membresias', label: 'Membresías' }, { value: 'pagos', label: 'Pagos' }, { value: 'asistencias', label: 'Asistencias' }]} />}
          />
          {tab === 'membresias' &&
            (data.memberships.length ? (
              <Table>
                <thead><tr><th>Plan</th><th>Tipo</th><th>Período</th><th>Total</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {data.memberships.map((m) => (
                    <tr key={m.id} className={m.cancelled_at ? 'opacity-50' : ''}>
                      <td><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: m.plan_color }} />{m.plan_name}</span></td>
                      <td className="text-muted">{m.kind === 'inscripcion' ? 'Inscripción' : 'Renovación'}</td>
                      <td className="whitespace-nowrap tabular">{date(m.start_date)} → {date(m.end_date)}</td>
                      <td className="tabular">{usd(m.total_usd)}</td>
                      <td><Badge tone={STATUS[m.status].tone} dot>{STATUS[m.status].label}</Badge></td>
                      <td className="text-right">
                        {can('admin') && !m.cancelled_at && (
                          <Button variant="ghost" size="icon" title="Anular" onClick={() => setCancelling(m)}><Ban className="size-4" /></Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState title="Sin membresías" />)}

          {tab === 'pagos' &&
            (data.payments.length ? (
              <Table>
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th>Referencia</th><th className="text-right">Monto</th></tr></thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id} className={p.voided_at ? 'opacity-50 line-through' : ''}>
                      <td className="whitespace-nowrap text-muted">{dateTime(p.created_at)}</td>
                      <td>{CONCEPTS[p.concept].label}</td>
                      <td>{PAYMENT_METHODS[p.method]?.label}</td>
                      <td className="text-muted">{p.reference ?? '—'}</td>
                      <td><Money value={p.amount_usd} bsValue={p.amount_bs} size="sm" align="right" /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState title="Sin pagos" />)}

          {tab === 'asistencias' &&
            (data.attendance.length ? (
              <Table>
                <thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th></tr></thead>
                <tbody>
                  {data.attendance.map((a) => (
                    <tr key={a.id}>
                      <td>{date(a.check_in_at)}</td>
                      <td className="tabular">{time(a.check_in_at)}</td>
                      <td className="tabular text-muted">{a.check_out_at ? time(a.check_out_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState title="Sin asistencias" />)}
        </Card>
      </div>

      {editing && <ClientFormModal open client={client} onClose={() => setEditing(false)} />}
      {renewing && <MembershipCheckout open onClose={() => setRenewing(false)} client={client} planId={current?.plan_id} />}
      <CancelMembershipModal membership={cancelling} onClose={() => setCancelling(null)} />
    </>
  );
}
