import cors from 'cors';
import { env } from '../../env';
import { HEADERS } from './const/headers';

export function isAllowedOrigin(origin: string): boolean {
  return env.WEB_ORIGIN.includes(origin);
}

export const corsMiddleware = cors({
  origin: env.WEB_ORIGIN,
  credentials: true,
  exposedHeaders: [HEADERS.PERMISSIONS_VERSION],
});
