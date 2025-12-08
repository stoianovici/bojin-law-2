/**
 * GraphQL Proxy Route
 * Proxies GraphQL requests to gateway service with session cookies
 * Authenticates user via session cookie and passes context to gateway
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie');

    // Authenticate user from session cookie
    const { user } = await getAuthUser(request);

    // Build headers for gateway request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward cookies from the request
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // Get MS access token if provided (for email sync operations)
    const msAccessToken = request.headers.get('x-ms-access-token');

    // Pass authenticated user context to gateway
    // In production, we authenticate via session cookie and pass user context
    // In development without a session, use mock user for convenience
    if (user) {
      headers['x-mock-user'] = JSON.stringify({
        userId: user.id,
        firmId: user.firmId,
        role: user.role,
        email: user.email,
        // Include MS access token for operations that need Graph API access
        accessToken: msAccessToken || undefined,
      });
    } else if (process.env.NODE_ENV === 'development') {
      // Fallback to mock user only in development when no session exists
      headers['x-mock-user'] = JSON.stringify({
        userId: 'aa3992a2-4bb0-45e2-9bc5-15e75f6a5793', // Partner user from seed
        firmId: '99d685ee-1723-4d21-9634-ea414ceaba9b', // Demo firm from seed
        role: 'Partner',
        email: 'partner@demo.lawfirm.ro',
      });
    }

    // Forward request to gateway GraphQL endpoint
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: body,
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('GraphQL proxy error:', error);
    return NextResponse.json({ errors: [{ message: 'GraphQL proxy error' }] }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: 'GraphQL endpoint only accepts POST requests' },
    { status: 405 }
  );
}
