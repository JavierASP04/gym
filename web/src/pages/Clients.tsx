import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Plus, Search, Users } from 'lucide-react';
import { ClientFormModal } from '@/components/ClientForm';
import { Avatar, Badge, Button, Card, EmptyState, Input, LoadingBlock, PageHeader, Pagination, Segmented, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STATUS } from '@/lib/constants';
import { date, downloadCsv, fullName, initials, shortDate } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import type { ClientListRow, Paged } from '@/lib/types';

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'activa', label: 'Activos' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'gracia', label: 'En gracia' },
  { value: 'vencida', label: 'Vencidos' },
  { value: 'sin_plan', label: 'Sin plan' },
  { value: 'inactivo', label: 'Inactivos' },
];

export default function Clients() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(q);

  const params = { q: debounced, status, page, pageSize: 20 };
  const { data, isLoading } = useQuery({
    queryKey: ['clients', params],
    queryFn: () => api.get<Paged<ClientListRow>>('/clients', params),
    placeholderData: keepPreviousData,
  });

  const exportCsv = async () => {
    const all = await api.get<Paged<ClientListRow>>('/clients', { ...params, page: 1, pageSize: 100 });
    downloadCsv(
      'clientes.csv',
      all.rows.map((r) => ({ cedula: r.document, nombre: r.first_name, apellido: r.last_name, telefono: r.phone, correo: r.email, plan: r.plan_name, estado: STATUS[r.membership_status].label, vence: r.end_date, ultima_visita: r.last_visit })),
    );
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${data?.total ?? '—'} clientes registrados`}
        icon={<Users className="size-5" />}
        actions={
          <>
            <Button variant="outline" icon={<Download className="size-4" />} onClick={exportCsv}>Exportar</Button>
            {can('admin', 'recepcion') && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nuevo cliente</Button>}
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="lg:w-80">
            <Input icon={<Search className="size-4" />} placeholder="Cédula, nombre, teléfono…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div className="overflow-x-auto">
            <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={FILTERS} />
          </div>
        </div>

        {isLoading ? (
          <LoadingBlock rows={8} />
        ) : !data?.rows.length ? (
          <EmptyState title="No hay clientes" description={q ? 'Prueba con otra búsqueda' : 'Registra tu primer cliente'} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="hidden md:table-cell">Contacto</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th className="hidden lg:table-cell">Vence</th>
                  <th className="hidden xl:table-cell">Última visita</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((c) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" name={initials(c.first_name, c.last_name)} color={c.plan_color ?? 'var(--surface-3)'} />
                        <div className="min-w-0">
                          <Link to={`/clientes/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{fullName(c)}</Link>
                          <p className="text-xs text-muted tabular">{c.document}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <p>{c.phone ?? '—'}</p>
                      <p className="text-xs text-muted">{c.email}</p>
                    </td>
                    <td>{c.plan_name ?? <span className="text-muted">—</span>}</td>
                    <td>
                      {c.active ? <Badge tone={STATUS[c.membership_status].tone} dot>{STATUS[c.membership_status].label}</Badge> : <Badge>Inactivo</Badge>}
                    </td>
                    <td className="hidden tabular lg:table-cell">{date(c.end_date)}</td>
                    <td className="hidden text-muted xl:table-cell">{c.last_visit ? shortDate(c.last_visit) : 'Nunca'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      {creating && <ClientFormModal open onClose={() => setCreating(false)} onSaved={(c) => navigate(`/clientes/${c.id}`)} />}
    </>
  );
}
