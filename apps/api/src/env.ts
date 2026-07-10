import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url(),
  WEB_ORIGIN: z.url(),
  PORT: z.coerce.number().default(8080),
});

export const env = schema.parse(process.env);
