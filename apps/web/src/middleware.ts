import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie, getCookieCache } from 'better-auth/cookies';
import { hasPermission } from '@repo/guards';
import {
  ACCOUNT_LOCKED_ROUTE,
  DEFAULT_REDIRECT_HOME,
  DEFAULT_REDIRECT_LOGIN,
  DENIED_ROUTE,
  WELCOME_ROUTE,
  isAuthRoute,
  isProtectedRoute,
} from '@/lib/auth/navigation';
import { resolveRouteAccess } from '@/lib/auth/route-access';

type CachedUser = { role?: string | null; mustChangePassword?: boolean };

async function readCachedUser(req: NextRequest): Promise<CachedUser | undefined> {
  try {
    const cached = await getCookieCache(req, { secret: process.env.BETTER_AUTH_SECRET });
    if (!cached?.user) return undefined;
    return cached.user as CachedUser;
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

  const cachedUser = await readCachedUser(req);

  if (cachedUser?.mustChangePassword) {
    if (pathname !== ACCOUNT_LOCKED_ROUTE) {
      return NextResponse.redirect(new URL(ACCOUNT_LOCKED_ROUTE, req.url));
    }
  } else if (pathname === ACCOUNT_LOCKED_ROUTE && cachedUser !== undefined) {
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT_HOME, req.url));
  }

  const required = resolveRouteAccess(pathname);
  if (required) {
    // Only enforce when the cache resolved a role; a cold cache falls through to
    // the API's authorization check.
    if (cachedUser !== undefined && !hasPermission(cachedUser.role, required)) {
      // The dashboard denial is a welcome landing; every other route is a 403.
      const target = pathname === DEFAULT_REDIRECT_HOME ? WELCOME_ROUTE : DENIED_ROUTE;
      return NextResponse.rewrite(new URL(target, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|trpc|_next/static|_next/image|favicon.ico).*)'],
};
