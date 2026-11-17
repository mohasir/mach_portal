import { beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import {
  CHARGE_FIXED_MAX,
  QUOTE_STAGE,
  type CreateQuoteInput,
  type QuoteChargeInput,
} from '@repo/schemas';
import {
  appSettings,
  chargeTypes,
  clients,
  products,
  quoteCharges,
  quoteStages,
  quotes,
} from '../../../db/schema';
import {
  addMember,
  createTestTenant,
  createTestUser,
  resetDb,
  testDb,
  testUnitId,
} from '../../../test/db';
import { ConfigRepository } from '../../config/config.repository';
import type { NotificationsRepository } from '../../notifications/notifications.repository';
import { ProductsRepository } from '../../products/products.repository';
import { TemplatesRepository } from '../../templates/templates.repository';
import { QuotesRepository } from '../quotes.repository';
import { QuotePdfGenerator, QuotesService } from '../quotes.service';

function serviceFor(tenantId: string, extraChargesActive = true) {
  const pdf = new QuotePdfGenerator(
    (fn) => testDb.transaction(fn),
    (tx) => ({
      quotes: new QuotesRepository(tx, tenantId),
      products: new ProductsRepository(tx, tenantId),
      templates: new TemplatesRepository(tx, tenantId),
    }),
    false,
  );
  return new QuotesService(
    new QuotesRepository(testDb, tenantId),
    new ConfigRepository(testDb, tenantId),
    { create: async () => undefined } as unknown as NotificationsRepository,
    pdf,
    () => undefined,
    false,
    true,
    extraChargesActive,
  );
}

const featureOff = {
  code: 'FORBIDDEN',
  cause: { code: 'FEATURE_NOT_ENABLED', details: { feature: 'extraCharges' } },
};
const typeNotFound = { code: 'NOT_FOUND', cause: { code: 'CHARGE_TYPE_NOT_FOUND' } };
const typeInactive = { code: 'BAD_REQUEST', cause: { code: 'CHARGE_TYPE_INACTIVE' } };
const invalidValue = { code: 'BAD_REQUEST', cause: { code: 'CHARGE_TYPE_INVALID_VALUE' } };

async function seedTenant(slug: string) {
  const tenantId = (await createTestTenant(slug)).id;
  const userId = (await createTestUser()).id;
  await addMember(userId, tenantId);
  await testDb.insert(appSettings).values({ tenantId });
  const [client] = await testDb
    .insert(clients)
    .values({ tenantId, name: 'Client' })
    .returning({ id: clients.id });
  const [product] = await testDb
    .insert(products)
    .values({ tenantId, name: 'Bar', uomId: await testUnitId(tenantId), price: 1000, taxRate: 0.1 })
    .returning({ id: products.id });
  const [freight, card, retired] = await testDb
    .insert(chargeTypes)
    .values([
      { tenantId, name: 'Flete', kind: 'fixed', defaultValue: 2500, sortOrder: 0 },
      { tenantId, name: 'Tarjeta', kind: 'percent', defaultValue: 0.05, sortOrder: 1 },
      { tenantId, name: 'Retirado', kind: 'fixed', defaultValue: 100, isActive: false },
    ])
    .returning({ id: chargeTypes.id });
  return {
    tenantId,
    userId,
    clientId: client!.id,
    productId: product!.id,
    freightId: freight!.id,
    cardId: card!.id,
    retiredId: retired!.id,
  };
}

describe('quote charges', () => {
  let t: Awaited<ReturnType<typeof seedTenant>>;
  let other: Awaited<ReturnType<typeof seedTenant>>;
  let service: QuotesService;

  // 10 × 1000 at 10%: 11000 with tax.
  const input = (charges: QuoteChargeInput[], extra: Partial<CreateQuoteInput> = {}) =>
    ({
      isDraft: false,
      selectOptionsAtQuote: false,
      clientId: t.clientId,
      lines: [{ productId: t.productId, quantity: 10, subtotal: 10000, selections: [] }],
      charges,
      ...extra,
    }) as CreateQuoteInput;
  const storedCharges = (quoteId: string) =>
    testDb
      .select({
        chargeTypeId: quoteCharges.chargeTypeId,
        name: quoteCharges.name,
        kind: quoteCharges.kind,
        value: quoteCharges.value,
        amount: quoteCharges.amount,
        tenantId: quoteCharges.tenantId,
      })
      .from(quoteCharges)
      .where(eq(quoteCharges.quoteId, quoteId))
      .orderBy(asc(quoteCharges.sortOrder));
  const storedQuote = async (id: string) =>
    (await testDb.select().from(quotes).where(eq(quotes.id, id)))[0]!;
  const countRows = async () => ({
    quotes: (await testDb.select({ id: quotes.id }).from(quotes)).length,
    charges: (await testDb.select({ id: quoteCharges.id }).from(quoteCharges)).length,
  });

  beforeEach(async () => {
    await resetDb();
    await testDb
      .insert(quoteStages)
      .values(
        Object.values(QUOTE_STAGE).map((id) => ({
          id,
          label: `stage ${id}`,
          color: '#000000',
          sortOrder: id,
        })),
      )
      .onConflictDoNothing();
    t = await seedTenant('charges-a');
    other = await seedTenant('charges-b');
    service = serviceFor(t.tenantId);
  });

  it('applies catalog charges with their default or their own value, copying them', async () => {
    const created = await service.create(
      input([{ chargeTypeId: t.freightId }, { chargeTypeId: t.cardId, value: 0.03 }]),
      t.userId,
      false,
    );
    expect(await storedCharges(created.id)).toEqual([
      {
        chargeTypeId: t.freightId,
        name: 'Flete',
        kind: 'fixed',
        value: 2500,
        amount: 2500,
        tenantId: t.tenantId,
      },
      {
        chargeTypeId: t.cardId,
        name: 'Tarjeta',
        kind: 'percent',
        value: 0.03,
        amount: 330,
        tenantId: t.tenantId,
      },
    ]);
    const quote = await storedQuote(created.id);
    expect([quote.taxAmount, quote.total, quote.depositAmount]).toEqual([
      1000,
      13830,
      Math.round(13830 * 0.5),
    ]);
  });

  it('exposes the applied charges on the quote detail', async () => {
    const created = await service.create(
      input([{ chargeTypeId: t.freightId, value: 700 }]),
      t.userId,
      false,
    );
    const detail = await service.getById(created.id);
    expect(detail.charges).toEqual([
      {
        id: expect.any(String),
        chargeTypeId: t.freightId,
        name: 'Flete',
        kind: 'fixed',
        value: 700,
        amount: 700,
        sortOrder: 0,
      },
    ]);
    expect(detail.total).toBe(11700);
  });

  it('keeps the copy when the charge type changes afterwards', async () => {
    const created = await service.create(input([{ chargeTypeId: t.freightId }]), t.userId, false);
    await testDb
      .update(chargeTypes)
      .set({ name: 'Flete nuevo', defaultValue: 9999 })
      .where(eq(chargeTypes.id, t.freightId));
    expect(await storedCharges(created.id)).toMatchObject([{ name: 'Flete', value: 2500 }]);
  });

  it.each([
    ['another tenant', () => other.freightId, typeNotFound],
    ['an unknown', () => '00000000-0000-4000-8000-000000000000', typeNotFound],
    ['an inactive', () => t.retiredId, typeInactive],
  ])('rejects %s charge type without writing anything', async (_label, id, error) => {
    await expect(
      service.create(input([{ chargeTypeId: id() }]), t.userId, false),
    ).rejects.toMatchObject(error);
    expect(await countRows()).toEqual({ quotes: 0, charges: 0 });
  });

  it.each([
    ['a percent above 1', () => ({ chargeTypeId: t.cardId, value: 1.5 })],
    ['a percent of 0', () => ({ chargeTypeId: t.cardId, value: 0 })],
    ['a negative amount', () => ({ chargeTypeId: t.freightId, value: -100 })],
    ['a fractional amount', () => ({ chargeTypeId: t.freightId, value: 10.5 })],
  ])('rejects %s without writing anything', async (_label, charge) => {
    await expect(service.create(input([charge()]), t.userId, false)).rejects.toMatchObject(
      invalidValue,
    );
    expect(await countRows()).toEqual({ quotes: 0, charges: 0 });
  });

  it('rejects charges that take an amount past the integer range, writing nothing', async () => {
    const tooLarge = { code: 'BAD_REQUEST', cause: { code: 'QUOTE_AMOUNT_TOO_LARGE' } };
    const [big1, big2, big3] = await testDb
      .insert(chargeTypes)
      .values(
        ['Max 1', 'Max 2', 'Max 3'].map((name) => ({
          tenantId: t.tenantId,
          name,
          kind: 'fixed' as const,
          defaultValue: CHARGE_FIXED_MAX,
        })),
      )
      .returning({ id: chargeTypes.id });
    await expect(
      service.create(
        input([big1!, big2!, big3!].map(({ id }) => ({ chargeTypeId: id }))),
        t.userId,
        false,
      ),
    ).rejects.toMatchObject(tooLarge);
    expect(await countRows()).toEqual({ quotes: 0, charges: 0 });
    await expect(
      service.create(input([{ chargeTypeId: big1!.id }]), t.userId, false),
    ).resolves.toMatchObject({ total: 11000 + CHARGE_FIXED_MAX });
  });

  it('rejects a line subtotal past the integer range instead of failing on insert', async () => {
    const tooLarge = { code: 'BAD_REQUEST', cause: { code: 'QUOTE_AMOUNT_TOO_LARGE' } };
    const lines = [{ productId: t.productId, quantity: 1, subtotal: 2 ** 31, selections: [] }];
    await expect(service.create(input([], { lines }), t.userId, true)).rejects.toMatchObject(
      tooLarge,
    );
    expect(await countRows()).toEqual({ quotes: 0, charges: 0 });
  });

  it('rejects any charge without the add-on, writing nothing', async () => {
    const off = serviceFor(t.tenantId, false);
    await expect(
      off.create(input([{ chargeTypeId: t.freightId }]), t.userId, false),
    ).rejects.toMatchObject(featureOff);
    expect(await countRows()).toEqual({ quotes: 0, charges: 0 });
    await expect(off.create(input([]), t.userId, false)).resolves.toMatchObject({ total: 11000 });
  });

  it('replaces the charges of a quote when it is edited', async () => {
    const created = await service.create(input([{ chargeTypeId: t.freightId }]), t.userId, false);
    await service.update(created.id, input([{ chargeTypeId: t.cardId }]), false);
    expect(await storedCharges(created.id)).toMatchObject([
      { name: 'Tarjeta', value: 0.05, amount: 550 },
    ]);
    expect((await storedQuote(created.id)).total).toBe(11550);
    await service.update(created.id, input([]), false);
    expect(await storedCharges(created.id)).toEqual([]);
    expect((await storedQuote(created.id)).total).toBe(11000);
  });

  it('keeps a charge resent unchanged even after its type is deactivated', async () => {
    const created = await service.create(
      input([{ chargeTypeId: t.freightId, value: 800 }]),
      t.userId,
      false,
    );
    await testDb
      .update(chargeTypes)
      .set({ isActive: false, name: 'Otro', defaultValue: 1 })
      .where(eq(chargeTypes.id, t.freightId));
    await service.update(created.id, input([{ chargeTypeId: t.freightId }]), false);
    expect(await storedCharges(created.id)).toMatchObject([
      { name: 'Flete', value: 800, amount: 800 },
    ]);
    await expect(
      service.update(created.id, input([{ chargeTypeId: t.freightId, value: 900 }]), false),
    ).rejects.toMatchObject(typeInactive);
  });

  it('never reads the charges or charge types of another tenant', async () => {
    const theirs = await serviceFor(other.tenantId).create(
      {
        ...input([{ chargeTypeId: other.freightId }]),
        clientId: other.clientId,
        lines: [{ productId: other.productId, quantity: 1, subtotal: 1000, selections: [] }],
      },
      other.userId,
      false,
    );
    const repo = new QuotesRepository(testDb, t.tenantId);
    expect(await repo.findCharges(theirs.id)).toEqual([]);
    expect(await repo.findChargeTypes([other.freightId, other.cardId])).toEqual([]);
    await expect(service.getById(theirs.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await storedCharges(theirs.id)).toHaveLength(1);
  });

  describe('with the add-on off', () => {
    let quoteId: string;
    let off: QuotesService;

    beforeEach(async () => {
      quoteId = (
        await service.create(
          input([{ chargeTypeId: t.freightId }, { chargeTypeId: t.cardId }]),
          t.userId,
          false,
        )
      ).id;
      off = serviceFor(t.tenantId, false);
    });

    it('still reads the charges of a quote', async () => {
      const detail = await off.getById(quoteId);
      expect(detail.charges.map((c) => [c.name, c.amount])).toEqual([
        ['Flete', 2500],
        ['Tarjeta', 550],
      ]);
    });

    it('recalculates on edit without losing the existing charges', async () => {
      const lines = [{ productId: t.productId, quantity: 20, subtotal: 20000, selections: [] }];
      await off.update(quoteId, input([], { lines }), false);
      expect(await storedCharges(quoteId)).toMatchObject([
        { name: 'Flete', value: 2500, amount: 2500 },
        { name: 'Tarjeta', value: 0.05, amount: 1100 },
      ]);
      expect((await storedQuote(quoteId)).total).toBe(22000 + 2500 + 1100);
      await off.update(
        quoteId,
        input([{ chargeTypeId: t.freightId }, { chargeTypeId: t.cardId, value: 0.05 }]),
        false,
      );
      expect(await storedCharges(quoteId)).toHaveLength(2);
    });

    it('refuses a new or changed charge without touching the quote', async () => {
      const before = await storedQuote(quoteId);
      await expect(
        off.update(quoteId, input([{ chargeTypeId: t.cardId, value: 0.1 }]), false),
      ).rejects.toMatchObject(featureOff);
      await expect(
        off.update(quoteId, input([{ chargeTypeId: other.freightId }]), false),
      ).rejects.toMatchObject(featureOff);
      expect(await storedQuote(quoteId)).toEqual(before);
      expect(await storedCharges(quoteId)).toHaveLength(2);
    });
  });
});
