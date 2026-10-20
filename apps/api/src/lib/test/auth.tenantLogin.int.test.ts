import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { addMember, createTestTenant, resetDb, testDb } from '../../test/db';
import { session, user } from '../../db/schema';
import { auth } from '../auth';
import { invalidateTenantCache } from '../tenant/tenantResolver';

// Integration env: APP_BASE_DOMAIN = localhost, APP_PROTOCOL = http.
const PASSWORD = 'correct-horse-battery';
const API = 'http://localhost:8080/api/auth';

function tenantHeaders(slug: string | null, extra: Record<string, string> = {}): Headers {
  const headers = new Headers(extra);
  if (slug) {
    headers.set('x-internal-key', 'test-internal-proxy-key');
    headers.set('x-tenant-host', `${slug}.localhost`);
  }
  return headers;
}

async function signUp(email: string): Promise<string> {
  const { user: created } = await auth.api.signUpEmail({
    body: { name: email, email, password: PASSWORD },
  });
  return created.id;
}

function signIn(email: string, password: string, headers: Headers) {
  return auth.api.signInEmail({ body: { email, password }, headers, asResponse: true });
}

async function activeOrgsOf(userId: string): Promise<(string | null)[]> {
  const rows = await testDb.select().from(session).where(eq(session.userId, userId));
  return rows.map((r) => r.activeOrganizationId);
}

