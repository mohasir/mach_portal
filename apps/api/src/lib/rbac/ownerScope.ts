import { scopeFor, type AccessGrants, type ScopedCheck } from '@repo/guards';

// Only pairs listed in SCOPED_ACTIONS: the role editor offers own/all exactly for those.
export type ScopeCheck = ScopedCheck;

// Owner id to filter by, or undefined for no owner filter. Only when every check has scope 'all'
// is the filter lifted: an 'own' scope or a missing grant restricts the caller to own records.
export function ownerIdFor(
  access: AccessGrants,
  userId: string,
  ...checks: [ScopeCheck, ...ScopeCheck[]]
): string | undefined {
  const unrestricted = checks.every(
    ([resource, action]) => scopeFor(access, resource, action) === 'all',
  );
  return unrestricted ? undefined : userId;
}
