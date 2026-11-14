import type { FeatureKey } from '@repo/guards';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';
import { tenantReadPolicy } from '../rls/policy';

export const FEATURE_EVENT_ACTIONS = ['enabled', 'disabled', 'updated'] as const;
export type FeatureEventAction = (typeof FEATURE_EVENT_ACTIONS)[number];

// Only the platform role writes here (see PLATFORM_MANAGED_TABLES); the app role reads the rows
// of its tenant. A missing row means the feature is off for that tenant.
export const tenantFeatures = pgTable(
  'tenant_features',
  {
    tenantId: tenantId(),
    featureKey: text('feature_key').$type<FeatureKey>().notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    activatedAt: timestamp('activated_at').defaultNow().notNull(),
    // NULL keeps the feature active with no end date.
    expiresAt: timestamp('expires_at'),
    // Price agreed with the tenant, informative only: nothing charges it.
    priceCents: integer('price_cents'),
    billingPeriod: text('billing_period'),
    currency: text('currency'),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.featureKey] }), tenantReadPolicy('tenant_features')],
).enableRLS();

// RLS enabled with no policy: invisible to the app role, readable and writable by platform only.
export const tenantFeatureEvents = pgTable(
  'tenant_feature_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    featureKey: text('feature_key').$type<FeatureKey>().notNull(),
    action: text('action', { enum: FEATURE_EVENT_ACTIONS }).notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('tenant_feature_events_tenant_created_idx').on(t.tenantId, t.createdAt)],
).enableRLS();
