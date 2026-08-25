import type { PermissionCheck } from '@repo/guards';

export interface NavItem {
  label: string;
  href?: string;
  icon?: string;
  guard?: PermissionCheck;
  children?: NavItem[];
  layout?: 'bare';
}

export interface NavGroup {
  group?: string;
  items: NavItem[];
}
