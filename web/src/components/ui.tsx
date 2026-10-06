import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import type { Tone } from '@/lib/constants';
import { bs, usd } from '@/lib/format';
import { useBs } from '@/lib/hooks';

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-105 shadow-[0_6px_20px_-8px_var(--accent)]',
  secondary: 'bg-surface-3 text-fg hover:bg-line',
  outline: 'border border-line text-fg hover:bg-surface-2',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 light:text-red-600',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        size === 'icon' && 'h-9 w-9 text-sm',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ---------- Card ---------- */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-2xl border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-accent-ink">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-display font-semibold tracking-tight truncate">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
const tones: Record<Tone, string> = {
  green: 'bg-emerald-500/12 text-emerald-400 ring-emerald-500/25 light:text-emerald-700',
  lime: 'bg-lime-400/12 text-lime-300 ring-lime-400/25 light:text-lime-700',
  amber: 'bg-amber-500/12 text-amber-400 ring-amber-500/25 light:text-amber-700',
  orange: 'bg-orange-500/12 text-orange-400 ring-orange-500/25 light:text-orange-700',
  red: 'bg-red-500/12 text-red-400 ring-red-500/25 light:text-red-600',
  blue: 'bg-sky-500/12 text-sky-400 ring-sky-500/25 light:text-sky-700',
  violet: 'bg-violet-500/12 text-violet-400 ring-violet-500/25 light:text-violet-700',
  gray: 'bg-surface-3 text-muted ring-line',
};

export function Badge({ tone = 'gray', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Form fields ---------- */
export function Field({ label, hint, error, children, className }: { label?: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block space-y-1.5', className)}>
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      {children}
      {error ? <span className="block text-xs text-red-400">{error}</span> : hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }>(function Input(
  { className, icon, ...rest },
  ref,
) {
  if (!icon) return <input ref={ref} className={clsx('field', className)} {...rest} />;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted">{icon}</span>
      <input ref={ref} className={clsx('field pl-9', className)} {...rest} />
    </div>
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('field appearance-none pr-8 bg-[url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2020%2020%27%20fill=%27%238b93a7%27%3E%3Cpath%20d=%27M5.5%207.5l4.5%204.5%204.5-4.5%27/%3E%3C/svg%3E")] bg-[length:18px] bg-[right_8px_center] bg-no-repeat', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('field h-auto min-h-20 py-2', className)} {...rest} />;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3 text-sm">
      <span className={clsx('relative h-6 w-11 rounded-full transition', checked ? 'bg-accent' : 'bg-surface-3')}>
        <span className={clsx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={clsx('inline-flex rounded-xl border border-line bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx('rounded-lg px-3 py-1.5 text-xs font-medium transition whitespace-nowrap', value === o.value ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-3xl sm:rounded-3xl border border-line bg-surface shadow-2xl animate-pop',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-3xl',
          size === 'xl' && 'sm:max-w-5xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Layout helpers ---------- */
export function PageHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <div className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-fg">{icon}</div>}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, accent, trend }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; accent?: boolean; trend?: number | null }) {
  return (
    <Card className={clsx('relative overflow-hidden p-5', accent && 'border-transparent bg-accent text-accent-fg')}>
      <div className="flex items-start justify-between">
        <p className={clsx('text-xs font-medium uppercase tracking-wider', accent ? 'text-accent-fg/70' : 'text-muted')}>{label}</p>
        {icon && <div className={clsx('grid size-8 place-items-center rounded-lg', accent ? 'bg-black/10' : 'bg-surface-3 text-accent-ink')}>{icon}</div>}
      </div>
      <p className="mt-2 font-display text-[28px] font-bold leading-none tracking-tight tabular">{value}</p>
      <div className={clsx('mt-2 flex items-center gap-2 text-xs', accent ? 'text-accent-fg/75' : 'text-muted')}>
        {trend !== undefined && trend !== null && (
          <span className={clsx('font-semibold', trend >= 0 ? (accent ? '' : 'text-emerald-400') : 'text-red-400')}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sub}
      </div>
    </Card>
  );
}

export function EmptyState({ title, description, icon, action }: { title: string; description?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">{icon ?? <Inbox className="size-6" />}</div>
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('size-5 animate-spin text-muted', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-surface-3/70', className)} />;
}

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function Avatar({ name, color, size = 'md' }: { name: string; color?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={clsx(
        'grid shrink-0 place-items-center rounded-full font-display font-semibold text-black/80',
        size === 'sm' && 'size-8 text-xs',
        size === 'md' && 'size-10 text-sm',
        size === 'lg' && 'size-16 text-xl',
      )}
      style={{ background: color ?? 'var(--accent)' }}
    >
      {name}
    </div>
  );
}

/** Muestra un monto en USD con su equivalente en Bs a la tasa actual (o a una tasa histórica). */
export function Money({ value, rate, size = 'md', align = 'left', bsValue }: { value: number; rate?: number; bsValue?: number; size?: 'sm' | 'md' | 'lg' | 'xl'; align?: 'left' | 'right' }) {
  const { toBs } = useBs();
  const ves = bsValue ?? (rate ? value * rate : toBs(value));
  return (
    <div className={clsx('leading-tight tabular', align === 'right' && 'text-right')}>
      <div className={clsx('font-semibold', size === 'sm' && 'text-sm', size === 'lg' && 'text-xl font-display', size === 'xl' && 'text-3xl font-display font-bold')}>{usd(value)}</div>
      <div className={clsx('text-muted', size === 'xl' ? 'text-sm' : 'text-xs')}>{bs(ves)}</div>
    </div>
  );
}

/* ---------- Tables ---------- */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-sm [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted [&_td]:px-4 [&_td]:py-3 [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-surface-2/60">
        {children}
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 tabular">
          {page} / {pages}
        </span>
        <Button variant="ghost" size="icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Siguiente">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
