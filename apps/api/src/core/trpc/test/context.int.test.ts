import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db';
import { member, organization, session } from '../../../db/schema';
import { invalidateTenantCache } from '../../../lib/tenancy/tenantResolver';
import { createUserWithPassword, signInCookie } from '../../../test/authHelpers';
import { addMember, createTestTenant, resetDb } from '../../../test/db';
import { createContext } from '../context';

function contextFor(cookie?: string) {
  const headers = cookie ? { cookie } : {};
  return createContext({ req: { headers }, res: {} } as unknown as CreateExpressContextOptions);
}

describe('createContext', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('has no session and no tenant without a cookie', async () => {
    const ctx = await contextFor();
    expect(ctx.session).toBeNull();
    expect(ctx.tenant).toBeNull();
  });

  it('takes the tenant from the active organization of the session', async () => {
    const acme = await createTestTenant('acme', 'Acme Inc');
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, acme.id);
    const ctx = await contextFor(await signInCookie('m@test.local'));
    expect(ctx.tenant).toEqual({ id: acme.id, slug: 'acme', name: 'Acme Inc' });
  });

  it('has a session but no tenant when no organization is active', async () => {
    const a = await createTestTenant('a-corp');
    const b = await createTestTenant('b-corp');
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, a.id);
    await addMember(id, b.id);
    const ctx = await contextFor(await signInCookie('m@test.local'));
    expect(ctx.session?.user.id).toBe(id);
    expect(ctx.tenant).toBeNull();
  });

  it('has no tenant when the active organization no longer exists', async () => {
    const acme = await createTestTenant('acme');
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, acme.id);
    const cookie = await signInCookie('m@test.local');
    await db.delete(member);
    await db.delete(organization).where(eq(organization.id, acme.id));
    invalidateTenantCache();
    const ctx = await contextFor(cookie);
    expect(ctx.session).not.toBeNull();
    expect(ctx.tenant).toBeNull();
  });

  it('reflects a changed active organization on the very next request', async () => {
    const a = await createTestTenant('a-corp');
    const b = await createTestTenant('b-corp');
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, a.id);
    const cookie = await signInCookie('m@test.local');
    expect((await contextFor(cookie)).tenant?.id).toBe(a.id);

    await db.update(session).set({ activeOrganizationId: b.id }).where(eq(session.userId, id));
    expect((await contextFor(cookie)).tenant?.id).toBe(b.id);
  });
});
