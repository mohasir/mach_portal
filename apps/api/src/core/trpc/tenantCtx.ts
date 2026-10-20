import type { Context } from './context';

export type Session = NonNullable<Context['session']>;
export type SessionUser = Session['user'];

export type TenantCtx = { tenantId: string; user: SessionUser; session: Session['session'] };
