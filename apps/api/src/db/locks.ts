import { sql } from 'drizzle-orm';
import type { Executor } from './index';

// Transaction-scoped advisory locks. Each key lives only here so two call sites can never drift
// apart; hashtext is 32-bit, so a collision only makes unrelated callers wait for each other.

// Shared by user creation and tenant creation: every create/update/remove of one email serializes.
export function lockUserEmail(x: Executor, email: string) {
  return x.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`users_email:${email.toLowerCase()}`}))`,
  );
}

export function lockQuoteSeq(x: Executor, tenantId: string) {
  return x.execute(sql`select pg_advisory_xact_lock(hashtext(${`quotes_seq:${tenantId}`}))`);
}
