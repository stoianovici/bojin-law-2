/**
 * GraphQL Proxy Route
 * Proxies GraphQL requests to gateway service with session cookies
 */

import { NextRequest, NextResponse } from 'next/server';

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie');

    // Forward request to gateway GraphQL endpoint
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies from the request
        ...(cookieHeader && { 'Cookie': cookieHeader }),
        // Inject mock user in development - matches seed data IDs
        ...(process.env.NODE_ENV === 'development' && {
          'x-mock-user': JSON.stringify({
            userId: 'aa3992a2-4bb0-45e2-9bc5-15e75f6a5793', // Partner user from seed
            firmId: '99d685ee-1723-4d21-9634-ea414ceaba9b', // Demo firm from seed
            role: 'Partner',
            email: 'partner@demo.lawfirm.ro',
          }),
        }),
      },
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
    return NextResponse.json(
      { errors: [{ message: 'GraphQL proxy error' }] },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: 'GraphQL endpoint only accepts POST requests' },
    { status: 405 }
  );
}
