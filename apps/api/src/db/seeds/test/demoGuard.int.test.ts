import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { member, organization, user } from '../../schema';
import { createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import { assertDemoAllowed } from '../demoGuard';
import { runSeed } from '../run';

describe('assertDemoAllowed', () => {
  it('refuses --demo=local when NODE_ENV is production, even with --tenant', () => {
    expect(() =>
      assertDemoAllowed({ env: 'production', organizations: [], tenantFlag: undefined }),
    ).toThrow(/production/);
    expect(() =>
      assertDemoAllowed({ env: 'production', organizations: ['acme'], tenantFlag: 'acme' }),
    ).toThrow(/production/);
  });

  it('refuses --demo=local without --tenant when a non-demo organization exists', () => {
    expect(() =>
      assertDemoAllowed({
        env: 'development',
        organizations: ['demo-norte', 'real-co'],
        tenantFlag: undefined,
      }),
    ).toThrow(/--tenant=<slug>/);
  });

  it('allows --demo=local on an empty database or one holding only the demo tenants', () => {
    expect(() =>
      assertDemoAllowed({ env: undefined, organizations: [], tenantFlag: undefined }),
    ).not.toThrow();
    expect(() =>
      assertDemoAllowed({
        env: 'development',
        organizations: ['demo-norte', 'demo-sur'],
        tenantFlag: undefined,
      }),
    ).not.toThrow();
  });

  it('allows --demo=local --tenant outside production, whatever organizations exist', () => {
    expect(() =>
      assertDemoAllowed({ env: 'development', organizations: ['real-co'], tenantFlag: 'real-co' }),
    ).not.toThrow();
  });
});

describe('runSeed guards', () => {
  beforeEach(async () => {
    await resetDb();
    vi.unstubAllEnvs();
  });

  it('refuses --demo=local in production before writing anything', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(runSeed({ demo: 'local' })).rejects.toThrow(/production/);
    expect(await testDb.select().from(organization)).toEqual([]);
    expect(await testDb.select().from(user)).toEqual([]);
  });

  it('refuses --demo=local without --tenant when a real tenant exists, writing nothing', async () => {
    await createTestTenant('real-co');
    await expect(runSeed({ demo: 'local' })).rejects.toThrow(/--tenant=<slug>/);
    expect((await testDb.select().from(organization)).map((o) => o.slug)).toEqual(['real-co']);
    expect(await testDb.select().from(user)).toEqual([]);
  });

  it('warns before adding demo accounts to an explicit tenant', { timeout: 120_000 }, async () => {
    await createTestTenant('real-co');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await runSeed({ demo: 'local', tenant: 'real-co' });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/known passwords.*real-co/s));
    warn.mockRestore();
  });

  it('does not touch the guard for --demo=prod and adds no membership to the real superadmin', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const tenant = await createTestTenant('acme');
    const sa = await createTestUser({ email: 'samuel@admin.com', role: 'superadmin' });
    await runSeed({ demo: 'prod', tenant: 'acme' });
    const [after] = await testDb.select().from(user).where(eq(user.id, sa.id));
    expect(after!.isPlatformAdmin).toBe(true);
    expect(await testDb.select().from(member)).toEqual([]);
    expect(tenant.id).toBeTruthy();
  });
});
