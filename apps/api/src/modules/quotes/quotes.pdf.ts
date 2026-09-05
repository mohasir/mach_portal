import type { QuotePdfTemplateContent } from '@repo/schemas';
import type {
  QuotePdfDetailBlock,
  QuotePdfFee,
  QuotePdfItem,
  QuotePdfRequest,
} from '../../lib/pdfService/types';
import type { ProductWithGroups } from '../products/products.resource';
import type { QuoteDetailRow, QuoteLineDetail } from './quotes.resource';

function formatGroupTitle(group: ProductWithGroups['optionGroups'][number]): string {
  if (group.selectionType === 'included') return `${group.label} (Included)`;
  return group.maxSelect != null ? `${group.label} (Choose any ${group.maxSelect})` : group.label;
}

// Curated per-product mapping (product name -> group label -> emoji), sourced directly from
// the station reference sheets — the same group label can mean a different emoji on a
// different product (e.g. Snack Station's "Fruits" is 🍍, Popsicles' "Fruits" is 🍓), so this
// has to be keyed by product, not by label alone. Craft Bar is intentionally absent: its
// per-cocktail icons don't fit the one-emoji-per-group DetailBlock shape.
const EMOJI_BY_PRODUCT: Record<string, Record<string, string>> = {
  'Snack Station': {
    'Base Chips': '🌶️',
    Toppings: '🍬',
    Fruits: '🍍',
    Extras: '🧂',
  },
  Esquites: {
    'Premium Corn Base': '🌽',
    'Included Toppings': '🧀',
    'Included Seasonings': '🌶️',
    'Base Chip': '🔥',
  },
  'Mini Pancakes': {
    'Premium Toppings': '🍬',
    'Fresh Fruits': '🍓',
    'Premium Syrups': '🍯',
  },
  Crepaletas: {
    'Premium Toppings': '🍬',
    'Fresh Fruits': '🍓',
    'Premium Syrups': '🍯',
  },
  Crepes: {
    'Premium Toppings': '🍬',
    'Fresh Fruits': '🍓',
    'Premium Syrups': '🍯',
  },
  'Fruit Station': {
    'Fresh Fruits': '🍓',
    'Premium Syrups': '🍯',
    Yogurt: '🥣',
    'Crunchy Toppings': '🥜',
  },
  Popsicles: {
    Toppings: '🍬',
    Fruits: '🍓',
    Syrups: '🍯',
  },
  'Hot Chocolate': {
    'Premium Toppings': '🍬',
    'Premium Sauces': '🍯',
    Cookie: '🍪',
    Included: '✨',
  },
  Nachos: {
    'Choose Your Base': '🥣',
    'Signature Toppings': '🌶️',
    'Warm Cheese Sauce': '🧀',
    'Flavor Enhancers': '🔥',
  },
};

// Best-effort fallback for groups not covered by EMOJI_BY_PRODUCT (e.g. new products) —
// first keyword match against the PDF service's curated icon set wins, no match means the
// PDF renders the block without an icon.
const DETAIL_EMOJI_RULES: { keywords: string[]; emoji: string }[] = [
  { keywords: ['cheese'], emoji: '🧀' },
  { keywords: ['fruit'], emoji: '🍓' },
  { keywords: ['syrup', 'honey'], emoji: '🍯' },
  { keywords: ['spicy', 'chili', 'chilli', 'jalapeño', 'jalapeno', 'hot'], emoji: '🌶️' },
  { keywords: ['sauce', 'seasoning', 'flavor', 'flavour'], emoji: '🔥' },
  { keywords: ['base'], emoji: '🥣' },
  { keywords: ['topping', 'candy', 'cookie', 'crunchy', 'sweet'], emoji: '🍬' },
];

function pickDetailEmoji(productName: string, label: string): string | undefined {
  const curated = EMOJI_BY_PRODUCT[productName]?.[label];
  if (curated) return curated;
  const lower = label.toLowerCase();
  return DETAIL_EMOJI_RULES.find((rule) => rule.keywords.some((k) => lower.includes(k)))?.emoji;
}

// Craft Bar's "Signature Cocktails" is the one group that renders as one DetailBlock per
// option instead of one block for the whole group — each cocktail gets its own icon and its
// ingredients (stored as the option's description, e.g. "Tequila • Grapefruit") as its own
// line, which a single shared group emoji/option-list can't represent.
const CRAFT_BAR_PRODUCT = 'Craft Bar';
const SIGNATURE_COCKTAILS_GROUP = 'Signature Cocktails';

