import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * HTTP Basic Auth Middleware
 * Protects the application with username/password on non-localhost environments
 *
 * Environment Variables Required:
 * - BASIC_AUTH_USER: Username for authentication
 * - BASIC_AUTH_PASSWORD: Password for authentication
 *
 * To disable: Don't set the environment variables
 */
export function middleware(request: NextRequest) {
  // Skip auth on localhost/development
  const hostname = request.headers.get('host') || '';
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return NextResponse.next();
  }

  // Skip auth if credentials not configured
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD;

  if (!basicAuthUser || !basicAuthPassword) {
    // No auth configured, allow through
    return NextResponse.next();
  }

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
  if (user === basicAuthUser && password === basicAuthPassword) {
    // Valid credentials, allow through
    return NextResponse.next();
  }

  // Invalid credentials
  return new NextResponse('Invalid credentials', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
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
