import { z } from 'zod';

export const locationScopeSchema = z.enum(['country', 'areas']);
export type LocationScope = z.infer<typeof locationScopeSchema>;

// How many administrative levels a quote must carry: 0 = country only, 1 = region, 2 = locality.
export const locationDepthSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type LocationDepth = z.infer<typeof locationDepthSchema>;

export const LOCATION_REGION_MAX = 20;
export const LOCATION_LOCALITY_MAX = 120;
export const LOCATION_AREAS_MAX = 500;

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

// Region codes and locality names are checked against the @repo/geo datasets by the API.
export const locationAreaSchema = z.object({
  region: z.string().trim().min(1).max(LOCATION_REGION_MAX),
  locality: z.preprocess(
    blankToNull,
    z.string().trim().min(1).max(LOCATION_LOCALITY_MAX).nullable().default(null),
  ),
});
export type LocationArea = z.infer<typeof locationAreaSchema>;

// While `enabled` is false any field may be left empty; enabling requires the whole form.
export const updateLocationSettingsSchema = z.object({
  enabled: z.boolean(),
  country: z.preprocess(
    blankToNull,
    z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable()
      .default(null),
  ),
  depth: locationDepthSchema.nullable().default(null),
  scope: locationScopeSchema.nullable().default(null),
  areas: z.array(locationAreaSchema).max(LOCATION_AREAS_MAX).default([]),
  askAddress: z.boolean().default(false),
});
export type UpdateLocationSettingsInput = z.infer<typeof updateLocationSettingsSchema>;
