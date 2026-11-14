import { z } from 'zod';
import { FEATURE_KEYS } from '@repo/guards';

export const featureKeySchema = z.enum(FEATURE_KEYS);

export const myFeaturesSchema = z.object({
  features: z.array(
    z.object({
      key: featureKeySchema,
      // ISO timestamp; null for core features and for ones with no end date.
      expiresAt: z.string().nullable(),
    }),
  ),
});
export type MyFeatures = z.infer<typeof myFeaturesSchema>;
