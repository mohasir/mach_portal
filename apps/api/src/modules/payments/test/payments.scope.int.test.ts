import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { paginationOf, paymentsIncomeQuerySchema, paymentsListQuerySchema } from '@repo/schemas';
import { db } from '../../../db';
import { quotes } from '../../../db/schema';
import {
  addMember,
  addMemberWithGrants,
  createTestTenant,
  createTestUser,
  resetDb,
} from '../../../test/db';
import { insertPayment, seedEventsTenant, seedQuoteStages } from '../../../test/fixtures/events';
import { callerFor } from '../../../test/trpcCaller';

// Tenant A: the seed payment (300) is on `other`'s event; `me` owns event2, which gets a 500
// payment. Tenant B's quotes all belong to `me`, so only tenant isolation keeps them out of A.
async function setup() {
  const tenant = await createTestTenant('tenant-a');
  const tenantB = await createTestTenant('tenant-b');
  const other = await createTestUser();
  const me = await createTestUser();
  await addMember(other.id, tenant.id, 'admin');
  await seedQuoteStages();
  const seed = await seedEventsTenant({ ...tenant, userId: other.id }, 'A');
  await db
    .update(quotes)
    .set({ createdById: me.id, assignedToId: me.id })
    .where(eq(quotes.id, seed.quote2Id));
  const ownPaymentId = await insertPayment(tenant.id, seed.event2Id, 500);
  await seedEventsTenant({ ...tenantB, userId: me.id }, 'B');
  return { tenant, me, seed, ownPaymentId };
}

const listIds = async (caller: ReturnType<typeof callerFor>) =>
  (await caller.payments.list(paymentsListQuerySchema.parse({ page: 1, pageSize: 50 }))).items
    .map((p) => p.id)
    .sort();

const incomeTotal = async (caller: ReturnType<typeof callerFor>) =>
  (await caller.payments.income(paymentsIncomeQuerySchema.parse({ groupBy: 'year' }))).totalAmount;

describe('payments router owner scope', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('payment.read all lists and sums every tenant payment', async () => {
    const { tenant, me, seed, ownPaymentId } = await setup();
    await addMemberWithGrants(me.id, tenant.id, [[RESOURCES.PAYMENT, ACTIONS.READ, 'all']]);
    const caller = callerFor(tenant, me);

    await expect(listIds(caller)).resolves.toEqual([seed.paymentId, ownPaymentId].sort());
    await expect(incomeTotal(caller)).resolves.toBe(800);
  });

  it('payment.read own lists and sums only payments of own events', async () => {
    const { tenant, me, ownPaymentId } = await setup();
    await addMemberWithGrants(me.id, tenant.id, [[RESOURCES.PAYMENT, ACTIONS.READ, 'own']]);
    const caller = callerFor(tenant, me);

    await expect(listIds(caller)).resolves.toEqual([ownPaymentId]);
    await expect(incomeTotal(caller)).resolves.toBe(500);
  });

  it('the list count follows the same filter', async () => {
    const { tenant, me } = await setup();
    await addMemberWithGrants(me.id, tenant.id, [[RESOURCES.PAYMENT, ACTIONS.READ, 'own']]);
    const res = await callerFor(tenant, me).payments.list(
      paymentsListQuerySchema.parse({ page: 1, pageSize: 1 }),
    );
    expect(paginationOf(res)?.total).toBe(1);
  });
});
