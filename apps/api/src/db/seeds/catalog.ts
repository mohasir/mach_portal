import { and, eq, sql } from 'drizzle-orm';
import { DEFAULT_UNIT_CODE } from '@repo/schemas';
import { db } from '../index';
import {
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
  description: string;
  isPremium?: boolean;
  // Per-unit price in cents.
  price?: number;
  // Code of a unit the tenant already has (seedUnitsOfMeasure runs first); defaults to 'pers'.
  uomCode?: string;
  // Smallest quantity per quote line; defaults to the smallest tier, or 1 without tiers.
  minQuantity?: number;
  // Category name, created for the tenant when missing.
  category?: string;
  tiers: SeedTier[];
  groups: SeedGroup[];
}

export const seedMinQuantity = (p: Pick<SeedProduct, 'minQuantity' | 'tiers'>): number =>
  p.minQuantity ?? (p.tiers.length > 0 ? Math.min(...p.tiers.map((t) => t.quantity)) : 1);

const SWEET_TOPPINGS: SeedGroup = {
  label: 'Premium Toppings',
  selectionType: 'select',
  maxSelect: 7,
  options: [
    { name: 'Lotus Biscoff' },
    { name: 'Chopped Peanuts' },
    { name: 'Coconut Flakes' },
    { name: 'Mini Marshmallows' },
    { name: "M&M's" },
    { name: 'Sprinkles' },
    { name: 'White Chocolate' },
    { name: 'Coffee Chocolate' },
    { name: 'Crushed Oreo' },
    { name: 'Mazapan' },
  ],
};
const SWEET_FRUITS: SeedGroup = {
  label: 'Fresh Fruits',
  selectionType: 'select',
  maxSelect: 2,
  options: [
    { name: 'Banana' },
    { name: 'Strawberry' },
    { name: 'Blueberry' },
    { name: 'Raspberry' },
  ],
};
const SWEET_SYRUPS: SeedGroup = {
  label: 'Premium Syrups',
  selectionType: 'included',
  options: [
    { name: 'Nutella' },
    { name: 'Caramel' },
    { name: 'Condensed Milk' },
    { name: "Hershey's" },
    { name: 'Maple Syrup' },
  ],
};

