import type { RouterOutputs } from '@/lib/trpc/types';

export type Product = RouterOutputs['products']['list'][number];
export type PriceTier = Product['priceTiers'][number];
export type OptionGroup = Product['optionGroups'][number];
export type Option = OptionGroup['options'][number];

// Only the admin catalog carries `isUsed` (rows already referenced by quotes).
export type CatalogProduct = RouterOutputs['products']['catalog'][number];
export type CatalogOptionGroup = CatalogProduct['optionGroups'][number];
export type CatalogOption = CatalogOptionGroup['options'][number];
