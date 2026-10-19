import { env } from '../../env';

export function tenantUrl(slug: string, path = '/'): string {
  return `${env.APP_PROTOCOL}://${slug}.${env.APP_BASE_DOMAIN}${path}`;
}
