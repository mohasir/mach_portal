export const AUTH_ROUTES = ['/login', '/set-password'];
export const PROTECTED_ROUTES = ['/admin', '/console', '/select-organization'];

export const DEFAULT_REDIRECT_LOGIN = '/login';
export const DEFAULT_REDIRECT_HOME = '/admin';

export const ROOT_ROUTE = '/';
export const CONSOLE_ROUTE = '/console';

export const WELCOME_ROUTE = '/admin/welcome';
export const DENIED_ROUTE = '/admin/denied';
export const SELECT_ORGANIZATION_ROUTE = '/select-organization';
export const ACCOUNT_LOCKED_ROUTE = '/account-locked';

export const isAuthRoute = (pathname: string) =>
  AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

export const isProtectedRoute = (pathname: string) =>
  PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

export const homeRouteFor = (user: { isPlatformAdmin?: boolean | null }) =>
  user.isPlatformAdmin === true ? CONSOLE_ROUTE : DEFAULT_REDIRECT_HOME;

// Without a user we go to /admin, not /login: the middleware bounces /login back to / while a
// (possibly stale) session cookie exists, which would loop. AuthProvider on the protected route
// signs out a stale cookie and redirects to the login, or shows the retry screen on a server error.
export function resolveHomeTarget({
  isPending,
  user,
}: {
  isPending: boolean;
  user: { isPlatformAdmin?: boolean | null } | null;
}): 'loading' | { redirect: string } {
  if (isPending) return 'loading';
  if (!user) return { redirect: DEFAULT_REDIRECT_HOME };
  return { redirect: homeRouteFor(user) };
}
