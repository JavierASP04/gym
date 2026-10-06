const usdFmt = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const bsFmt = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rateFmt = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const intFmt = new Intl.NumberFormat('es-VE');

export const usd = (n: number | null | undefined) => usdFmt.format(n ?? 0).replace('US$', '$');
export const bs = (n: number | null | undefined) => `Bs ${bsFmt.format(n ?? 0)}`;
export const rateStr = (n: number | null | undefined) => rateFmt.format(n ?? 0);
export const int = (n: number | null | undefined) => intFmt.format(n ?? 0);
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());
export const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
};

function parseLocal(s: string) {
  const [date, time = '00:00:00'] = s.split(/[ T]/);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

export const date = (s?: string | null) =>
  s ? parseLocal(s).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const shortDate = (s?: string | null) =>
  s ? parseLocal(s).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) : '—';
export const time = (s?: string | null) =>
  s ? parseLocal(s).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
export const dateTime = (s?: string | null) => (s ? `${shortDate(s)} · ${time(s)}` : '—');

export function relativeDays(days: number) {
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === -1) return 'ayer';
  return days > 0 ? `en ${days} días` : `hace ${-days} días`;
}

export function age(birth?: string | null) {
  if (!birth) return null;
  const b = parseLocal(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export const initials = (first = '', last = '') => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
export const fullName = (p: { first_name?: string | null; last_name?: string | null }) =>
  [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Cliente general';

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}

export const whatsappLink = (phone: string | null | undefined, text: string) => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '58' + digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};
