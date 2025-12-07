/**
 * Get current user endpoint
 * Checks the local session cookie to return the authenticated user
 * This provides a fallback auth mechanism when MSAL tokens aren't cached in sessionStorage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { authenticated: false, error: error || 'Not authenticated' },
        { status: 401 }
      );
    }

    // Return user in the format expected by AuthContext
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        firmId: user.firmId,
        status: 'Active',
        azureAdId: '',
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      },
    });
  } catch (error) {
    console.error('[/api/auth/me] Error:', error);
    return NextResponse.json({ authenticated: false, error: 'Server error' }, { status: 500 });
  }
}
