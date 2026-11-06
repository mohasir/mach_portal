import { z } from 'zod';
import {
  catalogIdSchema,
  catalogReorderSchema,
  createOptionGroupSchema,
  createOptionSchema,
  createProductSchema,
  updateOptionGroupSchema,
  updateOptionSchema,
  updateProductSchema,
  updateProductTiersSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { productsModule } from './products.module';

const read = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.READ] });
const create = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
const update = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] });
const disable = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.DISABLE] });
const enable = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.ENABLE] });
const deleteOption = guardedProcedure({ [RESOURCES.PRODUCT_OPTION]: [ACTIONS.DELETE] });
const duplicate = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.DUPLICATE] });

const groupsRouter = router({
  create: create
    .input(createOptionGroupSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).createOptionGroup(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateOptionGroupSchema }))
    .mutation(({ ctx, input }) => productsModule(ctx).updateOptionGroup(input.id, input.data)),
  delete: deleteOption
    .input(catalogIdSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).deleteOptionGroup(input.id)),
  disable: disable
    .input(catalogIdSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).toggleOptionGroupActive(input.id, false)),
  enable: enable
    .input(catalogIdSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).toggleOptionGroupActive(input.id, true)),
  reorder: update
    .input(catalogReorderSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).reorderOptionGroups(input.ids)),
});

const optionsRouter = router({
  create: create
    .input(createOptionSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).createOption(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateOptionSchema }))
    .mutation(({ ctx, input }) => productsModule(ctx).updateOption(input.id, input.data)),
  delete: deleteOption
    .input(catalogIdSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).deleteOption(input.id)),
  disable: disable
    .input(catalogIdSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).toggleOptionActive(input.id, false)),
  enable: enable
    .input(catalogIdSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).toggleOptionActive(input.id, true)),
  reorder: update
    .input(catalogReorderSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).reorderOptions(input.ids)),
});

const priceTiersUpdate = guardedProcedure({ [RESOURCES.PRICE_TIERS]: [ACTIONS.UPDATE] });

const pricesRouter = router({
  list: read.query(({ ctx }) => productsModule(ctx).pricesList()),
  update: priceTiersUpdate
    .input(z.object({ id: z.uuid(), data: updateProductTiersSchema }))
    .mutation(({ ctx, input }) =>
      productsModule(ctx).updateProductTiers(input.id, input.data.tiers),
    ),
});

export const productsRouter = router({
  list: read.query(({ ctx }) => productsModule(ctx).list()),
  catalog: read
    .input(z.object({ includeInactive: z.boolean().default(true) }).optional())
    .query(({ ctx, input }) => productsModule(ctx).catalog(input?.includeInactive ?? true)),

  create: create
    .input(createProductSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).createProduct(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateProductSchema }))
    .mutation(({ ctx, input }) => productsModule(ctx).updateProduct(input.id, input.data)),
  duplicate: duplicate
    .input(catalogIdSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).duplicateProduct(input.id)),
  disable: disable
    .input(catalogIdSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).toggleProductActive(input.id, false)),
  enable: enable
    .input(catalogIdSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).toggleProductActive(input.id, true)),
  reorder: update
    .input(catalogReorderSchema)
    .mutation(({ ctx, input }) => productsModule(ctx).reorderProducts(input.ids)),

  groups: groupsRouter,
  options: optionsRouter,
  prices: pricesRouter,
});
