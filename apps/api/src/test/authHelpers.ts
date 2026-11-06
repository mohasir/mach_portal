import { eq } from 'drizzle-orm';
import { expect } from 'vitest';
import { db } from '../db';
import { session, user } from '../db/schema';
import { auth } from '../lib/auth';

export const TEST_PASSWORD = 'correct-horse-battery';

type UserOpts = { role?: string; isPlatformAdmin?: boolean; mustChangePassword?: boolean };

// Goes through the internal signUpEmail call, so the user has a real credential account; the
// session that call opens is dropped so tests only see sessions from explicit sign-ins.
export async function createUserWithPassword(email: string, opts: UserOpts = {}): Promise<string> {
  const { user: created } = await auth.api.signUpEmail({
    body: { name: email, email, password: TEST_PASSWORD },
  });
  await db.delete(session).where(eq(session.userId, created.id));
  await db
    .update(user)
    .set({
      role: opts.role ?? 'admin',
      isPlatformAdmin: opts.isPlatformAdmin ?? false,
      mustChangePassword: opts.mustChangePassword ?? false,
    })
    .where(eq(user.id, created.id));
  return created.id;
}

// Real sign-in carrying a request context, returning the cookie header to replay later.
export async function signInCookie(email: string): Promise<string> {
  const res = await auth.api.signInEmail({
    body: { email, password: TEST_PASSWORD },
    headers: new Headers(),
    asResponse: true,
  });
  expect(res.status).toBe(200);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

// Signs in and points the session at `orgId`, the same state `tenant.select` leaves behind.
export async function signInWithActiveOrg(
  email: string,
  userId: string,
  orgId: string | null,
): Promise<string> {
  const cookie = await signInCookie(email);
  await db.update(session).set({ activeOrganizationId: orgId }).where(eq(session.userId, userId));
  return cookie;
}
