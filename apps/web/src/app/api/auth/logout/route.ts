/**
 * Logout endpoint proxy
 * Forwards logout request to gateway service
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Forward logout request to gateway
    const response = await fetch('http://localhost:4000/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies to maintain session
        cookie: request.headers.get('cookie') || '',
      },
    });

    const data = await response.json();

    // Create response with appropriate status
    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    // Forward set-cookie headers from gateway (to clear session)
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }

    return nextResponse;
  } catch (error) {
    console.error('Logout proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to logout' },
      { status: 500 }
    );
  }
}
