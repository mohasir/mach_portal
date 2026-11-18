import { z } from 'zod';
import { catalogKindSchema } from './catalogKinds';
import { featureKeySchema } from './features';
import { listQuerySchema } from './pagination';

export const consoleOrganizationListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
  catalogKind: catalogKindSchema.optional(),
});
export type ConsoleOrganizationListQuery = z.infer<typeof consoleOrganizationListQuerySchema>;

export const consoleOrganizationIdSchema = z.object({
  organizationId: z.string().min(1),
});

export const createOrganizationInputSchema = z.object({
  slug: z.string().trim().min(1, 'console.validation.slugRequired').max(60),
  name: z.string().trim().min(1, 'console.validation.nameRequired').max(120),
  adminEmail: z.email('console.validation.emailInvalid'),
  adminName: z.string().trim().min(1, 'console.validation.adminNameRequired').max(120),
  catalogKind: catalogKindSchema.optional(),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;

export interface ConsoleOrganization {
  id: string;
  slug: string;
  name: string;
  catalogKind: z.infer<typeof catalogKindSchema>;
  activeFeatureCount: number;
  // ISO timestamp of the earliest end date among the active features that have one.
  nextExpiry: string | null;
  createdAt: string;
}

const isRealDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

// Fields left out keep their stored value; null clears them.
export const setConsoleFeatureInputSchema = consoleOrganizationIdSchema.extend({
  key: featureKeySchema,
  // Last active day.
  expiresOn: z
    .string()
    .refine(isRealDate, 'console.validation.expiresOnInvalid')
    .nullable()
    .optional(),
  priceCents: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
  billingPeriod: z.enum(['monthly', 'yearly']).nullable().optional(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'console.validation.currencyInvalid')
    .transform((v) => v.toUpperCase())
    .nullable()
    .optional(),
});
export type SetConsoleFeatureInput = z.input<typeof setConsoleFeatureInputSchema>;

export const unsetConsoleFeatureInputSchema = consoleOrganizationIdSchema.extend({
  key: featureKeySchema,
});
export type UnsetConsoleFeatureInput = z.infer<typeof unsetConsoleFeatureInputSchema>;

export const setConsoleCatalogKindInputSchema = consoleOrganizationIdSchema.extend({
  kind: catalogKindSchema,
});
export type SetConsoleCatalogKindInput = z.infer<typeof setConsoleCatalogKindInputSchema>;

export interface ConsoleFeature {
  key: z.infer<typeof featureKeySchema>;
  kind: string;
  // Enabled and in force: not expired and with its requirements active.
  active: boolean;
  enabled: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  priceCents: number | null;
  billingPeriod: string | null;
  currency: string | null;
}

export const consoleHistoryQuerySchema = consoleOrganizationIdSchema.extend({
  limit: z.number().int().min(1).max(100).default(50),
});
export type ConsoleHistoryQuery = z.infer<typeof consoleHistoryQuerySchema>;

export interface ConsoleHistoryItem {
  source: 'feature' | 'access' | 'audit';
  id: string;
  createdAt: string;
  actor: string;
  // Stable key the web translates: feature.<action>, access.<type> or audit.<action>.
  label: string;
  detail: Record<string, unknown> | null;
}

export interface ConsoleGlobalSummary {
  organizations: number;
  products: number;
  quotes: number;
  events: number;
  expiringFeatures: {
    organizationId: string;
    organizationName: string;
    featureKey: string;
    expiresAt: string;
  }[];
}

export interface ConsoleOrganizationSummary {
  products: number;
  clients: number;
  // Platform-level stage labels, stages without quotes left out, ordered by stage sort order.
  quotesByStage: { stageId: number; label: string; count: number }[];
  events: number;
}
