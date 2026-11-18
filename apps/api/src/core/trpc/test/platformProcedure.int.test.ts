import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { user } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { addMember, createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import type { Context } from '../context';
import { platformProcedure, router } from '../trpc';

const testRouter = router({
  probe: platformProcedure.query(({ ctx }) => ({
    id: ctx.platformUser.id,
    email: ctx.platformUser.email,
    name: ctx.platformUser.name,
  })),
});

function contextFor(userId: string | null, sessionFlag = true): Context {
  return {
    req: {},
    res: { setHeader: () => undefined },
    session: userId
      ? {
          session: { id: `sess-${userId}`, userId, activeOrganizationId: null },
          user: { id: userId, isPlatformAdmin: sessionFlag, mustChangePassword: false },
        }
      : null,
    tenant: null,
    platformDatabase: testDb,
  } as unknown as Context;
}

const call = (userId: string | null, sessionFlag?: boolean) =>
  testRouter.createCaller(contextFor(userId, sessionFlag)).probe();

async function rejection(promise: Promise<unknown>): Promise<TRPCError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(TRPCError);
  return err as TRPCError;
}

beforeEach(resetDb);
afterAll(resetDb);

describe('platformProcedure', () => {
  it('rejects without a session', async () => {
    expect((await rejection(call(null))).code).toBe('UNAUTHORIZED');
  });

  it('rejects a member who is not a platform admin', async () => {
    const tenant = await createTestTenant('plat-a');
    const owner = await createTestUser();
    const member = await createTestUser();
    await addMember(owner.id, tenant.id, 'superadmin');
    await addMember(member.id, tenant.id);

    for (const u of [owner, member]) {
      const err = await rejection(call(u.id, false));
      expect(err.code).toBe('FORBIDDEN');
      expect(err.cause).toBeUndefined();
    }
  });

  it('rejects when the flag was revoked in the database but the session still says true', async () => {
    const admin = await createTestUser({ isPlatformAdmin: true });
    await testDb.update(user).set({ isPlatformAdmin: false }).where(eq(user.id, admin.id));

    expect((await rejection(call(admin.id, true))).code).toBe('FORBIDDEN');
  });

  it('rejects an admin that must change password', async () => {
    const admin = await createTestUser({ isPlatformAdmin: true });
    await testDb.update(user).set({ mustChangePassword: true }).where(eq(user.id, admin.id));

    const err = await rejection(call(admin.id));
    expect(err.code).toBe('FORBIDDEN');
    expect(err.cause).toBeInstanceOf(AppError);
    expect((err.cause as AppError).code).toBe(ErrorCodes.user.MUST_CHANGE_PASSWORD);
  });

  it('admits a platform admin without any membership', async () => {
    const admin = await createTestUser({ isPlatformAdmin: true, email: 'root@test.local' });

    expect(await call(admin.id, false)).toEqual({
      id: admin.id,
      email: 'root@test.local',
      name: 'root@test.local',
    });
  });
});
