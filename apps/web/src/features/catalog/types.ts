import type { RouterOutputs } from '@/lib/trpc/types';

export type Product = RouterOutputs['products']['catalog'][number];
export type PriceTier = Product['priceTiers'][number];
export type OptionGroup = Product['optionGroups'][number];
export type Option = OptionGroup['options'][number];
