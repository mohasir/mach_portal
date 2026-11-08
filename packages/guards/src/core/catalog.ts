import { statements } from './access-control';

// Better Auth's admin plugin declares more user/session actions than any tenant procedure checks;
// granting one of those per tenant would do nothing, so the tenant catalog keeps only these.
const TENANT_USER_ACTIONS: readonly string[] = [
  'create',
  'list',
  'delete',
  'set-password',
  'update',
];
const PLATFORM_ONLY_RESOURCES: readonly string[] = ['session'];

// What a tenant role may grant: the roles editor, role validation and access resolution all read
// this, so a permission outside it can never be stored or authorize.
export const TENANT_PERMISSIONS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    Object.entries(statements as Readonly<Record<string, readonly string[]>>)
      .filter(([resource]) => !PLATFORM_ONLY_RESOURCES.includes(resource))
      .map(([resource, actions]) => [
        resource,
        Object.freeze(
          resource === 'user'
            ? actions.filter((a) => TENANT_USER_ACTIONS.includes(a))
            : [...actions],
        ),
      ]),
  ),
);

export function isCatalogPermission(resource: string, action: string): boolean {
  return (
    Object.hasOwn(TENANT_PERMISSIONS, resource) && TENANT_PERMISSIONS[resource]!.includes(action)
  );
}

export function catalogResources(): string[] {
  return Object.keys(TENANT_PERMISSIONS);
}

export function catalogActions(resource: string): readonly string[] {
  return Object.hasOwn(TENANT_PERMISSIONS, resource) ? TENANT_PERMISSIONS[resource]! : [];
}
