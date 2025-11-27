/**
 * Get current user endpoint proxy
 * Forwards request to gateway service to check active session
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Mock user in development - matches seed data IDs
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        id: 'aa3992a2-4bb0-45e2-9bc5-15e75f6a5793', // Partner user from seed
        email: 'partner@demo.lawfirm.ro',
        firstName: 'Alex',
        lastName: 'Popescu',
        role: 'Partner',
        status: 'Active',
        firmId: '99d685ee-1723-4d21-9634-ea414ceaba9b', // Demo firm from seed
        azureAdId: 'aad-partner-demo-12345',
        preferences: { language: 'ro', aiSuggestionLevel: 'high' },
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      });
    }

    // Forward request to gateway
    const response = await fetch('http://localhost:4000/auth/me', {
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
