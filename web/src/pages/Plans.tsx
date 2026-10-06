import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Check, ClipboardList, Pencil, Plus, Users } from 'lucide-react';
import { Badge, Button, Card, Field, Input, LoadingBlock, Modal, PageHeader, Switch, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { bs, usd } from '@/lib/format';
import { useAction, useBs, usePlans } from '@/lib/hooks';
import type { Plan } from '@/lib/types';

const COLORS = ['#c6f432', '#22c55e', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#f97316', '#f59e0b'];

function PlanModal({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const [d, setD] = useState({
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    price_usd: String(plan?.price_usd ?? ''),
    duration_days: String(plan?.duration_days ?? 30),
    color: plan?.color ?? COLORS[0],
    features: (plan?.features ?? []).join('\n'),
    active: plan ? !!plan.active : true,
  });
  const { toBs } = useBs();
  const save = useAction(
    () => {
      const body = { ...d, features: d.features.split('\n').map((s) => s.trim()).filter(Boolean) };
      return plan ? api.put(`/plans/${plan.id}`, body) : api.post('/plans', body);
    },
    { success: plan ? 'Plan actualizado' : 'Plan creado', invalidate: [['plans']], onSuccess: onClose },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? 'Editar plan' : 'Nuevo plan'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="plan-form" loading={save.isPending}>Guardar</Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre *" className="sm:col-span-2">
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} required autoFocus />
        </Field>
        <Field label="Precio ($) *" hint={`≈ ${bs(toBs(Number(d.price_usd) || 0))}`}>
          <Input inputMode="decimal" value={d.price_usd} onChange={(e) => setD({ ...d, price_usd: e.target.value.replace(',', '.') })} required />
        </Field>
        <Field label="Duración (días) *">
          <Input type="number" min={1} value={d.duration_days} onChange={(e) => setD({ ...d, duration_days: e.target.value })} required />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <Input value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </Field>
        <Field label="Beneficios (uno por línea)" className="sm:col-span-2">
          <Textarea rows={4} value={d.features} onChange={(e) => setD({ ...d, features: e.target.value })} placeholder={'Sala de pesas\nClases grupales'} />
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setD({ ...d, color: c })} className={clsx('grid size-8 place-items-center rounded-full transition', d.color === c && 'ring-2 ring-fg ring-offset-2 ring-offset-surface')} style={{ background: c }}>
                {d.color === c && <Check className="size-4 text-black/70" />}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex items-end">
          <Switch checked={d.active} onChange={(v) => setD({ ...d, active: v })} label="Disponible para la venta" />
        </div>
      </form>
    </Modal>
  );
}

export default function Plans() {
  const { data: plans, isLoading } = usePlans();
  const { can } = useAuth();
  const { toBs } = useBs();
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);
  const admin = can('admin');

  return (
    <>
      <PageHeader
        title="Planes"
        subtitle="Precios en dólares con su equivalente en bolívares a la tasa BCV del día"
        icon={<ClipboardList className="size-5" />}
        actions={admin && <Button icon={<Plus className="size-4" />} onClick={() => setEditing(null)}>Nuevo plan</Button>}
      />
      {isLoading ? (
        <Card><LoadingBlock /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {plans?.map((p) => (
            <Card key={p.id} className={clsx('group relative flex flex-col overflow-hidden p-6 transition hover:-translate-y-0.5', !p.active && 'opacity-60')}>
              <div className="absolute -right-10 -top-10 size-32 rounded-full opacity-25 blur-2xl transition group-hover:opacity-40" style={{ background: p.color }} />
              <div className="relative flex items-start justify-between">
                <div>
                  <span className="mb-3 block h-1.5 w-10 rounded-full" style={{ background: p.color }} />
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className="text-sm text-muted">{p.description}</p>
                </div>
                {admin && (
                  <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label="Editar"><Pencil className="size-4" /></Button>
                )}
              </div>
              <div className="relative mt-5">
                <p className="font-display text-4xl font-bold tracking-tight tabular">{usd(p.price_usd)}</p>
                <p className="text-sm text-muted tabular">{bs(toBs(p.price_usd))} · {p.duration_days} {p.duration_days === 1 ? 'día' : 'días'}</p>
              </div>
              <ul className="relative mt-5 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0" style={{ color: p.color }} /> {f}
                  </li>
                ))}
              </ul>
              <div className="relative mt-6 flex items-center justify-between border-t border-line pt-4 text-sm">
                <span className="flex items-center gap-2 text-muted"><Users className="size-4" /> {p.active_members ?? 0} activos</span>
                {!p.active && <Badge>Inactivo</Badge>}
                {p.duration_days > 1 && p.active ? <span className="text-xs text-muted">{usd(p.price_usd / p.duration_days)}/día</span> : null}
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing !== undefined && <PlanModal plan={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}
