import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  RESOURCES,
  catalogActions,
  catalogResources,
  SCOPED_ACTIONS,
  type AccessGrants,
} from '@repo/guards';
import {
  buildMatrix,
  cellState,
  changeScope,
  diffPermissions,
  exceedingPermissions,
  fromPermissionList,
  resourceGroup,
  resourceState,
  togglePermission,
  toggleResource,
  toPermissionList,
  type MatrixCatalog,
  type PermissionValue,
} from '../lib/permissionMatrix';

const owner: AccessGrants = { isOwner: true, grants: {} };
const actor = (grants: AccessGrants['grants']): AccessGrants => ({ isOwner: false, grants });

const QUOTE_READ = 'quote.read';
const byCatalog = (resource: string) => (a: string, b: string) =>
  catalogActions(resource).indexOf(a) - catalogActions(resource).indexOf(b);
const QUOTE_UPDATE = 'quote.update';

describe('buildMatrix', () => {
  it('renders every catalog resource and action, in catalog order', () => {
    const matrix = buildMatrix();
    const resources = matrix.flatMap((g) => g.resources.map((r) => r.resource));
    expect(new Set(resources)).toEqual(new Set(catalogResources()));
    for (const group of matrix) {
      for (const { resource, actions } of group.resources) {
        expect(actions.map((a) => a.action)).toEqual([...catalogActions(resource)]);
      }
    }
  });

  it('includes a resource that is new to the catalog without any matrix change', () => {
    const catalog: MatrixCatalog = {
      resources: () => [...catalogResources(), 'invoice'],
      actions: (resource) =>
        resource === 'invoice' ? ['read', 'export'] : catalogActions(resource),
    };
    const matrix = buildMatrix(catalog);
    const other = matrix.find((g) => g.key === 'other');
    expect(other?.resources).toEqual([
      {
        resource: 'invoice',
        actions: [
          { action: 'read', key: 'invoice.read', scoped: false },
          { action: 'export', key: 'invoice.export', scoped: false },
        ],
      },
    ]);
  });

  it('omits empty groups and keeps a fixed group order', () => {
    const catalog: MatrixCatalog = {
      resources: () => [RESOURCES.ROLE, RESOURCES.QUOTE],
      actions: catalogActions,
    };
    expect(buildMatrix(catalog).map((g) => g.key)).toEqual(['operations', 'administration']);
  });

  it('marks scope support only on the pairs the API filters by owner', () => {
    const scopedOf = (resource: string) =>
      buildMatrix()
        .flatMap((g) => g.resources)
        .find((r) => r.resource === resource)
        ?.actions.filter((a) => a.scoped)
        .map((a) => a.action);
    expect(scopedOf(RESOURCES.QUOTE)).toEqual(
      [...SCOPED_ACTIONS[RESOURCES.QUOTE]].sort(byCatalog(RESOURCES.QUOTE)),
    );
    expect(scopedOf(RESOURCES.QUOTE)).not.toContain(ACTIONS.CREATE);
    expect(scopedOf(RESOURCES.QUOTE)).not.toContain(ACTIONS.MANAGE_ASSIGNMENT);
    expect(scopedOf(RESOURCES.EVENT)).not.toContain(ACTIONS.CREATE);
    expect(scopedOf(RESOURCES.PAYMENT)).toContain(ACTIONS.READ);
    expect(scopedOf(RESOURCES.CLIENT)).toEqual([]);
  });

  it('puts unknown resources in the "other" group', () => {
    expect(resourceGroup(RESOURCES.QUOTE)).toBe('operations');
    expect(resourceGroup(RESOURCES.PRODUCT)).toBe('catalog');
    expect(resourceGroup(RESOURCES.TAX_RATES)).toBe('settings');
    expect(resourceGroup(RESOURCES.ROLE)).toBe('administration');
    expect(resourceGroup('invoice')).toBe('other');
  });
});

