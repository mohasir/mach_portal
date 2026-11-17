import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createQuoteSchema,
  QUOTE_STAGE,
  quotesBoardQuerySchema,
  quotesListQuerySchema,
  type CreateQuoteInput,
  type UpdateLocationSettingsInput,
} from '@repo/schemas';
import { appSettings, clients, events, products, quoteStages, quotes } from '../../../db/schema';
import {
  addMember,
  createTestTenant,
  createTestUser,
  resetDb,
  testDb,
  testUnitId,
} from '../../../test/db';
import { ConfigRepository } from '../../config/config.repository';
import { LocationSettingsRepository } from '../../locationSettings/locationSettings.repository';
import { LocationSettingsService } from '../../locationSettings/locationSettings.service';
import type { NotificationsRepository } from '../../notifications/notifications.repository';
import { ProductsRepository } from '../../products/products.repository';
import { TemplatesRepository } from '../../templates/templates.repository';
import { QuotesRepository } from '../quotes.repository';
import { QuotePdfGenerator, QuotesService } from '../quotes.service';

function serviceFor(tenantId: string) {
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
    false,
  );
}

const configure = (tenantId: string, settings: Partial<UpdateLocationSettingsInput>) =>
  new LocationSettingsService(new LocationSettingsRepository(testDb, tenantId)).update({
    enabled: true,
    country: 'US',
    depth: 2,
    scope: 'country',
    areas: [],
    askAddress: true,
    ...settings,
  });

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
    .values({ tenantId, name: 'Bar', uomId: await testUnitId(tenantId), price: 1000, taxRate: 0 })
    .returning({ id: products.id });
  return { tenantId, userId, clientId: client!.id, productId: product!.id };
}

const invalidLocation = { code: 'BAD_REQUEST', cause: { code: 'QUOTE_INVALID_LOCATION' } };
const notCovered = { code: 'BAD_REQUEST', cause: { code: 'QUOTE_LOCATION_NOT_COVERED' } };
const incomplete = { code: 'BAD_REQUEST', cause: { code: 'QUOTE_LOCATION_INCOMPLETE' } };

