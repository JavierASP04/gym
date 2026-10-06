import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, UserPlus } from 'lucide-react';
import { MembershipCheckout } from '@/components/MembershipCheckout';
import { MembershipsTable } from '@/components/MembershipsTable';
import { Button, Card, PageHeader, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { int, todayStr, usd } from '@/lib/format';
import { usePlans, useSettings } from '@/lib/hooks';

export default function Enrollments() {
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState<number>();
  const { data: plans = [] } = usePlans();
  const { data: settings } = useSettings();
  const { can } = useAuth();
  const t = todayStr();
  const { data: month } = useQuery({
    queryKey: ['memberships', 'month-stats', t],
    queryFn: () => api.get<{ memberships: { inscripciones: number; renovaciones: number }; newClients: number }>('/reports/summary', { from: `${t.slice(0, 8)}01`, to: t }),
    enabled: can('admin'),
  });

  const start = (id?: number) => {
    setPlanId(id);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Inscripciones"
        subtitle="Registra nuevos miembros y cobra su primer plan"
        icon={<UserPlus className="size-5" />}
        actions={<Button size="lg" icon={<UserPlus className="size-4" />} onClick={() => start()}>Nueva inscripción</Button>}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat accent label="Inscripciones del mes" value={month ? int(month.memberships.inscripciones) : '—'} sub={month ? `${month.newClients} clientes nuevos registrados` : 'Solo administradores ven estadísticas'} icon={<Sparkles className="size-4" />} />
        <Stat label="Cuota de inscripción" value={usd(Number(settings?.enrollment_fee_usd ?? 0))} sub="Se cobra solo en la primera membresía" />
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Inscripción rápida</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plans.filter((p) => p.active).map((p) => (
              <Button key={p.id} variant="secondary" size="sm" onClick={() => start(p.id)}>
                <span className="size-2 rounded-full" style={{ background: p.color }} /> {p.name}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      <MembershipsTable kind="inscripcion" />

      {open && <MembershipCheckout open onClose={() => setOpen(false)} planId={planId} title="Nueva inscripción" />}
    </>
  );
}
