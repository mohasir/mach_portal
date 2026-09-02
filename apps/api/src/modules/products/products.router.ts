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
import { db } from '../../db';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

const service = new ProductsService(new ProductsRepository(db));

const read = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.READ] });
const create = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
const update = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] });
const disable = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.DISABLE] });
const enable = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.ENABLE] });

const groupsRouter = router({
  create: create
    .input(createOptionGroupSchema)
    .mutation(({ input }) => service.createOptionGroup(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateOptionGroupSchema }))
    .mutation(({ input }) => service.updateOptionGroup(input.id, input.data)),
  disable: disable
    .input(catalogIdSchema)
    .mutation(({ input }) => service.toggleOptionGroupActive(input.id, false)),
  enable: enable
    .input(catalogIdSchema)
    .mutation(({ input }) => service.toggleOptionGroupActive(input.id, true)),
  reorder: update
    .input(catalogReorderSchema)
    .mutation(({ input }) => service.reorderOptionGroups(input.ids)),
});

const optionsRouter = router({
  create: create.input(createOptionSchema).mutation(({ input }) => service.createOption(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateOptionSchema }))
    .mutation(({ input }) => service.updateOption(input.id, input.data)),
  disable: disable
    .input(catalogIdSchema)
    .mutation(({ input }) => service.toggleOptionActive(input.id, false)),
  enable: enable
    .input(catalogIdSchema)
    .mutation(({ input }) => service.toggleOptionActive(input.id, true)),
  reorder: update
    .input(catalogReorderSchema)
    .mutation(({ input }) => service.reorderOptions(input.ids)),
});

const priceTiersUpdate = guardedProcedure({ [RESOURCES.PRICE_TIERS]: [ACTIONS.UPDATE] });

const pricesRouter = router({
  list: read.query(() => service.pricesList()),
  update: priceTiersUpdate
    .input(z.object({ id: z.uuid(), data: updateProductTiersSchema }))
    .mutation(({ input }) => service.updateProductTiers(input.id, input.data.tiers)),
});

export const productsRouter = router({
  list: read.query(() => service.list()),
  catalog: read
    .input(z.object({ includeInactive: z.boolean().default(true) }).optional())
    .query(({ input }) => service.catalog(input?.includeInactive ?? true)),

  create: create.input(createProductSchema).mutation(({ input }) => service.createProduct(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateProductSchema }))
    .mutation(({ input }) => service.updateProduct(input.id, input.data)),
  disable: disable
    .input(catalogIdSchema)
    .mutation(({ input }) => service.toggleProductActive(input.id, false)),
  enable: enable
    .input(catalogIdSchema)
    .mutation(({ input }) => service.toggleProductActive(input.id, true)),
  reorder: update
    .input(catalogReorderSchema)
    .mutation(({ input }) => service.reorderProducts(input.ids)),

  groups: groupsRouter,
  options: optionsRouter,
  prices: pricesRouter,
});
