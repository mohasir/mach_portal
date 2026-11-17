import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import {
  computeQuoteTotals,
  QUOTE_STAGE,
  type DiscountType,
  type QuoteStageId,
} from '@repo/schemas';
import { db as defaultDb, type Executor } from '../index';
import {
  chargeTypes,
  quoteCharges,
  quotes,
  quoteLines,
  quoteLineOptions,
  quoteStageHistory,
  quoteAssignmentHistory,
  clients,
  eventTypes,
  products,
  productPriceTiers,
  optionGroups,
  options,
  appSettings,
  user,
} from '../schema';

export interface SeedSelection {
  groupLabel: string;
  optionNames: string[];
}

export interface SeedLine {
  productName: string;
  quantity: number;
  selections?: SeedSelection[];
}

export interface SeedCharge {
  chargeTypeName: string;
  // Omitted: the type's default value.
  value?: number;
}

export interface SeedQuote {
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
  charges?: SeedCharge[];
  // Backdates `createdAt` (defaults to "now" otherwise) so quotes spread across the
  // year instead of bunching into whichever day the seed happened to run — needed for
  // dashboard.quotesByMonth/closeRate to show a real distribution, not one spike.
  createdAt?: string;
}

export const SEED_QUOTES: SeedQuote[] = [
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
        productName: 'Paquete Esencial',
        quantity: 70,
        selections: [
          {
            groupLabel: 'Acabados',
            optionNames: ['Mate', 'Liso', 'Rústico'],
          },
          { groupLabel: 'Colores', optionNames: ['Negro', 'Blanco'] },
        ],
      },
      {
        productName: 'Servicio Premium',
        quantity: 70,
        selections: [
          {
            groupLabel: 'Modalidades',
            optionNames: ['Diagnóstico', 'Auditoría', 'Mantenimiento'],
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
    charges: [{ chargeTypeName: 'Traslado' }],
    lines: [
      {
        productName: 'Paquete Plus',
        quantity: 100,
        selections: [
          {
            groupLabel: 'Acabados',
            optionNames: ['Metalizado', 'Pulido', 'Liso'],
          },
          { groupLabel: 'Colores', optionNames: ['Azul', 'Verde'] },
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
    charges: [
      { chargeTypeName: 'Traslado', value: 7500 },
      { chargeTypeName: 'Recargo por pago con tarjeta' },
    ],
    lines: [
      {
        productName: 'Kit Básico',
        quantity: 60,
        selections: [{ groupLabel: 'Variante', optionNames: ['Compacta', 'Ligera'] }],
      },
      {
        productName: 'Colección Urbana',
        quantity: 60,
        selections: [
          { groupLabel: 'Bases', optionNames: ['Moderna', 'Minimalista', 'Industrial'] },
          { groupLabel: 'Detalles', optionNames: ['Etiqueta', 'Costuras'] },
          { groupLabel: 'Materiales', optionNames: ['Nailon', 'Lona'] },
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
        productName: 'Paquete Compacto',
        quantity: 40,
        selections: [{ groupLabel: 'Acabados', optionNames: ['Brillante', 'Satinado'] }],
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
        productName: 'Colección Natural',
        quantity: 50,
        selections: [
          { groupLabel: 'Materiales', optionNames: ['Algodón', 'Cerámica', 'Bambú'] },
          { groupLabel: 'Formato', optionNames: ['Grande'] },
        ],
      },
      {
        productName: 'Colección Clásica',
        quantity: 50,
        selections: [
          { groupLabel: 'Detalles', optionNames: ['Bolsillo', 'Cierre'] },
          { groupLabel: 'Materiales', optionNames: ['Lona'] },
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
        productName: 'Paquete Esencial',
        quantity: 150,
        selections: [
          { groupLabel: 'Acabados', optionNames: ['Nacarado', 'Pulido'] },
          { groupLabel: 'Colores', optionNames: ['Negro', 'Azul'] },
        ],
      },
      {
        productName: 'Paquete Plus',
        quantity: 150,
        selections: [{ groupLabel: 'Acabados', optionNames: ['Rústico', 'Envejecido'] }],
      },
      {
        productName: 'Servicio Premium',
        quantity: 150,
        selections: [
          {
            groupLabel: 'Modalidades',
            optionNames: ['Capacitación', 'Optimización', 'Implementación'],
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
        productName: 'Kit Completo',
        quantity: 40,
        selections: [{ groupLabel: 'Elige la base', optionNames: ['Base ligera'] }],
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
        productName: 'Kit Básico',
        quantity: 60,
        selections: [{ groupLabel: 'Variante', optionNames: ['Compacta'] }],
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
        productName: 'Colección Urbana',
        quantity: 60,
        selections: [
          { groupLabel: 'Bases', optionNames: ['Moderna', 'Minimalista'] },
          { groupLabel: 'Detalles', optionNames: ['Etiqueta'] },
          { groupLabel: 'Materiales', optionNames: ['Nailon'] },
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
        productName: 'Colección Urbana',
        quantity: 60,
        selections: [
          { groupLabel: 'Bases', optionNames: ['Industrial', 'Minimalista'] },
          { groupLabel: 'Detalles', optionNames: ['Costuras'] },
          { groupLabel: 'Materiales', optionNames: ['Lona'] },
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
        productName: 'Colección Urbana',
        quantity: 60,
        selections: [
          { groupLabel: 'Bases', optionNames: ['Moderna'] },
          { groupLabel: 'Detalles', optionNames: ['Etiqueta', 'Costuras'] },
          { groupLabel: 'Materiales', optionNames: ['Nailon', 'Lona'] },
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
        productName: 'Paquete Compacto',
        quantity: 40,
        selections: [{ groupLabel: 'Acabados', optionNames: ['Brillante', 'Satinado'] }],
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
        productName: 'Colección Natural',
        quantity: 50,
        selections: [
          { groupLabel: 'Materiales', optionNames: ['Algodón', 'Cerámica'] },
          { groupLabel: 'Formato', optionNames: ['Grande'] },
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
        productName: 'Kit Completo',
        quantity: 40,
        selections: [{ groupLabel: 'Elige la base', optionNames: ['Base ligera'] }],
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
        productName: 'Servicio Estándar',
        quantity: 50,
        selections: [
          { groupLabel: 'Complementos', optionNames: ['Auditoría', 'Consultoría'] },
          { groupLabel: 'Modalidad', optionNames: ['Remoto'] },
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
        productName: 'Colección Clásica',
        quantity: 60,
        selections: [
          { groupLabel: 'Detalles', optionNames: ['Ojales', 'Flecos'] },
          { groupLabel: 'Materiales', optionNames: ['Cuero', 'Algodón'] },
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
        productName: 'Colección Natural',
        quantity: 40,
        selections: [
          { groupLabel: 'Materiales', optionNames: ['Algodón', 'Cuero'] },
          { groupLabel: 'Formato', optionNames: ['Pequeño'] },
        ],
      },
      {
        productName: 'Paquete Compacto',
        quantity: 40,
        selections: [{ groupLabel: 'Acabados', optionNames: ['Rústico', 'Liso'] }],
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
        productName: 'Colección Urbana',
        quantity: 70,
        selections: [
          { groupLabel: 'Bases', optionNames: ['Moderna', 'Vintage'] },
          { groupLabel: 'Detalles', optionNames: ['Costuras', 'Grabado'] },
          { groupLabel: 'Materiales', optionNames: ['Nailon'] },
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
        productName: 'Paquete Esencial',
        quantity: 90,
        selections: [
          { groupLabel: 'Acabados', optionNames: ['Nacarado', 'Rústico'] },
          { groupLabel: 'Colores', optionNames: ['Negro', 'Verde'] },
        ],
      },
      {
        productName: 'Servicio Premium',
        quantity: 100,
        selections: [
          {
            groupLabel: 'Modalidades',
            optionNames: ['Diagnóstico', 'Optimización', 'Implementación'],
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
        productName: 'Kit Completo',
        quantity: 60,
        selections: [{ groupLabel: 'Elige la base', optionNames: ['Base ligera', 'Base modular'] }],
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
        productName: 'Paquete Plus',
        quantity: 50,
        selections: [
          { groupLabel: 'Acabados', optionNames: ['Metalizado', 'Rústico'] },
          { groupLabel: 'Colores', optionNames: ['Blanco'] },
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
        productName: 'Kit Básico',
        quantity: 40,
        selections: [{ groupLabel: 'Variante', optionNames: ['Estándar'] }],
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
        productName: 'Colección Clásica',
        quantity: 40,
        selections: [
          { groupLabel: 'Detalles', optionNames: ['Bolsillo'] },
          { groupLabel: 'Materiales', optionNames: ['Lona'] },
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
        productName: 'Servicio Estándar',
        quantity: 60,
        selections: [
          { groupLabel: 'Complementos', optionNames: ['Certificación', 'Documentación'] },
          { groupLabel: 'Modalidad', optionNames: ['Presencial'] },
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
        productName: 'Paquete Compacto',
        quantity: 30,
        selections: [{ groupLabel: 'Acabados', optionNames: ['Mate'] }],
      },
    ],
  },
];

export interface SeedQuotesOptions {
  quotes?: SeedQuote[];
  creatorEmail: string;
  // Rotated over the quotes as assignees, each with one assignment history row.
  assigneeEmails?: string[];
}

async function loadContext(
  db: Executor,
  tenantId: string,
  creatorEmail: string,
  assigneeEmails: string[],
) {
  const [
    clientRows,
    eventTypeRows,
    productRows,
    tierRows,
    groupRows,
    optionRows,
    chargeTypeRows,
    appRow,
    creator,
    assignees,
  ] = await Promise.all([
    db
      .select({ id: clients.id, email: clients.email, state: clients.state })
      .from(clients)
      .where(eq(clients.tenantId, tenantId)),
    db
      .select({ id: eventTypes.id, name: eventTypes.name })
      .from(eventTypes)
      .where(eq(eventTypes.tenantId, tenantId)),
    db
      .select({
        id: products.id,
        name: products.name,
        uomId: products.uomId,
        taxRate: products.taxRate,
        taxExempt: products.taxExempt,
      })
      .from(products)
      .where(eq(products.tenantId, tenantId)),
    db
      .select({
        productId: productPriceTiers.productId,
        quantity: productPriceTiers.quantity,
        price: productPriceTiers.price,
      })
      .from(productPriceTiers)
      .where(eq(productPriceTiers.tenantId, tenantId)),
    db
      .select({ id: optionGroups.id, productId: optionGroups.productId, label: optionGroups.label })
      .from(optionGroups)
      .where(eq(optionGroups.tenantId, tenantId)),
    db
      .select({ id: options.id, optionGroupId: options.optionGroupId, name: options.name })
      .from(options)
      .where(eq(options.tenantId, tenantId)),
    db
      .select({
        id: chargeTypes.id,
        name: chargeTypes.name,
        kind: chargeTypes.kind,
        defaultValue: chargeTypes.defaultValue,
      })
      .from(chargeTypes)
      .where(eq(chargeTypes.tenantId, tenantId)),
    db
      .select({
        depositRate: appSettings.depositRate,
        quoteValidityMonths: appSettings.quoteValidityMonths,
        quoteSeqStart: appSettings.quoteSeqStart,
      })
      .from(appSettings)
      .where(eq(appSettings.tenantId, tenantId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, creatorEmail))
      .limit(1)
      .then((r) => r[0]),
    assigneeEmails.length > 0
      ? db
          .select({ id: user.id, email: user.email })
          .from(user)
          .where(inArray(user.email, assigneeEmails))
      : Promise.resolve([]),
  ]);

  return {
    clientRows,
    eventTypeRows,
    productRows,
    tierRows,
    groupRows,
    optionRows,
    chargeTypeRows,
    appRow,
    creator,
    assigneeIds: assigneeEmails
      .map((email) => assignees.find((a) => a.email === email)?.id)
      .filter((id): id is string => id !== undefined),
  };
}

type Context = Awaited<ReturnType<typeof loadContext>>;

function resolveCharge(charge: SeedCharge, ctx: Context) {
  const type = ctx.chargeTypeRows.find((t) => t.name === charge.chargeTypeName);
  if (!type) throw new Error(`seedQuotes: cargo "${charge.chargeTypeName}" no existe`);
  return {
    chargeTypeId: type.id,
    name: type.name,
    kind: type.kind,
    value: charge.value ?? type.defaultValue,
  };
}

function resolveLine(line: SeedLine, ctx: Context) {
  const product = ctx.productRows.find((p) => p.name === line.productName);
  if (!product) throw new Error(`seedQuotes: producto "${line.productName}" no existe`);

  const tier = ctx.tierRows.find((t) => t.productId === product.id && t.quantity === line.quantity);
  if (!tier)
    throw new Error(
      `seedQuotes: "${line.productName}" no tiene paquete para ${line.quantity} unidades`,
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

  return {
    productId: product.id,
    uomId: product.uomId,
    quantity: line.quantity,
    subtotal: tier.price,
    taxRate: product.taxExempt ? 0 : product.taxRate,
    selections,
  };
}

export async function seedQuotes(
  tenantId: string,
  opts: SeedQuotesOptions,
  db: Executor = defaultDb,
) {
  console.log('🧾 Seeding cotizaciones...');
  const ctx = await loadContext(db, tenantId, opts.creatorEmail, opts.assigneeEmails ?? []);
  if (!ctx.appRow) {
    console.log('  ⏭️  app_settings no está seedeado, salteando cotizaciones');
    return;
  }
  if (!ctx.creator) {
    console.log(`  ⏭️  usuario "${opts.creatorEmail}" no existe, salteando cotizaciones`);
    return;
  }
  const appRow = ctx.appRow;
  const creatorId = ctx.creator.id;

  for (const [index, seed] of (opts.quotes ?? SEED_QUOTES).entries()) {
    const client = ctx.clientRows.find((c) => c.email === seed.clientEmail);
    if (!client) {
      console.log(`  ⏭️  cliente "${seed.clientEmail}" no existe, salteando`);
      continue;
    }

    // Seq and number derive from the seed itself (not from "today") so a re-run finds them.
    const seq = appRow.quoteSeqStart + index;
    const issuedAt = seed.createdAt ? new Date(`${seed.createdAt}T09:00:00Z`) : new Date();
    const number = `QUO${issuedAt.toISOString().slice(0, 10).replace(/-/g, '')}-${String(seq).padStart(6, '0')}`;

    const [existing] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.tenantId, tenantId), eq(quotes.seq, seq)))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${number} ya existe, salteando`);
      continue;
    }

    const eventTypeId = seed.eventTypeName
      ? (ctx.eventTypeRows.find((e) => e.name === seed.eventTypeName)?.id ?? null)
      : null;
    const lines = seed.lines.map((l) => resolveLine(l, ctx));
    const charges = (seed.charges ?? []).map((c) => resolveCharge(c, ctx));
    const {
      lines: lineTotals,
      taxBreakdown: _breakdown,
      charges: chargeTotals,
      ...totals
    } = computeQuoteTotals({
      lines,
      discountType: seed.discountType,
      discountValue: seed.discountValue,
      charges,
      depositRate: appRow.depositRate,
    });

    const validUntil = new Date(issuedAt);
    validUntil.setMonth(validUntil.getMonth() + appRow.quoteValidityMonths);
    const assignedToId =
      ctx.assigneeIds.length > 0 ? ctx.assigneeIds[index % ctx.assigneeIds.length]! : null;

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
        assignedToId,
        ...(seed.createdAt ? { createdAt: issuedAt } : {}),
        ...totals,
        tenantId,
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
        tenantId,
      },
    ];
    if (seed.stageId !== QUOTE_STAGE.PENDING) {
      historyRows.push({
        quoteId: quote!.id,
        fromStageId: QUOTE_STAGE.PENDING,
        toStageId: seed.stageId,
        changedById: creatorId,
        tenantId,
      });
    }
    await db.insert(quoteStageHistory).values(historyRows);

    if (assignedToId) {
      await db.insert(quoteAssignmentHistory).values({
        quoteId: quote!.id,
        fromUserId: null,
        toUserId: assignedToId,
        changedById: creatorId,
        tenantId,
      });
    }

    if (lines.length > 0) {
      const lineRows = lines.map((line, i) => ({
        id: randomUUID(),
        quoteId: quote!.id,
        productId: line.productId,
        uomId: line.uomId,
        quantity: line.quantity,
        subtotal: line.subtotal,
        taxRate: line.taxRate,
        taxAmount: lineTotals[i]!.taxAmount,
        sortOrder: i,
        tenantId,
      }));
      await db.insert(quoteLines).values(lineRows);

      const optionRows = lines.flatMap((line, i) =>
        line.selections.flatMap((sel) =>
          sel.optionIds.map((optionId) => ({
            quoteLineId: lineRows[i]!.id,
            optionId,
            optionGroupId: sel.optionGroupId,
            tenantId,
          })),
        ),
      );
      if (optionRows.length > 0) await db.insert(quoteLineOptions).values(optionRows);
    }

    if (charges.length > 0) {
      await db.insert(quoteCharges).values(
        charges.map((charge, i) => ({
          ...charge,
          quoteId: quote!.id,
          amount: chargeTotals[i]!.amount,
          sortOrder: i,
          tenantId,
        })),
      );
    }

    console.log(
      `  ✅ ${number} — ${seed.clientEmail} (stage ${seed.stageId}, ${lines.length} líneas)`,
    );
  }
}
