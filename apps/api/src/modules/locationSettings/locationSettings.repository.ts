import { asc, sql } from 'drizzle-orm';
import type { LocationArea, LocationDepth, LocationScope } from '@repo/schemas';
import type { Executor } from '../../db';
import { tenantLocation, tenantLocationAreas } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { publicLocationAreaColumns, publicLocationColumns } from './locationSettings.resource';

export type LocationSettingsWrite = {
  enabled: boolean;
  country: string | null;
  depth: LocationDepth | null;
  scope: LocationScope | null;
  areas: LocationArea[];
  askAddress: boolean;
};

export class LocationSettingsRepository {
  constructor(
    private db: Executor,
    private tenantId: string,
  ) {}

  async find() {
    const [row] = await this.db
      .select(publicLocationColumns)
      .from(tenantLocation)
      .where(tenantEq(tenantLocation, this.tenantId))
      .limit(1);
    const areas = row
      ? await this.db
          .select(publicLocationAreaColumns)
          .from(tenantLocationAreas)
          .where(tenantEq(tenantLocationAreas, this.tenantId))
          .orderBy(asc(tenantLocationAreas.region), asc(tenantLocationAreas.locality))
      : [];
    return { row, areas };
  }

  // The settings row and its areas are replaced together, so a failed write leaves the previous
  // configuration whole.
  save({ areas, ...data }: LocationSettingsWrite) {
    return this.db.transaction(async (tx) => {
      await tx
        .insert(tenantLocation)
        .values({ ...data, tenantId: this.tenantId })
        .onConflictDoUpdate({
          target: tenantLocation.tenantId,
          set: { ...data, updatedAt: sql`now()` },
          setWhere: tenantEq(tenantLocation, this.tenantId),
        });
      await tx.delete(tenantLocationAreas).where(tenantEq(tenantLocationAreas, this.tenantId));
      if (areas.length > 0) {
        await tx
          .insert(tenantLocationAreas)
          .values(
            areas.map((a) => ({ region: a.region, locality: a.locality, tenantId: this.tenantId })),
          );
      }
    });
  }
}
