import { and, eq, sql } from 'drizzle-orm';
import { DEFAULT_UNIT_CODE } from '@repo/schemas';
import { db } from '../index';
import {
  appSettings,
  options,
  optionGroups,
  productCategories,
  productPriceTiers,
  products,
  unitsOfMeasure,
} from '../schema';
import type { Executor } from '../index';

export interface SeedTier {
  quantity: number;
  price: number;
}

export interface SeedOption {
  name: string;
  description?: string;
}

export interface SeedGroup {
  label: string;
  selectionType: 'select' | 'included';
  maxSelect?: number;
  options: SeedOption[];
}

export interface SeedProduct {
  name: string;
  shortDescription: string;
  // Markdown.
  longDescription?: string;
  isPremium?: boolean;
  // Per-unit price in cents.
  price?: number;
  // Code of a unit the tenant already has (seedUnitsOfMeasure runs first); defaults to 'pers'.
  uomCode?: string;
  // Smallest quantity per quote line; defaults to the smallest tier, or 1 without tiers.
  minQuantity?: number;
  // Category name, created for the tenant when missing.
  category?: string;
  // Defaults to the tenant's default rate (seedConfig runs first).
  taxRate?: number;
  taxExempt?: boolean;
  tiers: SeedTier[];
  groups: SeedGroup[];
}

export const seedMinQuantity = (p: Pick<SeedProduct, 'minQuantity' | 'tiers'>): number =>
  p.minQuantity ?? (p.tiers.length > 0 ? Math.min(...p.tiers.map((t) => t.quantity)) : 1);

const SHARED_GROUPS: SeedGroup[] = [
  {
    label: 'Acabados',
    selectionType: 'select',
    maxSelect: 7,
    options: [
      { name: 'Mate' },
      { name: 'Brillante' },
      { name: 'Satinado' },
      { name: 'Texturizado' },
      { name: 'Metalizado' },
      { name: 'Rústico' },
      { name: 'Pulido' },
      { name: 'Envejecido' },
      { name: 'Liso' },
      { name: 'Nacarado' },
    ],
  },
  {
    label: 'Colores',
    selectionType: 'select',
    maxSelect: 2,
    options: [{ name: 'Blanco' }, { name: 'Negro' }, { name: 'Azul' }, { name: 'Verde' }],
  },
  {
    label: 'Accesorios incluidos',
    selectionType: 'included',
    options: [
      { name: 'Estuche' },
      { name: 'Manual de uso' },
      { name: 'Cable' },
      { name: 'Bolsa' },
      { name: 'Garantía extendida' },
    ],
  },
];

