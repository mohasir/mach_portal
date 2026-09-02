import type { PermissionCheck } from '@repo/guards';

export interface NavItem {
  label: string;
  href?: string;
  icon?: string;
  guard?: PermissionCheck;
  children?: NavItem[];
  layout?: 'bare';
  // Shown regardless of `guard` — the route itself still enforces `guard` (route-access.ts),
  // it just falls back to the welcome screen instead of disappearing from the nav.
  alwaysVisible?: boolean;
}

export interface NavGroup {
  group?: string;
  items: NavItem[];
}
