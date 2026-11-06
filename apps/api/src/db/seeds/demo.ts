import { randomUUID } from 'node:crypto';
import { QUOTE_STAGE, type UserPreferences } from '@repo/schemas';
import { db } from '../index';
import { organization } from '../schema';
import { TenancyRepository } from '../../lib/tenancy/tenancy.repository';
import { seedEventActivity, seedQuoteStageSettings, type SeedStageOverride } from './activity';
import { SEED_CATALOG, type SeedProduct } from './catalog';
import { SEED_CLIENTS, seedClients, type SeedClient } from './clients';
import type { SeedAppSettings } from './config';
import { seedTenantDefaults } from './defaults';
import { seedEventPayments } from './eventPayments';
import { seedEvents } from './events';
import { seedQuoteStages } from './quoteStages';
import { SEED_QUOTES, seedQuotes, type SeedQuote } from './quotes';
import { SEED_STAFF, seedStaff, type SeedStaff } from './staff';
import { ensureAccount, ensureMembership, seedUsers, type SeedUser } from './users';

export const DEMO_PLATFORM_ADMIN_EMAIL = 'platform@demo.test';
export const DEMO_SHARED_USER_EMAIL = 'shared@demo.test';

export interface DemoProfile {
  slug: string;
  name: string;
  users: SeedUser[];
  sharedUserRole: SeedUser['role'];
  clients: SeedClient[];
  staff: SeedStaff[];
  catalog: SeedProduct[];
  quotes: SeedQuote[];
  appSettings: SeedAppSettings;
  stageOverrides: SeedStageOverride[];
  preferences: Partial<UserPreferences>;
}

const demoUsers = (domain: string, label: string): SeedUser[] => [
  { name: `Super ${label}`, email: `superadmin@${domain}`, role: 'superadmin' },
  { name: `Admin ${label}`, email: `admin@${domain}`, role: 'admin' },
  { name: `Operador ${label}`, email: `operator@${domain}`, role: 'operator' },
  { name: `Miembro Uno ${label}`, email: `member1@${domain}`, role: 'member' },
  { name: `Miembro Dos ${label}`, email: `member2@${domain}`, role: 'member' },
];

const SUR_CLIENTS: SeedClient[] = [
  {
    name: 'Valentina Ortiz',
    email: 'valentina.ortiz@example.org',
    phone: '+12125550301',
    city: 'Yonkers',
    state: 'NY',
    notes: 'Boda en jardín, 2026.',
  },
  {
    name: 'Gabriel Moreno',
    email: 'gabriel.moreno@example.org',
    phone: '+12015550302',
    city: 'Newark',
    state: 'NJ',
    address: '12 Ferry St',
  },
  {
    name: 'Isabella Cruz',
    email: 'isabella.cruz@example.org',
    phone: '+12035550303',
    city: 'Hartford',
    state: 'CT',
    notes: 'Evento de empresa, ~80 personas.',
  },
  {
    name: 'Mateo Rojas',
    email: 'mateo.rojas@example.org',
    phone: '+13475550304',
    city: 'Bronx',
    state: 'NY',
    address: '500 Grand Concourse',
  },
  {
    name: 'Lucía Vargas',
    email: 'lucia.vargas@example.org',
    phone: '+19085550305',
    city: 'Edison',
    state: 'NJ',
    notes: 'Baby shower en salón.',
  },
  {
    name: 'Martín Castillo',
    email: 'martin.castillo@example.org',
    phone: '+12035550306',
    city: 'Waterbury',
    state: 'CT',
    address: '77 Bank St',
  },
  {
    name: 'Renata Silva',
    email: 'renata.silva@example.org',
    phone: '+16465550307',
    city: 'Staten Island',
    state: 'NY',
  },
  {
    name: 'Joaquín Medina',
    email: 'joaquin.medina@example.org',
    phone: '+15515550308',
    city: 'Paterson',
    state: 'NJ',
    address: '9 Market St',
    notes: 'Aniversario familiar.',
  },
  {
    name: 'Emilia Navarro',
    email: 'emilia.navarro@example.org',
    phone: '+14755550309',
    city: 'Norwalk',
    state: 'CT',
  },
  {
    name: 'Santiago Peña',
    email: 'santiago.pena@example.org',
    phone: '+19175550310',
    city: 'Harlem',
    state: 'NY',
    notes: 'Corporativo mensual.',
  },
];

const SUR_STAFF: SeedStaff[] = [
  { name: 'Catalina Ríos', email: 'catalina.rios@sur.demo', phone: '+12125550410', isActive: true },
  {
    name: 'Tobías Fuentes',
    email: 'tobias.fuentes@sur.demo',
    phone: '+12015550421',
    isActive: true,
  },
  { name: 'Ximena Ibarra', email: 'ximena.ibarra@sur.demo', phone: '+12035550432', isActive: true },
  { name: 'Bruno Acosta', email: 'bruno.acosta@sur.demo', phone: '+16465550443', isActive: true },
  {
    name: 'Olivia Paredes',
    email: 'olivia.paredes@sur.demo',
    phone: '+15515550454',
    isActive: false,
  },
];

const SUR_PRODUCT_NAMES: Record<string, string> = {
  Crepes: 'Waffles Belgas',
  'Mini Pancakes': 'Churros Rellenos',
  Crepaletas: 'Paletas de Waffle',
  Esquites: 'Elotes Asados',
  Nachos: 'Tacos al Pastor',
  'Fruit Station': 'Barra de Frutas',
  'Snack Station': 'Barra de Botanas',
  Popsicles: 'Raspados',
  'Hot Chocolate': 'Café de Olla',
  'Craft Bar': 'Barra de Mezcal',
};

