import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie, getCookieCache } from 'better-auth/cookies';
import { hasPermission } from '@repo/guards';
import {
  DEFAULT_REDIRECT_HOME,
  DEFAULT_REDIRECT_LOGIN,
  DENIED_ROUTE,
  WELCOME_ROUTE,
  isAuthRoute,
  isProtectedRoute,
} from '@/lib/auth/navigation';
import { resolveRouteAccess } from '@/lib/auth/route-access';

async function readCachedRole(req: NextRequest): Promise<string | null | undefined> {
  try {
    const cached = await getCookieCache(req, { secret: process.env.BETTER_AUTH_SECRET });
    if (!cached?.user) return undefined;
    return (cached.user as { role?: string | null }).role ?? null;
  } catch {
    return undefined;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!getSessionCookie(req);

  if (!hasSession) {
    if (isProtectedRoute(pathname)) {
      const loginUrl = new URL(DEFAULT_REDIRECT_LOGIN, req.url);
      loginUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT_HOME, req.url));
  }

  const required = resolveRouteAccess(pathname);
  if (required) {
    const role = await readCachedRole(req);
    // Only enforce when the cache resolved a role; a cold cache falls through to
    // the API's authorization check.
    if (role !== undefined && !hasPermission(role, required)) {
      // The dashboard denial is a welcome landing; every other route is a 403.
      const target = pathname === DEFAULT_REDIRECT_HOME ? WELCOME_ROUTE : DENIED_ROUTE;
      return NextResponse.rewrite(new URL(target, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
