import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarClock, Globe, RefreshCw, Save, Settings as SettingsIcon, TrendingUp } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Field, Input, LoadingBlock, PageHeader, Segmented, Switch, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { bs, dateTime, rateStr } from '@/lib/format';
import { useAction, useRate, useSettings } from '@/lib/hooks';
import type { Rate, Settings } from '@/lib/types';

function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={icon} />
      <div className="px-5 pb-5">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { data: rate } = useRate();
  const qc = useQueryClient();
  const [d, setD] = useState<Settings | null>(null);
  const [testing, setTesting] = useState(false);
  const { data: history = [] } = useQuery({ queryKey: ['rates', 'history', 10], queryFn: () => api.get<{ rate: number; source: string; fetched_at: string; rate_date: string | null }[]>('/rates/history', { limit: 10 }) });

  useEffect(() => {
    if (settings) setD(settings);
  }, [settings]);

  const save = useAction(() => api.put<Settings>('/settings', d), {
    success: 'Configuración guardada',
    invalidate: [['settings'], ['rate'], ['dashboard']],
  });

  const testFetch = async () => {
    setTesting(true);
    try {
      qc.setQueryData(['rate'], await api.get<Rate>('/rates/current', { refresh: 1 }));
      qc.invalidateQueries({ queryKey: ['rates'] });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading || !d) return <Card><LoadingBlock rows={8} /></Card>;
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });
  const dirty = JSON.stringify(d) !== JSON.stringify(settings);

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle="Datos del gimnasio, reglas de membresía y tasa de cambio"
        icon={<SettingsIcon className="size-5" />}
        actions={<Button icon={<Save className="size-4" />} disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar cambios</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Datos del gimnasio" subtitle="Aparecen en los recibos" icon={<Building2 className="size-4" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre comercial" className="sm:col-span-2"><Input value={d.gym_name} onChange={set('gym_name')} /></Field>
            <Field label="RIF"><Input value={d.gym_rif} onChange={set('gym_rif')} /></Field>
            <Field label="Teléfono"><Input value={d.gym_phone} onChange={set('gym_phone')} /></Field>
            <Field label="Correo" className="sm:col-span-2"><Input value={d.gym_email} onChange={set('gym_email')} /></Field>
            <Field label="Dirección" className="sm:col-span-2"><Input value={d.gym_address} onChange={set('gym_address')} /></Field>
            <Field label="Mensaje al pie del recibo" className="sm:col-span-2"><Input value={d.receipt_footer} onChange={set('receipt_footer')} /></Field>
          </div>
        </Section>

        <Section title="Membresías y acceso" subtitle="Reglas aplicadas en inscripciones, renovaciones y check-in" icon={<CalendarClock className="size-4" />}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cuota de inscripción ($)" hint={rate ? `≈ ${bs(Number(d.enrollment_fee_usd) * rate.rate)}` : undefined}><Input inputMode="decimal" value={d.enrollment_fee_usd} onChange={set('enrollment_fee_usd')} /></Field>
            <Field label="Días de gracia" hint="Acceso permitido tras vencer"><Input type="number" min={0} value={d.grace_days} onChange={set('grace_days')} /></Field>
            <Field label="Alerta de vencimiento" hint="Días antes para avisar"><Input type="number" min={1} value={d.expiring_alert_days} onChange={set('expiring_alert_days')} /></Field>
          </div>
          <div className="mt-5">
            <Switch checked={d.one_checkin_per_day === '1'} onChange={(v) => setD({ ...d, one_checkin_per_day: v ? '1' : '0' })} label="Permitir solo una entrada por día por cliente" />
          </div>
        </Section>

        <Section title="Tasa de cambio BCV" subtitle="Conversión automática de $ a Bs en todo el sistema" icon={<TrendingUp className="size-4" />}>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-2 p-4">
              <div>
                <p className="text-xs text-muted">Tasa vigente</p>
                <p className="font-display text-3xl font-bold tabular">Bs {rateStr(rate?.rate)}</p>
                <p className="text-xs text-muted">{rate?.source} · {dateTime(rate?.fetchedAt)}</p>
              </div>
              <Button variant="outline" icon={<RefreshCw className={`size-4 ${testing ? 'animate-spin' : ''}`} />} onClick={testFetch} disabled={testing || d.rate_mode === 'manual'}>Consultar BCV ahora</Button>
            </div>
            <Field label="Modo">
              <Segmented value={d.rate_mode as 'auto' | 'manual'} onChange={(v) => setD({ ...d, rate_mode: v })} options={[{ value: 'auto', label: 'Automática (API BCV)' }, { value: 'manual', label: 'Manual' }]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tasa manual (Bs por $)" hint={d.rate_mode === 'auto' ? 'Se usa como respaldo si la API no responde' : 'Se usará en todas las operaciones'}>
                <Input inputMode="decimal" value={d.manual_rate} onChange={set('manual_rate')} />
              </Field>
              <Field label="Actualizar cada (minutos)" hint="Frecuencia de consulta a la API">
                <Input type="number" min={5} value={d.rate_refresh_minutes} onChange={set('rate_refresh_minutes')} disabled={d.rate_mode === 'manual'} />
              </Field>
            </div>
            <p className="flex items-start gap-2 rounded-xl border border-line p-3 text-xs text-muted">
              <Globe className="mt-0.5 size-4 shrink-0" />
              Fuentes gratuitas: DolarApi (ve.dolarapi.com) con respaldo en PyDolarVe. Cada pago guarda la tasa usada, así los reportes históricos no cambian cuando la tasa se actualiza.
            </p>
          </div>
        </Section>

        <Card>
          <CardHeader title="Historial de tasas" subtitle="Últimos valores registrados" />
          <Table>
            <thead><tr><th>Fecha</th><th>Fuente</th><th className="text-right">Tasa</th></tr></thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td className="text-muted">{dateTime(h.fetched_at)}</td>
                  <td><Badge tone={h.source.includes('demo') ? 'gray' : 'blue'}>{h.source}</Badge></td>
                  <td className="text-right font-medium tabular">{rateStr(h.rate)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
