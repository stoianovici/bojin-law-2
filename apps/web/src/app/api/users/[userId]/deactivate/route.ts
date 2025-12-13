/**
 * Deactivate User API Endpoint
 * Deactivates an active user (sets status to Inactive)
 * Story 2.4.1: Partner User Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@legal-platform/database';
import { getAuthUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

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
        { error: 'Forbidden', message: 'Only Partners can deactivate users' },
        { status: 403 }
      );
    }

    // Prevent self-deactivation
    if (userId === sessionUser.id) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'You cannot deactivate yourself' },
        { status: 400 }
      );
    }

    // Find the user to deactivate
    const userToDeactivate = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToDeactivate) {
      return NextResponse.json({ error: 'Not Found', message: 'User not found' }, { status: 404 });
    }

    // Verify user is in the same firm
    if (userToDeactivate.firmId !== sessionUser.firmId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cannot deactivate users from other firms' },
        { status: 403 }
      );
    }

    if (userToDeactivate.status !== 'Active') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'User is not active' },
        { status: 400 }
      );
    }

    // Deactivate the user
    const deactivatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'Inactive',
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

    // Create audit log entry
    await prisma.userAuditLog.create({
      data: {
        userId: userId,
        action: 'Deactivated',
        adminUserId: sessionUser.id,
        oldValue: 'Active',
        newValue: 'Inactive',
      },
    });

    return NextResponse.json(deactivatedUser);
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to deactivate user' },
      { status: 500 }
    );
  }
}
