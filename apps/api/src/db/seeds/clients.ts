import { eq } from 'drizzle-orm';
import type { StateValue } from '@repo/schemas';
import { db } from '../index';
import { clients } from '../schema';

interface SeedClient {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: StateValue;
  address?: string;
  notes?: string;
}

const SEED_CLIENTS: SeedClient[] = [
  {
    name: 'Laura Jiménez',
    email: 'laura.jimenez@example.com',
    phone: '+12125550134',
    city: 'New York',
    state: 'NY',
    address: '145 W 57th St, Apt 12B',
    notes: 'Referida por Instagram. Interesada en boda 2026.',
  },
  {
    name: 'Marcus Bennett',
    email: 'marcus.bennett@example.com',
    phone: '+12015550198',
    city: 'Jersey City',
    state: 'NJ',
    address: '88 Morgan St',
  },
  {
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    phone: '+12035550176',
    city: 'Stamford',
    state: 'CT',
    notes: 'Cumpleaños corporativo, ~60 personas.',
  },
  {
    name: 'Diego Fernández',
    email: 'diego.fernandez@example.com',
    phone: '+13475550112',
    city: 'Brooklyn',
    state: 'NY',
    address: '210 Bedford Ave',
  },
  {
    name: 'Emily Carter',
    email: 'emily.carter@example.com',
    phone: '+19085550155',
    city: 'Princeton',
    state: 'NJ',
    notes: 'Pidió cotización para baby shower.',
  },
  {
    name: 'Sofía Ramírez',
    email: 'sofia.ramirez@example.com',
    phone: '+12035550143',
    city: 'New Haven',
    state: 'CT',
    address: '19 Elm St',
  },
  {
    name: 'James O’Connor',
    email: 'james.oconnor@example.com',
    phone: '+16465550187',
    city: 'Queens',
    state: 'NY',
  },
  {
    name: 'Hannah Weiss',
    email: 'hannah.weiss@example.com',
    phone: '+15515550169',
    city: 'Hoboken',
    state: 'NJ',
    address: '400 Washington St',
    notes: 'Evento aniversario, terraza.',
  },
  {
    name: 'Tomás Álvarez',
    email: 'tomas.alvarez@example.com',
    phone: '+14755550121',
    city: 'Bridgeport',
    state: 'CT',
  },
  {
    name: 'Rachel Kim',
    email: 'rachel.kim@example.com',
    phone: '+19175550102',
    city: 'Manhattan',
    state: 'NY',
    notes: 'Corporativo trimestral recurrente.',
  },
];

export async function seedClients() {
  console.log('🧑‍🤝‍🧑 Seeding clientes...');

  for (const c of SEED_CLIENTS) {
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, c.email))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${c.email} ya existe, salteando`);
      continue;
    }

    await db.insert(clients).values(c);
    console.log(`  ✅ ${c.name} (${c.state})`);
  }
}
