import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_APP_VERSION: z.string(),
  NEXT_PUBLIC_APP_COMMIT: z.string(),
  // Set per Netlify site/context (Site settings → Environment variables); defaults to
  // 'local' when absent so a forgotten var stays visible instead of reading as prod.
  NEXT_PUBLIC_APP_ENV: z.string().default('local'),
});

export const env = schema.parse({
  NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
  NEXT_PUBLIC_APP_VERSION: process.env['NEXT_PUBLIC_APP_VERSION'],
  NEXT_PUBLIC_APP_COMMIT: process.env['NEXT_PUBLIC_APP_COMMIT'],
  NEXT_PUBLIC_APP_ENV: process.env['NEXT_PUBLIC_APP_ENV'],
});

export const showEnvBanner = env.NEXT_PUBLIC_APP_ENV !== 'production';
