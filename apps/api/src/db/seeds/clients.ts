import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { clients } from '../schema';
import type { Executor } from '../index';

export interface SeedClient {
  name: string;
  email: string;
  phone: string;
  // Where this client's events usually take place: copied to the quotes the seed creates for it,
  // never stored on the client.
  region: string;
  locality: string;
  address?: string;
  notes?: string;
}

export const SEED_CLIENTS: SeedClient[] = [
  {
    name: 'Laura Jiménez',
    email: 'laura.jimenez@example.com',
    phone: '+12125550134',
    region: 'NY',
    locality: 'New York',
    address: '145 W 57th St, Apt 12B',
    notes: 'Referida por Instagram. Interesada en boda 2026.',
  },
  {
    name: 'Marcus Bennett',
    email: 'marcus.bennett@example.com',
    phone: '+12015550198',
    region: 'NJ',
    locality: 'Jersey City',
    address: '88 Morgan St',
  },
  {
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    phone: '+12035550176',
    region: 'CT',
    locality: 'Stamford',
    notes: 'Cumpleaños corporativo, ~60 personas.',
  },
  {
    name: 'Diego Fernández',
    email: 'diego.fernandez@example.com',
    phone: '+13475550112',
    region: 'NY',
    locality: 'Buffalo',
    address: '210 Bedford Ave',
  },
  {
    name: 'Emily Carter',
    email: 'emily.carter@example.com',
    phone: '+19085550155',
    region: 'NJ',
    locality: 'Princeton',
    notes: 'Pidió cotización para baby shower.',
  },
  {
    name: 'Sofía Ramírez',
    email: 'sofia.ramirez@example.com',
    phone: '+12035550143',
    region: 'CT',
    locality: 'New Haven',
    address: '19 Elm St',
  },
  {
    name: 'James O’Connor',
    email: 'james.oconnor@example.com',
    phone: '+16465550187',
    region: 'NY',
    locality: 'Rochester',
  },
  {
    name: 'Hannah Weiss',
    email: 'hannah.weiss@example.com',
    phone: '+15515550169',
    region: 'NJ',
    locality: 'Hoboken',
    address: '400 Washington St',
    notes: 'Evento aniversario, terraza.',
  },
  {
    name: 'Tomás Álvarez',
    email: 'tomas.alvarez@example.com',
    phone: '+14755550121',
    region: 'CT',
    locality: 'Bridgeport',
  },
  {
    name: 'Rachel Kim',
    email: 'rachel.kim@example.com',
    phone: '+19175550102',
    region: 'NY',
    locality: 'New York',
    notes: 'Corporativo trimestral recurrente.',
  },
];

export async function seedClients(
  tenantId: string,
  list: SeedClient[] = SEED_CLIENTS,
  x: Executor = db,
) {
  console.log('🧑‍🤝‍🧑 Seeding clientes...');

  for (const c of list) {
    const [existing] = await x
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.email, c.email)))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${c.email} ya existe, salteando`);
      continue;
    }

    const { region: _region, locality: _locality, ...client } = c;
    await x.insert(clients).values({ ...client, tenantId });
    console.log(`  ✅ ${c.name}`);
  }
}
