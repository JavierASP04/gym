import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.TZ ||= 'America/Caracas';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'cambia-este-secreto-en-produccion',
  jwtExpiresIn: '12h',
  dbPath: process.env.DB_PATH ?? path.resolve(here, '../data/gym.db'),
  webDist: path.resolve(here, '../../web/dist'),
  isProd: process.env.NODE_ENV === 'production',
} as const;

if (config.isProd && config.jwtSecret === 'cambia-este-secreto-en-produccion') {
  console.warn('[seguridad] Define JWT_SECRET en producción.');
}
