import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { member } from '../../../db/schema';
import { addMember, createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import { TenancyRepository } from '../tenancy.repository';

describe('TenancyRepository', () => {
  const repo = new TenancyRepository();

  beforeEach(resetDb);

  describe('isMemberOf', () => {
    it('is true only for the tenant the user belongs to', async () => {
      const a = await createTestTenant('a');
      const b = await createTestTenant('b');
      const u = await createTestUser();
      await addMember(u.id, a.id);
      await expect(repo.isMemberOf(u.id, a.id)).resolves.toBe(true);
      await expect(repo.isMemberOf(u.id, b.id)).resolves.toBe(false);
    });

    it('is false for another user of the same tenant', async () => {
      const a = await createTestTenant('a');
      const u = await createTestUser();
      const other = await createTestUser();
      await addMember(u.id, a.id);
      await expect(repo.isMemberOf(other.id, a.id)).resolves.toBe(false);
    });
  });

  describe('findBySlug', () => {
    it('finds an organization regardless of the slug casing', async () => {
      const t = await createTestTenant('acme');
      await expect(repo.findBySlug(' ACME ')).resolves.toEqual({ id: t.id, slug: 'acme' });
    });

    it('returns undefined for an unknown slug', async () => {
      await expect(repo.findBySlug('ghost')).resolves.toBeUndefined();
    });
  });

  describe('findById', () => {
    it('returns the organization with its name', async () => {
      const t = await createTestTenant('acme', 'Acme Inc');
      await expect(repo.findById(t.id)).resolves.toEqual({
        id: t.id,
        slug: 'acme',
        name: 'Acme Inc',
      });
    });

    it('returns undefined for an unknown id', async () => {
      await expect(repo.findById('ghost')).resolves.toBeUndefined();
    });
  });

  describe('findMemberOrganizationIds', () => {
    it('lists the user organizations up to the limit', async () => {
      const a = await createTestTenant('a');
      const b = await createTestTenant('b');
      const u = await createTestUser();
      await addMember(u.id, a.id);
      await addMember(u.id, b.id);
      await expect(repo.findMemberOrganizationIds(u.id, 5)).resolves.toHaveLength(2);
      await expect(repo.findMemberOrganizationIds(u.id, 1)).resolves.toHaveLength(1);
    });

    it('is empty for a user without memberships', async () => {
      const u = await createTestUser();
      await expect(repo.findMemberOrganizationIds(u.id, 2)).resolves.toEqual([]);
    });
  });

  describe('isPlatformAdmin', () => {
    it('reflects the account flag', async () => {
      const admin = await createTestUser({ isPlatformAdmin: true });
      const regular = await createTestUser();
      await expect(repo.isPlatformAdmin(admin.id)).resolves.toBe(true);
      await expect(repo.isPlatformAdmin(regular.id)).resolves.toBe(false);
      await expect(repo.isPlatformAdmin('ghost')).resolves.toBe(false);
    });
  });

  it('sees uncommitted writes only when bound to the caller transaction', async () => {
    const u = await createTestUser();
    const a = await createTestTenant('a');
    await testDb
      .transaction(async (tx) => {
        await tx.insert(member).values({
          id: randomUUID(),
          userId: u.id,
          organizationId: a.id,
          role: 'member',
          createdAt: new Date(),
        });
        await expect(new TenancyRepository(tx).isMemberOf(u.id, a.id)).resolves.toBe(true);
        await expect(repo.isMemberOf(u.id, a.id)).resolves.toBe(false);
        throw new Error('rollback');
      })
      .catch(() => undefined);
    await expect(repo.isMemberOf(u.id, a.id)).resolves.toBe(false);
  });
});
