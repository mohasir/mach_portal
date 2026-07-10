import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';
import { ac, roles } from '@repo/guards';
import { env } from '@/env';

export const authClient = createAuthClient({
  // Web origin; better-auth appends /api/auth, which next.config rewrites to the
  // API. Keeps auth same-origin so its cookies are set on the web domain.
  baseURL: env.NEXT_PUBLIC_APP_URL,
  plugins: [adminClient({ ac, roles })],
});

export const { signIn, signUp, signOut, useSession } = authClient;
