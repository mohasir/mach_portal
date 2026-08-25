import { updateQuotePdfTemplateSchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { TemplatesRepository } from './templates.repository';
import { TemplatesService } from './templates.service';

const service = new TemplatesService(new TemplatesRepository(db));

export const templatesRouter = router({
  getQuotePdf: guardedProcedure({ [RESOURCES.QUOTE_PDF_TEMPLATE]: [ACTIONS.VIEW] }).query(() =>
    service.getQuotePdf(),
  ),
  updateQuotePdf: guardedProcedure({ [RESOURCES.QUOTE_PDF_TEMPLATE]: [ACTIONS.UPDATE] })
    .input(updateQuotePdfTemplateSchema)
    .mutation(({ input }) => service.updateQuotePdf(input.content)),
});
