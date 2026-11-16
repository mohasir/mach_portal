import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const journalPath = resolve(__dirname, '../../../../drizzle/meta/_journal.json');
const { entries } = JSON.parse(readFileSync(journalPath, 'utf8')) as {
  entries: { tag: string; when: number }[];
};

// drizzle's migrator skips any entry whose `when` is not greater than the latest applied one.
describe('drizzle migration journal', () => {
  it('has strictly increasing `when` values in entry order', () => {
    entries.slice(1).forEach((entry, i) => {
      expect(entry.when, `${entry.tag} must be after ${entries[i].tag}`).toBeGreaterThan(
        entries[i].when,
      );
    });
  });

  it('has no `when` value in the future', () => {
    const now = Date.now();
    for (const entry of entries) {
      expect(entry.when, `${entry.tag} is in the future`).toBeLessThanOrEqual(now);
    }
  });
});