export const SEED_CATALOG: SeedProduct[] = [
  {
    name: 'Paquete Esencial',
    category: 'Paquetes',
    uomCode: 'pers',
    shortDescription: 'Paquete base con acabados, colores y accesorios a elección.',
    longDescription:
      '## Qué incluye\n\n- Acabados y colores a elección\n- Accesorios básicos\n- Entrega coordinada\n\n**Ideal** para proyectos de tamaño pequeño y mediano.',
    tiers: [
      { quantity: 30, price: 63000 },
      { quantity: 40, price: 67000 },
      { quantity: 50, price: 71000 },
      { quantity: 60, price: 75000 },
      { quantity: 70, price: 79000 },
      { quantity: 80, price: 83000 },
      { quantity: 90, price: 87000 },
      { quantity: 100, price: 91000 },
      { quantity: 120, price: 99000 },
      { quantity: 150, price: 112000 },
      { quantity: 250, price: 169000 },
    ],
    groups: SHARED_GROUPS,
  },
  {
    name: 'Paquete Plus',
    category: 'Paquetes',
    uomCode: 'pers',
    shortDescription: 'Paquete ampliado con más acabados y accesorios incluidos.',
    tiers: [
      { quantity: 30, price: 61000 },
      { quantity: 40, price: 65000 },
      { quantity: 50, price: 69000 },
      { quantity: 60, price: 73000 },
      { quantity: 70, price: 77000 },
      { quantity: 80, price: 81000 },
      { quantity: 90, price: 85000 },
      { quantity: 100, price: 89000 },
      { quantity: 120, price: 97000 },
      { quantity: 150, price: 109000 },
      { quantity: 200, price: 129000 },
      { quantity: 400, price: 209500 },
    ],
    groups: SHARED_GROUPS,
  },
  {
    name: 'Paquete Compacto',
    category: 'Paquetes',
    uomCode: 'pers',
    shortDescription: 'Versión compacta del paquete con las mismas opciones.',
    tiers: [
      { quantity: 30, price: 48500 },
      { quantity: 40, price: 53000 },
      { quantity: 50, price: 57500 },
      { quantity: 60, price: 62000 },
      { quantity: 70, price: 68000 },
      { quantity: 80, price: 70500 },
      { quantity: 90, price: 75000 },
      { quantity: 100, price: 79500 },
      { quantity: 120, price: 88500 },
      { quantity: 150, price: 102000 },
      { quantity: 200, price: 134000 },
      { quantity: 250, price: 156000 },
    ],
    groups: SHARED_GROUPS,
  },
  {
    name: 'Kit Básico',
    category: 'Kits',
    uomCode: 'und',
    shortDescription: 'Kit con componentes incluidos y una variante a elección.',
    tiers: [
      { quantity: 30, price: 41000 },
      { quantity: 40, price: 45000 },
      { quantity: 50, price: 48500 },
      { quantity: 60, price: 52500 },
      { quantity: 70, price: 56000 },
      { quantity: 80, price: 60000 },
      { quantity: 90, price: 63500 },
      { quantity: 100, price: 67500 },
      { quantity: 120, price: 75000 },
      { quantity: 150, price: 89000 },
      { quantity: 200, price: 105000 },
    ],
    groups: [
      {
        label: 'Base incluida',
        selectionType: 'included',
        options: [{ name: 'Base estándar' }],
      },
      {
        label: 'Componentes incluidos',
        selectionType: 'included',
        options: [
          { name: 'Componente A' },
          { name: 'Componente B' },
          { name: 'Componente C' },
          { name: 'Componente D' },
        ],
      },
      {
        label: 'Herramientas incluidas',
        selectionType: 'included',
        options: [
          { name: 'Llave' },
          { name: 'Destornillador' },
          { name: 'Cinta' },
          { name: 'Guantes' },
        ],
      },
      {
        label: 'Variante',
        selectionType: 'select',
        maxSelect: 2,
        options: [
          { name: 'Compacta' },
          { name: 'Estándar' },
          { name: 'Reforzada' },
          { name: 'Ligera' },
        ],
      },
    ],
  },
  {
    name: 'Kit Completo',
    category: 'Kits',
    uomCode: 'und',
    shortDescription: 'Kit con base a elección, componentes e instalación incluidos.',
    longDescription:
      '## Contenido del kit\n\n- Base a elección\n- Componentes incluidos\n- Instalación\n\nIncluye **garantía** estándar.',
    tiers: [
      { quantity: 30, price: 50000 },
      { quantity: 40, price: 55000 },
      { quantity: 50, price: 60000 },
      { quantity: 60, price: 65000 },
      { quantity: 80, price: 75000 },
      { quantity: 100, price: 85000 },
      { quantity: 150, price: 110000 },
      { quantity: 200, price: 135000 },
    ],
    groups: [
      {
        label: 'Elige la base',
        selectionType: 'select',
        maxSelect: 5,
        options: [
          { name: 'Base ligera' },
          { name: 'Base estándar' },
          { name: 'Base reforzada' },
          { name: 'Base plegable' },
          { name: 'Base modular' },
        ],
      },
      {
        label: 'Componentes incluidos',
        selectionType: 'included',
        options: [
          { name: 'Soporte' },
          { name: 'Panel' },
          { name: 'Cubierta' },
          { name: 'Anclaje' },
          { name: 'Sello' },
        ],
      },
      {
        label: 'Instalación incluida',
        selectionType: 'included',
        options: [{ name: 'Instalación en sitio' }],
      },
      {
        label: 'Extras incluidos',
        selectionType: 'included',
        options: [{ name: 'Limpieza' }, { name: 'Embalaje' }, { name: 'Etiquetado' }],
      },
    ],
  },
  {
    name: 'Colección Natural',
    category: 'Colecciones',
    uomCode: 'caja',
    shortDescription: 'Línea de materiales naturales con acabados y complementos incluidos.',
    tiers: [
      { quantity: 30, price: 46000 },
      { quantity: 40, price: 51000 },
      { quantity: 50, price: 56500 },
      { quantity: 60, price: 62000 },
      { quantity: 70, price: 67500 },
      { quantity: 80, price: 73000 },
      { quantity: 90, price: 78000 },
      { quantity: 100, price: 83500 },
      { quantity: 120, price: 94500 },
      { quantity: 150, price: 110500 },
      { quantity: 200, price: 137500 },
    ],
    groups: [
      {
        label: 'Materiales',
        selectionType: 'select',
        maxSelect: 5,
        options: [
          { name: 'Madera' },
          { name: 'Bambú' },
          { name: 'Algodón' },
          { name: 'Lino' },
          { name: 'Cuero' },
          { name: 'Cerámica' },
          { name: 'Vidrio' },
          { name: 'Acero' },
          { name: 'Aluminio' },
          { name: 'Cobre' },
        ],
      },
      {
        label: 'Acabados',
        selectionType: 'included',
        options: [
          { name: 'Barniz' },
          { name: 'Cera' },
          { name: 'Pintura' },
          { name: 'Esmalte' },
          { name: 'Aceite' },
          { name: 'Laca' },
        ],
      },
      {
        label: 'Formato',
        selectionType: 'select',
        maxSelect: 2,
        options: [{ name: 'Pequeño' }, { name: 'Grande' }],
      },
      {
        label: 'Complementos',
        selectionType: 'included',
        options: [{ name: 'Base' }, { name: 'Tapa' }, { name: 'Etiqueta' }, { name: 'Empaque' }],
      },
    ],
  },
  {
    name: 'Colección Urbana',
    category: 'Colecciones',
    uomCode: 'caja',
    shortDescription: 'Línea moderna con bases, detalles y materiales a elección.',
    tiers: [
      { quantity: 30, price: 43500 },
      { quantity: 40, price: 48500 },
      { quantity: 50, price: 53000 },
      { quantity: 60, price: 58000 },
      { quantity: 70, price: 62500 },
      { quantity: 80, price: 67000 },
      { quantity: 90, price: 72000 },
      { quantity: 100, price: 76500 },
      { quantity: 120, price: 86000 },
      { quantity: 150, price: 100000 },
      { quantity: 180, price: 114000 },
      { quantity: 200, price: 123500 },
    ],
    groups: [
      {
        label: 'Bases',
        selectionType: 'select',
        maxSelect: 3,
        options: [
          { name: 'Clásica' },
          { name: 'Moderna' },
          { name: 'Minimalista' },
          { name: 'Industrial' },
          { name: 'Vintage' },
        ],
      },
      {
        label: 'Detalles',
        selectionType: 'select',
        maxSelect: 6,
        options: [
          { name: 'Bordes' },
          { name: 'Costuras' },
          { name: 'Remaches' },
          { name: 'Grabado' },
          { name: 'Relieve' },
          { name: 'Logotipo' },
          { name: 'Etiqueta' },
          { name: 'Cinta' },
          { name: 'Botones' },
          { name: 'Cierre' },
          { name: 'Bolsillo' },
        ],
      },
      {
        label: 'Materiales',
        selectionType: 'select',
        maxSelect: 2,
        options: [
          { name: 'Algodón' },
          { name: 'Lino' },
          { name: 'Cuero' },
          { name: 'Nailon' },
          { name: 'Lona' },
          { name: 'Poliéster' },
        ],
      },
      {
        label: 'Extras',
        selectionType: 'included',
        options: [
          { name: 'Bolsa' },
          { name: 'Caja' },
          { name: 'Tarjeta' },
          { name: 'Certificado' },
        ],
      },
    ],
  },
  {
    name: 'Colección Clásica',
    category: 'Colecciones',
    uomCode: 'caja',
    shortDescription: 'Línea clásica con detalles y materiales a elección.',
    tiers: [
      { quantity: 30, price: 47000 },
      { quantity: 40, price: 52500 },
      { quantity: 50, price: 57500 },
      { quantity: 60, price: 62500 },
      { quantity: 70, price: 67500 },
      { quantity: 80, price: 72500 },
      { quantity: 90, price: 77500 },
      { quantity: 100, price: 82300 },
      { quantity: 120, price: 92500 },
      { quantity: 150, price: 107500 },
      { quantity: 200, price: 134000 },
      { quantity: 400, price: 233500 },
    ],
    groups: [
      {
        label: 'Detalles',
        selectionType: 'select',
        maxSelect: 7,
        options: [
          { name: 'Bordes' },
          { name: 'Costuras' },
          { name: 'Remaches' },
          { name: 'Grabado' },
          { name: 'Relieve' },
          { name: 'Logotipo' },
          { name: 'Etiqueta' },
          { name: 'Cinta' },
          { name: 'Botones' },
          { name: 'Cierre' },
          { name: 'Bolsillo' },
          { name: 'Ojales' },
          { name: 'Flecos' },
          { name: 'Parches' },
          { name: 'Pasadores' },
          { name: 'Hebillas' },
          { name: 'Broches' },
        ],
      },
      {
        label: 'Materiales',
        selectionType: 'select',
        maxSelect: 2,
        options: [
          { name: 'Algodón' },
          { name: 'Lino' },
          { name: 'Cuero' },
          { name: 'Nailon' },
          { name: 'Lona' },
          { name: 'Poliéster' },
          { name: 'Seda' },
        ],
      },
      {
        label: 'Acabados',
        selectionType: 'included',
        options: [
          { name: 'Barniz' },
          { name: 'Cera' },
          { name: 'Pintura' },
          { name: 'Esmalte' },
          { name: 'Aceite' },
        ],
      },
    ],
  },
  {
    name: 'Servicio Estándar',
    category: 'Servicios',
    uomCode: 'serv',
    shortDescription: 'Servicio profesional con complementos, entregables y modalidad a elección.',
    longDescription:
      '## Alcance\n\n1. Diagnóstico inicial\n2. Plan de trabajo\n3. Ejecución y seguimiento\n\n> Los entregables se acuerdan antes de comenzar.',
    tiers: [
      { quantity: 30, price: 42000 },
      { quantity: 40, price: 46000 },
      { quantity: 50, price: 51000 },
      { quantity: 60, price: 55000 },
      { quantity: 70, price: 60000 },
      { quantity: 80, price: 64000 },
      { quantity: 90, price: 68000 },
      { quantity: 100, price: 72000 },
      { quantity: 120, price: 81000 },
      { quantity: 150, price: 94000 },
      { quantity: 200, price: 116000 },
    ],
    groups: [
      {
        label: 'Complementos',
        selectionType: 'select',
        maxSelect: 7,
        options: [
          { name: 'Sesión extra' },
          { name: 'Material de apoyo' },
          { name: 'Informe' },
          { name: 'Seguimiento' },
          { name: 'Consultoría' },
          { name: 'Capacitación' },
          { name: 'Soporte remoto' },
          { name: 'Visita técnica' },
          { name: 'Documentación' },
          { name: 'Auditoría' },
          { name: 'Certificación' },
        ],
      },
      {
        label: 'Entregables',
        selectionType: 'included',
        options: [{ name: 'Informe final' }, { name: 'Resumen ejecutivo' }, { name: 'Acta' }],
      },
      {
        label: 'Modalidad',
        selectionType: 'select',
        maxSelect: 1,
        options: [{ name: 'Presencial' }, { name: 'Remoto' }],
      },
      {
        label: 'Incluido',
        selectionType: 'included',
        options: [
          { name: 'Planificación' },
          { name: 'Coordinación' },
          { name: 'Materiales' },
          { name: 'Traslados' },
          { name: 'Soporte posterior' },
        ],
      },
    ],
  },
  {
    name: 'Servicio Premium',
    category: 'Servicios',
    uomCode: 'serv',
    shortDescription: 'Servicio de alto nivel con equipo dedicado y planificación personalizada.',
    isPremium: true,
    tiers: [
      { quantity: 35, price: 93000 },
      { quantity: 60, price: 142000 },
      { quantity: 70, price: 149000 },
      { quantity: 100, price: 189500 },
      { quantity: 130, price: 279000 },
      { quantity: 150, price: 284000 },
    ],
    groups: [
      {
        label: 'Modalidades',
        selectionType: 'select',
        maxSelect: 3,
        options: [
          { name: 'Diagnóstico', description: 'Evaluación • Informe' },
          { name: 'Implementación', description: 'Plan • Ejecución' },
          { name: 'Capacitación', description: 'Taller • Material' },
          { name: 'Auditoría', description: 'Revisión • Hallazgos' },
          { name: 'Consultoría', description: 'Análisis • Estrategia' },
          { name: 'Mantenimiento', description: 'Revisión • Ajustes' },
          { name: 'Soporte', description: 'Atención • Seguimiento' },
          { name: 'Optimización', description: 'Medición • Mejora' },
        ],
      },
      {
        label: 'El servicio incluye',
        selectionType: 'included',
        options: [
          { name: 'Hasta 4 horas de servicio' },
          { name: 'Equipo profesional' },
          { name: 'Materiales premium' },
          { name: 'Planificación personalizada' },
        ],
      },
    ],
  },
];

