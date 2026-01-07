/**
 * Token refresh endpoint proxy
 * Forwards refresh request to gateway service
 */

import { NextResponse } from 'next/server';

// Gateway URL - use environment variable or default to localhost for development
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';

export async function POST(request: Request) {
  try {
    // Forward refresh request to gateway
    const response = await fetch(`${GATEWAY_URL}/auth/refresh`, {
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

    // Forward set-cookie headers from gateway (for token rotation)
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }

    return nextResponse;
  } catch (error) {
    console.error('Refresh proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