describe('cellState', () => {
  it('disables a permission the actor does not hold', () => {
    const state = cellState({}, actor({ [QUOTE_READ]: 'all' }), false, 'quote', 'update');
    expect(state).toMatchObject({ checked: false, disabled: true });
  });

  it('enables a permission the actor holds', () => {
    const state = cellState({}, actor({ [QUOTE_READ]: 'all' }), false, 'quote', 'read');
    expect(state).toMatchObject({ checked: false, disabled: false, allScopeDisabled: false });
  });

  it("an actor with scope 'own' cannot pick 'all'", () => {
    const state = cellState(
      { [QUOTE_READ]: 'own' },
      actor({ [QUOTE_READ]: 'own' }),
      false,
      'quote',
      'read',
    );
    expect(state).toMatchObject({ checked: true, scope: 'own', allScopeDisabled: true });
  });

  it('disables a granted permission wider than what the actor holds', () => {
    const state = cellState(
      { [QUOTE_READ]: 'all' },
      actor({ [QUOTE_READ]: 'own' }),
      false,
      'quote',
      'read',
    );
    expect(state).toMatchObject({ checked: true, disabled: true });
  });

  it('shows everything checked and disabled when locked (owner role)', () => {
    const state = cellState({}, owner, true, 'quote', 'delete');
    expect(state).toEqual({
      checked: true,
      scope: 'all',
      disabled: true,
      allScopeDisabled: true,
    });
  });

  it('an owner actor can grant anything', () => {
    expect(cellState({}, owner, false, 'role', 'delete').disabled).toBe(false);
  });

  it('disables everything while the actor permissions are not loaded', () => {
    expect(cellState({}, undefined, false, 'quote', 'read').disabled).toBe(true);
  });
});

describe('togglePermission / changeScope', () => {
  it('grants at the widest scope the actor holds', () => {
    expect(togglePermission({}, owner, 'quote', 'read', true)).toEqual({ [QUOTE_READ]: 'all' });
    expect(togglePermission({}, actor({ [QUOTE_READ]: 'own' }), 'quote', 'read', true)).toEqual({
      [QUOTE_READ]: 'own',
    });
  });

  it('removes a permission', () => {
    expect(togglePermission({ [QUOTE_READ]: 'all' }, owner, 'quote', 'read', false)).toEqual({});
  });

  it('ignores a change to a disabled permission', () => {
    const value: PermissionValue = { [QUOTE_UPDATE]: 'all' };
    const a = actor({ [QUOTE_READ]: 'all' });
    expect(togglePermission(value, a, 'quote', 'update', false)).toBe(value);
    expect(togglePermission({}, a, 'quote', 'update', true)).toEqual({});
  });

  it('does not mutate the input', () => {
    const value: PermissionValue = { [QUOTE_READ]: 'all' };
    togglePermission(value, owner, 'quote', 'update', true);
    expect(value).toEqual({ [QUOTE_READ]: 'all' });
  });

  it('changes the scope of a granted permission', () => {
    expect(changeScope({ [QUOTE_READ]: 'all' }, owner, 'quote', 'read', 'own')).toEqual({
      [QUOTE_READ]: 'own',
    });
  });

  it("refuses 'all' when the actor only holds 'own'", () => {
    const value: PermissionValue = { [QUOTE_READ]: 'own' };
    expect(changeScope(value, actor({ [QUOTE_READ]: 'own' }), 'quote', 'read', 'all')).toBe(value);
  });

  it('ignores a scope change on a permission that is not granted', () => {
    const value: PermissionValue = {};
    expect(changeScope(value, owner, 'quote', 'read', 'own')).toBe(value);
  });
});

