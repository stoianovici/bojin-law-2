/**
 * Update User Role API Endpoint
 * Changes a user's role (Partner, Associate, Paralegal)
 * Story 2.4.1: Partner User Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@legal-platform/database';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const { role } = body;

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
        { error: 'Forbidden', message: 'Only Partners can change user roles' },
        { status: 403 }
      );
    }

    // Validate role
    const validRoles = ['Partner', 'Associate', 'Paralegal'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid role. Must be Partner, Associate, or Paralegal' },
        { status: 400 }
      );
    }

    // Find the user to update
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToUpdate) {
      return NextResponse.json({ error: 'Not Found', message: 'User not found' }, { status: 404 });
    }

    // Verify user is in the same firm
    if (userToUpdate.firmId !== sessionUser.firmId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cannot modify users from other firms' },
        { status: 403 }
      );
    }

    // Don't update if role is the same
    if (userToUpdate.role === role) {
      return NextResponse.json(userToUpdate);
    }

    const oldRole = userToUpdate.role;

    // Update the user's role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: role,
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
        action: 'RoleChanged',
        adminUserId: sessionUser.id,
        oldValue: oldRole,
        newValue: role,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update user role' },
      { status: 500 }
    );
  }
}
