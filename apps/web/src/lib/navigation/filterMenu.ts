import type { FeatureKey } from '@repo/guards';
import type { NavGroup, NavItem } from './types';

type HasFeature = (key: FeatureKey) => boolean;

export const isNavItemAvailable = (item: NavItem, hasFeature: HasFeature): boolean =>
  !item.feature || hasFeature(item.feature);

/** Drops the items of inactive modules and the groups left empty. */
export function filterMenuByFeatures(menu: NavGroup[], hasFeature: HasFeature): NavGroup[] {
  return menu
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => isNavItemAvailable(item, hasFeature))
        .map((item) =>
          item.children
            ? { ...item, children: item.children.filter((c) => isNavItemAvailable(c, hasFeature)) }
            : item,
        ),
    }))
    .filter((group) => group.items.length > 0);
}
