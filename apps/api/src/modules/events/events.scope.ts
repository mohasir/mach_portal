import { ACTIONS, RESOURCES, type AccessGrants } from '@repo/guards';
import { ownerIdFor, type ScopeCheck } from '../../lib/rbac/ownerScope';

// What gets filtered is always the event, so event.read always applies; a procedure gated by
// another action (event.update, payment.delete...) also applies that action's scope, and the
// stricter of the two wins. Shared by the tRPC router and the Express upload route.
export function eventOwnerId(
  access: AccessGrants,
  userId: string,
  gate?: ScopeCheck,
): string | undefined {
  const read: ScopeCheck = [RESOURCES.EVENT, ACTIONS.READ];
  return gate ? ownerIdFor(access, userId, read, gate) : ownerIdFor(access, userId, read);
}
