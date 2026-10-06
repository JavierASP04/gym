import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { CalendarCheck2, CheckCircle2, DoorOpen, Fingerprint, LogOut, ScanLine, ShieldAlert, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { ClientPicker } from '@/components/ClientPicker';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Input, LoadingBlock, PageHeader, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { STATUS } from '@/lib/constants';
import { date, fullName, initials, relativeDays, time, todayStr } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import type { MembershipStatus } from '@/lib/types';

interface CheckInResult {
  allowed: boolean;
  duplicate?: boolean;
  reason?: string;
  warning?: string;
  client: { id: number; document: string; first_name: string; last_name: string };
  membership: { plan_name: string; plan_color: string; end_date: string; days_left: number; status: MembershipStatus } | null;
}

interface AttendanceRow {
  id: number;
  client_id: number;
  document: string;
  first_name: string;
  last_name: string;
  plan_name: string | null;
  plan_color: string | null;
  check_in_at: string;
  check_out_at: string | null;
}

export default function Attendance() {
  const [doc, setDoc] = useState('');
  const [day, setDay] = useState(todayStr());
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [resultKey, setResultKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', day],
    queryFn: () => api.get<{ rows: AttendanceRow[]; inside: number }>('/attendance', { date: day }),
    refetchInterval: 30_000,
  });

  const checkIn = async (body: { document?: string; client_id?: number }) => {
    setBusy(true);
    try {
      const r = await api.post<CheckInResult>('/attendance/check-in', body);
      setResult(r);
      setResultKey((k) => k + 1);
      if (r.allowed && !r.duplicate) {
        toast.success(`Bienvenido, ${r.client.first_name}`);
        qc.invalidateQueries({ queryKey: ['attendance'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
      }
      setDoc('');
    } catch (e) {
      setResult(null);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (doc.trim()) checkIn({ document: doc.trim() });
  };

  const checkout = useAction((id: number) => api.post(`/attendance/${id}/check-out`), { success: 'Salida registrada', invalidate: [['attendance'], ['dashboard']] });

  const rows = data?.rows ?? [];
  const isToday = day === todayStr();

  return (
    <>
      <PageHeader title="Asistencias" subtitle="Control de acceso y registro de entradas" icon={<CalendarCheck2 className="size-5" />} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-6">
          <Card className="relative overflow-hidden p-6">
            <div className="bg-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
            <div className="relative">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-accent-fg animate-pulse-ring">
                <Fingerprint className="size-8" />
              </div>
              <h2 className="mt-4 text-center font-display text-xl font-bold">Registrar entrada</h2>
              <p className="text-center text-sm text-muted">Ingresa o escanea la cédula del cliente</p>
              <form onSubmit={submit} className="mt-5 flex gap-2">
                <Input
                  ref={inputRef}
                  autoFocus
                  icon={<ScanLine className="size-4" />}
                  className="h-12 text-lg tracking-wider uppercase"
                  placeholder="V12345678"
                  value={doc}
                  onChange={(e) => setDoc(e.target.value)}
                />
                <Button type="submit" size="lg" loading={busy}>Entrar</Button>
              </form>
              <div className="mt-4">
                <p className="mb-1.5 text-xs text-muted">o busca por nombre</p>
                <ClientPicker value={null} onChange={(c) => c && checkIn({ client_id: c.id })} />
              </div>
            </div>
          </Card>

          {result && (
            <Card
              key={resultKey}
              className={clsx('overflow-hidden animate-pop', result.allowed ? 'border-emerald-500/40' : 'border-red-500/40')}
            >
              <div className={clsx('flex items-center gap-3 px-5 py-3 text-sm font-semibold', result.allowed ? 'bg-emerald-500/12 text-emerald-400 light:text-emerald-700' : 'bg-red-500/12 text-red-400 light:text-red-600')}>
                {result.allowed ? <CheckCircle2 className="size-5" /> : <ShieldAlert className="size-5" />}
                {result.allowed ? (result.duplicate ? 'Ya registró entrada hoy' : 'Acceso permitido') : 'Acceso denegado'}
              </div>
              <div className="flex items-center gap-4 p-5">
                <Avatar size="lg" name={initials(result.client.first_name, result.client.last_name)} color={result.membership?.plan_color} />
                <div className="min-w-0 flex-1">
                  <Link to={`/clientes/${result.client.id}`} className="block truncate font-display text-lg font-semibold hover:underline">{fullName(result.client)}</Link>
                  <p className="text-sm text-muted">{result.client.document}</p>
                  {result.membership && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS[result.membership.status].tone} dot>{STATUS[result.membership.status].label}</Badge>
                      <span className="text-xs text-muted">
                        {result.membership.plan_name} · vence {date(result.membership.end_date)} ({relativeDays(result.membership.days_left)})
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {(result.reason && !result.allowed) || result.warning ? (
                <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
                  <span className={result.allowed ? 'text-amber-400' : 'text-red-400'}>{result.allowed ? result.warning : result.reason}</span>
                  {(!result.allowed || result.membership?.status === 'gracia' || result.membership?.status === 'por_vencer') && (
                    <Link to={`/renovaciones?cliente=${result.client.id}`}>
                      <Button size="sm">Renovar</Button>
                    </Link>
                  )}
                </div>
              ) : null}
            </Card>
          )}
        </div>

        <Card>
          <CardHeader
            title={isToday ? 'Entradas de hoy' : `Entradas del ${date(day)}`}
            subtitle={`${rows.length} visitas · ${data?.inside ?? 0} en sala`}
            icon={<DoorOpen className="size-4" />}
            action={<input type="date" className="field h-9 w-auto" value={day} max={todayStr()} onChange={(e) => setDay(e.target.value || todayStr())} />}
          />
          {isLoading ? (
            <LoadingBlock />
          ) : rows.length === 0 ? (
            <EmptyState icon={<UserRound className="size-6" />} title="Sin registros" description="Las entradas aparecerán aquí en tiempo real" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Plan</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/clientes/${r.client_id}`} className="flex items-center gap-3">
                        <Avatar size="sm" name={initials(r.first_name, r.last_name)} color={r.plan_color} />
                        <div>
                          <p className="font-medium hover:underline">{fullName(r)}</p>
                          <p className="text-xs text-muted">{r.document}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="text-muted">{r.plan_name ?? '—'}</td>
                    <td className="tabular">{time(r.check_in_at)}</td>
                    <td className="tabular">{r.check_out_at ? time(r.check_out_at) : <Badge tone="green" dot>En sala</Badge>}</td>
                    <td className="text-right">
                      {!r.check_out_at && isToday && (
                        <Button variant="ghost" size="sm" icon={<LogOut className="size-3.5" />} onClick={() => checkout.mutate(r.id)}>
                          Salida
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
