const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local (zona del servidor, por defecto America/Caracas) en formato YYYY-MM-DD. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toDateStr(new Date());
}

/** Fecha-hora local `YYYY-MM-DD HH:MM:SS`; ordenable y agrupable con substr() en SQLite. */
export function nowStr(d: Date = new Date()): string {
  return `${toDateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function diffDays(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

export function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}
