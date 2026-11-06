import { updateQuotePdfTemplateSchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { templatesModule } from './templates.module';

export const templatesRouter = router({
  getQuotePdf: guardedProcedure({ [RESOURCES.QUOTE_PDF_TEMPLATE]: [ACTIONS.VIEW] }).query(
    ({ ctx }) => templatesModule(ctx).getQuotePdf(),
  ),
  updateQuotePdf: guardedProcedure({ [RESOURCES.QUOTE_PDF_TEMPLATE]: [ACTIONS.UPDATE] })
    .input(updateQuotePdfTemplateSchema)
    .mutation(({ ctx, input }) => templatesModule(ctx).updateQuotePdf(input.content)),
});
