import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/** Rutas públicas (sin sesión). Todo lo demás requiere sesión. */
const PUBLIC_ROUTES = ['/login'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!getSessionCookie(req);
  const isPublic = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  // Hint de redirección en el borde. La autorización real la hace la API.
  if (!hasSession && !isPublic) return NextResponse.redirect(new URL('/login', req.url));
  if (hasSession && isPublic) return NextResponse.redirect(new URL('/notes', req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
