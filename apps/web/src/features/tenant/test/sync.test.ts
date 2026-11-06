import { describe, expect, it } from 'vitest';
import { actionForMessage, hasTenantChanged, parseSyncMessage } from '../sync';

describe('parseSyncMessage', () => {
  it('accepts well-formed messages and rejects anything else', () => {
    expect(parseSyncMessage({ kind: 'login', senderId: 'a' })).toEqual({
      kind: 'login',
      senderId: 'a',
    });
    expect(parseSyncMessage({ kind: 'nope', senderId: 'a' })).toBe(null);
    expect(parseSyncMessage({ kind: 'login' })).toBe(null);
    expect(parseSyncMessage(null)).toBe(null);
    expect(parseSyncMessage('login')).toBe(null);
  });
});

describe('actionForMessage', () => {
  it('goes home on organization change and login, to login on logout', () => {
    expect(actionForMessage({ kind: 'tenant-changed', senderId: 'a' }, 'me')).toBe('home');
    expect(actionForMessage({ kind: 'login', senderId: 'a' }, 'me')).toBe('home');
    expect(actionForMessage({ kind: 'logout', senderId: 'a' }, 'me')).toBe('login');
  });

  it('ignores own and invalid messages', () => {
    expect(actionForMessage({ kind: 'logout', senderId: 'me' }, 'me')).toBe(null);
    expect(actionForMessage({ kind: 'x', senderId: 'a' }, 'me')).toBe(null);
  });
});

describe('hasTenantChanged', () => {
  it('detects only a switch between two known organizations', () => {
    expect(hasTenantChanged('a', 'b')).toBe(true);
    expect(hasTenantChanged('a', 'a')).toBe(false);
    expect(hasTenantChanged(null, 'b')).toBe(false);
    expect(hasTenantChanged('a', null)).toBe(false);
    expect(hasTenantChanged('a', undefined)).toBe(false);
  });
});
