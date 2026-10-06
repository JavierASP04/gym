import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Ban, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STATUS } from '@/lib/constants';
import { date, dateTime, fullName, usd } from '@/lib/format';
import { useAction, useDebounced } from '@/lib/hooks';
import type { Membership, Paged } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingBlock, Modal, Pagination, Switch, Table, Textarea } from './ui';

export function CancelMembershipModal({ membership, onClose }: { membership: Membership | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [voidPayments, setVoidPayments] = useState(true);
  const cancel = useAction(() => api.post(`/memberships/${membership!.id}/cancel`, { reason, void_payments: voidPayments }), {
    success: 'Membresía anulada',
    invalidate: [['memberships'], ['client'], ['clients'], ['dashboard'], ['payments']],
    onSuccess: onClose,
  });
  if (!membership) return null;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Anular membresía"
      subtitle={`${membership.plan_name} · ${date(membership.start_date)} → ${date(membership.end_date)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Volver</Button>
          <Button variant="danger" disabled={reason.trim().length < 3} loading={cancel.isPending} onClick={() => cancel.mutate(undefined)}>Anular</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Motivo *">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: error al registrar el plan" autoFocus />
        </Field>
        <Switch checked={voidPayments} onChange={setVoidPayments} label="Anular también los pagos asociados (reembolso)" />
      </div>
    </Modal>
  );
}

export function MembershipsTable({ kind }: { kind: 'inscripcion' | 'renovacion' }) {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<Membership | null>(null);
  const debounced = useDebounced(q);
  const params = { kind, q: debounced, page, pageSize: 15 };
  const { data, isLoading } = useQuery({
    queryKey: ['memberships', params],
    queryFn: () => api.get<Paged<Membership>>('/memberships', params),
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-line p-4">
        <p className="font-display font-semibold">Historial</p>
        <div className="w-72">
          <Input icon={<Search className="size-4" />} placeholder="Buscar cliente…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>
      {isLoading ? (
        <LoadingBlock />
      ) : !data?.rows.length ? (
        <EmptyState title="Sin registros" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Plan</th>
                <th>Período</th>
                <th>Total</th>
                <th>Estado</th>
                <th className="hidden lg:table-cell">Registró</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((m) => (
                <tr key={m.id} className={m.cancelled_at ? 'opacity-50' : ''}>
                  <td className="whitespace-nowrap text-muted">{dateTime(m.created_at)}</td>
                  <td>
                    <Link to={`/clientes/${m.client_id}`} className="font-medium hover:underline">{fullName(m)}</Link>
                    <p className="text-xs text-muted">{m.document}</p>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: m.plan_color }} />{m.plan_name}</span>
                  </td>
                  <td className="whitespace-nowrap tabular text-muted">{date(m.start_date)} → {date(m.end_date)}</td>
                  <td className="tabular font-medium">{usd(m.total_usd)}</td>
                  <td><Badge tone={STATUS[m.status].tone} dot>{STATUS[m.status].label}</Badge></td>
                  <td className="hidden text-muted lg:table-cell">{m.created_by_name}</td>
                  <td className="text-right">
                    {can('admin') && !m.cancelled_at && (
                      <Button variant="ghost" size="icon" title="Anular" onClick={() => setCancelling(m)}>
                        <Ban className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
        </>
      )}
      <CancelMembershipModal membership={cancelling} onClose={() => setCancelling(null)} />
    </Card>
  );
}
