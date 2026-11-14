import { describe, expect, it } from 'vitest';
import { visibleClientTabs } from '../helpers';

describe('visibleClientTabs', () => {
  it('shows both tabs with both modules active', () => {
    expect(visibleClientTabs({ quotes: true, events: true })).toEqual(['quotes', 'events']);
  });

  it('hides the quotes tab without quotes', () => {
    expect(visibleClientTabs({ quotes: false, events: true })).toEqual(['events']);
  });

  it('hides the events tab without events', () => {
    expect(visibleClientTabs({ quotes: true, events: false })).toEqual(['quotes']);
  });

  it('shows no tabs in a core-only organization', () => {
    expect(visibleClientTabs({ quotes: false, events: false })).toEqual([]);
  });
});
