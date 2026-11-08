import { describe, expect, it } from 'vitest';
import { can, permissionKey, scopeFor, type AccessGrants } from '../evaluate';

const owner: AccessGrants = { isOwner: true, grants: {} };
const member: AccessGrants = {
  isOwner: false,
  grants: {
    'quote.read': 'own',
    'quote.update': 'all',
    'legacy_thing.read': 'all',
  },
};

describe('permissionKey', () => {
  it('joins resource and action', () => {
    expect(permissionKey('quote', 'read')).toBe('quote.read');
  });
});

describe('can', () => {
  it('is true for the owner regardless of grants', () => {
    expect(can(owner, { quote: ['delete'] })).toBe(true);
  });

  it('is false for null or undefined access', () => {
    expect(can(null, { quote: ['read'] })).toBe(false);
    expect(can(undefined, { quote: ['read'] })).toBe(false);
  });

  it('is true only when every requested action is granted', () => {
    expect(can(member, { quote: ['read', 'update'] })).toBe(true);
    expect(can(member, { quote: ['read', 'delete'] })).toBe(false);
  });

  it('fails closed on a check that names no action, for every caller', () => {
    for (const access of [member, owner]) {
      expect(can(access, {})).toBe(false);
      expect(can(access, { quote: undefined })).toBe(false);
      expect(can(access, { quote: [] })).toBe(false);
    }
  });

  it('ignores an empty resource entry next to a requested action', () => {
    expect(can(member, { quote: ['update'], event: undefined })).toBe(true);
    expect(can(member, { quote: ['update'], event: [] })).toBe(true);
  });

  it('requires every resource in the check', () => {
    expect(can(member, { quote: ['read'], client: ['read'] })).toBe(false);
  });

  it('ignores grant keys outside the catalog', () => {
    expect(can(member, { legacy_thing: ['read'] } as never)).toBe(false);
  });
});

describe('scopeFor', () => {
  it('returns all for the owner', () => {
    expect(scopeFor(owner, 'quote', 'read')).toBe('all');
  });

  it('returns the granted scope', () => {
    expect(scopeFor(member, 'quote', 'read')).toBe('own');
    expect(scopeFor(member, 'quote', 'update')).toBe('all');
  });

  it('reads an own grant on an action the API never filters by owner as all', () => {
    const legacy: AccessGrants = { isOwner: false, grants: { 'quote.create': 'own' } };
    expect(scopeFor(legacy, 'quote', 'create')).toBe('all');
  });

  it('returns null when not granted or no access', () => {
    expect(scopeFor(member, 'quote', 'delete')).toBeNull();
    expect(scopeFor(null, 'quote', 'read')).toBeNull();
  });
});
