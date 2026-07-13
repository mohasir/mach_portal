import { z } from 'zod';
import {
  catalogReorderSchema,
  catalogToggleActiveSchema,
  createOptionGroupSchema,
  createOptionSchema,
  createProductSchema,
  updateOptionGroupSchema,
  updateOptionSchema,
  updateProductSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../trpc/trpc';
import { db } from '../../db';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

const service = new ProductsService(new ProductsRepository(db));

// All 3 levels (product/option_group/option) gate on the single `product`
// resource (docs/mach-bar-flows.md §4.2: "gateado con useCan, recurso product").
const read = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.READ] });
const create = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
const update = guardedProcedure({ [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] });

const groupsRouter = router({
  create: create.input(createOptionGroupSchema).mutation(({ input }) => service.createOptionGroup(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateOptionGroupSchema }))
    .mutation(({ input }) => service.updateOptionGroup(input.id, input.data)),
  toggleActive: update
    .input(catalogToggleActiveSchema)
    .mutation(({ input }) => service.toggleOptionGroupActive(input.id, input.isActive)),
  reorder: update.input(catalogReorderSchema).mutation(({ input }) => service.reorderOptionGroups(input.ids)),
});

const optionsRouter = router({
  create: create.input(createOptionSchema).mutation(({ input }) => service.createOption(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateOptionSchema }))
    .mutation(({ input }) => service.updateOption(input.id, input.data)),
  toggleActive: update
    .input(catalogToggleActiveSchema)
    .mutation(({ input }) => service.toggleOptionActive(input.id, input.isActive)),
  reorder: update.input(catalogReorderSchema).mutation(({ input }) => service.reorderOptions(input.ids)),
});

export const productsRouter = router({
  // Active-only tree, consumed by the quote builder (mach-bar-flows.md §2.1).
  list: read.query(() => service.list()),
  // Full tree (active + inactive), consumed by the catalog editor (§4.5).
  catalog: read
    .input(z.object({ includeInactive: z.boolean().default(true) }).optional())
    .query(({ input }) => service.catalog(input?.includeInactive ?? true)),

  create: create.input(createProductSchema).mutation(({ input }) => service.createProduct(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateProductSchema }))
    .mutation(({ input }) => service.updateProduct(input.id, input.data)),
  toggleActive: update
    .input(catalogToggleActiveSchema)
    .mutation(({ input }) => service.toggleProductActive(input.id, input.isActive)),
  reorder: update.input(catalogReorderSchema).mutation(({ input }) => service.reorderProducts(input.ids)),

  groups: groupsRouter,
  options: optionsRouter,
});
