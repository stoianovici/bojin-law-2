import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Combined Middleware: Basic Auth + OAuth Protected Routes
 * 1. Basic Auth for non-localhost environments (staging protection)
 * 2. OAuth session-based authentication for protected routes
 *
 * Environment Variables:
 * - BASIC_AUTH_USER: Username for Basic Auth
 * - BASIC_AUTH_PASSWORD: Password for Basic Auth
 *
 * Story 2.4: Authentication with Azure AD
 */

// Routes that require OAuth authentication
const protectedRoutes = [
  '/dashboard',
  '/cases',
  '/documents',
  '/tasks',
  '/admin',
  '/settings',
];

// Public routes that don't require OAuth authentication
const publicRoutes = [
  '/login',
  '/auth/callback',
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = request.headers.get('host') || '';

  // 1. Skip all auth on localhost/development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return NextResponse.next();
  }

  // 2. Skip auth for health check endpoints (Render, Docker, etc.)
  if (pathname === '/api/health' || pathname === '/health' || pathname === '/_health') {
    return NextResponse.next();
  }

  // 3. Basic Auth (staging protection)
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD;

  if (basicAuthUser && basicAuthPassword) {
    // Get authorization header
    const authHeader = request.headers.get('authorization');

    // If no auth header, challenge for credentials
    if (!authHeader) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
      });
    }

    // Parse Basic Auth credentials
    const auth = authHeader.split(' ')[1];
    const [user, password] = Buffer.from(auth, 'base64').toString().split(':');

    // Verify credentials
    if (user !== basicAuthUser || password !== basicAuthPassword) {
      // Invalid credentials
      return new NextResponse('Invalid credentials', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
      });
    }
    // Valid Basic Auth credentials, continue to OAuth check
  }

  // 4. OAuth Session Check for Protected Routes
  // Check if route is public (no OAuth required)
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check if route is protected (OAuth required)
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  if (!isProtectedRoute) {
    // Not a protected route, allow through
    return NextResponse.next();
  }

  // Check for session cookie (OAuth session)
  const sessionCookie = request.cookies.get('sid');

  if (!sessionCookie) {
    // No session cookie - redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie exists - allow request to proceed
  // JWT validation happens on the server-side API routes
  return NextResponse.next();
}

// Configure which routes to apply middleware to
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public files in /public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
};
