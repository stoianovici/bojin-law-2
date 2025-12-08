/**
 * Logout endpoint
 * Clears the session cookie and optionally forwards to gateway
 */

import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  try {
    // Create response
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

    // Clear the session cookie by setting it to expire immediately
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to logout' },
      { status: 500 }
    );
  }
}