describe('quote operating location', () => {
  let t: Awaited<ReturnType<typeof seedTenant>>;
  let service: QuotesService;

  // Parsed like the router does, so unknown keys such as `country` are dropped as they would be.
  const input = (extra: Record<string, unknown> = {}, isDraft = false): CreateQuoteInput =>
    createQuoteSchema.parse({
      isDraft,
      selectOptionsAtQuote: false,
      clientId: t.clientId,
      lines: [{ productId: t.productId, quantity: 10, subtotal: 10000, selections: [] }],
      ...extra,
    });
  const stored = async (id: string) =>
    (await testDb.select().from(quotes).where(eq(quotes.id, id)))[0]!;
  const place = (row: {
    country: string | null;
    region: string | null;
    locality: string | null;
    address: string | null;
  }) => ({
    country: row.country,
    region: row.region,
    locality: row.locality,
    address: row.address,
  });
  const quoteCount = async () => (await testDb.select({ id: quotes.id }).from(quotes)).length;

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
    t = await seedTenant('location-a');
    service = serviceFor(t.tenantId);
  });

  describe('enabled', () => {
    it('stores the place with the configured country, whatever the input sends', async () => {
      await configure(t.tenantId, {});
      const created = await service.create(
        input({ country: 'NI', region: 'NY', locality: 'Albany', address: '1 State St' }),
        t.userId,
        false,
      );
      expect(place(await stored(created.id))).toEqual({
        country: 'US',
        region: 'NY',
        locality: 'Albany',
        address: '1 State St',
      });
      expect(place(created)).toEqual(place(await stored(created.id)));
    });

    it('requires every configured level and the address on a quote that is not a draft', async () => {
      await configure(t.tenantId, {});
      await expect(
        service.create(input({ region: 'NY', address: '1 State St' }), t.userId, false),
      ).rejects.toMatchObject(incomplete);
      await expect(
        service.create(input({ region: 'NY', locality: 'Albany' }), t.userId, false),
      ).rejects.toMatchObject(incomplete);
      expect(await quoteCount()).toBe(0);
    });

    it('lets a draft leave levels empty', async () => {
      await configure(t.tenantId, {});
      const created = await service.create(input({ region: 'NY' }, true), t.userId, false);
      expect(place(await stored(created.id))).toEqual({
        country: 'US',
        region: 'NY',
        locality: null,
        address: null,
      });
    });

    it('stores only the configured levels and needs the address only when asked', async () => {
      await configure(t.tenantId, { depth: 1, askAddress: false });
      const created = await service.create(
        input({ region: 'NJ', locality: 'Newark', address: '9 Market St' }),
        t.userId,
        false,
      );
      expect(place(await stored(created.id))).toEqual({
        country: 'US',
        region: 'NJ',
        locality: null,
        address: null,
      });
    });

    it('stores only the country on a country-only depth', async () => {
      await configure(t.tenantId, { depth: 0, askAddress: false });
      const created = await service.create(input({ region: 'NJ' }), t.userId, false);
      expect(place(await stored(created.id))).toEqual({
        country: 'US',
        region: null,
        locality: null,
        address: null,
      });
    });

    it.each([
      ['an unknown region', { region: 'ZZ', locality: 'Albany' }],
      ['a locality of another region', { region: 'NY', locality: 'Paterson' }],
      ['an unknown locality', { region: 'NY', locality: 'Atlantis' }],
      ['a locality without region', { locality: 'Albany' }],
    ])('rejects %s without writing', async (_, location) => {
      await configure(t.tenantId, {});
      await expect(
        service.create(input({ ...location, address: '1 St' }), t.userId, false),
      ).rejects.toMatchObject(invalidLocation);
      expect(await quoteCount()).toBe(0);
    });

    it('rejects a region or locality outside the coverage without writing', async () => {
      await configure(t.tenantId, {
        scope: 'areas',
        areas: [
          { region: 'NY', locality: null },
          { region: 'NJ', locality: 'Newark' },
        ],
      });
      const ok = await service.create(
        input({ region: 'NJ', locality: 'Newark', address: '1 St' }),
        t.userId,
        false,
      );
      expect((await stored(ok.id)).locality).toBe('Newark');
      await expect(
        service.create(
          input({ region: 'CT', locality: 'Hartford', address: '1 St' }),
          t.userId,
          false,
        ),
      ).rejects.toMatchObject(notCovered);
      await expect(
        service.create(
          input({ region: 'NJ', locality: 'Paterson', address: '1 St' }),
          t.userId,
          false,
        ),
      ).rejects.toMatchObject(notCovered);
      expect(await quoteCount()).toBe(1);
    });

    it('keeps a stored place resent unchanged even if it is not in the dataset', async () => {
      await configure(t.tenantId, {});
      const created = await service.create(input({}, true), t.userId, false);
      await testDb
        .update(quotes)
        .set({ country: 'US', region: 'NY', locality: 'Bronx' })
        .where(eq(quotes.id, created.id));
      await service.update(
        created.id,
        input({ region: 'NY', locality: 'Bronx', address: '500 Grand Concourse' }),
        false,
      );
      expect(place(await stored(created.id))).toMatchObject({ region: 'NY', locality: 'Bronx' });
      await expect(
        service.update(
          created.id,
          input({ region: 'NJ', locality: 'Bronx', address: '500 Grand Concourse' }),
          false,
        ),
      ).rejects.toMatchObject(invalidLocation);
    });
  });

  describe('disabled', () => {
    it('neither requires nor accepts a place, and keeps the stored one when editing', async () => {
      const created = await service.create(
        input({ region: 'NY', locality: 'Albany', address: '1 St' }),
        t.userId,
        false,
      );
      expect(place(await stored(created.id))).toEqual({
        country: null,
        region: null,
        locality: null,
        address: null,
      });

      await testDb
        .update(quotes)
        .set({ country: 'US', region: 'NY', locality: 'Albany', address: '1 State St' })
        .where(eq(quotes.id, created.id));
      await service.update(
        created.id,
        input({
          region: 'CT',
          locality: 'Hartford',
          address: 'other',
          notes: 'edited',
          eventDate: '2031-01-01',
        }),
        false,
      );
      const row = await stored(created.id);
      expect(place(row)).toEqual({
        country: 'US',
        region: 'NY',
        locality: 'Albany',
        address: '1 State St',
      });
      expect([row.notes, row.eventDate]).toEqual(['edited', '2031-01-01']);
      expect((await service.getById(created.id)).region).toBe('NY');
    });

    it('keeps the stored place after the function is turned off', async () => {
      await configure(t.tenantId, {});
      const created = await service.create(
        input({ region: 'NY', locality: 'Albany', address: '1 St' }),
        t.userId,
        false,
      );
      await configure(t.tenantId, { enabled: false });
      await service.update(created.id, input({ notes: 'later' }), false);
      expect(place(await stored(created.id))).toEqual({
        country: 'US',
        region: 'NY',
        locality: 'Albany',
        address: '1 St',
      });
    });
  });

  describe('leaving the draft stage', () => {
    const sendDraft = async (extra: Record<string, unknown>) => {
      const created = await service.create(input(extra, true), t.userId, false);
      return service.updateStage(created.id, QUOTE_STAGE.QUOTED, t.userId);
    };

    it('only needs lines while the function is off', async () => {
      await expect(sendDraft({})).resolves.toMatchObject({ stageId: QUOTE_STAGE.QUOTED });
    });

    it('needs the configured levels and the address when on', async () => {
      await configure(t.tenantId, {});
      await expect(sendDraft({ region: 'NY', locality: 'Albany' })).rejects.toMatchObject({
        cause: { code: 'QUOTE_INCOMPLETE' },
      });
      await expect(
        sendDraft({ region: 'NY', locality: 'Albany', address: '1 St' }),
      ).resolves.toMatchObject({ stageId: QUOTE_STAGE.QUOTED });
    });

    it('does not ask for a country of a quote saved while the function was off', async () => {
      const created = await service.create(input({}, true), t.userId, false);
      expect(place(await stored(created.id)).country).toBeNull();
      await configure(t.tenantId, { depth: 0, askAddress: false });
      expect((await service.getById(created.id)).isComplete).toBe(true);
      await expect(
        service.updateStage(created.id, QUOTE_STAGE.QUOTED, t.userId),
      ).resolves.toMatchObject({ stageId: QUOTE_STAGE.QUOTED });
    });

    it('follows the current depth', async () => {
      await configure(t.tenantId, { depth: 1, askAddress: false });
      const created = await service.create(input({ region: 'NY' }, true), t.userId, false);
      expect((await service.getById(created.id)).isComplete).toBe(true);
      await configure(t.tenantId, { depth: 2, askAddress: false });
      expect((await service.getById(created.id)).isComplete).toBe(false);
      const listed = await service.list(quotesListQuerySchema.parse({}));
      expect(listed.items[0]!.isComplete).toBe(false);
    });
  });

  it('filters the list by region', async () => {
    await configure(t.tenantId, { depth: 1, askAddress: false });
    await service.create(input({ region: 'NY' }), t.userId, false);
    await service.create(input({ region: 'NJ' }), t.userId, false);
    await service.create(input({}, true), t.userId, false);
    const listed = await service.list(quotesListQuerySchema.parse({ regions: ['NJ'] }));
    expect(listed.items.map((q) => q.region)).toEqual(['NJ']);
  });

  it('filters by region within the configured country when codes are shared', async () => {
    await configure(t.tenantId, { country: 'NI', depth: 1, askAddress: false });
    const ni = await service.create(input({ region: 'CA' }), t.userId, false);
    await configure(t.tenantId, { country: 'US', depth: 1, askAddress: false });
    await service.create(input({ region: 'CA' }), t.userId, false);
    await configure(t.tenantId, { country: 'NI', depth: 1, askAddress: false });
    const query = { regions: ['CA'] };
    const listed = await service.list(quotesListQuerySchema.parse(query));
    expect(listed.items.map((q) => q.id)).toEqual([ni.id]);
    const board = await service.board(quotesBoardQuerySchema.parse(query));
    expect(board[QUOTE_STAGE.PENDING].map((q) => q.id)).toEqual([ni.id]);
  });

  it('copies the place of the quote to the event it creates', async () => {
    await configure(t.tenantId, {});
    const created = await service.create(
      input({ region: 'NY', locality: 'Albany', address: '1 State St' }),
      t.userId,
      false,
    );
    await service.updateStage(created.id, QUOTE_STAGE.QUOTED, t.userId);
    await service.approve(created.id, t.userId, { id: t.userId, name: 'U' } as never);
    const [event] = await testDb.select().from(events).where(eq(events.quoteId, created.id));
    expect(place(event!)).toEqual({
      country: 'US',
      region: 'NY',
      locality: 'Albany',
      address: '1 State St',
    });
  });

  it('reads the settings of its own organization only', async () => {
    const other = await seedTenant('location-b');
    await configure(other.tenantId, {
      scope: 'areas',
      areas: [{ region: 'CT', locality: null }],
    });
    const created = await service.create(
      input({ region: 'NY', locality: 'Albany', address: '1 St' }),
      t.userId,
      false,
    );
    expect(place(await stored(created.id)).country).toBeNull();
    await configure(t.tenantId, {});
    await expect(
      service.create(input({ region: 'NY', locality: 'Albany', address: '1 St' }), t.userId, false),
    ).resolves.toBeDefined();
  });
});
