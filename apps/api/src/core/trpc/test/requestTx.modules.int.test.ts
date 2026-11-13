import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clientsListQuerySchema,
  eventsListQuerySchema,
  quotesListQuerySchema,
} from '@repo/schemas';
import { db, withTenantTx, type Database } from '../../../db';
import * as schema from '../../../db/schema';
import { member, platformAccessLog, user } from '../../../db/schema';
import { env } from '../../../env';
import { auth } from '../../../lib/auth';
import { seedTenantRoles } from '../../../lib/rbac/seedTenantRoles';
import { clientsModule } from '../../../modules/clients/clients.module';
import { quotesModule } from '../../../modules/quotes/quotes.module';
import { UsersRepository } from '../../../modules/users/users.repository';
import { TEST_PASSWORD } from '../../../test/authHelpers';
import { addMember, createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import { seedEventsTenant, seedQuoteStages, type EventsSeed } from '../../../test/fixtures/events';
import { TEST_APP_ROLE, testAppDatabaseUrl } from '../../../test/roles';
import { callerFor } from '../../../test/trpcCaller';
import type { TenantCtx } from '../tenantCtx';

// Fewer connections than concurrent calls: a call that needed a second connection while holding
// its request transaction would leave every connection waiting and never finish.
const APP_POOL_MAX = 3;
const CONCURRENT_CALLS = 8;

type Seeded = { tenant: { id: string; slug: string; userId: string }; seed: EventsSeed };

let appClient: ReturnType<typeof postgres>;
let appDb: Database;

beforeAll(async () => {
  appClient = postgres(testAppDatabaseUrl(), { max: APP_POOL_MAX });
  appDb = drizzle(appClient, { schema }) as unknown as Database;
  const [row] = await appDb.execute<{ who: string }>(sql`select current_user as who`);
  expect(row?.who).toBe(TEST_APP_ROLE);
});

afterAll(async () => {
  await appClient?.end();
});

function withinMs<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not finish within ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Every method that would take a connection from the global pool.
function spyGlobalPool() {
  return (['select', 'insert', 'update', 'delete', 'execute', 'transaction'] as const).map(
    (method) => vi.spyOn(db, method),
  );
}

async function seedTenant(slug: string, label: string): Promise<Seeded> {
  const created = await createTestTenant(slug);
  const owner = await createTestUser();
  await addMember(owner.id, created.id, 'superadmin');
  const tenant = { ...created, userId: owner.id };
  return { tenant, seed: await seedEventsTenant(tenant, label) };
}

describe('modules on the request transaction (app role)', () => {
  let a: Seeded;
  let b: Seeded;

  beforeEach(async () => {
    await resetDb();
    await seedQuoteStages();
    a = await seedTenant('tenant-a', 'A');
    b = await seedTenant('tenant-b', 'B');
  });
  afterEach(() => vi.restoreAllMocks());

  it('clients.list and quotes.list return only the session tenant and never touch the global pool', async () => {
    const spies = spyGlobalPool();
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);

    const clients = await caller.clients.list(clientsListQuerySchema.parse({}));
    const quotes = await caller.quotes.list(quotesListQuerySchema.parse({}));

    expect(clients.items.map((c) => c.id)).toEqual([a.seed.clientId]);
    expect(quotes.items.map((q) => q.id).sort()).toEqual(
      [a.seed.quoteId, a.seed.quote2Id, a.seed.freeQuoteId].sort(),
    );
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('a module reads through ctx.db: with the RLS tenant set to A, a repository filtering on B sees nothing', async () => {
    // The superuser pool proves B has rows to find.
    const asSuperuser = { tenantId: b.tenant.id, db: testDb } as unknown as TenantCtx;
    expect(
      (await clientsModule(asSuperuser).list(clientsListQuerySchema.parse({}))).items,
    ).toHaveLength(1);

    await withTenantTx(
      a.tenant.id,
      async (tx) => {
        const ctx = { tenantId: b.tenant.id, db: tx } as unknown as TenantCtx;
        expect((await clientsModule(ctx).list(clientsListQuerySchema.parse({}))).items).toEqual([]);
        expect((await quotesModule(ctx).list(quotesListQuerySchema.parse({}))).items).toEqual([]);
      },
      appDb,
    );
  });

  it(`${CONCURRENT_CALLS} concurrent calls on a pool of ${APP_POOL_MAX} connections all finish`, async () => {
    const spies = spyGlobalPool();
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);
    const calls = Array.from({ length: CONCURRENT_CALLS }, (_, i) => {
      switch (i % 3) {
        case 0:
          return caller.clients.list(clientsListQuerySchema.parse({})).then((r) => r.items.length);
        case 1:
          return caller.quotes.list(quotesListQuerySchema.parse({})).then((r) => r.items.length);
        default:
          return caller.events.list(eventsListQuerySchema.parse({})).then((r) => r.items.length);
      }
    });

    const counts = await withinMs(Promise.all(calls), 15_000, 'the concurrent calls');
    expect(counts).toHaveLength(CONCURRENT_CALLS);
    expect(counts.every((n) => n > 0)).toBe(true);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('users.create that fails after sign-up leaves no account behind, although the request rolls back', async () => {
    const roles = await seedTenantRoles(a.tenant.id, testDb);
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);
    const email = 'rollback@test.local';
    vi.spyOn(UsersRepository.prototype, 'addMembership').mockRejectedValueOnce(new Error('boom'));

    await expect(caller.users.create({ name: 'R', email, roleId: roles.member })).rejects.toThrow(
      'boom',
    );
    expect(await testDb.select().from(user).where(eq(user.email, email))).toEqual([]);

    const retry = await caller.users.create({ name: 'R', email, roleId: roles.member });
    expect(retry.setupUrl).not.toBeNull();
  });

  // Under RLS the request only sees this tenant's audit rows, so the account delete can still hit
  // the audit FK for rows written in another tenant.
  it('users.delete keeps the account of a user audited in another tenant and still removes the membership', async () => {
    const target = await createTestUser();
    await addMember(target.id, a.tenant.id, 'member');
    await testDb.insert(platformAccessLog).values({
      userId: target.id,
      tenantId: b.tenant.id,
      path: 'clients.list',
      type: 'query',
    });
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);

    await expect(caller.users.delete({ id: target.id })).resolves.toEqual({ id: target.id });

    expect(await testDb.select().from(member).where(eq(member.userId, target.id))).toEqual([]);
    expect(await testDb.select({ id: user.id }).from(user).where(eq(user.id, target.id))).toEqual([
      { id: target.id },
    ]);
  });

  it('users.delete still deletes the account of a user with no organization and no audit rows', async () => {
    const target = await createTestUser();
    await addMember(target.id, a.tenant.id, 'member');
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);

    await expect(caller.users.delete({ id: target.id })).resolves.toEqual({ id: target.id });

    expect(await testDb.select().from(user).where(eq(user.id, target.id))).toEqual([]);
  });
});

describe('Better Auth pool', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('signs up and signs in while every connection of the request pool is held by a transaction', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let started = 0;
    let allStarted!: () => void;
    const allHeld = new Promise<void>((resolve) => (allStarted = resolve));
    const held = Array.from({ length: env.DB_POOL_MAX }, () =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select 1`);
        if (++started === env.DB_POOL_MAX) allStarted();
        await gate;
      }),
    );

    try {
      await withinMs(allHeld, 10_000, 'holding the request pool');
      const email = 'pool@test.local';
      await withinMs(
        auth.api.signUpEmail({ body: { name: email, email, password: TEST_PASSWORD } }),
        10_000,
        'sign-up',
      );
      const signIn = await withinMs(
        auth.api.signInEmail({
          body: { email, password: TEST_PASSWORD },
          headers: new Headers(),
          asResponse: true,
        }),
        10_000,
        'sign-in',
      );
      // A user without organization is refused after the password check, which needs the pool.
      expect([200, 403]).toContain(signIn.status);
    } finally {
      release();
      await Promise.all(held);
    }
  });
});
