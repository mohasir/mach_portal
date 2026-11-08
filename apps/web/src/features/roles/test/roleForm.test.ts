import { describe, expect, it } from 'vitest';
import {
  buildCreatePayload,
  buildUpdatePayload,
  editorMode,
  initialFormState,
  isFormDirty,
  rebaseOnLatest,
  type RoleSource,
} from '../lib/roleForm';

const role: RoleSource = {
  id: 'r1',
  name: 'Sales',
  isOwner: false,
  version: 3,
  permissions: [
    { resource: 'quote', action: 'read', scope: 'own' },
    { resource: 'client', action: 'read', scope: 'all' },
  ],
};

describe('initialFormState', () => {
  it('is empty for a new role', () => {
    expect(initialFormState()).toEqual({ name: '', permissions: {} });
  });

  it('loads name and permissions from the role', () => {
    expect(initialFormState(role)).toEqual({
      name: 'Sales',
      permissions: { 'quote.read': 'own', 'client.read': 'all' },
    });
  });
});

describe('payloads', () => {
  it('create trims the name and sends the permission list', () => {
    expect(buildCreatePayload({ name: '  Sales  ', permissions: { 'quote.read': 'own' } })).toEqual(
      { name: 'Sales', permissions: [{ resource: 'quote', action: 'read', scope: 'own' }] },
    );
  });

  it('update sends the expectedVersion read with the role', () => {
    const payload = buildUpdatePayload(role.id, role.version, {
      name: 'Sales team',
      permissions: { 'quote.read': 'all' },
    });
    expect(payload).toEqual({
      id: 'r1',
      expectedVersion: 3,
      name: 'Sales team',
      permissions: [{ resource: 'quote', action: 'read', scope: 'all' }],
    });
  });
});

describe('isFormDirty', () => {
  it('detects name and permission changes', () => {
    const base = initialFormState(role);
    expect(isFormDirty(base, base)).toBe(false);
    expect(isFormDirty(base, { ...base, name: 'Other' })).toBe(true);
    expect(isFormDirty(base, { ...base, permissions: {} })).toBe(true);
    expect(isFormDirty(base, { ...base, name: ' Sales ' })).toBe(false);
  });
});

describe('rebaseOnLatest (version conflict reload)', () => {
  it('keeps what the user typed and moves expectedVersion to the latest version', () => {
    const draft = { name: 'Sales EU', permissions: { 'quote.read': 'all' as const } };
    const latest: RoleSource = {
      ...role,
      version: 5,
      name: 'Sales',
      permissions: [
        { resource: 'quote', action: 'read', scope: 'own' },
        { resource: 'quote', action: 'update', scope: 'own' },
      ],
    };
    const result = rebaseOnLatest(draft, latest);
    expect(result.draft).toBe(draft);
    expect(result.expectedVersion).toBe(5);
    // What saving the draft would change on top of the latest version.
    expect(result.diff).toEqual({
      nameChanged: true,
      added: [],
      removed: ['quote.update'],
      rescoped: ['quote.read'],
    });
  });

  it('reports no difference when the draft already matches the latest version', () => {
    const latest: RoleSource = { ...role, version: 4 };
    const result = rebaseOnLatest(initialFormState(role), latest);
    expect(result.diff).toEqual({ nameChanged: false, added: [], removed: [], rescoped: [] });
  });
});

describe('editorMode', () => {
  const actor = {
    isOwner: false,
    grants: { 'quote.read': 'own' as const, 'client.read': 'all' as const },
  };

  it('locks the owner role', () => {
    expect(editorMode({ ...role, isOwner: true }, true, actor)).toEqual({
      locked: true,
      exceedsActor: false,
      readOnly: true,
    });
  });

  it('is editable when the role stays within the actor power', () => {
    expect(editorMode(role, true, actor)).toEqual({
      locked: false,
      exceedsActor: false,
      readOnly: false,
    });
  });

  it('is read-only without role.update', () => {
    expect(editorMode(role, false, actor).readOnly).toBe(true);
  });

  it('turns read-only when a reloaded version holds permissions the actor lacks', () => {
    const reloaded: RoleSource = {
      ...role,
      version: 4,
      permissions: [...role.permissions, { resource: 'quote', action: 'delete', scope: 'all' }],
    };
    expect(editorMode(reloaded, true, actor)).toEqual({
      locked: false,
      exceedsActor: true,
      readOnly: true,
    });
  });
});
