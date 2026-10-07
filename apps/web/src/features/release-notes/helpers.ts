import type { ReleaseNote, ReleaseNotesAction } from './types';

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

const parseVersion = (version: string) => {
  const match = VERSION_RE.exec(version);
  return match ? match.slice(1).map(Number) : null;
};

/** Negative, zero or positive like a sort comparator; `null` when either isn't MAJOR.MINOR.PATCH. */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    const diff = left[i]! - right[i]!;
    if (diff !== 0) return diff;
  }
  return 0;
}

// A user with nothing saved is new (or this is the first deploy carrying release notes): the
// current version is stored as seen so only later releases get announced to them.
export function resolveReleaseNotesAction({
  currentVersion,
  lastSeen,
  hasNotes,
}: {
  currentVersion: string;
  lastSeen: string | undefined;
  hasNotes: boolean;
}): ReleaseNotesAction {
  if (!lastSeen) return 'markSeen';
  const comparison = compareVersions(currentVersion, lastSeen);
  return comparison !== null && comparison > 0 && hasNotes ? 'show' : 'none';
}

/** Readable problems in the registry; checked by a test so a broken entry fails `pnpm test`. */
export function validateReleaseNotes(registry: Record<string, ReleaseNote>): string[] {
  return Object.entries(registry).flatMap(([key, note]) => {
    const errors: string[] = [];
    if (note.version !== key) errors.push(`${key}: version is "${note.version}"`);
    if (note.slides.length === 0) errors.push(`${key}: no slides`);
    return errors;
  });
}

// `preferences` is undefined while loading or after a failed fetch: nothing is decided until the
// saved version is known, so the modal never flashes open for someone who already saw it. With the
// feature flag off nothing is written either, so toggling it has no side effects.
export function resolveGateState({
  enabled,
  currentVersion,
  preferences,
  note,
}: {
  enabled: boolean;
  currentVersion: string;
  preferences: { lastSeenReleaseNotes?: string } | undefined;
  note: ReleaseNote | undefined;
}): { action: ReleaseNotesAction; note?: ReleaseNote } {
  if (!enabled || !preferences) return { action: 'none' };
  const action = resolveReleaseNotesAction({
    currentVersion,
    lastSeen: preferences.lastSeenReleaseNotes,
    hasNotes: !!note,
  });
  return action === 'show' ? { action, note } : { action };
}
