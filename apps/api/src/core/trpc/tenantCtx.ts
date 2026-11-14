import type { FeatureKey } from '@repo/guards';
import type { Executor, TenantRunner } from '../../db';
import type { ResolvedAccess } from '../../lib/rbac/access';
import type { Context } from './context';

export type Session = NonNullable<Context['session']>;
export type SessionUser = Session['user'];

// Schedules work that must see the procedure's writes, e.g. a background job reading them on its
// own connection. It runs only once the request transaction has committed, never after a rollback.
export type AfterCommit = (task: () => void) => void;

export type TenantCtx = {
  tenantId: string;
  user: SessionUser;
  session: Session['session'];
  access: ResolvedAccess;
  // Active features of the tenant (core included), cached for a few seconds per tenant.
  features: ReadonlySet<FeatureKey>;
  // The request transaction, with the tenant set for RLS.
  db: Executor;
  // Opens a short transaction of its own, independent of (and not rolled back with) `db`. Inside a
  // request it takes a second pool connection while `db` still holds the first, so concurrent
  // requests doing this can exhaust the pool waiting on each other.
  runInTenant: TenantRunner;
  afterCommit: AfterCommit;
};

// Procedures that must not hold a connection across slow external calls get no request transaction.
export type ShortTxCtx = Omit<TenantCtx, 'db'>;