describe('tenant-aware login', () => {
  beforeEach(async () => {
    await resetDb();
    // Tenants are recreated with fresh ids on every test.
    invalidateTenantCache();
  });

  it('creates a member session bound to the host tenant', async () => {
    const acme = await createTestTenant('acme');
    const userId = await signUp('m@test.local');
    await addMember(userId, acme.id);
    await testDb.delete(session);

    const res = await signIn('m@test.local', PASSWORD, tenantHeaders('acme'));

    expect(res.status).toBe(200);
    await expect(activeOrgsOf(userId)).resolves.toEqual([acme.id]);
  });

  it('lets a platform admin into any tenant', async () => {
    const acme = await createTestTenant('acme');
    const userId = await signUp('root@test.local');
    await testDb.update(user).set({ isPlatformAdmin: true }).where(eq(user.id, userId));
    await testDb.delete(session);

    const res = await signIn('root@test.local', PASSWORD, tenantHeaders('acme'));

    expect(res.status).toBe(200);
    await expect(activeOrgsOf(userId)).resolves.toEqual([acme.id]);
  });

  it('rejects a non-member with exactly the wrong-password response', async () => {
    const acme = await createTestTenant('acme');
    await createTestTenant('other');
    const memberId = await signUp('m@test.local');
    await addMember(memberId, acme.id);
    const outsiderId = await signUp('out@test.local');
    await testDb.delete(session);

    const wrongPassword = await signIn('out@test.local', 'nope-nope-nope', tenantHeaders('acme'));
    const nonMember = await signIn('out@test.local', PASSWORD, tenantHeaders('acme'));
    const unknownUser = await signIn('ghost@test.local', PASSWORD, tenantHeaders('acme'));

    expect(wrongPassword.status).toBe(401);
    expect(nonMember.status).toBe(wrongPassword.status);
    expect(unknownUser.status).toBe(wrongPassword.status);
    const expected = await wrongPassword.json();
    expect(expected).toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' });
    await expect(nonMember.json()).resolves.toEqual(expected);
    await expect(unknownUser.json()).resolves.toEqual(expected);
    await expect(activeOrgsOf(outsiderId)).resolves.toEqual([]);
  });

  it('is member-only per tenant: a member of A cannot log into B', async () => {
    const a = await createTestTenant('a-corp');
    await createTestTenant('b-corp');
    const userId = await signUp('m@test.local');
    await addMember(userId, a.id);
    await testDb.delete(session);

    const res = await signIn('m@test.local', PASSWORD, tenantHeaders('b-corp'));

    expect(res.status).toBe(401);
    await expect(activeOrgsOf(userId)).resolves.toEqual([]);
  });

  it.each([
    ['no tenant headers', () => tenantHeaders(null)],
    ['unknown tenant', () => tenantHeaders('ghost')],
    ['host without the proxy key', () => new Headers({ 'x-tenant-host': 'acme.localhost' })],
    [
      'host with a wrong proxy key',
      () => new Headers({ 'x-tenant-host': 'acme.localhost', 'x-internal-key': 'x'.repeat(24) }),
    ],
    [
      'host outside the base domain',
      () =>
        new Headers({
          'x-tenant-host': 'acme.evil.com',
          'x-internal-key': 'test-internal-proxy-key',
        }),
    ],
  ])('rejects with the generic error when the tenant is not resolvable: %s', async (_l, build) => {
    const acme = await createTestTenant('acme');
    const userId = await signUp('m@test.local');
    await addMember(userId, acme.id);
    await testDb.delete(session);

    const res = await signIn('m@test.local', PASSWORD, build());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' });
    await expect(activeOrgsOf(userId)).resolves.toEqual([]);
  });

  it('ignores client-supplied activeOrganizationId in the body', async () => {
    const acme = await createTestTenant('acme');
    const other = await createTestTenant('other');
    const userId = await signUp('m@test.local');
    await addMember(userId, acme.id);
    await testDb.delete(session);

    await auth.api.signInEmail({
      body: { email: 'm@test.local', password: PASSWORD, activeOrganizationId: other.id } as never,
      headers: tenantHeaders('acme'),
    });

    await expect(activeOrgsOf(userId)).resolves.toEqual([acme.id]);
  });

  it('keeps internal calls without a request working (session has no active tenant)', async () => {
    const userId = await signUp('internal@test.local');

    await expect(activeOrgsOf(userId)).resolves.toEqual([null]);
  });

  describe('over HTTP (auth.handler)', () => {
    function httpSignIn(email: string, password: string, origin: string, slug: string | null) {
      const headers = tenantHeaders(slug, { 'content-type': 'application/json', origin });
      return auth.handler(
        new Request(`${API}/sign-in/email`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ email, password }),
        }),
      );
    }

    it('signs in a member from their tenant origin and sets a host-only cookie', async () => {
      const acme = await createTestTenant('acme');
      const userId = await signUp('m@test.local');
      await addMember(userId, acme.id);
      await testDb.delete(session);

      const res = await httpSignIn('m@test.local', PASSWORD, 'http://acme.localhost', 'acme');

      expect(res.status).toBe(200);
      const cookie = res.headers.get('set-cookie') ?? '';
      expect(cookie).toContain('better-auth.session_token=');
      expect(cookie.toLowerCase()).not.toContain('domain=');
      await expect(activeOrgsOf(userId)).resolves.toEqual([acme.id]);
    });

    it('answers the same body for a non-member and a wrong password', async () => {
      const acme = await createTestTenant('acme');
      const memberId = await signUp('m@test.local');
      await addMember(memberId, acme.id);
      await signUp('out@test.local');

      const wrong = await httpSignIn(
        'out@test.local',
        'bad-bad-bad-bad',
        'http://acme.localhost',
        'acme',
      );
      const outsider = await httpSignIn(
        'out@test.local',
        PASSWORD,
        'http://acme.localhost',
        'acme',
      );

      expect(outsider.status).toBe(wrong.status);
      await expect(outsider.json()).resolves.toEqual(await wrong.json());
      expect(outsider.headers.get('set-cookie')).toBeNull();
    });

    // Better Auth skips its origin check when NODE_ENV=test, so the trust list is asserted directly.
    it('trusts only the request origin when it is an existing tenant', async () => {
      await createTestTenant('acme');
      const trusted = async (origin: string | null) => {
        const headers = new Headers(origin ? { origin } : {});
        const resolve = auth.options.trustedOrigins as (r?: Request) => Promise<string[]>;
        return resolve(new Request(`${API}/sign-out`, { method: 'POST', headers }));
      };

      await expect(trusted('http://acme.localhost')).resolves.toEqual(['http://acme.localhost']);
      await expect(trusted('http://evil.com')).resolves.toEqual([]);
      await expect(trusted('http://ghost.localhost')).resolves.toEqual([]);
      await expect(trusted('http://acme.localhost.evil.com')).resolves.toEqual([]);
      await expect(trusted(null)).resolves.toEqual([]);
      const resolve = auth.options.trustedOrigins as (r?: Request) => Promise<string[]>;
      await expect(resolve(undefined)).resolves.toEqual([]);
    });
  });
});
