import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  computeQuoteTotals,
  QUOTE_STAGE,
  type DiscountType,
  type QuoteStageId,
} from '@repo/schemas';
import { db } from '../index';
import {
  quotes,
  quoteLines,
  quoteLineOptions,
  quoteStageHistory,
  clients,
  eventTypes,
  products,
  productPriceTiers,
  optionGroups,
  options,
  stateSettings,
  appSettings,
  user,
} from '../schema';

const SEED_CREATOR_EMAIL = 'samuel@admin.com';

interface SeedSelection {
  groupLabel: string;
  optionNames: string[];
}

interface SeedLine {
  productName: string;
  numPersons: number;
  selections?: SeedSelection[];
}

interface SeedQuote {
  clientEmail: string;
  eventTypeName?: string;
  eventDate?: string;
  eventTime?: string;
  address?: string;
  notes?: string;
  stageId: QuoteStageId;
  discountType?: DiscountType;
  discountValue?: number;
  lines: SeedLine[];
  // Backdates `createdAt` (defaults to "now" otherwise) so quotes spread across the
  // year instead of bunching into whichever day the seed happened to run — needed for
  // dashboard.quotesByMonth/closeRate to show a real distribution, not one spike.
  createdAt?: string;
}

const SEED_QUOTES: SeedQuote[] = [
  {
    clientEmail: 'laura.jimenez@example.com',
    eventTypeName: 'Boda',
    eventDate: '2026-09-12',
    eventTime: '18:00',
    address: '145 W 57th St, Apt 12B',
    stageId: QUOTE_STAGE.PENDING,
    createdAt: '2026-08-10',
    lines: [
      {
        productName: 'Crepes',
        numPersons: 70,
        selections: [
          {
            groupLabel: 'Premium Toppings',
            optionNames: ['Lotus Biscoff', 'Crushed Oreo', 'Sprinkles'],
          },
          { groupLabel: 'Fresh Fruits', optionNames: ['Strawberry', 'Banana'] },
        ],
      },
      {
        productName: 'Craft Bar',
        numPersons: 70,
        selections: [
          {
            groupLabel: 'Signature Cocktails',
            optionNames: ['Paloma', 'Mango Tango', 'Passion Mojito'],
          },
        ],
      },
    ],
  },
  {
    clientEmail: 'marcus.bennett@example.com',
    eventTypeName: 'Cumpleaños',
    eventDate: '2026-08-02',
    eventTime: '15:00',
    address: '88 Morgan St',
    stageId: QUOTE_STAGE.QUOTED,
    discountType: 'percent',
    discountValue: 0.1,
    createdAt: '2026-06-20',
    lines: [
      {
        productName: 'Mini Pancakes',
        numPersons: 100,
        selections: [
          {
            groupLabel: 'Premium Toppings',
            optionNames: ["M&M's", 'White Chocolate', 'Crushed Oreo'],
          },
          { groupLabel: 'Fresh Fruits', optionNames: ['Blueberry', 'Raspberry'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'priya.nair@example.com',
    eventTypeName: 'Corporativo',
    eventDate: '2026-07-28',
    eventTime: '12:00',
    address: '1 Landmark Sq, Stamford',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-06-01',
    lines: [
      {
        productName: 'Esquites',
        numPersons: 60,
        selections: [{ groupLabel: 'Base Chip', optionNames: ['Doritos Nacho Cheese', 'Ruffles'] }],
      },
      {
        productName: 'Snack Station',
        numPersons: 60,
        selections: [
          { groupLabel: 'Base Chips', optionNames: ['Nacho Cheese', 'Cool Ranch', "Flamin' Hot"] },
          { groupLabel: 'Toppings', optionNames: ['Peanuts', 'Gummy Bears'] },
          { groupLabel: 'Fruits', optionNames: ['Pineapple', 'Watermelon'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'diego.fernandez@example.com',
    eventTypeName: 'Graduación',
    eventDate: '2026-06-20',
    address: '210 Bedford Ave',
    stageId: QUOTE_STAGE.CANCELLED,
    createdAt: '2026-05-10',
    lines: [
      {
        productName: 'Crepaletas',
        numPersons: 40,
        selections: [
          { groupLabel: 'Premium Toppings', optionNames: ['Chopped Peanuts', 'Coconut Flakes'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'emily.carter@example.com',
    eventTypeName: 'Baby Shower',
    eventDate: '2026-09-05',
    eventTime: '11:00',
    address: '1 Palmer Sq, Princeton',
    stageId: QUOTE_STAGE.QUOTED,
    discountType: 'fixed',
    discountValue: 5000,
    createdAt: '2026-08-01',
    lines: [
      {
        productName: 'Fruit Station',
        numPersons: 50,
        selections: [
          { groupLabel: 'Fresh Fruits', optionNames: ['Mango', 'Watermelon', 'Strawberry'] },
          { groupLabel: 'Yogurt', optionNames: ['Vanilla Yogurt'] },
        ],
      },
      {
        productName: 'Popsicles',
        numPersons: 50,
        selections: [
          { groupLabel: 'Toppings', optionNames: ['Sprinkles', "M&M's"] },
          { groupLabel: 'Fruits', optionNames: ['Strawberries'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'sofia.ramirez@example.com',
    eventTypeName: 'Aniversario',
    stageId: QUOTE_STAGE.PENDING,
    createdAt: '2026-08-11',
    lines: [], // borrador vacío — cubre el caso de 0 líneas (D16/createQuoteSchema)
  },
  {
    clientEmail: 'james.oconnor@example.com',
    eventTypeName: 'Boda',
    eventDate: '2026-10-17',
    eventTime: '17:30',
    address: '35-30 Vernon Blvd, Queens',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-07-15',
    lines: [
      {
        productName: 'Crepes',
        numPersons: 150,
        selections: [
          { groupLabel: 'Premium Toppings', optionNames: ['Mazapan', 'White Chocolate'] },
          { groupLabel: 'Fresh Fruits', optionNames: ['Strawberry', 'Blueberry'] },
        ],
      },
      {
        productName: 'Mini Pancakes',
        numPersons: 150,
        selections: [
          { groupLabel: 'Premium Toppings', optionNames: ['Sprinkles', 'Coffee Chocolate'] },
        ],
      },
      {
        productName: 'Craft Bar',
        numPersons: 150,
        selections: [
          {
            groupLabel: 'Signature Cocktails',
            optionNames: ['Spicy Margarita', 'Mezcal Mule', 'Beach Breeze'],
          },
        ],
      },
    ],
  },
  {
    clientEmail: 'hannah.weiss@example.com',
    eventTypeName: 'Aniversario',
    eventDate: '2026-05-30',
    address: '400 Washington St',
    stageId: QUOTE_STAGE.CANCELLED,
    createdAt: '2026-04-20',
    lines: [
      {
        productName: 'Nachos',
        numPersons: 40,
        selections: [{ groupLabel: 'Choose Your Base', optionNames: ['Tortilla Chips'] }],
      },
    ],
  },
  // Confirmadas extra — dan varios eventos+pagos de prueba (seedEventPayments) repartidos en
  // meses distintos (y uno en 2025) para probar filtros/agrupación por semana-mes-año de Pagos.
  {
    clientEmail: 'tomas.alvarez@example.com',
    eventTypeName: 'Corporativo',
    eventDate: '2026-02-10',
    eventTime: '13:00',
    address: '10 Fairfield Ave, Bridgeport',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-01-20',
    lines: [
      {
        productName: 'Esquites',
        numPersons: 60,
        selections: [{ groupLabel: 'Base Chip', optionNames: ['Doritos Nacho Cheese'] }],
      },
    ],
  },
  {
    clientEmail: 'rachel.kim@example.com',
    eventTypeName: 'Corporativo',
    eventDate: '2026-01-15',
    eventTime: '12:30',
    address: '200 Park Ave',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-01-02',
    lines: [
      {
        productName: 'Snack Station',
        numPersons: 60,
        selections: [
          { groupLabel: 'Base Chips', optionNames: ['Nacho Cheese', 'Cool Ranch'] },
          { groupLabel: 'Toppings', optionNames: ['Peanuts'] },
          { groupLabel: 'Fruits', optionNames: ['Pineapple'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'rachel.kim@example.com',
    eventTypeName: 'Corporativo',
    eventDate: '2026-04-16',
    eventTime: '12:30',
    address: '200 Park Ave',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-03-01',
    lines: [
      {
        productName: 'Snack Station',
        numPersons: 60,
        selections: [
          { groupLabel: 'Base Chips', optionNames: ["Flamin' Hot", 'Cool Ranch'] },
          { groupLabel: 'Toppings', optionNames: ['Gummy Bears'] },
          { groupLabel: 'Fruits', optionNames: ['Watermelon'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'rachel.kim@example.com',
    eventTypeName: 'Corporativo',
    eventDate: '2026-07-15',
    eventTime: '12:30',
    address: '200 Park Ave',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-06-10',
    lines: [
      {
        productName: 'Snack Station',
        numPersons: 60,
        selections: [
          { groupLabel: 'Base Chips', optionNames: ['Nacho Cheese'] },
          { groupLabel: 'Toppings', optionNames: ['Peanuts', 'Gummy Bears'] },
          { groupLabel: 'Fruits', optionNames: ['Pineapple', 'Watermelon'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'diego.fernandez@example.com',
    eventTypeName: 'Cumpleaños',
    eventDate: '2026-05-22',
    eventTime: '16:00',
    address: '210 Bedford Ave',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-04-25',
    lines: [
      {
        productName: 'Crepaletas',
        numPersons: 40,
        selections: [
          { groupLabel: 'Premium Toppings', optionNames: ['Chopped Peanuts', 'Coconut Flakes'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'emily.carter@example.com',
    eventTypeName: 'Corporativo',
    eventDate: '2026-11-20',
    eventTime: '12:00',
    address: '1 Palmer Sq, Princeton',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-08-05',
    lines: [
      {
        productName: 'Fruit Station',
        numPersons: 50,
        selections: [
          { groupLabel: 'Fresh Fruits', optionNames: ['Mango', 'Watermelon'] },
          { groupLabel: 'Yogurt', optionNames: ['Vanilla Yogurt'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'marcus.bennett@example.com',
    eventTypeName: 'Aniversario',
    eventDate: '2025-12-05',
    eventTime: '19:00',
    address: '88 Morgan St',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2025-11-01',
    lines: [
      {
        productName: 'Nachos',
        numPersons: 40,
        selections: [{ groupLabel: 'Choose Your Base', optionNames: ['Tortilla Chips'] }],
      },
    ],
  },
  // Tanda 2 — rellena los meses del año que quedaban sin cotizaciones (marzo/junio/agosto/
  // septiembre/diciembre) y da createdAt repartido ene-ago 2026, para que el dashboard
  // (summary/quotesByMonth/topProducts) tenga datos reales en cualquier mes que se mire, no
  // solo en el mes en que se corrió el seed.
  {
    clientEmail: 'laura.jimenez@example.com',
    eventTypeName: 'Corporativo',
    eventDate: '2026-03-14',
    eventTime: '10:00',
    address: '145 W 57th St, Apt 12B',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-02-10',
    lines: [
      {
        productName: 'Hot Chocolate',
        numPersons: 50,
        selections: [
          { groupLabel: 'Premium Toppings', optionNames: ['Crushed Oreo', 'Mini Marshmallows'] },
          { groupLabel: 'Cookie', optionNames: ['Classic Cookie'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'hannah.weiss@example.com',
    eventTypeName: 'Cumpleaños',
    eventDate: '2026-06-06',
    eventTime: '14:00',
    address: '400 Washington St',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-05-01',
    lines: [
      {
        productName: 'Popsicles',
        numPersons: 60,
        selections: [
          { groupLabel: 'Toppings', optionNames: ['Oreo', 'White Chocolate'] },
          { groupLabel: 'Fruits', optionNames: ['Mango', 'Watermelon'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'sofia.ramirez@example.com',
    eventTypeName: 'Baby Shower',
    eventDate: '2026-08-03',
    eventTime: '11:00',
    address: '9 Nassau St, Princeton',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-06-25',
    lines: [
      {
        productName: 'Fruit Station',
        numPersons: 40,
        selections: [
          { groupLabel: 'Fresh Fruits', optionNames: ['Mango', 'Pineapple'] },
          { groupLabel: 'Yogurt', optionNames: ['Strawberry Yogurt'] },
        ],
      },
      {
        productName: 'Crepaletas',
        numPersons: 40,
        selections: [
          { groupLabel: 'Premium Toppings', optionNames: ['Sprinkles', 'Crushed Oreo'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'james.oconnor@example.com',
    eventTypeName: 'Cumpleaños',
    eventDate: '2026-08-28',
    eventTime: '17:00',
    address: '35-30 Vernon Blvd, Queens',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-07-20',
    lines: [
      {
        productName: 'Snack Station',
        numPersons: 70,
        selections: [
          { groupLabel: 'Base Chips', optionNames: ['Nacho Cheese', 'Ruffles'] },
          { groupLabel: 'Toppings', optionNames: ['Gummy Bears', 'Nerds'] },
          { groupLabel: 'Fruits', optionNames: ['Pineapple'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'priya.nair@example.com',
    eventTypeName: 'Boda',
    eventDate: '2026-09-18',
    eventTime: '18:30',
    address: '1 Landmark Sq, Stamford',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-08-02',
    lines: [
      {
        productName: 'Crepes',
        numPersons: 90,
        selections: [
          { groupLabel: 'Premium Toppings', optionNames: ['Mazapan', 'Sprinkles'] },
          { groupLabel: 'Fresh Fruits', optionNames: ['Strawberry', 'Raspberry'] },
        ],
      },
      {
        productName: 'Craft Bar',
        numPersons: 100,
        selections: [
          {
            groupLabel: 'Signature Cocktails',
            optionNames: ['Paloma', 'Mezcal Mule', 'Beach Breeze'],
          },
        ],
      },
    ],
  },
  {
    clientEmail: 'diego.fernandez@example.com',
    eventTypeName: 'Graduación',
    eventDate: '2026-12-12',
    eventTime: '13:00',
    address: '210 Bedford Ave',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-08-08',
    lines: [
      {
        productName: 'Nachos',
        numPersons: 60,
        selections: [
          { groupLabel: 'Choose Your Base', optionNames: ['Tortilla Chips', 'Ruffles'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'emily.carter@example.com',
    eventTypeName: 'Graduación',
    eventDate: '2026-09-30',
    eventTime: '15:00',
    address: '1 Palmer Sq, Princeton',
    stageId: QUOTE_STAGE.QUOTED,
    createdAt: '2026-08-09',
    lines: [
      {
        productName: 'Mini Pancakes',
        numPersons: 50,
        selections: [
          { groupLabel: 'Premium Toppings', optionNames: ["M&M's", 'Sprinkles'] },
          { groupLabel: 'Fresh Fruits', optionNames: ['Banana'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'tomas.alvarez@example.com',
    eventTypeName: 'Otro',
    eventDate: '2026-10-05',
    eventTime: '12:00',
    address: '10 Fairfield Ave, Bridgeport',
    stageId: QUOTE_STAGE.PENDING,
    createdAt: '2026-08-12',
    lines: [
      {
        productName: 'Esquites',
        numPersons: 40,
        selections: [{ groupLabel: 'Base Chip', optionNames: ['Cool Ranch'] }],
      },
    ],
  },
  {
    clientEmail: 'james.oconnor@example.com',
    eventTypeName: 'Baby Shower',
    eventDate: '2026-03-20',
    address: '35-30 Vernon Blvd, Queens',
    stageId: QUOTE_STAGE.CANCELLED,
    createdAt: '2026-02-15',
    lines: [
      {
        productName: 'Popsicles',
        numPersons: 40,
        selections: [
          { groupLabel: 'Toppings', optionNames: ['Sprinkles'] },
          { groupLabel: 'Fruits', optionNames: ['Strawberries'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'hannah.weiss@example.com',
    eventTypeName: 'Corporativo',
    eventDate: '2026-06-25',
    eventTime: '12:00',
    address: '400 Washington St',
    stageId: QUOTE_STAGE.QUOTED,
    createdAt: '2026-05-20',
    lines: [
      {
        productName: 'Hot Chocolate',
        numPersons: 60,
        selections: [
          { groupLabel: 'Premium Toppings', optionNames: ['Almonds', 'Chocolate Chips'] },
          { groupLabel: 'Cookie', optionNames: ['Flamed Cookie with Toasted Marshmallows'] },
        ],
      },
    ],
  },
  {
    clientEmail: 'laura.jimenez@example.com',
    eventTypeName: 'Aniversario',
    eventDate: '2026-01-25',
    eventTime: '19:00',
    address: '145 W 57th St, Apt 12B',
    stageId: QUOTE_STAGE.CONFIRMED,
    createdAt: '2026-01-10',
    lines: [
      {
        productName: 'Crepaletas',
        numPersons: 30,
        selections: [{ groupLabel: 'Premium Toppings', optionNames: ['Lotus Biscoff'] }],
      },
    ],
  },
];

async function loadContext() {
  const [
    clientRows,
    eventTypeRows,
    productRows,
    tierRows,
    groupRows,
    optionRows,
    stateRows,
    appRow,
    creator,
  ] = await Promise.all([
    db.select({ id: clients.id, email: clients.email, state: clients.state }).from(clients),
    db.select({ id: eventTypes.id, name: eventTypes.name }).from(eventTypes),
    db.select({ id: products.id, name: products.name }).from(products),
    db
      .select({
        productId: productPriceTiers.productId,
        numPersons: productPriceTiers.numPersons,
        price: productPriceTiers.price,
      })
      .from(productPriceTiers),
    db
      .select({ id: optionGroups.id, productId: optionGroups.productId, label: optionGroups.label })
      .from(optionGroups),
    db
      .select({ id: options.id, optionGroupId: options.optionGroupId, name: options.name })
      .from(options),
    db.select({ state: stateSettings.state, taxRate: stateSettings.taxRate }).from(stateSettings),
    db
      .select({
        depositRate: appSettings.depositRate,
        quoteValidityMonths: appSettings.quoteValidityMonths,
        quoteSeqStart: appSettings.quoteSeqStart,
        applyTaxByState: appSettings.applyTaxByState,
        cardSurchargeRate: appSettings.cardSurchargeRate,
      })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, SEED_CREATOR_EMAIL))
      .limit(1)
      .then((r) => r[0]),
  ]);

  return {
    clientRows,
    eventTypeRows,
    productRows,
    tierRows,
    groupRows,
    optionRows,
    stateRows,
    appRow,
    creator,
  };
}

type Context = Awaited<ReturnType<typeof loadContext>>;

function resolveLine(line: SeedLine, ctx: Context) {
  const product = ctx.productRows.find((p) => p.name === line.productName);
  if (!product) throw new Error(`seedQuotes: producto "${line.productName}" no existe`);

  const tier = ctx.tierRows.find(
    (t) => t.productId === product.id && t.numPersons === line.numPersons,
  );
  if (!tier)
    throw new Error(
      `seedQuotes: "${line.productName}" no tiene tramo para ${line.numPersons} personas`,
    );

  const selections = (line.selections ?? []).map((sel) => {
    const group = ctx.groupRows.find(
      (g) => g.productId === product.id && g.label === sel.groupLabel,
    );
    if (!group)
      throw new Error(`seedQuotes: grupo "${sel.groupLabel}" no existe en "${line.productName}"`);

    const optionIds = sel.optionNames.map((name) => {
      const option = ctx.optionRows.find((o) => o.optionGroupId === group.id && o.name === name);
      if (!option) throw new Error(`seedQuotes: opción "${name}" no existe en "${sel.groupLabel}"`);
      return option.id;
    });
    return { optionGroupId: group.id, optionIds };
  });

  return { productId: product.id, numPersons: line.numPersons, subtotal: tier.price, selections };
}

export async function seedQuotes() {
  console.log('🧾 Seeding cotizaciones...');
  const ctx = await loadContext();
  if (!ctx.appRow) {
    console.log('  ⏭️  app_settings no está seedeado, salteando cotizaciones');
    return;
  }
  if (!ctx.creator) {
    console.log(`  ⏭️  usuario "${SEED_CREATOR_EMAIL}" no existe, salteando cotizaciones`);
    return;
  }
  const appRow = ctx.appRow;
  const creatorId = ctx.creator.id;

  for (const [index, seed] of SEED_QUOTES.entries()) {
    const client = ctx.clientRows.find((c) => c.email === seed.clientEmail);
    if (!client) {
      console.log(`  ⏭️  cliente "${seed.clientEmail}" no existe, salteando`);
      continue;
    }

    const now = new Date();
    const seq = appRow.quoteSeqStart + index;
    const number = `QUO${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(seq).padStart(6, '0')}`;

    const [existing] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.number, number))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${number} ya existe, salteando`);
      continue;
    }

    const eventTypeId = seed.eventTypeName
      ? (ctx.eventTypeRows.find((e) => e.name === seed.eventTypeName)?.id ?? null)
      : null;
    const taxRate = appRow.applyTaxByState
      ? (ctx.stateRows.find((s) => s.state === client.state)?.taxRate ?? 0)
      : 0;
    const depositRate = appRow.depositRate;

    const lines = seed.lines.map((l) => resolveLine(l, ctx));
    const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
    const longDistanceAmount = Math.round(subtotal * taxRate);
    const totals = computeQuoteTotals({
      lines: lines.map((l) => ({ subtotal: l.subtotal })),
      discountType: seed.discountType,
      discountValue: seed.discountValue,
      longDistanceAmount,
      taxRate,
      cardSurchargeRate: appRow.cardSurchargeRate,
      depositRate,
    });

    const validUntil = new Date(now);
    validUntil.setMonth(validUntil.getMonth() + appRow.quoteValidityMonths);

    const [quote] = await db
      .insert(quotes)
      .values({
        seq,
        number,
        clientId: client.id,
        eventTypeId,
        eventDate: seed.eventDate ?? null,
        eventTime: seed.eventTime ?? null,
        state: client.state,
        address: seed.address ?? null,
        notes: seed.notes ?? null,
        discountType: seed.discountType ?? null,
        discountValue: seed.discountValue ?? null,
        validUntil: validUntil.toISOString().slice(0, 10),
        stageId: seed.stageId,
        isDraft: seed.stageId === QUOTE_STAGE.PENDING,
        createdById: creatorId,
        ...(seed.createdAt ? { createdAt: new Date(`${seed.createdAt}T09:00:00Z`) } : {}),
        ...totals,
      })
      .returning({ id: quotes.id });

    // Simplified history: creation + (if applicable) one jump straight to the seeded stage —
    // doesn't replay every intermediate transition, just enough to populate "Historial" in the demo.
    const historyRows: (typeof quoteStageHistory.$inferInsert)[] = [
      {
        quoteId: quote!.id,
        fromStageId: null,
        toStageId: QUOTE_STAGE.PENDING,
        changedById: creatorId,
      },
    ];
    if (seed.stageId !== QUOTE_STAGE.PENDING) {
      historyRows.push({
        quoteId: quote!.id,
        fromStageId: QUOTE_STAGE.PENDING,
        toStageId: seed.stageId,
        changedById: creatorId,
      });
    }
    await db.insert(quoteStageHistory).values(historyRows);

    if (lines.length > 0) {
      const lineRows = lines.map((line, i) => ({
        id: randomUUID(),
        quoteId: quote!.id,
        productId: line.productId,
        numPersons: line.numPersons,
        subtotal: line.subtotal,
        sortOrder: i,
      }));
      await db.insert(quoteLines).values(lineRows);

      const optionRows = lines.flatMap((line, i) =>
        line.selections.flatMap((sel) =>
          sel.optionIds.map((optionId) => ({
            quoteLineId: lineRows[i]!.id,
            optionId,
            optionGroupId: sel.optionGroupId,
          })),
        ),
      );
      if (optionRows.length > 0) await db.insert(quoteLineOptions).values(optionRows);
    }

    console.log(
      `  ✅ ${number} — ${seed.clientEmail} (stage ${seed.stageId}, ${lines.length} líneas)`,
    );
  }
}
