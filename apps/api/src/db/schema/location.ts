import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { LocationDepth, LocationScope } from '@repo/schemas';
import { organization } from './auth';
import { tenantId } from './tenantColumn';
import { tenantIsolationPolicy } from '../rls/policy';

// One row per organization; a missing row reads as the feature turned off.
export const tenantLocation = pgTable(
  'tenant_location',
  {
    tenantId: text('tenant_id')
      .primaryKey()
      .references(() => organization.id),
    enabled: boolean('enabled').default(false).notNull(),
    // ISO 3166-1 alpha-2, one of the @repo/geo countries.
    country: text('country'),
    depth: smallint('depth').$type<LocationDepth>(),
    scope: text('scope').$type<LocationScope>(),
    askAddress: boolean('ask_address').default(false).notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  () => [
    check('tenant_location_depth_check', sql`depth BETWEEN 0 AND 2`),
    check('tenant_location_scope_check', sql`scope IN ('country', 'areas')`),
    check(
      'tenant_location_enabled_complete_check',
      sql`NOT enabled OR (country IS NOT NULL AND depth IS NOT NULL AND scope IS NOT NULL)`,
    ),
    tenantIsolationPolicy('tenant_location'),
  ],
).enableRLS();

// Covered areas when scope = 'areas'; a null locality covers the whole region.
export const tenantLocationAreas = pgTable(
  'tenant_location_areas',
  {
    tenantId: tenantId().references(() => tenantLocation.tenantId, { onDelete: 'cascade' }),
    region: text('region').notNull(),
    locality: text('locality'),
  },
  (t) => [
    // coalesce makes two region-wide rows (null locality) collide, as a primary key would.
    uniqueIndex('tenant_location_areas_uidx').on(
      t.tenantId,
      t.region,
      sql`coalesce(${t.locality}, '')`,
    ),
    tenantIsolationPolicy('tenant_location_areas'),
  ],
).enableRLS();
