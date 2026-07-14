import { eq } from 'drizzle-orm';
import { db } from '../index';
import { options, optionGroups, productPriceTiers, products } from '../schema';

interface SeedTier {
  numPersons: number;
  price: number;
}

interface SeedOption {
  name: string;
  description?: string;
}

interface SeedGroup {
  label: string;
  selectionType: 'select' | 'included';
  maxSelect?: number;
  options: SeedOption[];
}

interface SeedProduct {
  name: string;
  description: string;
  isPremium?: boolean;
  tiers: SeedTier[];
  groups: SeedGroup[];
}

const PLACEHOLDER_TIERS: SeedTier[] = [
  { numPersons: 30, price: 50000 },
  { numPersons: 40, price: 55000 },
  { numPersons: 50, price: 60000 },
  { numPersons: 60, price: 65000 },
  { numPersons: 80, price: 75000 },
  { numPersons: 100, price: 85000 },
  { numPersons: 150, price: 110000 },
  { numPersons: 200, price: 135000 },
];

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

const SEED_CATALOG: SeedProduct[] = [
  {
    name: 'Crepes',
    description: 'Crepes preparados en vivo con toppings, frutas y jarabes premium.',
    tiers: PLACEHOLDER_TIERS,
    groups: [SWEET_TOPPINGS, SWEET_FRUITS, SWEET_SYRUPS],
  },
  {
    name: 'Mini Pancakes',
    description: 'Pancakes miniatura apilados con toppings a elección.',
    tiers: [
      { numPersons: 30, price: 61000 },
      { numPersons: 40, price: 65000 },
      { numPersons: 50, price: 69000 },
      { numPersons: 60, price: 73000 },
      { numPersons: 70, price: 77000 },
      { numPersons: 80, price: 81000 },
      { numPersons: 90, price: 85000 },
      { numPersons: 100, price: 89000 },
      { numPersons: 120, price: 97000 },
      { numPersons: 150, price: 109000 },
      { numPersons: 200, price: 129000 },
      { numPersons: 400, price: 209500 },
    ],
    groups: [SWEET_TOPPINGS, SWEET_FRUITS, SWEET_SYRUPS],
  },
  {
    name: 'Crepaletas',
    description: 'Paletas de crepe bañadas y decoradas al momento.',
    tiers: [
      { numPersons: 30, price: 48500 },
      { numPersons: 40, price: 53000 },
      { numPersons: 50, price: 57500 },
      { numPersons: 60, price: 62000 },
    ],
    groups: [SWEET_TOPPINGS, SWEET_FRUITS, SWEET_SYRUPS],
  },
  {
    name: 'Esquites',
    description: 'Elote desgranado al estilo mexicano con base de maíz fresco.',
    tiers: [
      { numPersons: 30, price: 41000 },
      { numPersons: 40, price: 45000 },
      { numPersons: 50, price: 48500 },
      { numPersons: 60, price: 52500 },
      { numPersons: 70, price: 56000 },
      { numPersons: 80, price: 60000 },
      { numPersons: 90, price: 63500 },
      { numPersons: 100, price: 67500 },
      { numPersons: 120, price: 75000 },
      { numPersons: 150, price: 89000 },
      { numPersons: 200, price: 105000 },
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
    description: 'Estación de nachos con base a elección y guarniciones incluidas.',
    tiers: PLACEHOLDER_TIERS,
    groups: [
      {
        // TODO(client): confirm how many bases the client picks (assumed 1).
        label: 'Choose Your Base',
        selectionType: 'select',
        maxSelect: 1,
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
    description: 'Selección de fruta fresca con yogurt y toppings crocantes.',
    tiers: PLACEHOLDER_TIERS,
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
    description: 'Botanas saladas y dulces con chips base, toppings y frutas.',
    tiers: PLACEHOLDER_TIERS,
    groups: [
      {
        // TODO(client): "3 Base Chips Included" — assumed choose 3 of 5.
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
    description: 'Paletas heladas artesanales con toppings, frutas y jarabes.',
    tiers: PLACEHOLDER_TIERS,
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
    description: 'Chocolate caliente premium con toppings, salsas y galleta a elección.',
    tiers: PLACEHOLDER_TIERS,
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
    description:
      'Barra de cócteles de autor con bartender profesional. El alcohol lo provee el cliente; el bartender entrega una lista de compras personalizada antes del evento.',
    isPremium: true,
    tiers: PLACEHOLDER_TIERS,
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
        isPremium: p.isPremium ?? false,
        sortOrder: productIndex,
      })
      .returning({ id: products.id });

    if (p.tiers.length > 0) {
      await db.insert(productPriceTiers).values(
        p.tiers.map((tier, tierIndex) => ({
          productId: product!.id,
          numPersons: tier.numPersons,
          price: tier.price,
          sortOrder: tierIndex,
        })),
      );
    }

    for (const [groupIndex, g] of p.groups.entries()) {
      const [group] = await db
        .insert(optionGroups)
        .values({
          productId: product!.id,
          label: g.label,
          selectionType: g.selectionType,
          maxSelect: g.maxSelect ?? null,
          sortOrder: groupIndex,
        })
        .returning({ id: optionGroups.id });

      await db.insert(options).values(
        g.options.map((option, optionIndex) => ({
          optionGroupId: group!.id,
          name: option.name,
          description: option.description ?? null,
          sortOrder: optionIndex,
        })),
      );
    }

    console.log(`  ✅ ${p.name} (${p.tiers.length} tramos, ${p.groups.length} secciones)`);
  }
}
