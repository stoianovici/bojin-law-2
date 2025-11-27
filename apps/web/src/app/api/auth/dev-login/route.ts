/**
 * Development Login API Route
 * Proxies to gateway dev-login endpoint and forwards session cookie
 * ONLY available in development mode
 */

import { NextResponse } from 'next/server';

export async function POST(_request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  try {
    // Forward request to gateway
    const response = await fetch('http://localhost:4000/auth/dev-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();

    // Get the Set-Cookie header from gateway response
    const setCookieHeader = response.headers.get('set-cookie');

    // Create response with user data
    const nextResponse = NextResponse.json(data);

    // Forward the session cookie if present
    if (setCookieHeader) {
      nextResponse.headers.set('set-cookie', setCookieHeader);
    }

    return nextResponse;
  } catch (error) {
    console.error('Dev login proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to create dev session' },
      { status: 500 }
    );
  }
}
