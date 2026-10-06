import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircle, RefreshCcw } from 'lucide-react';
import type { PickedClient } from '@/components/ClientPicker';
import { MembershipCheckout } from '@/components/MembershipCheckout';
import { MembershipsTable } from '@/components/MembershipsTable';
import { Avatar, Badge, Button, Card, EmptyState, LoadingBlock, Money, PageHeader, Segmented, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { STATUS } from '@/lib/constants';
import { date, fullName, initials, relativeDays, whatsappLink } from '@/lib/format';
import { useSettings } from '@/lib/hooks';
import type { MembershipStatus } from '@/lib/types';

interface ExpiringRow {
  id: number;
  client_id: number;
  end_date: string;
  status: MembershipStatus;
  days_left: number;
  document: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  plan_id: number;
  plan_name: string;
  plan_color: string;
  price_usd: number;
}

export default function Renewals() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes');
  const [window_, setWindow] = useState('7');
  const [checkout, setCheckout] = useState<{ client: PickedClient | null; planId?: number } | null>(null);
  const { data: settings } = useSettings();

  const { data = [], isLoading } = useQuery({
    queryKey: ['expiring', window_],
    queryFn: () => api.get<ExpiringRow[]>('/memberships/expiring', { days: window_, past: 30 }),
  });

  const preselect = params.get('cliente');
  const { data: preClient } = useQuery({
    queryKey: ['client', Number(preselect)],
    queryFn: () => api.get<{ client: PickedClient; current: { plan_id: number } | null }>(`/clients/${preselect}`),
    enabled: !!preselect,
  });
  useEffect(() => {
    if (preClient) {
      setCheckout({ client: preClient.client, planId: preClient.current?.plan_id });
      setParams({}, { replace: true });
    }
  }, [preClient, setParams]);

  const upcoming = data.filter((r) => r.days_left >= 0);
  const overdue = data.filter((r) => r.days_left < 0);

  const row = (r: ExpiringRow) => {
    const msg = `Hola ${r.first_name}, tu plan ${r.plan_name} en ${settings?.gym_name ?? 'el gimnasio'} ${r.days_left >= 0 ? `vence ${relativeDays(r.days_left)} (${date(r.end_date)})` : `venció ${relativeDays(r.days_left)}`}. Renueva y sigue entrenando con nosotros.`;
    const wa = whatsappLink(r.phone, msg);
    return (
      <tr key={r.id}>
        <td>
          <Link to={`/clientes/${r.client_id}`} className="flex items-center gap-3">
            <Avatar size="sm" name={initials(r.first_name, r.last_name)} color={r.plan_color} />
            <div>
              <p className="font-medium hover:underline">{fullName(r)}</p>
              <p className="text-xs text-muted">{r.document} · {r.phone ?? 'sin teléfono'}</p>
            </div>
          </Link>
        </td>
        <td>{r.plan_name}</td>
        <td className="tabular">{date(r.end_date)}</td>
        <td><Badge tone={STATUS[r.status].tone} dot>{relativeDays(r.days_left)}</Badge></td>
        <td><Money value={r.price_usd} size="sm" /></td>
        <td>
          <div className="flex justify-end gap-1">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="icon" title="Enviar recordatorio por WhatsApp"><MessageCircle className="size-4" /></Button>
              </a>
            )}
            <Button size="sm" icon={<RefreshCcw className="size-3.5" />} onClick={() => setCheckout({ client: r, planId: r.plan_id })}>Renovar</Button>
          </div>
        </td>
      </tr>
    );
  };

  const head = (
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Plan</th>
        <th>Vence</th>
        <th>Estado</th>
        <th>Precio</th>
        <th />
      </tr>
    </thead>
  );

  return (
    <>
      <PageHeader
        title="Renovaciones"
        subtitle="Los días restantes nunca se pierden: la renovación continúa desde el vencimiento"
        icon={<RefreshCcw className="size-5" />}
        actions={
          <>
            <Segmented value={tab} onChange={setTab} options={[{ value: 'pendientes', label: 'Pendientes' }, { value: 'historial', label: 'Historial' }]} />
            <Button icon={<RefreshCcw className="size-4" />} onClick={() => setCheckout({ client: null })}>Renovar cliente</Button>
          </>
        }
      />

      {tab === 'historial' ? (
        <MembershipsTable kind="renovacion" />
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
              <div>
                <p className="font-display font-semibold">Por vencer</p>
                <p className="text-xs text-muted">{upcoming.length} clientes</p>
              </div>
              <Segmented value={window_} onChange={setWindow} options={[{ value: '3', label: '3 días' }, { value: '7', label: '7 días' }, { value: '15', label: '15 días' }, { value: '30', label: '30 días' }]} />
            </div>
            {isLoading ? <LoadingBlock /> : upcoming.length ? <Table>{head}<tbody>{upcoming.map(row)}</tbody></Table> : <EmptyState title="Nadie por vencer en este período" />}
          </Card>

          <Card>
            <div className="border-b border-line p-4">
              <p className="font-display font-semibold">Vencidos recientemente</p>
              <p className="text-xs text-muted">Últimos 30 días · {overdue.length} clientes por recuperar</p>
            </div>
            {isLoading ? <LoadingBlock /> : overdue.length ? <Table>{head}<tbody>{overdue.map(row)}</tbody></Table> : <EmptyState title="Sin vencidos recientes" />}
          </Card>
        </div>
      )}

      {checkout && <MembershipCheckout open onClose={() => setCheckout(null)} client={checkout.client} planId={checkout.planId} title="Renovar membresía" />}
    </>
  );
}
