import { z } from 'zod';
import {
  createProductCategorySchema,
  productCategoriesListQuerySchema,
  updateProductCategorySchema,
} from '@repo/schemas';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { guardedProcedure, guardedProcedureAnyOf, router } from '../../core/trpc/trpc';
import { productCategoriesModule } from './productCategories.module';

const idInput = z.object({ id: z.uuid() });

export const productCategoriesRouter = router({
  list: guardedProcedure({ [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.READ] })
    .input(productCategoriesListQuerySchema)
    .query(({ ctx, input }) => productCategoriesModule(ctx).list(input)),

  // The product form picks a category and the catalog filters by one, so reading products is
  // enough to list the active ones.
  options: guardedProcedureAnyOf(
    { [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.READ] },
    { [RESOURCES.PRODUCT]: [ACTIONS.READ] },
  ).query(({ ctx }) => productCategoriesModule(ctx).options()),

  create: guardedProcedure({ [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.CREATE] })
    .input(createProductCategorySchema)
    .mutation(({ ctx, input }) => productCategoriesModule(ctx).create(input)),

  update: guardedProcedure({ [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateProductCategorySchema }))
    .mutation(({ ctx, input }) => productCategoriesModule(ctx).update(input.id, input.data)),

  disable: guardedProcedure({ [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.DISABLE] })
    .input(idInput)
    .mutation(({ ctx, input }) => productCategoriesModule(ctx).disable(input.id)),

  enable: guardedProcedure({ [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.ENABLE] })
    .input(idInput)
    .mutation(({ ctx, input }) => productCategoriesModule(ctx).enable(input.id)),

  delete: guardedProcedure({ [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.DELETE] })
    .input(idInput)
    .mutation(({ ctx, input }) => productCategoriesModule(ctx).remove(input.id)),
});
