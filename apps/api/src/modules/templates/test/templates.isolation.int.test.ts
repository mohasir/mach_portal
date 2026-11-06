import { beforeEach, describe, expect, it } from 'vitest';
import { TEMPLATE_TYPES } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { templates } from '../../../db/schema';
import { seedTwoTenants, resetDb, testDb, type TestTenant } from '../../../test/db';
import { TemplatesRepository } from '../templates.repository';

const TYPE = TEMPLATE_TYPES.QUOTE_PDF;

describe('templates tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: TemplatesRepository;
  let repoB: TemplatesRepository;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    await testDb.insert(templates).values({ tenantId: a.id, type: TYPE, content: { who: 'A' } });
    await testDb.insert(templates).values({ tenantId: b.id, type: TYPE, content: { who: 'B' } });
    repoA = new TemplatesRepository(testDb, a.id);
    repoB = new TemplatesRepository(testDb, b.id);
  });

  it('findByType returns the template of the tenant, not another one', async () => {
    expect((await repoA.findByType(TYPE))?.content).toEqual({ who: 'A' });
    expect((await repoB.findByType(TYPE))?.content).toEqual({ who: 'B' });
  });

  it('findByType is undefined for a tenant without a template', async () => {
    await testDb.delete(templates).where(eq(templates.tenantId, a.id));
    expect(await repoA.findByType(TYPE)).toBeUndefined();
    expect((await repoB.findByType(TYPE))?.content).toEqual({ who: 'B' });
  });

  it('upsertByType updates only the tenant row', async () => {
    await repoA.upsertByType(TYPE, { who: 'A2' });
    const rows = await testDb.select().from(templates);
    expect(rows).toHaveLength(2);
    expect((await repoA.findByType(TYPE))?.content).toEqual({ who: 'A2' });
    expect((await repoB.findByType(TYPE))?.content).toEqual({ who: 'B' });
  });

  it('upsertByType creates a row stamped with the tenant when none exists', async () => {
    await testDb.delete(templates).where(eq(templates.tenantId, a.id));
    await repoA.upsertByType(TYPE, { who: 'new' });
    const rows = await testDb.select().from(templates).where(eq(templates.tenantId, a.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toEqual({ who: 'new' });
    expect((await repoB.findByType(TYPE))?.content).toEqual({ who: 'B' });
  });
});
