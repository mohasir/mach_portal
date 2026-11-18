import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { platformAuditLog } from '../../../db/schema';
import { createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import { recordOrganizationView, recordPlatformAudit } from '../platformAudit';

let userId: string;
let tenantA: string;
let tenantB: string;

beforeEach(async () => {
  await resetDb();
  userId = (await createTestUser({ isPlatformAdmin: true })).id;
  tenantA = (await createTestTenant('audit-a', undefined, { features: [] })).id;
  tenantB = (await createTestTenant('audit-b', undefined, { features: [] })).id;
});
afterAll(resetDb);

const rows = () => testDb.select().from(platformAuditLog);

describe('recordPlatformAudit', () => {
  it('writes the row in the caller transaction and rolls back with it', async () => {
    await testDb.transaction(async (tx) => {
      await recordPlatformAudit(tx, {
        userId,
        action: 'feature.set',
        tenantId: tenantA,
        payload: { feature: 'x' },
      });
      expect(await tx.select().from(platformAuditLog)).toHaveLength(1);
    });
    const [row] = await rows();
    expect(row).toMatchObject({
      userId,
      action: 'feature.set',
      tenantId: tenantA,
      payload: { feature: 'x' },
    });

    await expect(
      testDb.transaction(async (tx) => {
        await recordPlatformAudit(tx, { userId, action: 'organization.create' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await rows()).toHaveLength(1);
    expect(
      await testDb.select().from(platformAuditLog).where(eq(platformAuditLog.tenantId, tenantA)),
    ).toHaveLength(1);
  });
});

describe('recordOrganizationView', () => {
  it('records an organization view once per session and tenant', async () => {
    const entry = { userId, sessionId: 's1', tenantId: tenantA };
    await Promise.all([
      recordOrganizationView(entry, testDb),
      recordOrganizationView(entry, testDb),
    ]);
    await recordOrganizationView(entry, testDb);

    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ action: 'organization.view', tenantId: tenantA, userId });
  });

  it('records again for another session or tenant', async () => {
    await recordOrganizationView({ userId, sessionId: 's1', tenantId: tenantA }, testDb);
    await recordOrganizationView({ userId, sessionId: 's2', tenantId: tenantA }, testDb);
    await recordOrganizationView({ userId, sessionId: 's1', tenantId: tenantB }, testDb);

    expect(await rows()).toHaveLength(3);
  });
});
