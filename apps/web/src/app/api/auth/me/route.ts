/**
 * Get current user endpoint proxy
 * Forwards request to gateway service to check active session
 */

import { NextResponse } from 'next/server';

// Gateway URL - use environment variable or default to localhost for development
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';

export async function GET(request: Request) {
  try {
    // Forward request to gateway
    const response = await fetch(`${GATEWAY_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies to maintain session
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Auth me proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get user' },
      { status: 500 }
    );
  }
}
