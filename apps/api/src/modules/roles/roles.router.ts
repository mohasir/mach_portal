import { z } from 'zod';
import { createRoleSchema, updateRoleSchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure, guardedProcedureAnyOf } from '../../core/trpc/trpc';
import { rolesModule } from './roles.module';

const read = guardedProcedure({ [RESOURCES.ROLE]: [ACTIONS.READ] });
const create = guardedProcedure({ [RESOURCES.ROLE]: [ACTIONS.CREATE] });
const update = guardedProcedure({ [RESOURCES.ROLE]: [ACTIONS.UPDATE] });
const remove = guardedProcedure({ [RESOURCES.ROLE]: [ACTIONS.DELETE] });
// Whoever may create or edit users has to pick a role for them, with or without role.read.
const assign = guardedProcedureAnyOf({ user: [ACTIONS.CREATE] }, { user: [ACTIONS.UPDATE] });

const roleIdSchema = z.object({ id: z.string().min(1) });

export const rolesRouter = router({
  list: read.query(({ ctx }) => rolesModule(ctx).list()),
  assignable: assign.query(({ ctx }) => rolesModule(ctx).assignable()),
  get: read.input(roleIdSchema).query(({ ctx, input }) => rolesModule(ctx).get(input.id)),
  create: create
    .input(createRoleSchema)
    .mutation(({ ctx, input }) => rolesModule(ctx).create(input)),
  update: update.input(updateRoleSchema).mutation(({ ctx, input }) => {
    const { id, ...rest } = input;
    return rolesModule(ctx).update(id, rest);
  }),
  // Copying a role creates one, so it needs create rather than update.
  duplicate: create
    .input(roleIdSchema)
    .mutation(({ ctx, input }) => rolesModule(ctx).duplicate(input.id)),
  delete: remove
    .input(roleIdSchema)
    .mutation(({ ctx, input }) => rolesModule(ctx).delete(input.id)),
});
