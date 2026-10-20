import { router, tenantProcedure } from '../../core/trpc/trpc';
import { isMemberOf } from '../../lib/tenant/membership';

export const tenantRouter = router({
  current: tenantProcedure.query(async ({ ctx }) => {
    const { id, slug, name } = ctx.tenant;
    const user = ctx.session?.user as { id: string; isPlatformAdmin?: boolean | null } | undefined;
    const isPlatformAccess = Boolean(user?.isPlatformAdmin) && !(await isMemberOf(user!.id, id));
    return { id, slug, name, isPlatformAccess };
  }),
});
