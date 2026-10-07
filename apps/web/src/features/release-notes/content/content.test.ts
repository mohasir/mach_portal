import { describe, expect, it } from 'vitest';
import { validateReleaseNotes } from '../helpers';
import type { ReleaseNote } from '../types';
import { RELEASE_NOTES, getReleaseNote } from './index';

const text = (value: string) => ({ es: value, en: value });

const note = (version: string, overrides: Partial<ReleaseNote> = {}): ReleaseNote => ({
  version,
  slides: [{ title: text('Título'), description: text('Descripción') }],
  ...overrides,
});

describe('release notes registry', () => {
  it('ships a valid registry', () => {
    expect(validateReleaseNotes(RELEASE_NOTES)).toEqual([]);
  });

  it('returns undefined for a version without notes', () => {
    expect(getReleaseNote('0.99.0')).toBeUndefined();
  });
});

describe('validateReleaseNotes', () => {
  it('accepts slides with and without an icon', () => {
    const registry = {
      '0.17.0': note('0.17.0', {
        slides: [
          { title: text('A'), description: text('a') },
          { title: text('B'), description: text('b'), icon: () => null },
        ],
      }),
    };
    expect(validateReleaseNotes(registry)).toEqual([]);
  });

  it('flags a key that does not match its version', () => {
    expect(validateReleaseNotes({ '0.17.0': note('0.18.0') })).toHaveLength(1);
  });

  it('flags a release without slides', () => {
    expect(validateReleaseNotes({ '0.17.0': note('0.17.0', { slides: [] }) })).toHaveLength(1);
  });
});
