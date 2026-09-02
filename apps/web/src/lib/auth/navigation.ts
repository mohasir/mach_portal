export const AUTH_ROUTES = ['/login', '/set-password'];
export const PROTECTED_ROUTES = ['/admin'];

export const DEFAULT_REDIRECT_LOGIN = '/login';
export const DEFAULT_REDIRECT_HOME = '/admin';

export const WELCOME_ROUTE = '/admin/welcome';
export const DENIED_ROUTE = '/admin/denied';
export const ACCOUNT_LOCKED_ROUTE = '/account-locked';

export const isAuthRoute = (pathname: string) =>
  AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

export const isProtectedRoute = (pathname: string) =>
  PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
