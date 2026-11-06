import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { addMember, createTestTenant, resetDb, testDb } from '../../test/db';
import { member, organization, user } from '../../db/schema';
import { auth } from '../auth';

const PASSWORD = 'correct-horse-battery';
const API = 'http://localhost:8080/api/auth';

async function signUpInternal(email: string, role?: string): Promise<string> {
  const { user: created } = await auth.api.signUpEmail({
    body: { name: email, email, password: PASSWORD },
  });
  if (role) await testDb.update(user).set({ role }).where(eq(user.id, created.id));
  return created.id;
}

function http(path: string, init: { method?: string; cookie?: string; body?: unknown } = {}) {
  const headers = new Headers({ origin: 'http://localhost:3000' });
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  return auth.handler(
    new Request(`${API}${path}`, {
      method: init.method ?? 'POST',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

async function loginCookie(email: string): Promise<string> {
  const res = await http('/sign-in/email', { body: { email, password: PASSWORD } });
  expect(res.status).toBe(200);
  return (res.headers.getSetCookie() ?? []).map((c) => c.split(';')[0]).join('; ');
}

describe('HTTP surface of Better Auth plugins', () => {
  let cookies: Record<string, string>;

  beforeEach(async () => {
    await resetDb();
    const acme = await createTestTenant('acme');
    const memberId = await signUpInternal('member@test.local');
    const adminId = await signUpInternal('admin@test.local', 'superadmin');
    await addMember(memberId, acme.id);
    await addMember(adminId, acme.id);
    cookies = {
      member: await loginCookie('member@test.local'),
      admin: await loginCookie('admin@test.local'),
    };
  });

  const blocked: [string, string, unknown][] = [
    ['POST', '/organization/create', { name: 'Evil', slug: 'evil' }],
    ['POST', '/organization/set-active', { organizationSlug: 'acme' }],
    ['POST', '/organization/update', { data: { slug: 'renamed' } }],
    ['POST', '/organization/delete', { organizationId: 'x' }],
    ['GET', '/organization/list', undefined],
    ['GET', '/admin/list-users', undefined],
    ['POST', '/admin/create-user', { email: 'x@test.local', password: PASSWORD, name: 'x' }],
    ['POST', '/admin/set-role', { userId: 'x', role: 'superadmin' }],
    ['POST', '/sign-up/email', { name: 'Squat', email: 'squat@test.local', password: PASSWORD }],
  ];

  describe.each(['member', 'admin'] as const)('as an authenticated %s', (who) => {
    it.each(blocked)('refuses %s %s with a fixed not-found body', async (method, path, body) => {
      const res = await http(path, { method, cookie: cookies[who], body });

      expect(res.status).toBe(404);
      const text = await res.text();
      expect(text).not.toContain(path);
      expect(JSON.parse(text)).toEqual({ code: 'NOT_FOUND', message: 'Not found' });
    });

    it('created no organization or user', async () => {
      for (const [method, path, body] of blocked) {
        await http(path, { method, cookie: cookies[who], body });
      }

      const orgs = await testDb.select().from(organization);
      expect(orgs.map((o) => o.slug)).toEqual(['acme']);
      const users = await testDb.select({ email: user.email }).from(user);
      expect(users.map((u) => u.email).sort()).toEqual(['admin@test.local', 'member@test.local']);
      await expect(testDb.select().from(member)).resolves.toHaveLength(2);
    });
  });

  it('refuses unauthenticated sign-up too', async () => {
    const res = await http('/sign-up/email', {
      body: { name: 'a', email: 'anon@test.local', password: PASSWORD },
    });
    expect(res.status).toBe(404);
  });

  it('refuses paths regardless of trailing slash or case tricks', async () => {
    for (const path of ['/organization/create/', '/Organization/create', '/admin/list-users/']) {
      const res = await http(path, { method: 'POST', cookie: cookies['member'], body: {} });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
    await expect(testDb.select().from(organization)).resolves.toHaveLength(1);
  });

  it('refuses a self-service avatar URL but still lets a user rename themselves', async () => {
    const cookie = cookies['member'];
    const bad = await http('/update-user', { cookie, body: { image: 'javascript:alert(1)' } });
    expect(bad.status).toBe(400);
    const ok = await http('/update-user', { cookie, body: { name: 'Renamed' } });
    expect(ok.status).toBe(200);
    const [row] = await testDb
      .select({ name: user.name, image: user.image })
      .from(user)
      .where(eq(user.email, 'member@test.local'));
    expect(row).toEqual({ name: 'Renamed', image: null });
  });

  it('still creates users through the internal signUpEmail call', async () => {
    const id = await signUpInternal('created@test.local');
    const [row] = await testDb.select().from(user).where(eq(user.id, id));
    expect(row?.email).toBe('created@test.local');
  });

  it('keeps sign-in, get-session and sign-out working over HTTP', async () => {
    const cookie = await loginCookie('member@test.local');

    const session = await http('/get-session', { method: 'GET', cookie });
    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({
      user: { email: 'member@test.local' },
    });

    const out = await http('/sign-out', { cookie, body: {} });
    expect(out.status).toBe(200);
  });

  it('keeps self-service endpoints reachable (not blocked as not-found)', async () => {
    for (const [method, path, body] of [
      ['POST', '/update-user', { name: 'New Name' }],
      ['GET', '/list-sessions', undefined],
    ] as const) {
      const res = await http(path, { method, cookie: cookies['member'], body });
      expect(res.status).toBe(200);
    }
  });
});
