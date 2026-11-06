import { beforeEach, describe, expect, it } from 'vitest';
import { clientsListQuerySchema } from '@repo/schemas';
import { clients } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb } from '../../../test/db';
import { ClientsRepository } from '../clients.repository';

describe('clients search', () => {
  let repo: ClientsRepository;

  beforeEach(async () => {
    await resetDb();
    const { a } = await seedTwoTenants();
    await testDb.insert(clients).values(
      ['Promo 50% off', 'Ana_Maria', 'Back\\slash', 'Plain'].map((name) => ({
        tenantId: a.id,
        name,
      })),
    );
    repo = new ClientsRepository(testDb, a.id);
  });

  const names = async (search: string) =>
    (await repo.findPaginated(clientsListQuerySchema.parse({ search }))).items
      .map((c) => c.name)
      .sort();

  it.each([
    ['%', ['Promo 50% off']],
    ['_', ['Ana_Maria']],
    ['\\', ['Back\\slash']],
    ['%%', []],
    ['la', ['Back\\slash', 'Plain']],
  ])('takes %j literally', async (search, expected) => {
    expect(await names(search)).toEqual(expected);
  });
});
