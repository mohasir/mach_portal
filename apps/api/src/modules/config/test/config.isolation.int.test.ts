import { beforeEach, describe, expect, it } from 'vitest';
import { QUOTE_STAGE } from '@repo/schemas';
import {
  appSettings,
  clients,
  quoteStages,
  quoteStageSettings,
  quotes,
  stateSettings,
} from '../../../db/schema';
import { seedTwoTenants, resetDb, testDb, type TestTenant } from '../../../test/db';
import { ConfigRepository } from '../config.repository';

async function insertQuote(tenantId: string, seq: number) {
  const [client] = await testDb
    .insert(clients)
    .values({ tenantId, name: `client ${seq}` })
    .returning({ id: clients.id });
  await testDb.insert(quotes).values({
    tenantId,
    seq,
    number: `QUO-${tenantId.slice(0, 4)}-${seq}`,
    clientId: client!.id,
    stageId: QUOTE_STAGE.CONFIRMED,
    taxRate: 0.08,
  });
}

async function rawApp(tenantId: string) {
  const rows = await testDb.select().from(appSettings);
  return rows.find((r) => r.tenantId === tenantId);
}

describe('config tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: ConfigRepository;
  let repoB: ConfigRepository;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    await testDb.insert(quoteStages).values(
      Object.values(QUOTE_STAGE).map((id) => ({
        id,
        label: `stage ${id}`,
        color: '#000000',
        sortOrder: id,
      })),
    );
    await testDb.insert(appSettings).values([
      { tenantId: a.id, currency: 'USD', quoteSeqStart: 1 },
      { tenantId: b.id, currency: 'EUR', quoteSeqStart: 500 },
    ]);
    await testDb.insert(stateSettings).values([
      { tenantId: a.id, state: 'NY', taxRate: 0.06 },
      { tenantId: b.id, state: 'NY', taxRate: 0.09 },
      { tenantId: b.id, state: 'NJ', taxRate: 0.0625 },
    ]);
    repoA = new ConfigRepository(testDb, a.id);
    repoB = new ConfigRepository(testDb, b.id);
  });

  it('findAppSettings returns only the tenant row', async () => {
    expect((await repoA.findAppSettings())?.currency).toBe('USD');
    expect((await repoB.findAppSettings())?.currency).toBe('EUR');
  });

  it('findAppSettings is undefined for a tenant without a row', async () => {
    await testDb.delete(appSettings);
    await testDb.insert(appSettings).values({ tenantId: b.id });
    expect(await repoA.findAppSettings()).toBeUndefined();
  });

  it('findStateSettings lists only the tenant rows', async () => {
    const rowsA = await repoA.findStateSettings();
    expect(rowsA.map((r) => [r.state, r.taxRate])).toEqual([['NY', 0.06]]);
    expect(await repoB.findStateSettings()).toHaveLength(2);
  });

  it('upsertStateSettings writes only the tenant rows, even on the same state key', async () => {
    await repoA.upsertStateSettings([
      { state: 'NY', taxRate: 0.07 },
      { state: 'CT', taxRate: 0.0725 },
    ]);
    const all = await testDb.select().from(stateSettings);
    const byKey = (t: TestTenant, s: string) =>
      all.find((r) => r.tenantId === t.id && r.state === s)?.taxRate;
    expect(byKey(a, 'NY')).toBe(0.07);
    expect(byKey(a, 'CT')).toBe(0.0725);
    expect(byKey(b, 'NY')).toBe(0.09);
    expect(all.filter((r) => r.tenantId === b.id)).toHaveLength(2);
  });

  const updaters: [string, (r: ConfigRepository) => Promise<unknown>, string, unknown][] = [
    [
      'updateQuoteDefaults',
      (r) =>
        r.updateQuoteDefaults({
          depositRate: 0.3,
          quoteValidityMonths: 6,
          minPersonsPerLine: 10,
          quoteSeqStart: 77,
          currency: 'MXN',
          optionsSelectionDeadlineDays: 3,
        }),
      'quoteSeqStart',
      77,
    ],
    [
      'updateCatalogPreferences',
      (r) => r.updateCatalogPreferences({ catalogSortable: false }),
      'catalogSortable',
      false,
    ],
    [
      'updateQuoteBuilderPreferences',
      (r) =>
        r.updateQuoteBuilderPreferences({
          allowSelectOptionsAtQuote: false,
          promptRateChanges: true,
        }),
      'promptRateChanges',
      true,
    ],
    [
      'updatePipelinePreferences',
      (r) => r.updatePipelinePreferences({ hideStaleQuotes: false }),
      'hideStaleQuotes',
      false,
    ],
    [
      'updateTaxPreferences',
      (r) => r.updateTaxPreferences({ applyTaxByState: true, cardSurchargeRate: 0.123 }),
      'applyTaxByState',
      true,
    ],
  ];

  it.each(updaters)('%s updates only the tenant row', async (_n, run, key, value) => {
    const beforeB = await rawApp(b.id);
    await run(repoA);
    expect((await rawApp(a.id))?.[key as 'currency']).toEqual(value);
    expect(await rawApp(b.id)).toEqual(beforeB);
  });

  it.each(updaters)(
    '%s creates the row for a tenant that has none',
    async (_n, run, key, value) => {
      await testDb.delete(appSettings);
      await testDb.insert(appSettings).values({ tenantId: b.id });
      const beforeB = await rawApp(b.id);
      await run(repoA);
      expect((await rawApp(a.id))?.[key as 'currency']).toEqual(value);
      expect(await rawApp(b.id)).toEqual(beforeB);
    },
  );

  it('getLastUsedSeq ignores other tenants quotes', async () => {
    await insertQuote(a.id, 3);
    await insertQuote(b.id, 40);
    expect(await repoA.getLastUsedSeq()).toBe(3);
    expect(await repoB.getLastUsedSeq()).toBe(40);
  });

  describe('quote stage overlay', () => {
    const stageId = QUOTE_STAGE.CONFIRMED;
    const input = (label: string) =>
      Object.values(QUOTE_STAGE).map((id) => ({
        id,
        label: id === stageId ? label : `stage ${id}`,
        color: '#111111' as never,
        description: undefined,
      }));
    const labelOf = async (r: ConfigRepository) =>
      (await r.findQuoteStages()).find((x) => x.id === stageId)?.label;

    it('a tenant without overrides sees the global defaults', async () => {
      const stages = await repoA.findQuoteStages();
      expect(stages).toHaveLength(Object.values(QUOTE_STAGE).length);
      expect(stages.every((s) => s.label === `stage ${s.id}` && s.color === '#000000')).toBe(true);
    });

    it('A customizing a stage does not change what B sees, and B is independent', async () => {
      await repoA.upsertQuoteStages(input('Mine A'));
      expect(await labelOf(repoA)).toBe('Mine A');
      expect(await labelOf(repoB)).toBe(`stage ${stageId}`);
      await repoB.upsertQuoteStages(input('Mine B'));
      expect(await labelOf(repoB)).toBe('Mine B');
      expect(await labelOf(repoA)).toBe('Mine A');
    });

    it('upsert never writes the global quote_stages rows', async () => {
      const before = await testDb.select().from(quoteStages);
      await repoA.upsertQuoteStages(input('Mine A'));
      await repoA.upsertQuoteStages(input('Mine A again'));
      expect(await testDb.select().from(quoteStages)).toEqual(before);
    });

    it('re-upserting updates the single overlay row of the tenant', async () => {
      await repoA.upsertQuoteStages(input('One'));
      await repoA.upsertQuoteStages(input('Two'));
      const rows = await testDb.select().from(quoteStageSettings);
      expect(rows.filter((r) => r.tenantId === a.id)).toHaveLength(
        Object.values(QUOTE_STAGE).length,
      );
      expect(rows.filter((r) => r.tenantId === b.id)).toHaveLength(0);
      expect(await labelOf(repoA)).toBe('Two');
    });

    it('a tenantId smuggled in the payload cannot write another tenant row', async () => {
      const hostile = input('Hostile').map((r) => ({ ...r, tenantId: b.id }));
      await repoA.upsertQuoteStages(hostile as never);
      const rows = await testDb.select().from(quoteStageSettings);
      expect(rows.every((r) => r.tenantId === a.id)).toBe(true);
      expect(await labelOf(repoB)).toBe(`stage ${stageId}`);
    });

    it('findQuoteStages ignores overlay rows of other tenants', async () => {
      await testDb.insert(quoteStageSettings).values({ tenantId: b.id, stageId, label: 'Only B' });
      expect(await labelOf(repoA)).toBe(`stage ${stageId}`);
      expect(await labelOf(repoB)).toBe('Only B');
    });
  });
});
