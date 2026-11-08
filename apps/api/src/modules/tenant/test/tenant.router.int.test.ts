import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContext } from '../../../core/trpc/context';
import { appRouter } from '../../../core/trpc/router';
import { db } from '../../../db';
import { member, platformAccessLog, role, rolePermission, session } from '../../../db/schema';
import { createUserWithPassword, signInCookie } from '../../../test/authHelpers';
import { addMember, createTestTenant, pointMemberAtForeignRole, resetDb } from '../../../test/db';

// Each call rebuilds the context from the cookie, exactly like one HTTP request would.
function api(cookie?: string) {
  const headers = cookie ? { cookie } : {};
  return {
    call: async () =>
      appRouter.createCaller(
        await createContext({
          req: { headers },
          res: { setHeader: () => undefined },
        } as unknown as CreateExpressContextOptions),
      ),
  };
}

async function activeOrgOf(userId: string): Promise<string | null | undefined> {
  const [row] = await db.select().from(session).where(eq(session.userId, userId));
  return row?.activeOrganizationId;
}

describe('tenant router', () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => vi.restoreAllMocks());

  async function twoOrgs() {
    const a = await createTestTenant('a-corp', 'A Corp');
    const b = await createTestTenant('b-corp', 'B Corp');
    return { a, b };
  }

  describe('active', () => {
    it('is UNAUTHORIZED without a session', async () => {
      const t = await api().call();
      await expect(t.tenant.active()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('returns the active organization of a member', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id);
      const t = await api(await signInCookie('m@test.local')).call();
      await expect(t.tenant.active()).resolves.toEqual({
        id: a.id,
        slug: 'a-corp',
        name: 'A Corp',
        isPlatformAccess: false,
      });
    });

    it('is null when no organization is active', async () => {
      const { a, b } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id);
      await addMember(id, b.id);
      const t = await api(await signInCookie('m@test.local')).call();
      await expect(t.tenant.active()).resolves.toBeNull();
    });

    it('is null once the person is no longer a member of the active organization', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id);
      const cookie = await signInCookie('m@test.local');
      await db.delete(member);
      const t = await api(cookie).call();
      await expect(t.tenant.active()).resolves.toBeNull();
    });

    it('flags platform access for a platform admin without membership', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      await addMember(id, a.id);
      const cookie = await signInCookie('root@test.local');
      await db.delete(member);
      const t = await api(cookie).call();
      await expect(t.tenant.active()).resolves.toMatchObject({ isPlatformAccess: true });
    });

    it('does not flag platform access for a platform admin who is also a member', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      await addMember(id, a.id);
      const t = await api(await signInCookie('root@test.local')).call();
      await expect(t.tenant.active()).resolves.toMatchObject({ isPlatformAccess: false });
    });
  });

  describe('permissions', () => {
    async function roleIdOf(tenantId: string, name: string): Promise<string> {
      const [row] = await db
        .select({ id: role.id })
        .from(role)
        .where(and(eq(role.tenantId, tenantId), eq(role.name, name)));
      return row!.id;
    }

    it('is UNAUTHORIZED without a session', async () => {
      const t = await api().call();
      await expect(t.tenant.permissions()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      await expect(t.tenant.permissionsVersion()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it("returns the matrix and version of the membership's role", async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local', { role: 'superadmin' });
      await addMember(id, a.id, 'operator');
      const t = await api(await signInCookie('m@test.local')).call();
      const operator = await roleIdOf(a.id, 'Operator');

      const res = await t.tenant.permissions();

      expect(res.isOwner).toBe(false);
      expect(res.roleName).toBe('Operator');
      expect(res.version).toBe(`${operator}:1`);
      expect(res.grants).toMatchObject({ 'quote.read': 'own', 'client.create': 'all' });
      expect(res.grants['tax_rates.update']).toBeUndefined();
      await expect(t.tenant.permissionsVersion()).resolves.toEqual({ version: `${operator}:1` });
    });

    it('reflects a role edit on the next call', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id, 'operator');
      const cookie = await signInCookie('m@test.local');
      const operator = await roleIdOf(a.id, 'Operator');
      await db
        .delete(rolePermission)
        .where(and(eq(rolePermission.roleId, operator), eq(rolePermission.resource, 'quote')));
      await db.update(role).set({ version: 2 }).where(eq(role.id, operator));

      const res = await (await api(cookie).call()).tenant.permissions();
      expect(res.grants['quote.read']).toBeUndefined();
      expect(res.version).toBe(`${operator}:2`);
    });

    it('returns owner access for a platform admin without membership', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      await addMember(id, a.id);
      const cookie = await signInCookie('root@test.local');
      await db.delete(member);
      const t = await api(cookie).call();
      await expect(t.tenant.permissions()).resolves.toEqual({
        isOwner: true,
        grants: {},
        roleName: null,
        version: 'owner:0',
      });
      await expect(t.tenant.permissionsVersion()).resolves.toEqual({ version: 'owner:0' });
    });

    it('is FORBIDDEN for a member whose role belongs to another organization', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id, 'admin');
      await pointMemberAtForeignRole(id, a.id);
      const t = await api(await signInCookie('m@test.local')).call();
      await expect(t.tenant.permissions()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('memberships', () => {
    it('is UNAUTHORIZED without a session', async () => {
      const t = await api().call();
      await expect(t.tenant.memberships()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it("returns only the caller's own organizations", async () => {
      const { a, b } = await twoOrgs();
      const c = await createTestTenant('c-corp', 'C Corp');
      const me = await createUserWithPassword('me@test.local');
      const other = await createUserWithPassword('other@test.local');
      await addMember(me, a.id);
      await addMember(me, b.id);
      await addMember(other, c.id);
      const t = await api(await signInCookie('me@test.local')).call();
      const res = await t.tenant.memberships();
      expect(res).toHaveLength(2);
      expect(res).toEqual(
        expect.arrayContaining([
          { id: a.id, slug: 'a-corp', name: 'A Corp' },
          { id: b.id, slug: 'b-corp', name: 'B Corp' },
        ]),
      );
    });
  });

  describe('listAll', () => {
    it('is FORBIDDEN for a regular member', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id);
      const t = await api(await signInCookie('m@test.local')).call();
      await expect(t.tenant.listAll()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('is UNAUTHORIZED without a session', async () => {
      const t = await api().call();
      await expect(t.tenant.listAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('lists every organization for a platform admin', async () => {
      const { a, b } = await twoOrgs();
      await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      const t = await api(await signInCookie('root@test.local')).call();
      const res = await t.tenant.listAll();
      expect(res.map((o) => o.id).sort()).toEqual([a.id, b.id].sort());
    });
  });

  describe('select', () => {
    it('is UNAUTHORIZED without a session', async () => {
      const { a } = await twoOrgs();
      const t = await api().call();
      await expect(t.tenant.select({ organizationId: a.id })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('is FORBIDDEN for a foreign organization and leaves the session untouched', async () => {
      const { a, b } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id);
      const t = await api(await signInCookie('m@test.local')).call();
      await expect(t.tenant.select({ organizationId: b.id })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(activeOrgOf(id)).resolves.toBe(a.id);
    });

    it('answers FORBIDDEN, not NOT_FOUND, for an unknown id from a regular member', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id);
      const t = await api(await signInCookie('m@test.local')).call();
      await expect(t.tenant.select({ organizationId: 'ghost' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('switches to an own organization and the next request uses it', async () => {
      const { a, b } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id);
      await addMember(id, b.id);
      const cookie = await signInCookie('m@test.local');
      await expect(activeOrgOf(id)).resolves.toBeNull();

      const first = await api(cookie).call();
      await expect(first.tenant.select({ organizationId: a.id })).resolves.toEqual({
        id: a.id,
        slug: 'a-corp',
        name: 'A Corp',
        isPlatformAccess: false,
      });
      expect((await (await api(cookie).call()).tenant.active())?.id).toBe(a.id);

      await (await api(cookie).call()).tenant.select({ organizationId: b.id });
      expect((await (await api(cookie).call()).tenant.active())?.id).toBe(b.id);
      await expect(activeOrgOf(id)).resolves.toBe(b.id);
    });

    it("only updates the caller's own session row", async () => {
      const { a, b } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      const otherId = await createUserWithPassword('o@test.local');
      await addMember(id, a.id);
      await addMember(id, b.id);
      await addMember(otherId, a.id);
      await addMember(otherId, b.id);
      const mine = await signInCookie('m@test.local');
      await signInCookie('m@test.local');
      await signInCookie('o@test.local');
      const before = await db.select().from(session);

      await (await api(mine).call()).tenant.select({ organizationId: b.id });

      const after = await db.select().from(session);
      const changed = after.filter(
        (row) =>
          row.activeOrganizationId !== before.find((r) => r.id === row.id)!.activeOrganizationId,
      );
      expect(changed).toHaveLength(1);
      expect(changed[0]).toMatchObject({ userId: id, activeOrganizationId: b.id });
    });

    it('ignores any session id smuggled in the input', async () => {
      const { a, b } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      const otherId = await createUserWithPassword('o@test.local');
      await addMember(id, a.id);
      await addMember(id, b.id);
      await addMember(otherId, a.id);
      const mine = await signInCookie('m@test.local');
      await signInCookie('o@test.local');
      const [theirs] = await db.select().from(session).where(eq(session.userId, otherId));

      await (
        await api(mine).call()
      ).tenant.select({
        organizationId: b.id,
        sessionId: theirs!.id,
      } as never);

      await expect(activeOrgOf(otherId)).resolves.toBe(a.id);
    });

    it('lets a platform admin select any organization and audits it', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      const cookie = await signInCookie('root@test.local');

      const res = await (await api(cookie).call()).tenant.select({ organizationId: a.id });

      expect(res).toMatchObject({ id: a.id, isPlatformAccess: true });
      await expect(activeOrgOf(id)).resolves.toBe(a.id);
      const rows = await db.select().from(platformAccessLog);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: id,
        tenantId: a.id,
        type: 'mutation',
        path: 'tenant.select',
      });
    });

    it('does not audit a platform admin selecting an organization they belong to', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      await addMember(id, a.id);
      const cookie = await signInCookie('root@test.local');
      await (await api(cookie).call()).tenant.select({ organizationId: a.id });
      expect(await db.select().from(platformAccessLog)).toHaveLength(0);
    });

    it('is NOT_FOUND for a platform admin selecting an organization that does not exist', async () => {
      const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      const cookie = await signInCookie('root@test.local');
      await expect(
        (await api(cookie).call()).tenant.select({ organizationId: 'ghost' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: 'TENANT_NOT_FOUND' } });
      await expect(activeOrgOf(id)).resolves.toBeNull();
      expect(await db.select().from(platformAccessLog)).toHaveLength(0);
    });

    it('fails closed: a failing audit insert leaves the session unchanged', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      const cookie = await signInCookie('root@test.local');
      const caller = await api(cookie).call();
      vi.spyOn(db, 'insert').mockImplementation((() => {
        throw new Error('audit insert failed');
      }) as typeof db.insert);

      await expect(caller.tenant.select({ organizationId: a.id })).rejects.toThrow();

      await expect(activeOrgOf(id)).resolves.toBeNull();
    });

    it('rejects an empty organizationId', async () => {
      const { a } = await twoOrgs();
      const id = await createUserWithPassword('m@test.local');
      await addMember(id, a.id);
      const t = await api(await signInCookie('m@test.local')).call();
      await expect(t.tenant.select({ organizationId: '' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });
});
