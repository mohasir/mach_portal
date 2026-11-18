import { describe, expect, it } from 'vitest';
import { resolveConsoleAccess } from '../helpers';

describe('resolveConsoleAccess', () => {
  it('is loading while the session is pending', () => {
    expect(resolveConsoleAccess({ isPending: true, isPlatformAdmin: false })).toBe('loading');
    expect(resolveConsoleAccess({ isPending: true, isPlatformAdmin: true })).toBe('loading');
  });

  it('allows a platform admin', () => {
    expect(resolveConsoleAccess({ isPending: false, isPlatformAdmin: true })).toBe('allow');
  });

  it('shows not found to anyone else', () => {
    expect(resolveConsoleAccess({ isPending: false, isPlatformAdmin: false })).toBe('notFound');
  });
});
