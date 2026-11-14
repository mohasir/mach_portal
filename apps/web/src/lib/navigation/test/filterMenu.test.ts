import { describe, expect, it } from 'vitest';
import type { FeatureKey } from '@repo/guards';
import { ADMIN_MENU, NAV_BOTTOM_MENU } from '../config';
import { filterMenuByFeatures, isNavItemAvailable } from '../filterMenu';
import { NAV_ITEMS } from '../constants/items';

const labels = (menu: ReturnType<typeof filterMenuByFeatures>) =>
  menu.flatMap((g) => g.items.map((i) => i.href));

const only = (...keys: FeatureKey[]) => {
  const set = new Set<FeatureKey>(keys);
  return (key: FeatureKey) => set.has(key);
};

describe('filterMenuByFeatures', () => {
  it('hides every module item when no module is active, keeping core items', () => {
    const hrefs = labels(filterMenuByFeatures(ADMIN_MENU, only()));
    expect(hrefs).toEqual(
      expect.arrayContaining(['/admin', '/admin/clients', '/admin/products', '/admin/users']),
    );
    for (const hidden of [
      '/admin/calendar',
      '/admin/quotes',
      '/admin/events',
      '/admin/payments',
      '/admin/staff',
      '/admin/event-types',
      '/admin/reschedule-reasons',
    ]) {
      expect(hrefs).not.toContain(hidden);
    }
  });

  it('shows quotes items but not event items with only quotes active', () => {
    const hrefs = labels(filterMenuByFeatures(ADMIN_MENU, only('quotes')));
    expect(hrefs).toContain('/admin/quotes');
    expect(hrefs).not.toContain('/admin/events');
  });

  it('drops groups left empty', () => {
    const menu = filterMenuByFeatures(ADMIN_MENU, only());
    expect(menu.every((g) => g.items.length > 0)).toBe(true);
  });

  it('keeps everything with all features active', () => {
    expect(filterMenuByFeatures(ADMIN_MENU, () => true)).toEqual(ADMIN_MENU);
  });
});

describe('isNavItemAvailable', () => {
  it('hides a bottom-nav tab of an inactive module', () => {
    expect(NAV_BOTTOM_MENU.rightItems.filter((i) => isNavItemAvailable(i, only()))).not.toContain(
      NAV_ITEMS.QUOTES,
    );
  });

  it('always keeps an item with no feature', () => {
    expect(isNavItemAvailable(NAV_ITEMS.DASHBOARD, only())).toBe(true);
  });
});
