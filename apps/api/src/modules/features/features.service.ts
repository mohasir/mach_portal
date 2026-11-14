import type { FeatureKey, FeatureRow } from '@repo/guards';
import { myFeaturesResource } from './features.resource';

export class FeaturesService {
  constructor(private loadRows: () => Promise<FeatureRow[]>) {}

  // `active` is the set the API enforces (ctx.features), so the answer never disagrees with the
  // guards even while the cache is stale; the rows only supply the expiry dates.
  async mine(active: ReadonlySet<FeatureKey>) {
    return myFeaturesResource(active, await this.loadRows());
  }
}
