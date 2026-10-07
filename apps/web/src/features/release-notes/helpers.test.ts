import { describe, expect, it } from 'vitest';
import { compareVersions, resolveGateState, resolveReleaseNotesAction } from './helpers';

describe('compareVersions', () => {
  it('compares each part numerically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0);
    expect(compareVersions('0.16.0', '0.17.0')).toBeLessThan(0);
    expect(compareVersions('0.17.0', '0.17.0')).toBe(0);
  });

  it('returns null when a version is not MAJOR.MINOR.PATCH', () => {
    expect(compareVersions('0.17', '0.17.0')).toBeNull();
    expect(compareVersions('dev', '0.17.0')).toBeNull();
    expect(compareVersions('', '0.17.0')).toBeNull();
  });
});

describe('resolveReleaseNotesAction', () => {
  const currentVersion = '0.17.0';

  it('marks the current version as seen when nothing was saved yet', () => {
    expect(resolveReleaseNotesAction({ currentVersion, lastSeen: undefined, hasNotes: true })).toBe(
      'markSeen',
    );
    expect(
      resolveReleaseNotesAction({ currentVersion, lastSeen: undefined, hasNotes: false }),
    ).toBe('markSeen');
  });

  it('does nothing when the current version was already seen', () => {
    expect(resolveReleaseNotesAction({ currentVersion, lastSeen: '0.17.0', hasNotes: true })).toBe(
      'none',
    );
  });

  it('shows the notes of a newer version that has them', () => {
    expect(resolveReleaseNotesAction({ currentVersion, lastSeen: '0.16.0', hasNotes: true })).toBe(
      'show',
    );
  });

  it('does nothing for a newer version without notes', () => {
    expect(resolveReleaseNotesAction({ currentVersion, lastSeen: '0.16.0', hasNotes: false })).toBe(
      'none',
    );
  });

  it('does nothing after a rollback to an older version', () => {
    expect(
      resolveReleaseNotesAction({ currentVersion: '0.16.0', lastSeen: '0.17.0', hasNotes: true }),
    ).toBe('none');
  });

  it('does nothing when either version is malformed', () => {
    expect(
      resolveReleaseNotesAction({ currentVersion: 'dev', lastSeen: '0.16.0', hasNotes: true }),
    ).toBe('none');
    expect(resolveReleaseNotesAction({ currentVersion, lastSeen: 'oops', hasNotes: true })).toBe(
      'none',
    );
  });
});

describe('resolveGateState', () => {
  const note = {
    version: '0.17.0',
    slides: [{ title: { es: 'A', en: 'A' }, description: { es: 'a', en: 'a' } }],
  };

  it('does nothing while the feature flag is off', () => {
    expect(
      resolveGateState({ enabled: false, currentVersion: '0.17.0', preferences: {}, note }),
    ).toEqual({ action: 'none' });
    expect(
      resolveGateState({
        enabled: false,
        currentVersion: '0.17.0',
        preferences: { lastSeenReleaseNotes: '0.16.0' },
        note,
      }),
    ).toEqual({ action: 'none' });
  });

  it('waits while preferences are not loaded', () => {
    expect(
      resolveGateState({ enabled: true, currentVersion: '0.17.0', preferences: undefined, note }),
    ).toEqual({
      action: 'none',
    });
  });

  it('marks as seen silently when nothing was saved', () => {
    expect(
      resolveGateState({ enabled: true, currentVersion: '0.17.0', preferences: {}, note }),
    ).toEqual({
      action: 'markSeen',
    });
  });

  it('shows the note of a newer version', () => {
    expect(
      resolveGateState({
        enabled: true,
        currentVersion: '0.17.0',
        preferences: { lastSeenReleaseNotes: '0.16.0' },
        note,
      }),
    ).toEqual({ action: 'show', note });
  });

  it('does nothing for a newer version without a note', () => {
    expect(
      resolveGateState({
        enabled: true,
        currentVersion: '0.17.0',
        preferences: { lastSeenReleaseNotes: '0.16.0' },
        note: undefined,
      }),
    ).toEqual({ action: 'none' });
  });
});
