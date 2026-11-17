import { eq, inArray } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE, quotesListQuerySchema } from '@repo/schemas';
import { db } from '../../../db';
import { quotes } from '../../../db/schema';
import {
  addMember,
  addMemberWithGrants,
  createTestTenant,
  createTestUser,
  resetDb,
} from '../../../test/db';
import { seedEventsTenant, seedQuoteStages, type EventsSeed } from '../../../test/fixtures/events';
import { callerFor } from '../../../test/trpcCaller';

// The seed's quotes belong to `other`; `me` owns quote2 and the free (pending) quote.
async function setup() {
  const tenant = await createTestTenant('tenant-a');
  const other = await createTestUser();
  const me = await createTestUser();
  await addMember(other.id, tenant.id, 'admin');
  await seedQuoteStages();
  const seed = await seedEventsTenant({ ...tenant, userId: other.id }, 'A');
  await db
    .update(quotes)
    .set({ createdById: me.id, assignedToId: me.id })
    .where(inArray(quotes.id, [seed.quote2Id, seed.freeQuoteId]));
  return { tenant, me, seed };
}

const listIds = async (caller: ReturnType<typeof callerFor>) =>
  (await caller.quotes.list(quotesListQuerySchema.parse({}))).items.map((q) => q.id).sort();

const all = (s: EventsSeed) => [s.quoteId, s.quote2Id, s.freeQuoteId].sort();
const mine = (s: EventsSeed) => [s.quote2Id, s.freeQuoteId].sort();

describe('quotes router owner scope', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists every quote for scope all and only own quotes for scope own', async () => {
    const { tenant, me, seed } = await setup();
    const admin = await createTestUser();
    await addMember(admin.id, tenant.id, 'admin');
    await addMember(me.id, tenant.id, 'operator');

    await expect(listIds(callerFor(tenant, admin))).resolves.toEqual(all(seed));
    await expect(listIds(callerFor(tenant, me))).resolves.toEqual(mine(seed));
  });

  it('restricts to own quotes when the role has no quote.read grant', async () => {
    const { tenant, me, seed } = await setup();
    // pipeline.read gates the board, which lists quotes but holds no quote.read scope.
    await addMemberWithGrants(me.id, tenant.id, [[RESOURCES.PIPELINE, ACTIONS.READ, 'all']]);
    const board = await callerFor(tenant, me).quotes.board({});
    const ids = Object.values(board)
      .flat()
      .map((q) => q.id)
      .sort();
    expect(ids).toEqual(mine(seed));
  });

  it('checks the scope of quote.update on update procedures, not the read scope', async () => {
    const { tenant, me, seed } = await setup();
    await addMemberWithGrants(me.id, tenant.id, [
      [RESOURCES.QUOTE, ACTIONS.READ, 'all'],
      [RESOURCES.QUOTE, ACTIONS.UPDATE, 'own'],
    ]);
    const caller = callerFor(tenant, me);

    await expect(listIds(caller)).resolves.toEqual(all(seed));
    await expect(
      caller.quotes.updateStage({ id: seed.quoteId, stageId: QUOTE_STAGE.CANCELLED }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(caller.quotes.cancel({ id: seed.quoteId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(caller.quotes.cancel({ id: seed.freeQuoteId })).resolves.toMatchObject({
      id: seed.freeQuoteId,
    });
    const [other] = await db.select().from(quotes).where(eq(quotes.id, seed.quoteId));
    expect(other!.stageId).not.toBe('cancelled');
  });

  it('never lets an action scope wider than quote.read reach quotes the role cannot read', async () => {
    const { tenant, me, seed } = await setup();
    await addMemberWithGrants(me.id, tenant.id, [
      [RESOURCES.QUOTE, ACTIONS.READ, 'own'],
      [RESOURCES.QUOTE, ACTIONS.UPDATE, 'all'],
      [RESOURCES.QUOTE, ACTIONS.DELETE, 'all'],
    ]);
    const caller = callerFor(tenant, me);

    await expect(
      caller.quotes.updateStage({ id: seed.quoteId, stageId: QUOTE_STAGE.CANCELLED }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(caller.quotes.cancel({ id: seed.quoteId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(caller.quotes.archive({ id: seed.quoteId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(caller.quotes.cancel({ id: seed.freeQuoteId })).resolves.toMatchObject({
      id: seed.freeQuoteId,
    });
    const [other] = await db.select().from(quotes).where(eq(quotes.id, seed.quoteId));
    expect(other!.stageId).not.toBe('cancelled');
    expect(other!.archivedAt ?? null).toBeNull();
  });

  it('checks the scope of quote.delete on archive', async () => {
    const { tenant, me, seed } = await setup();
    await addMemberWithGrants(me.id, tenant.id, [
      [RESOURCES.QUOTE, ACTIONS.READ, 'all'],
      [RESOURCES.QUOTE, ACTIONS.DELETE, 'own'],
    ]);
    const caller = callerFor(tenant, me);
    await expect(caller.quotes.archive({ id: seed.quoteId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(caller.quotes.archive({ id: seed.freeQuoteId })).resolves.toBeDefined();
  });
});
