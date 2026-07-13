import { eq } from 'drizzle-orm';
import { db } from '../index';
import { options, optionGroups, products } from '../schema';

interface SeedOptionGroup {
  label: string;
  maxSelect?: number;
  options: string[];
}

interface SeedProduct {
  name: string;
  description: string;
  basePrice: number; // cents
  isPremium?: boolean;
  groups: SeedOptionGroup[];
}

// The 9 real Mach Bar stations (docs/mach-bar-domain.md §1).
const SEED_CATALOG: SeedProduct[] = [
  {
    name: 'Crepaletas',
    description: 'Paletas de crepe bañadas y decoradas al momento.',
    basePrice: 1200,
    groups: [
      {
        label: 'Toppings',
        maxSelect: 7,
        options: [
          'Chispas de chocolate',
          'Oreo',
          'Marshmallows',
          'Coco rallado',
          'Granola',
          'M&Ms',
          'Sprinkles',
        ],
      },
      { label: 'Frutas', maxSelect: 2, options: ['Fresa', 'Banana'] },
      { label: 'Salsas', maxSelect: 2, options: ['Dulce de leche', 'Nutella', 'Miel'] },
    ],
  },
  {
    name: 'Crepes',
    description: 'Crepes dulces y salados preparados en vivo.',
    basePrice: 1300,
    groups: [
      { label: 'Dulces', maxSelect: 3, options: ['Nutella', 'Dulce de leche', 'Azúcar y canela'] },
      { label: 'Salados', maxSelect: 2, options: ['Jamón y queso', 'Pollo', 'Espinaca y queso'] },
    ],
  },
  {
    name: 'Mini Pancakes',
    description: 'Pancakes miniatura apilados con toppings a elección.',
    basePrice: 1000,
    groups: [
      {
        label: 'Toppings',
        maxSelect: 4,
        options: ['Miel de maple', 'Chocolate', 'Frutos rojos', 'Crema batida'],
      },
    ],
  },
  {
    name: 'Nachos',
    description: 'Estación de nachos con guarniciones clásicas.',
    basePrice: 900,
    groups: [
      {
        label: 'Toppings',
        maxSelect: 5,
        options: [
          'Queso cheddar',
          'Guacamole',
          'Jalapeños',
          'Pico de gallo',
          'Crema agria',
          'Frijoles',
        ],
      },
    ],
  },
  {
    name: 'Fruit Station',
    description: 'Selección de fruta fresca de estación.',
    basePrice: 800,
    groups: [
      {
        label: 'Frutas',
        maxSelect: 6,
        options: ['Sandía', 'Melón', 'Piña', 'Uvas', 'Fresa', 'Kiwi'],
      },
    ],
  },
  {
    name: 'Esquites',
    description: 'Elote desgranado preparado al estilo mexicano.',
    basePrice: 950,
    groups: [
      {
        label: 'Toppings',
        maxSelect: 4,
        options: ['Mayonesa', 'Queso cotija', 'Chile piquín', 'Limón'],
      },
    ],
  },
  {
    name: 'Snack Station',
    description: 'Botanas saladas variadas para picar.',
    basePrice: 700,
    groups: [
      {
        label: 'Salados',
        maxSelect: 5,
        options: ['Papas fritas', 'Pretzels', 'Palomitas', 'Doritos', 'Cheetos'],
      },
    ],
  },
  {
    name: 'Popsicles',
    description: 'Paletas heladas artesanales de sabores frutales.',
    basePrice: 600,
    groups: [
      { label: 'Sabores', maxSelect: 4, options: ['Fresa', 'Mango', 'Limón', 'Coco', 'Uva'] },
    ],
  },
  {
    name: 'Craft Bar',
    description: 'Barra de bebidas artesanales sin alcohol.',
    basePrice: 1500,
    isPremium: true,
    groups: [
      {
        label: 'Bebidas',
        maxSelect: 3,
        options: ['Limonada', 'Agua de jamaica', 'Té helado', 'Soda artesanal'],
      },
    ],
  },
];

export async function seedCatalog() {
  console.log('🍽️  Seeding catálogo...');

  for (const [productIndex, p] of SEED_CATALOG.entries()) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.name, p.name))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${p.name} ya existe, salteando`);
      continue;
    }

    const [product] = await db
      .insert(products)
      .values({
        name: p.name,
        description: p.description,
        basePrice: p.basePrice,
        isPremium: p.isPremium ?? false,
        sortOrder: productIndex,
      })
      .returning({ id: products.id });

    for (const [groupIndex, g] of p.groups.entries()) {
      const [group] = await db
        .insert(optionGroups)
        .values({
          productId: product!.id,
          label: g.label,
          maxSelect: g.maxSelect,
          sortOrder: groupIndex,
        })
        .returning({ id: optionGroups.id });

      await db.insert(options).values(
        g.options.map((name, optionIndex) => ({
          optionGroupId: group!.id,
          name,
          sortOrder: optionIndex,
        })),
      );
    }

    console.log(`  ✅ ${p.name} (${p.groups.length} secciones)`);
  }
}
