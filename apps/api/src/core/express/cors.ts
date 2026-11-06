import cors from 'cors';
import { env } from '../../env';

export function isAllowedOrigin(origin: string): boolean {
  return env.WEB_ORIGIN.includes(origin);
}

export const corsMiddleware = cors({ origin: env.WEB_ORIGIN, credentials: true });
