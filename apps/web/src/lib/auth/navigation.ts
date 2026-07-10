export const AUTH_ROUTES = ['/login'];
export const PROTECTED_ROUTES = ['/admin'];

export const DEFAULT_REDIRECT_LOGIN = '/login';
export const DEFAULT_REDIRECT_HOME = '/admin';

export const WELCOME_ROUTE = '/admin/welcome';
export const DENIED_ROUTE = '/admin/denied';

export const isAuthRoute = (pathname: string) =>
  AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

export const isProtectedRoute = (pathname: string) =>
  PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
