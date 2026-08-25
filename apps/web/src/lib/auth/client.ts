import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';
import { ac, roles } from '@repo/guards';
import { env } from '@/env';

const baseURL =
  process.env.NODE_ENV === 'development' && typeof window !== 'undefined'
    ? window.location.origin
    : env.NEXT_PUBLIC_APP_URL;

export const authClient = createAuthClient({
  baseURL,
  plugins: [adminClient({ ac, roles })],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  updateUser,
  changePassword,
  listSessions,
  revokeSession,
} = authClient;
