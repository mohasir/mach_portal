import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { env } from '../../env';
import { addMember, createTestTenant, resetDb, testDb } from '../../test/db';
import { account, session, user } from '../../db/schema';
import { auth } from '../auth';

const PASSWORD = 'correct-horse-battery';
const API = 'http://localhost:8080/api/auth';

async function signUp(email: string): Promise<string> {
  const { user: created } = await auth.api.signUpEmail({
    body: { name: email, email, password: PASSWORD },
  });
  return created.id;
}

function signIn(email: string, password: string = PASSWORD) {
  return auth.api.signInEmail({
    body: { email, password },
    headers: new Headers(),
    asResponse: true,
  });
}

async function sessionsOf(userId: string) {
  return testDb.select().from(session).where(eq(session.userId, userId));
}

async function activeOrgsOf(userId: string): Promise<(string | null)[]> {
  return (await sessionsOf(userId)).map((r) => r.activeOrganizationId);
}

describe('login and active organization', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('activates the only organization of a person with one membership', async () => {
    const acme = await createTestTenant('acme');
    const userId = await signUp('m@test.local');
    await addMember(userId, acme.id);
    await testDb.delete(session);

    const res = await signIn('m@test.local');

    expect(res.status).toBe(200);
    await expect(activeOrgsOf(userId)).resolves.toEqual([acme.id]);
  });

  it('rejects a person with no organization with 403 USER_NO_ORGANIZATION and creates no session', async () => {
    const userId = await signUp('lonely@test.local');
    await testDb.delete(session);

    const res = await signIn('lonely@test.local');

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      code: 'USER_NO_ORGANIZATION',
      message: 'User has no organization',
    });
    expect(res.headers.get('set-cookie')).toBeNull();
    await expect(sessionsOf(userId)).resolves.toEqual([]);
  });

  it('does not reveal the missing organization before the password is verified', async () => {
    await signUp('lonely@test.local');
    const res = await signIn('lonely@test.local', 'nope-nope-nope');
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' });
  });

  it('lets a platform admin without memberships in, with no active organization', async () => {
    const userId = await signUp('root@test.local');
    await testDb.update(user).set({ isPlatformAdmin: true }).where(eq(user.id, userId));
    await testDb.delete(session);

    const res = await signIn('root@test.local');

    expect(res.status).toBe(200);
    await expect(activeOrgsOf(userId)).resolves.toEqual([null]);
  });

  it('activates the only organization of a platform admin with one membership', async () => {
    const acme = await createTestTenant('acme');
    const userId = await signUp('root@test.local');
    await testDb.update(user).set({ isPlatformAdmin: true }).where(eq(user.id, userId));
    await addMember(userId, acme.id);
    await testDb.delete(session);

    await signIn('root@test.local');

    await expect(activeOrgsOf(userId)).resolves.toEqual([acme.id]);
  });

  it('leaves no organization active for a person with several memberships', async () => {
    const a = await createTestTenant('a-corp');
    const b = await createTestTenant('b-corp');
    const userId = await signUp('multi@test.local');
    await addMember(userId, a.id);
    await addMember(userId, b.id);
    await testDb.delete(session);

    const res = await signIn('multi@test.local');

    expect(res.status).toBe(200);
    await expect(activeOrgsOf(userId)).resolves.toEqual([null]);
  });

  it("only counts the person's own memberships", async () => {
    const a = await createTestTenant('a-corp');
    const b = await createTestTenant('b-corp');
    const userId = await signUp('m@test.local');
    const otherId = await signUp('o@test.local');
    await addMember(userId, a.id);
    await addMember(otherId, b.id);
    await testDb.delete(session);

    await signIn('m@test.local');

    await expect(activeOrgsOf(userId)).resolves.toEqual([a.id]);
  });

  it('ignores a client-supplied activeOrganizationId in the body', async () => {
    const acme = await createTestTenant('acme');
    const other = await createTestTenant('other');
    const userId = await signUp('m@test.local');
    await addMember(userId, acme.id);
    await testDb.delete(session);

    await auth.api.signInEmail({
      body: { email: 'm@test.local', password: PASSWORD, activeOrganizationId: other.id } as never,
      headers: new Headers(),
    });

    await expect(activeOrgsOf(userId)).resolves.toEqual([acme.id]);
  });

  it('keeps internal calls without a request working (session has no active organization)', async () => {
    const userId = await signUp('internal@test.local');

    await expect(activeOrgsOf(userId)).resolves.toEqual([null]);
    const accounts = await testDb.select().from(account).where(eq(account.userId, userId));
    expect(accounts).toHaveLength(1);
  });

  describe('over HTTP (auth.handler)', () => {
    function httpSignIn(email: string, password: string) {
      return auth.handler(
        new Request(`${API}/sign-in/email`, {
          method: 'POST',
          headers: new Headers({
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
          }),
          body: JSON.stringify({ email, password }),
        }),
      );
    }

    it('signs in a member and sets a host-only cookie', async () => {
      const acme = await createTestTenant('acme');
      const userId = await signUp('m@test.local');
      await addMember(userId, acme.id);
      await testDb.delete(session);

      const res = await httpSignIn('m@test.local', PASSWORD);

      expect(res.status).toBe(200);
      const cookie = res.headers.get('set-cookie') ?? '';
      expect(cookie).toContain('better-auth.session_token=');
      expect(cookie.toLowerCase()).not.toContain('domain=');
      await expect(activeOrgsOf(userId)).resolves.toEqual([acme.id]);
    });

    it('answers 403 USER_NO_ORGANIZATION with no cookie and no session', async () => {
      const userId = await signUp('lonely@test.local');
      await testDb.delete(session);

      const res = await httpSignIn('lonely@test.local', PASSWORD);

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toMatchObject({ code: 'USER_NO_ORGANIZATION' });
      expect(res.headers.get('set-cookie')).toBeNull();
      await expect(sessionsOf(userId)).resolves.toEqual([]);
    });

    // Better Auth skips its origin check when NODE_ENV=test, so the trust list is asserted directly.
    it('trusts exactly the configured web origins', () => {
      expect(auth.options.trustedOrigins).toEqual(env.WEB_ORIGIN);
    });
  });
});
