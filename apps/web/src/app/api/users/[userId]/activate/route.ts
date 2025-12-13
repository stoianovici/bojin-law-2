/**
 * Activate User API Endpoint
 * Activates a pending user by assigning them to a firm with a role
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
    const body = await request.json();
    const { firmId, role } = body;

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
        { error: 'Forbidden', message: 'Only Partners can activate users' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!firmId || !role) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'firmId and role are required' },
        { status: 400 }
      );
    }

    // Validate role is valid
    const validRoles = ['Partner', 'Associate', 'Paralegal'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid role. Must be Partner, Associate, or Paralegal' },
        { status: 400 }
      );
    }

    // Find the user to activate
    const userToActivate = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToActivate) {
      return NextResponse.json({ error: 'Not Found', message: 'User not found' }, { status: 404 });
    }

    if (userToActivate.status !== 'Pending') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'User is not in pending status' },
        { status: 400 }
      );
    }

    // Verify the firm exists
    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
    });

    if (!firm) {
      return NextResponse.json({ error: 'Not Found', message: 'Firm not found' }, { status: 404 });
    }

    // Activate the user - update status, assign firm and role
    const activatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'Active',
        firmId: firmId,
        role: role,
        lastActive: new Date(),
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
        action: 'Activated',
        adminUserId: sessionUser.id,
        oldValue: 'Pending',
        newValue: 'Active',
      },
    });

    return NextResponse.json(activatedUser);
  } catch (error) {
    console.error('Error activating user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to activate user' },
      { status: 500 }
    );
  }
}
