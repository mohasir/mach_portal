import {
  RESOURCES,
  catalogActions,
  catalogResources,
  isCatalogPermission,
  permissionKey,
  scopeFor,
  supportsScope,
  type AccessGrants,
} from '@repo/guards';
import type { PermissionScope, RolePermissionInput } from '@repo/schemas';

/** Granted permissions keyed by `resource.action`, the same shape as `AccessGrants.grants`. */
export type PermissionValue = Readonly<Record<string, PermissionScope>>;

export interface MatrixCatalog {
  resources: () => readonly string[];
  actions: (resource: string) => readonly string[];
}

export interface MatrixAction {
  action: string;
  key: string;
  scoped: boolean;
}

export interface MatrixResource {
  resource: string;
  actions: MatrixAction[];
}

export const MATRIX_GROUPS = [
  'operations',
  'catalog',
  'settings',
  'administration',
  'other',
] as const;
export type MatrixGroupKey = (typeof MATRIX_GROUPS)[number];

export interface MatrixGroup {
  key: MatrixGroupKey;
  resources: MatrixResource[];
}

const defaultCatalog: MatrixCatalog = { resources: catalogResources, actions: catalogActions };

const GROUP_BY_RESOURCE: Readonly<Record<string, MatrixGroupKey>> = {
  [RESOURCES.DASHBOARD]: 'operations',
  [RESOURCES.EVENT]: 'operations',
  [RESOURCES.PAYMENT]: 'operations',
  [RESOURCES.CLIENT]: 'operations',
  [RESOURCES.QUOTE]: 'operations',
  [RESOURCES.PIPELINE]: 'operations',
  [RESOURCES.STAFF]: 'operations',
  [RESOURCES.PRODUCT]: 'catalog',
  [RESOURCES.PRODUCT_OPTION]: 'catalog',
  [RESOURCES.PRICE_TIERS]: 'catalog',
  [RESOURCES.UNIT_OF_MEASURE]: 'catalog',
  [RESOURCES.CHARGE_TYPE]: 'catalog',
  [RESOURCES.PRODUCT_CATEGORY]: 'catalog',
  [RESOURCES.PRODUCT_COST]: 'catalog',
  [RESOURCES.EVENT_TYPE]: 'catalog',
  [RESOURCES.RESCHEDULE_REASON]: 'catalog',
  [RESOURCES.TAX_RATES]: 'settings',
  [RESOURCES.QUOTE_DEFAULTS]: 'settings',
  [RESOURCES.QUOTE_STAGES]: 'settings',
  [RESOURCES.CATALOG_PREFERENCES]: 'settings',
  [RESOURCES.QUOTE_PDF_TEMPLATE]: 'settings',
  [RESOURCES.QUOTE_BUILDER_PREFERENCES]: 'settings',
  [RESOURCES.PIPELINE_PREFERENCES]: 'settings',
  [RESOURCES.ROLE]: 'administration',
  user: 'administration',
};

export function resourceGroup(resource: string): MatrixGroupKey {
  return Object.hasOwn(GROUP_BY_RESOURCE, resource) ? GROUP_BY_RESOURCE[resource]! : 'other';
}

export function buildMatrix(catalog: MatrixCatalog = defaultCatalog): MatrixGroup[] {
  const byGroup = new Map<MatrixGroupKey, MatrixResource[]>();
  for (const resource of catalog.resources()) {
    const entry: MatrixResource = {
      resource,
      actions: catalog.actions(resource).map((action) => ({
        action,
        key: permissionKey(resource, action),
        scoped: supportsScope(resource, action),
      })),
    };
    const group = resourceGroup(resource);
    byGroup.set(group, [...(byGroup.get(group) ?? []), entry]);
  }
  return MATRIX_GROUPS.filter((key) => byGroup.has(key)).map((key) => ({
    key,
    resources: byGroup.get(key)!,
  }));
}

function exceeds(scope: PermissionScope | undefined, held: PermissionScope | null): boolean {
  if (!scope) return false;
  return held === null || (scope === 'all' && held === 'own');
}

export interface CellState {
  checked: boolean;
  scope: PermissionScope | null;
  disabled: boolean;
  allScopeDisabled: boolean;
}

