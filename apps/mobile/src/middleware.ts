import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/auth/callback'];

// Routes that are always accessible (static assets, api, etc.)
const bypassRoutes = ['/_next', '/api', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for bypass routes
  if (bypassRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for auth cookie/token
  // Note: MSAL stores tokens in localStorage, which we can't access in middleware
  // For now, we rely on client-side auth checks
  // A more robust solution would use a session cookie set by an API route

  // For now, allow all routes and let client-side handle auth
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