const COCKTAIL_EMOJI_BY_NAME: Record<string, string> = {
  Paloma: '🍊',
  'Beach Breeze': '🌊',
  'Spicy Margarita': '🌶️',
  'Mango Tango': '🥭',
  'Mango Bay Breeze': '🍹',
  'Passion Mojito': '🌿',
  'Strawberry Margarita': '🍓',
  'Mezcal Mule': '🔥',
};

function splitIngredients(description: string | null): string[] {
  return (description ?? '')
    .split('•')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildCocktailBlocks(
  group: ProductWithGroups['optionGroups'][number],
): QuotePdfDetailBlock[] {
  return group.options
    .map((option) => ({
      title: option.name,
      options: splitIngredients(option.description),
      emoji: COCKTAIL_EMOJI_BY_NAME[option.name],
    }))
    .filter((block) => block.options.length > 0);
}

// The quote PDF is a sales document, not a record of what was actually picked — a
// line's options may still be unresolved at quote time (chosen later, at the event) or
// already resolved, but either way the client sees the station's full menu, not just
// whatever happens to be selected internally.
function buildItemDetails(product: ProductWithGroups): QuotePdfDetailBlock[] {
  return product.optionGroups.flatMap((group) => {
    if (product.name === CRAFT_BAR_PRODUCT && group.label === SIGNATURE_COCKTAILS_GROUP) {
      return buildCocktailBlocks(group);
    }
    const block = {
      title: formatGroupTitle(group),
      options: group.options.map((o) => o.name),
      emoji: pickDetailEmoji(product.name, group.label),
    };
    return block.options.length > 0 ? [block] : [];
  });
}

function buildItems(lines: QuoteLineDetail[], catalog: ProductWithGroups[]): QuotePdfItem[] {
  return lines.flatMap((line) => {
    const product = catalog.find((p) => p.id === line.productId);
    if (!product) return [];
    return [
      {
        sku: product.id,
        description: product.name,
        quantity: line.numPersons,
        total: line.subtotal / 100,
        details: buildItemDetails(product),
      },
    ];
  });
}

function buildFees(quoteRow: QuoteDetailRow): QuotePdfFee[] | undefined {
  const fees: QuotePdfFee[] = [];

  if (quoteRow.longDistanceAmount > 0) {
    fees.push({
      description: 'Long Distance Travel Fee',
      amount: quoteRow.longDistanceAmount / 100,
    });
  }

  if (quoteRow.taxAmount > 0) {
    const rate = Math.round(quoteRow.taxRate * 10000) / 100;
    fees.push({
      description: `Tax (${rate}%)`,
      amount: quoteRow.taxAmount / 100,
    });
  }

  if (quoteRow.cardSurchargeAmount > 0) {
    const rate = Math.round(quoteRow.cardSurchargeRate * 100);
    fees.push({
      description: `Card/Check Surcharge (${rate}%)`,
      amount: quoteRow.cardSurchargeAmount / 100,
    });
  }

  return fees.length > 0 ? fees : undefined;
}

export function buildQuotePdfPayload(
  quoteRow: QuoteDetailRow,
  lines: QuoteLineDetail[],
  catalog: ProductWithGroups[],
  template: QuotePdfTemplateContent | undefined,
): QuotePdfRequest {
  // Same combining rule as AddressLines.tsx (street, then "city, state"), minus the
  // state's translated display name — a US-facing PDF reads fine with the raw code.
  const location =
    [quoteRow.address, quoteRow.city, quoteRow.state].filter(Boolean).join(', ') || undefined;
  const hasEventInfo = Boolean(
    quoteRow.eventDate ?? quoteRow.eventTypeName ?? quoteRow.eventTime ?? location,
  );

  return {
    template: 'mach_quote',
    document_number: quoteRow.number,
    client_name: quoteRow.clientName,
    event: hasEventInfo
      ? {
          date: quoteRow.eventDate ?? undefined,
          type: quoteRow.eventTypeName ?? undefined,
          time: quoteRow.eventTime ?? undefined,
          location,
        }
      : undefined,
    services: template?.services.length ? template.services : undefined,
    items: buildItems(lines, catalog),
    fees: buildFees(quoteRow),
    deposit: quoteRow.depositAmount / 100,
    terms_and_conditions: template?.termsAndConditions.length
      ? template.termsAndConditions
      : undefined,
    validity_note: template?.validityNote,
    dietary_note: template?.dietaryNote,
    additional_notes: quoteRow.clientNotes ?? undefined,
  };
}
