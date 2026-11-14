import { myFeaturesSchema } from '@repo/schemas';
import { protectedProcedure, router } from '../../core/trpc/trpc';
import { featuresModule } from './features.module';

export const featuresRouter = router({
  // Any member of the organization: the web needs it to decide what to show.
  mine: protectedProcedure
    .output(myFeaturesSchema)
    .query(({ ctx }) => featuresModule(ctx).mine(ctx.features)),
});
