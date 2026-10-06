import { db } from '../db.js';
import { nowStr } from './dates.js';
import { getNumberSetting, getSetting } from './settings.js';

export interface RateInfo {
  rate: number;
  source: string;
  rateDate: string | null;
  fetchedAt: string;
  mode: 'auto' | 'manual';
  stale: boolean;
}

interface Provider {
  name: string;
  fetch: () => Promise<{ rate: number; rateDate: string | null }>;
}

async function getJson(url: string, timeoutMs = 8000): Promise<any> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json', 'user-agent': 'IronPulse-Gym/1.0' },
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/** APIs públicas y gratuitas que publican la tasa oficial del BCV, en orden de preferencia. */
const providers: Provider[] = [
  {
    name: 'DolarApi (BCV)',
    async fetch() {
      const j = await getJson('https://ve.dolarapi.com/v1/dolares/oficial');
      return { rate: Number(j.promedio ?? j.venta ?? j.compra), rateDate: j.fechaActualizacion ?? null };
    },
  },
  {
    name: 'PyDolarVe (BCV)',
    async fetch() {
      const j = await getJson('https://pydolarve.org/api/v2/dollar?page=bcv');
      const usd = j?.monitors?.usd ?? j?.monitors?.USD;
      return { rate: Number(usd?.price), rateDate: usd?.last_update ?? null };
    },
  },
];

type RateRow = { rate: number; source: string; rate_date: string | null; fetched_at: string };

function latestStored(): RateRow | undefined {
  return db
    .prepare('SELECT rate, source, rate_date, fetched_at FROM exchange_rates ORDER BY id DESC LIMIT 1')
    .get() as RateRow | undefined;
}

let inflight: Promise<RateRow | null> | null = null;

/** Consulta los proveedores y guarda la tasa. Deduplica llamadas concurrentes. */
export function refreshRate(): Promise<RateRow | null> {
  inflight ??= (async () => {
    const errors: string[] = [];
    for (const p of providers) {
      try {
        const { rate, rateDate } = await p.fetch();
        if (!Number.isFinite(rate) || rate <= 0) throw new Error('tasa inválida');
        const row: RateRow = { rate, source: p.name, rate_date: rateDate, fetched_at: nowStr() };
        const last = latestStored();
        // Solo se agrega al histórico si la tasa cambió; si no, se actualiza la marca de tiempo.
        if (last && last.rate === rate && last.source === p.name) {
          db.prepare('UPDATE exchange_rates SET fetched_at = ?, rate_date = ? WHERE id = (SELECT MAX(id) FROM exchange_rates)')
            .run(row.fetched_at, rateDate);
        } else {
          db.prepare('INSERT INTO exchange_rates(rate, source, rate_date, fetched_at) VALUES (?,?,?,?)')
            .run(rate, p.name, rateDate, row.fetched_at);
        }
        return row;
      } catch (e) {
        errors.push(`${p.name}: ${(e as Error).message}`);
      }
    }
    console.warn('[bcv] No se pudo actualizar la tasa →', errors.join(' | '));
    return null;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

function isStale(fetchedAt: string): boolean {
  const minutes = getNumberSetting('rate_refresh_minutes') || 60;
  const ageMs = Date.now() - new Date(fetchedAt.replace(' ', 'T')).getTime();
  return ageMs > minutes * 60_000;
}

export async function getRate(opts: { force?: boolean } = {}): Promise<RateInfo> {
  if (getSetting('rate_mode') === 'manual') {
    const rate = getNumberSetting('manual_rate');
    if (rate > 0) return { rate, source: 'Manual', rateDate: null, fetchedAt: nowStr(), mode: 'manual', stale: false };
  }

  let row = latestStored();
  if (opts.force || !row || isStale(row.fetched_at)) {
    row = (await refreshRate()) ?? row;
  }
  if (!row) {
    const manual = getNumberSetting('manual_rate');
    if (manual > 0) return { rate: manual, source: 'Manual (respaldo)', rateDate: null, fetchedAt: nowStr(), mode: 'auto', stale: true };
    throw new Error('No hay tasa BCV disponible. Configure una tasa manual.');
  }
  return {
    rate: row.rate,
    source: row.source,
    rateDate: row.rate_date,
    fetchedAt: row.fetched_at,
    mode: 'auto',
    stale: isStale(row.fetched_at),
  };
}

export function rateHistory(limit = 30) {
  return db
    .prepare('SELECT rate, source, rate_date, fetched_at FROM exchange_rates ORDER BY id DESC LIMIT ?')
    .all(limit) as RateRow[];
}

export function startRateScheduler() {
  const tick = () => {
    if (getSetting('rate_mode') === 'auto') refreshRate().catch(() => {});
  };
  tick();
  return setInterval(tick, 30 * 60_000).unref();
}