const surProduct = (name: string) => SUR_PRODUCT_NAMES[name] ?? `${name} Sur`;
// Psychological pricing (…$.99) keeps every Sur amount off the Norte grid of whole dollars.
const surPrice = (cents: number) => Math.round((cents * 1.15) / 100) * 100 - 1;

function shiftDate(iso: string | undefined, days: number) {
  if (!iso) return iso;
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const SUR_CATALOG: SeedProduct[] = SEED_CATALOG.map((p) => ({
  ...p,
  name: surProduct(p.name),
  description: `${p.description} (Edición Sur)`,
  tiers: p.tiers.map((t) => ({ ...t, price: surPrice(t.price) })),
}));

const surClientEmail = (email: string) =>
  SUR_CLIENTS[SEED_CLIENTS.findIndex((c) => c.email === email)]!.email;

const SUR_QUOTES: SeedQuote[] = SEED_QUOTES.map((q) => ({
  ...q,
  clientEmail: surClientEmail(q.clientEmail),
  eventDate: shiftDate(q.eventDate, 17),
  createdAt: shiftDate(q.createdAt, 9),
  lines: q.lines.map((l) => ({ ...l, productName: surProduct(l.productName) })),
}));

export const DEMO_TENANTS: DemoProfile[] = [
  {
    slug: 'demo-norte',
    name: 'Demo Norte',
    users: demoUsers('norte.demo', 'Norte'),
    sharedUserRole: 'operator',
    clients: SEED_CLIENTS,
    staff: SEED_STAFF,
    catalog: SEED_CATALOG,
    quotes: SEED_QUOTES,
    appSettings: {},
    stageOverrides: [{ stageId: QUOTE_STAGE.QUOTED, label: 'Enviada al cliente' }],
    preferences: { timeFormat: '12h' },
  },
  {
    slug: 'demo-sur',
    name: 'Demo Sur',
    users: demoUsers('sur.demo', 'Sur'),
    sharedUserRole: 'member',
    clients: SUR_CLIENTS,
    staff: SUR_STAFF,
    catalog: SUR_CATALOG,
    quotes: SUR_QUOTES,
    appSettings: { depositRate: 0.4, quoteSeqStart: 1001 },
    stageOverrides: [
      { stageId: QUOTE_STAGE.PENDING, label: 'Borrador', color: '#13c2c2' },
      { stageId: QUOTE_STAGE.CANCELLED, label: 'Perdida' },
    ],
    preferences: { timeFormat: '24h' },
  },
];

export async function ensureOrganization(slug: string, name: string): Promise<string> {
  const existing = await new TenancyRepository().findBySlug(slug);
  if (existing) return existing.id;
  const id = randomUUID();
  await db.insert(organization).values({ id, slug, name, createdAt: new Date() });
  return id;
}

// Full demo data set for one tenant. Idempotent: every step skips what already exists.
export async function seedDemoTenant(tenantId: string, profile: DemoProfile) {
  console.log(`🏢 Demo para ${profile.slug}...`);
  const admin = profile.users.find((u) => u.role === 'admin')!.email;
  await seedTenantDefaults(tenantId, db, {
    catalog: profile.catalog,
    appSettings: profile.appSettings,
  });
  await seedQuoteStageSettings(tenantId, profile.stageOverrides);
  await seedUsers(tenantId, profile.users);
  await seedClients(tenantId, profile.clients);
  await seedStaff(tenantId, profile.staff);
  await seedQuotes(tenantId, {
    quotes: profile.quotes,
    creatorEmail: admin,
    assigneeEmails: profile.users.filter((u) => u.role !== 'superadmin').map((u) => u.email),
  });
  await seedEvents(tenantId);
  await seedEventPayments(tenantId, admin);
  await seedEventActivity(tenantId, {
    actorEmail: admin,
    readerEmails: profile.users.map((u) => u.email),
    preferences: profile.preferences,
    reschedules: 2,
  });
}

// `--demo=local`: the two demo tenants, a platform admin without membership and one account
// that belongs to both tenants. The shared account's global role is the one of the first tenant,
// because authorization reads the global `user.role`.
export async function seedDemoLocal() {
  await seedQuoteStages();
  for (const profile of DEMO_TENANTS) {
    const tenantId = await ensureOrganization(profile.slug, profile.name);
    await seedDemoTenant(tenantId, profile);
  }

  await ensureAccount(
    { name: 'Plataforma Demo', email: DEMO_PLATFORM_ADMIN_EMAIL, role: 'superadmin' },
    { isPlatformAdmin: true },
  );

  const first = DEMO_TENANTS[0]!;
  const shared = await ensureAccount({
    name: 'Usuario Compartido',
    email: DEMO_SHARED_USER_EMAIL,
    role: first.sharedUserRole,
  });
  for (const profile of DEMO_TENANTS) {
    const tenantId = await ensureOrganization(profile.slug, profile.name);
    await ensureMembership(shared.id, tenantId, profile.sharedUserRole);
  }
}

// `--demo=local --tenant=<slug>`: the demo of the first profile into an existing tenant.
export async function seedDemoIntoTenant(slug: string) {
  const org = await new TenancyRepository().findBySlug(slug);
  if (!org) throw new Error(`Tenant "${slug}" does not exist`);
  await seedQuoteStages();
  const profile = DEMO_TENANTS.find((p) => p.slug === org.slug) ?? DEMO_TENANTS[0]!;
  const domain = `${org.slug}.demo`;
  await seedDemoTenant(org.id, {
    ...profile,
    users: profile.users.map((u) => ({ ...u, email: `${u.email.split('@')[0]}@${domain}` })),
  });
}