export const SEED_CATALOG: SeedProduct[] = [
  {
    name: 'Crepes',
    category: 'Desserts',
    description: 'Crepes preparados en vivo con toppings, frutas y jarabes premium.',
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
    groups: [SWEET_TOPPINGS, SWEET_FRUITS, SWEET_SYRUPS],
  },
  {
    name: 'Mini Pancakes',
    category: 'Desserts',
    description: 'Pancakes miniatura apilados con toppings a elección.',
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
    groups: [SWEET_TOPPINGS, SWEET_FRUITS, SWEET_SYRUPS],
  },
  {
    name: 'Crepaletas',
    category: 'Desserts',
    description: 'Paletas de crepe bañadas y decoradas al momento.',
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
    groups: [SWEET_TOPPINGS, SWEET_FRUITS, SWEET_SYRUPS],
  },
  {
    name: 'Esquites',
    category: 'Snacks',
    description: 'Elote desgranado al estilo mexicano con base de maíz fresco.',
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
        label: 'Premium Corn Base',
        selectionType: 'included',
        options: [{ name: 'Fresh Sweet Corn (Never Canned)' }],
      },
      {
        label: 'Included Toppings',
        selectionType: 'included',
        options: [
          { name: 'Mayonnaise' },
          { name: 'Butter' },
          { name: 'Mexican Crema' },
          { name: 'Cotija Cheese' },
        ],
      },
      {
        label: 'Included Seasonings',
        selectionType: 'included',
        options: [
          { name: 'Tajín' },
          { name: 'Tabasco' },
          { name: 'Fresh Lemon' },
          { name: 'Salt' },
        ],
      },
      {
        label: 'Base Chip',
        selectionType: 'select',
        maxSelect: 2,
        options: [
          { name: 'Doritos Nacho Cheese' },
          { name: 'Cool Ranch' },
          { name: "Flamin' Hot" },
          { name: 'Ruffles' },
        ],
      },
    ],
  },
  {
    name: 'Nachos',
    category: 'Snacks',
    description: 'Estación de nachos con base a elección y guarniciones incluidas.',
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
        label: 'Choose Your Base',
        selectionType: 'select',
        maxSelect: 5,
        options: [
          { name: 'Tortilla Chips' },
          { name: 'Nacho Cheese Doritos' },
          { name: 'Cool Ranch Doritos' },
          { name: "Flamin' Hot Doritos" },
          { name: 'Ruffles' },
        ],
      },
      {
        label: 'Signature Toppings',
        selectionType: 'included',
        options: [
          { name: 'Bacon Crumbles' },
          { name: 'Cotija Cheese' },
          { name: 'Chili Beans' },
          { name: 'Jalapeños' },
          { name: 'Pico de Gallo' },
        ],
      },
      {
        label: 'Warm Cheese Sauce',
        selectionType: 'included',
        options: [{ name: 'Hot Cheddar Cheese' }],
      },
      {
        label: 'Flavor Enhancers',
        selectionType: 'included',
        options: [{ name: 'Tabasco Sauce' }, { name: 'Valentina Sauce' }, { name: 'Tajín' }],
      },
    ],
  },
  {
    name: 'Fruit Station',
    category: 'Desserts',
    description: 'Selección de fruta fresca con yogurt y toppings crocantes.',
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
        label: 'Fresh Fruits',
        selectionType: 'select',
        maxSelect: 5,
        options: [
          { name: 'Banana' },
          { name: 'Strawberry' },
          { name: 'Mango' },
          { name: 'Melon' },
          { name: 'Pineapple' },
          { name: 'Watermelon' },
          { name: 'Blackberries' },
          { name: 'Raspberries' },
          { name: 'Green Grapes' },
          { name: 'Red Grapes' },
        ],
      },
      {
        label: 'Premium Syrups',
        selectionType: 'included',
        options: [
          { name: 'Caramel' },
          { name: 'Condensed Milk' },
          { name: "Hershey's" },
          { name: 'Natural Honey' },
          { name: 'Chamoy' },
          { name: 'Tajín' },
        ],
      },
      {
        label: 'Yogurt',
        selectionType: 'select',
        maxSelect: 2,
        options: [{ name: 'Strawberry Yogurt' }, { name: 'Vanilla Yogurt' }],
      },
      {
        label: 'Crunchy Toppings',
        selectionType: 'included',
        options: [
          { name: 'Almonds' },
          { name: 'Peanuts' },
          { name: 'Granola' },
          { name: 'Raisins' },
        ],
      },
    ],
  },
  {
    name: 'Snack Station',
    category: 'Snacks',
    description: 'Botanas saladas y dulces con chips base, toppings y frutas.',
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
        label: 'Base Chips',
        selectionType: 'select',
        maxSelect: 3,
        options: [
          { name: 'Doritos Spicy' },
          { name: 'Nacho Cheese' },
          { name: 'Cool Ranch' },
          { name: "Flamin' Hot" },
          { name: 'Ruffles' },
        ],
      },
      {
        label: 'Toppings',
        selectionType: 'select',
        maxSelect: 6,
        options: [
          { name: 'Pork Strips' },
          { name: 'Gummy Bears' },
          { name: 'Gummy Worms' },
          { name: 'Nerds' },
          { name: 'Airheads' },
          { name: 'Mango Gummies' },
          { name: 'Peanuts' },
          { name: 'Skwinkles' },
          { name: 'Pelon Mini' },
          { name: 'Pulparindo' },
          { name: 'Tamarind Sticks' },
        ],
      },
      {
        label: 'Fruits',
        selectionType: 'select',
        maxSelect: 2,
        options: [
          { name: 'Cucumber' },
          { name: 'Green Grapes' },
          { name: 'Green Apple' },
          { name: 'Pineapple' },
          { name: 'Watermelon' },
          { name: 'Jicama' },
        ],
      },
      {
        label: 'Extras',
        selectionType: 'included',
        options: [
          { name: 'Artificial Lime Juice' },
          { name: 'Chamoy' },
          { name: 'Valentina' },
          { name: 'Tajín' },
        ],
      },
    ],
  },
  {
    name: 'Popsicles',
    category: 'Desserts',
    description: 'Paletas heladas artesanales con toppings, frutas y jarabes.',
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
        label: 'Toppings',
        selectionType: 'select',
        maxSelect: 7,
        options: [
          { name: 'Trolli Worms' },
          { name: 'Gummy Bears' },
          { name: 'Airheads' },
          { name: 'Mango Gummies' },
          { name: 'Skwinkles' },
          { name: 'Pelon Mini' },
          { name: 'Pulparindo' },
          { name: 'Tamarind Stick' },
          { name: 'Marshmallows' },
          { name: "M&M's" },
          { name: 'Sprinkles' },
          { name: 'Oreo' },
          { name: 'White Chocolate' },
          { name: 'Marzipan' },
          { name: 'Coconut' },
          { name: 'Almonds' },
          { name: 'Peanuts' },
        ],
      },
      {
        label: 'Fruits',
        selectionType: 'select',
        maxSelect: 2,
        options: [
          { name: 'Watermelon' },
          { name: 'Melon' },
          { name: 'Mango' },
          { name: 'Grapes' },
          { name: 'Strawberries' },
          { name: 'Blueberries' },
          { name: 'Pineapple' },
        ],
      },
      {
        label: 'Syrups',
        selectionType: 'included',
        options: [
          { name: 'Chamoy' },
          { name: 'Tajín' },
          { name: 'Caramel' },
          { name: 'Condensed Milk' },
          { name: "Hershey's" },
        ],
      },
    ],
  },
  {
    name: 'Hot Chocolate',
    category: 'Drinks',
    description: 'Chocolate caliente premium con toppings, salsas y galleta a elección.',
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
        label: 'Premium Toppings',
        selectionType: 'select',
        maxSelect: 7,
        options: [
          { name: 'Crushed Peppermint Candy' },
          { name: 'Lotus Biscoff Crumbles' },
          { name: 'Coconut Rolls' },
          { name: 'Shredded Coconut' },
          { name: 'Mini Marshmallows' },
          { name: "M&M's" },
          { name: 'Colorful Sprinkles' },
          { name: 'White Chocolate Chips' },
          { name: 'Chocolate Chips' },
          { name: 'Crushed Oreo' },
          { name: 'Almonds' },
        ],
      },
      {
        label: 'Premium Sauces',
        selectionType: 'included',
        options: [
          { name: 'Caramel' },
          { name: 'Condensed Milk' },
          { name: "Hershey's Chocolate Syrup" },
        ],
      },
      {
        label: 'Cookie',
        selectionType: 'select',
        maxSelect: 1,
        options: [{ name: 'Flamed Cookie with Toasted Marshmallows' }, { name: 'Classic Cookie' }],
      },
      {
        label: 'Included',
        selectionType: 'included',
        options: [
          { name: 'Whipped Cream' },
          { name: 'Cinnamon Powder' },
          { name: 'Sugar' },
          { name: 'Stevia' },
          { name: 'Cold Milk' },
        ],
      },
    ],
  },
  {
    name: 'Craft Bar',
    category: 'Drinks',
    description:
      'Barra de cócteles de autor con bartender profesional. El alcohol lo provee el cliente; el bartender entrega una lista de compras personalizada antes del evento.',
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
        label: 'Signature Cocktails',
        selectionType: 'select',
        maxSelect: 3,
        options: [
          { name: 'Paloma', description: 'Tequila • Grapefruit' },
          { name: 'Beach Breeze', description: 'Vodka • Orange • Cranberry' },
          { name: 'Spicy Margarita', description: 'Tequila • Jalapeño' },
          { name: 'Mango Tango', description: 'Rum • Mango' },
          { name: 'Mango Bay Breeze', description: 'Vodka • Mango • Cranberry' },
          { name: 'Passion Mojito', description: 'Passion Fruit • Mint' },
          { name: 'Strawberry Margarita', description: 'Tequila • Strawberry' },
          { name: 'Mezcal Mule', description: 'Mezcal • Ginger Beer • Lime' },
        ],
      },
      {
        label: 'Service Includes',
        selectionType: 'included',
        options: [
          { name: 'Up to 4 Hours of Beverage Service' },
          { name: 'Professional Bartender(s)' },
          { name: 'Premium Mixers & Fresh Garnishes' },
          { name: 'Personalized Cocktail Selection' },
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
        description: p.description,
        isPremium: p.isPremium ?? false,
        price: p.price ?? null,
        uomId: unit.id,
        minQuantity: seedMinQuantity(p),
        categoryId,
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
