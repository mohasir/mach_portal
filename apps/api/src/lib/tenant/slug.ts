export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'api',
  'app',
  'www',
  'mail',
  'auth',
  'login',
  'static',
  'assets',
  'cdn',
  'docs',
  'help',
  'support',
  'status',
  'staging',
  'dev',
  'test',
  'root',
  'system',
];

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.includes(slug);
}
