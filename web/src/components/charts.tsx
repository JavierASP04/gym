import type { ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: Array<{ value: number; name: string; color?: string; payload: Record<string, unknown> }>; label?: string | number; format?: (v: number, name: string) => ReactNode; labelFormat?: (l: string | number) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
      {label !== undefined && <p className="mb-1 font-medium text-muted">{labelFormat ? labelFormat(label) : label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 font-semibold tabular">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {format ? format(p.value, p.name) : p.value}
        </p>
      ))}
    </div>
  );
}

export function AreaTrend<T extends object>({ data, x, y, height = 240, color = 'var(--accent)', format, xFormat, labelFormat }: { data: T[]; x: keyof T & string; y: keyof T & string; height?: number; color?: string; format?: (v: number) => ReactNode; xFormat?: (v: string) => string; labelFormat?: (l: string | number) => ReactNode }) {
  const id = `g-${y}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey={x as never} {...axis} tickFormatter={xFormat} minTickGap={24} />
        <YAxis {...axis} width={52} />
        <Tooltip content={<TooltipBox format={format} labelFormat={labelFormat} />} cursor={{ stroke: 'var(--line)' }} />
        <Area type="monotone" dataKey={y as never} stroke={color} strokeWidth={2.5} fill={`url(#${id})`} activeDot={{ r: 5, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars<T extends object>({ data, x, y, height = 220, color = 'var(--accent)', format, xFormat, highlightMax }: { data: T[]; x: keyof T & string; y: keyof T & string; height?: number; color?: string; format?: (v: number) => ReactNode; xFormat?: (v: string) => string; highlightMax?: boolean }) {
  const max = Math.max(...data.map((d) => Number(d[y as keyof T]) || 0));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey={x as never} {...axis} tickFormatter={xFormat} interval="preserveStartEnd" />
        <YAxis {...axis} width={44} allowDecimals={false} />
        <Tooltip content={<TooltipBox format={format} labelFormat={xFormat ? (l) => xFormat(String(l)) : undefined} />} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey={y as never} radius={[6, 6, 2, 2]} maxBarSize={36}>
          {data.map((d, i) => (
            <Cell key={i} fill={color} fillOpacity={highlightMax && Number(d[y as keyof T]) !== max ? 0.45 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 200, format, center }: { data: { name: string; value: number; color: string }[]; height?: number; format?: (v: number) => ReactNode; center?: ReactNode }) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none" cornerRadius={4}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<TooltipBox format={(v, n) => <>{n}: {format ? format(v) : v}</>} />} />
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function Legend({ items, format }: { items: { name: string; value: number; color: string }[]; format: (v: number) => ReactNode }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.name} className="text-sm">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: i.color }} />
            <span className="flex-1 truncate text-muted">{i.name}</span>
            <span className="font-medium tabular">{format(i.value)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full" style={{ width: `${(i.value / total) * 100}%`, background: i.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
