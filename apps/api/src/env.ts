import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url(),
  WEB_ORIGIN: z.url(),
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
