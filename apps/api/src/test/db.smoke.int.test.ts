import { beforeEach, describe, it } from 'vitest';
import { resetDb } from './db';

describe('integration harness', () => {
  beforeEach(async () => {
    await resetDb();
  });

  // Enabled once the organization/member schema exists:
  //   const { a, b } = await seedTwoTenants();
  //   expect 2 rows in organization and 2 in member, one member per tenant.
  it.todo('creates two isolated tenants with one member each');
});
