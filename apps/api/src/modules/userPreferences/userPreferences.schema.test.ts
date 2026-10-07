import { describe, expect, it } from 'vitest';
import { updateUserPreferencesSchema, userPreferencesSchema } from '@repo/schemas';

describe('lastSeenReleaseNotes preference', () => {
  it('is undefined when it was never saved', () => {
    expect(userPreferencesSchema.parse({ timeFormat: '24h' }).lastSeenReleaseNotes).toBeUndefined();
  });

  it('reads a saved version', () => {
    expect(
      userPreferencesSchema.parse({ lastSeenReleaseNotes: '0.17.0' }).lastSeenReleaseNotes,
    ).toBe('0.17.0');
  });

  it('drops an invalid value without discarding the other preferences', () => {
    const parsed = userPreferencesSchema.parse({ lastSeenReleaseNotes: 42, timeFormat: '24h' });
    expect(parsed.lastSeenReleaseNotes).toBeUndefined();
    expect(parsed.timeFormat).toBe('24h');
  });

  it('can be updated on its own', () => {
    expect(updateUserPreferencesSchema.parse({ lastSeenReleaseNotes: '0.17.0' })).toEqual({
      lastSeenReleaseNotes: '0.17.0',
    });
  });
});
