import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_APP_VERSION: z.string(),
  NEXT_PUBLIC_APP_COMMIT: z.string(),
});

export const env = schema.parse({
  NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
  NEXT_PUBLIC_APP_VERSION: process.env['NEXT_PUBLIC_APP_VERSION'],
  NEXT_PUBLIC_APP_COMMIT: process.env['NEXT_PUBLIC_APP_COMMIT'],
});
