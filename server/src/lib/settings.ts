import { db, DEFAULT_SETTINGS } from '../db.js';

export type Settings = typeof DEFAULT_SETTINGS;

export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out as Settings;
}

export function getSetting(key: keyof Settings): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? DEFAULT_SETTINGS[key];
}

export const getNumberSetting = (key: keyof Settings) => Number(getSetting(key)) || 0;

export function saveSettings(values: Partial<Record<string, string>>) {
  const stmt = db.prepare(
    'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  db.transaction(() => {
    for (const [k, v] of Object.entries(values)) {
      if (k in DEFAULT_SETTINGS && v !== undefined) stmt.run(k, String(v));
    }
  })();
}
