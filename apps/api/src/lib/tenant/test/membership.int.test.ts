import { beforeEach, describe, expect, it } from 'vitest';
import { addMember, createTestTenant, createTestUser, resetDb } from '../../../test/db';
import { isMemberOf } from '../membership';

describe('isMemberOf', () => {
  beforeEach(resetDb);

  it('is true only for the tenant the user belongs to', async () => {
    const a = await createTestTenant('a');
    const b = await createTestTenant('b');
    const u = await createTestUser();
    await addMember(u.id, a.id);
    await expect(isMemberOf(u.id, a.id)).resolves.toBe(true);
    await expect(isMemberOf(u.id, b.id)).resolves.toBe(false);
  });

  it('is false for another user of the same tenant', async () => {
    const a = await createTestTenant('a');
    const u = await createTestUser();
    const other = await createTestUser();
    await addMember(u.id, a.id);
    await expect(isMemberOf(other.id, a.id)).resolves.toBe(false);
  });
});
