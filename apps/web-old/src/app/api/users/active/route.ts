/**
 * Active Users API Endpoint
 * Returns list of active users in the firm
 * Story 2.4.1: Partner User Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@legal-platform/database';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify the requester is authenticated and is a Partner
    const { user: sessionUser, error } = await getAuthUser(request);
    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Unauthorized', message: error || 'Authentication required' },
        { status: 401 }
      );
    }

    if (sessionUser.role !== 'Partner') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only Partners can view users' },
        { status: 403 }
      );
    }

    // Query for active users in the same firm
    const activeUsers = await prisma.user.findMany({
      where: {
        status: 'Active',
        firmId: sessionUser.firmId,
      },
      orderBy: {
        lastName: 'asc',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        firmId: true,
        azureAdId: true,
        preferences: true,
        createdAt: true,
        lastActive: true,
      },
    });

    return NextResponse.json(activeUsers);
  } catch (error) {
    console.error('Error fetching active users:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch active users' },
      { status: 500 }
    );
  }
}
