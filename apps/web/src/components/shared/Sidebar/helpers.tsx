import type { MenuProps } from 'antd';
import type { TFunction } from 'i18next';
import type { PermissionCheck } from '@repo/guards';
import { IconMap, type NavGroup, type NavItem } from '@/lib/navigation';

type CanFn = (permissions: PermissionCheck) => boolean;

const isItemVisible = (item: NavItem, can: CanFn): boolean =>
  !!item.alwaysVisible || !item.guard || can(item.guard);

/** Un grupo es visible si al menos uno de sus ítems (o subítems) lo es. */
export const isGroupVisible = (group: NavGroup, can: CanFn): boolean =>
  group.items.some((item) =>
    item.children?.length
      ? item.children.some((child) => isItemVisible(child, can))
      : isItemVisible(item, can),
  );

const toMenuItem = (
  item: NavItem,
  can: CanFn,
  t: TFunction,
): NonNullable<MenuProps['items']>[number] => {
  const icon = item.icon ? IconMap[item.icon] : undefined;

  if (item.children?.length) {
    const visibleChildren = item.children.filter((child) => isItemVisible(child, can));
    return {
      key: item.href ?? item.label,
      icon,
      label: t(item.label),
      children: visibleChildren.map((child) => toMenuItem(child, can, t)),
    };
  }

  return {
    key: item.href!,
    icon,
    label: t(item.label),
  };
};

export function buildMenuItems(
  menu: NavGroup[],
  can: CanFn,
  t: TFunction,
  collapsed = false,
): MenuProps['items'] {
  const items: NonNullable<MenuProps['items']> = [];

  menu.forEach((group, index) => {
    if (!isGroupVisible(group, can)) return;

    const visibleItems = group.items
      .filter((item) =>
        item.children?.length
          ? item.children.some((c) => isItemVisible(c, can))
          : isItemVisible(item, can),
      )
      .map((item) => toMenuItem(item, can, t));

    if (group.group) {
      items.push({
        key: `group-${index}`,
        type: 'group',
        label: collapsed ? '' : t(group.group),
        children: visibleItems,
      });
    } else {
      items.push(...visibleItems);
    }
  });

  return items;
}

export function findActiveKey(menu: NavGroup[], pathname: string): string | undefined {
  const hrefs = menu
    .flatMap((group) => group.items)
    .flatMap((item) => [item.href, ...(item.children?.map((c) => c.href) ?? [])])
    .filter((href): href is string => Boolean(href));

  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
