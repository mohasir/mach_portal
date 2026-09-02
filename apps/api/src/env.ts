import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url(),
  // Comma-separated list so the same API can trust multiple web origins
  // (e.g. localhost for the browser + a LAN IP for testing on mobile).
  WEB_ORIGIN: z
    .string()
    .min(1)
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.url()).min(1)),
  // Canonical web origin used to build password setup/reset links
  WEB_APP_URL: z.url(),
  PORT: z.coerce.number().default(8080),
  STORAGE_PROVIDER: z.enum(['r2']).default('r2'),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.url(),
  PDF_SERVICE_URL: z.url(),
  PDF_SERVICE_API_KEY: z.string().min(1),
});

export const env = schema.parse(process.env);