// Idempotent by name (case-insensitive, like the unique index); new ones go at the end.
async function seedCategoryId(tenantId: string, name: string, x: Executor): Promise<string> {
  const match = and(
    eq(productCategories.tenantId, tenantId),
    sql`lower(${productCategories.name}) = lower(${name})`,
  );
  const [existing] = await x
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(match)
    .limit(1);
  if (existing) return existing.id;
  const [last] = await x
    .select({ value: sql<number>`coalesce(max(${productCategories.sortOrder}), -1)::int` })
    .from(productCategories)
    .where(eq(productCategories.tenantId, tenantId));
  const [created] = await x
    .insert(productCategories)
    .values({ tenantId, name, sortOrder: (last?.value ?? -1) + 1 })
    .returning({ id: productCategories.id });
  return created!.id;
}

export async function seedCatalog(
  tenantId: string,
  x: Executor = db,
  catalog: SeedProduct[] = SEED_CATALOG,
) {
  console.log('🍽️  Seeding catálogo...');
  const [settings] = await x
    .select({ defaultTaxRate: appSettings.defaultTaxRate })
    .from(appSettings)
    .where(eq(appSettings.tenantId, tenantId))
    .limit(1);
  const defaultTaxRate = settings?.defaultTaxRate ?? 0;

  for (const [productIndex, p] of catalog.entries()) {
    const [existing] = await x
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.name, p.name)))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${p.name} ya existe, salteando`);
      continue;
    }

    const uomCode = p.uomCode ?? DEFAULT_UNIT_CODE;
    const [unit] = await x
      .select({ id: unitsOfMeasure.id })
      .from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.tenantId, tenantId), eq(unitsOfMeasure.code, uomCode)))
      .limit(1);
    if (!unit) throw new Error(`Unit "${uomCode}" does not exist for tenant ${tenantId}`);

    const categoryId = p.category ? await seedCategoryId(tenantId, p.category, x) : null;

    const [product] = await x
      .insert(products)
      .values({
        name: p.name,
        shortDescription: p.shortDescription,
        longDescription: p.longDescription ?? null,
        isPremium: p.isPremium ?? false,
        price: p.price ?? null,
        uomId: unit.id,
        minQuantity: seedMinQuantity(p),
        categoryId,
        taxRate: p.taxRate ?? defaultTaxRate,
        taxExempt: p.taxExempt ?? false,
        sortOrder: productIndex,
        tenantId,
      })
      .returning({ id: products.id });

    if (p.tiers.length > 0) {
      await x.insert(productPriceTiers).values(
        p.tiers.map((tier, tierIndex) => ({
          productId: product!.id,
          quantity: tier.quantity,
          price: tier.price,
          sortOrder: tierIndex,
          tenantId,
        })),
      );
    }

    for (const [groupIndex, g] of p.groups.entries()) {
      const [group] = await x
        .insert(optionGroups)
        .values({
          productId: product!.id,
          label: g.label,
          selectionType: g.selectionType,
          maxSelect: g.maxSelect ?? null,
          sortOrder: groupIndex,
          tenantId,
        })
        .returning({ id: optionGroups.id });

      await x.insert(options).values(
        g.options.map((option, optionIndex) => ({
          optionGroupId: group!.id,
          name: option.name,
          description: option.description ?? null,
          sortOrder: optionIndex,
          tenantId,
        })),
      );
    }

    console.log(`  ✅ ${p.name} (${p.tiers.length} paquetes, ${p.groups.length} secciones)`);
  }
}