describe('resource selection', () => {
  const quoteActions = catalogActions(RESOURCES.QUOTE);

  it('selects every action the actor can grant and leaves the rest', () => {
    const a = actor({ [QUOTE_READ]: 'own', [QUOTE_UPDATE]: 'all' });
    expect(toggleResource({}, a, 'quote', quoteActions, true)).toEqual({
      [QUOTE_READ]: 'own',
      [QUOTE_UPDATE]: 'all',
    });
  });

  it('clears only what the actor can change', () => {
    const a = actor({ [QUOTE_READ]: 'all' });
    const value: PermissionValue = { [QUOTE_READ]: 'all', 'quote.delete': 'all' };
    expect(toggleResource(value, a, 'quote', quoteActions, false)).toEqual({
      'quote.delete': 'all',
    });
  });

  it('keeps an already granted scope when selecting all', () => {
    const value: PermissionValue = { [QUOTE_READ]: 'own' };
    expect(toggleResource(value, owner, 'quote', [ACTIONS.READ], true)).toEqual({
      [QUOTE_READ]: 'own',
    });
  });

  it('reports checked / indeterminate / disabled', () => {
    expect(resourceState({}, owner, false, 'quote', quoteActions)).toMatchObject({
      checked: false,
      indeterminate: false,
      granted: 0,
      total: quoteActions.length,
      disabled: false,
    });
    expect(
      resourceState({ [QUOTE_READ]: 'all' }, owner, false, 'quote', quoteActions),
    ).toMatchObject({ checked: false, indeterminate: true, granted: 1 });
    const all = Object.fromEntries(quoteActions.map((a) => [`quote.${a}`, 'all' as const]));
    expect(resourceState(all, owner, false, 'quote', quoteActions)).toMatchObject({
      checked: true,
      indeterminate: false,
    });
    expect(resourceState({}, actor({}), false, 'quote', quoteActions).disabled).toBe(true);
  });

  it('is fully checked and disabled when locked', () => {
    expect(resourceState({}, owner, true, 'quote', quoteActions)).toMatchObject({
      checked: true,
      indeterminate: false,
      granted: quoteActions.length,
      disabled: true,
    });
  });
});

describe('list conversion', () => {
  it('round-trips a permission list', () => {
    const list = [
      { resource: 'quote', action: 'read', scope: 'own' as const },
      { resource: 'client', action: 'create', scope: 'all' as const },
    ];
    const value = fromPermissionList(list);
    expect(value).toEqual({ 'quote.read': 'own', 'client.create': 'all' });
    expect(toPermissionList(value)).toEqual([
      { resource: 'client', action: 'create', scope: 'all' },
      { resource: 'quote', action: 'read', scope: 'own' },
    ]);
  });

  it('sends all for an action without own/all, whatever scope was stored', () => {
    expect(toPermissionList({ 'quote.create': 'own', 'quote.read': 'own' })).toEqual([
      { resource: 'quote', action: 'create', scope: 'all' },
      { resource: 'quote', action: 'read', scope: 'own' },
    ]);
  });

  it('drops permissions that are no longer in the catalog', () => {
    expect(toPermissionList({ 'quote.read': 'all', 'quote.retired': 'all' })).toEqual([
      { resource: 'quote', action: 'read', scope: 'all' },
    ]);
  });
});

describe('diffPermissions', () => {
  it('lists added, removed and rescoped keys', () => {
    expect(
      diffPermissions(
        { 'quote.read': 'all', 'quote.update': 'all', 'client.read': 'all' },
        { 'quote.read': 'own', 'client.read': 'all', 'client.create': 'all' },
      ),
    ).toEqual({ added: ['client.create'], removed: ['quote.update'], rescoped: ['quote.read'] });
  });

  it('is empty for equal values', () => {
    expect(diffPermissions({ 'quote.read': 'all' }, { 'quote.read': 'all' })).toEqual({
      added: [],
      removed: [],
      rescoped: [],
    });
  });
});

describe('exceedingPermissions', () => {
  it('lists the permissions wider than what the actor holds', () => {
    const a = actor({ [QUOTE_READ]: 'own' });
    expect(exceedingPermissions({ [QUOTE_READ]: 'all', 'client.read': 'all' }, a)).toEqual([
      'client.read',
      QUOTE_READ,
    ]);
    expect(exceedingPermissions({ [QUOTE_READ]: 'own' }, a)).toEqual([]);
    expect(exceedingPermissions({ 'client.read': 'all' }, owner)).toEqual([]);
  });
});