export function cellState(
  value: PermissionValue,
  actor: AccessGrants | null | undefined,
  locked: boolean,
  resource: string,
  action: string,
): CellState {
  if (locked) return { checked: true, scope: 'all', disabled: true, allScopeDisabled: true };
  const scope = value[permissionKey(resource, action)];
  const held = scopeFor(actor, resource, action);
  return {
    checked: !!scope,
    scope: scope ?? null,
    // A permission wider than the actor's own cannot be changed by them, not even removed.
    disabled: held === null || exceeds(scope, held),
    allScopeDisabled: held !== 'all',
  };
}

function isEditable(
  value: PermissionValue,
  actor: AccessGrants | null | undefined,
  resource: string,
  action: string,
): boolean {
  return !cellState(value, actor, false, resource, action).disabled;
}

export function togglePermission(
  value: PermissionValue,
  actor: AccessGrants | null | undefined,
  resource: string,
  action: string,
  checked: boolean,
): PermissionValue {
  if (!isEditable(value, actor, resource, action)) return value;
  const key = permissionKey(resource, action);
  if (!checked) {
    if (!(key in value)) return value;
    const next = { ...value };
    delete next[key];
    return next;
  }
  if (key in value) return value;
  return { ...value, [key]: scopeFor(actor, resource, action)! };
}

export function changeScope(
  value: PermissionValue,
  actor: AccessGrants | null | undefined,
  resource: string,
  action: string,
  scope: PermissionScope,
): PermissionValue {
  const key = permissionKey(resource, action);
  const current = value[key];
  if (!current || current === scope) return value;
  if (!isEditable(value, actor, resource, action)) return value;
  if (exceeds(scope, scopeFor(actor, resource, action))) return value;
  return { ...value, [key]: scope };
}

export interface ResourceState {
  checked: boolean;
  indeterminate: boolean;
  granted: number;
  total: number;
  disabled: boolean;
}

export function resourceState(
  value: PermissionValue,
  actor: AccessGrants | null | undefined,
  locked: boolean,
  resource: string,
  actions: readonly string[],
): ResourceState {
  const total = actions.length;
  if (locked) return { checked: true, indeterminate: false, granted: total, total, disabled: true };
  const granted = actions.filter((a) => permissionKey(resource, a) in value).length;
  return {
    checked: total > 0 && granted === total,
    indeterminate: granted > 0 && granted < total,
    granted,
    total,
    disabled: actions.every((a) => !isEditable(value, actor, resource, a)),
  };
}

export function toggleResource(
  value: PermissionValue,
  actor: AccessGrants | null | undefined,
  resource: string,
  actions: readonly string[],
  checked: boolean,
): PermissionValue {
  return actions.reduce(
    (next, action) => togglePermission(next, actor, resource, action, checked),
    value,
  );
}

export function fromPermissionList(
  permissions: readonly Pick<RolePermissionInput, 'resource' | 'action' | 'scope'>[],
): PermissionValue {
  return Object.fromEntries(
    permissions.map((p) => [permissionKey(p.resource, p.action), p.scope] as const),
  );
}

// Permissions retired from the catalog are dropped: the API rejects any it does not know.
export function toPermissionList(
  value: PermissionValue,
  catalog: MatrixCatalog = defaultCatalog,
): RolePermissionInput[] {
  return catalog.resources().flatMap((resource) =>
    catalog.actions(resource).flatMap((action) => {
      const stored = value[permissionKey(resource, action)];
      if (!stored || !isCatalogPermission(resource, action)) return [];
      // The API accepts 'own' only where it filters by owner; older roles may hold it elsewhere.
      const scope = supportsScope(resource, action) ? stored : 'all';
      return [{ resource, action, scope }];
    }),
  );
}

export interface PermissionDiff {
  added: string[];
  removed: string[];
  rescoped: string[];
}

export function diffPermissions(before: PermissionValue, after: PermissionValue): PermissionDiff {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return {
    added: keys.filter((k) => !before[k] && after[k]),
    removed: keys.filter((k) => before[k] && !after[k]),
    rescoped: keys.filter((k) => before[k] && after[k] && before[k] !== after[k]),
  };
}

/** Keys the actor cannot hold at the granted scope; the API refuses to touch such a role. */
export function exceedingPermissions(
  value: PermissionValue,
  actor: AccessGrants | null | undefined,
): string[] {
  if (actor?.isOwner) return [];
  return Object.keys(value)
    .filter((key) => {
      const dot = key.indexOf('.');
      const held = scopeFor(actor, key.slice(0, dot), key.slice(dot + 1));
      return exceeds(value[key], held);
    })
    .sort();
}
