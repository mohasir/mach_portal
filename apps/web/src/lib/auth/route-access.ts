import { ACTIONS, RESOURCES, type PermissionCheck } from '@repo/guards';

const { READ } = ACTIONS;

type RouteAccess = {
  prefix: string;
  exact?: boolean;
  permission: PermissionCheck | null;
};

const ROUTE_ACCESS: RouteAccess[] = [
  { prefix: '/admin/events', permission: { [RESOURCES.EVENT]: [READ] } },
  { prefix: '/admin/clients', permission: { [RESOURCES.CLIENT]: [READ] } },
  { prefix: '/admin/quotes', permission: { [RESOURCES.QUOTE]: [READ] } },
  { prefix: '/admin/pipeline', permission: { [RESOURCES.PIPELINE]: [READ] } },
  { prefix: '/admin/staff', permission: { [RESOURCES.STAFF]: [READ] } },
  { prefix: '/admin/catalog', permission: { [RESOURCES.PRODUCT]: [READ] } },
  { prefix: '/admin/users', permission: { user: ['list'] } },
  { prefix: '/admin/faq', permission: null },
  { prefix: '/admin/support', permission: null },
  { prefix: '/admin', exact: true, permission: { [RESOURCES.DASHBOARD]: [READ] } },
];

const matches = (pathname: string, { prefix, exact }: RouteAccess) =>
  exact ? pathname === prefix : pathname === prefix || pathname.startsWith(`${prefix}/`);

export function resolveRouteAccess(pathname: string): PermissionCheck | null | undefined {
  const entry = ROUTE_ACCESS.find((e) => matches(pathname, e));
  if (entry) return entry.permission;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return null;
  return undefined;
}
