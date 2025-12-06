/**
 * Update User Status API Route
 * Allows Partners/Admins to activate/deactivate users
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

interface UpdateStatusRequest {
  userId: string;
  status: 'Active' | 'Pending' | 'Inactive';
}

/**
 * POST /api/users/update-status
 * Updates a user's status (Partner/Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Trebuie să fii autentificat' },
        { status: 401 }
      );
    }

    // Only Partners and BusinessOwners can update status
    if (currentUser.role !== 'Partner' && currentUser.role !== 'BusinessOwner') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Nu ai permisiunea să modifici statusuri' },
        { status: 403 }
      );
    }

    const body: UpdateStatusRequest = await request.json();
    const { userId, status } = body;

    if (!userId || !status) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'ID utilizator și status sunt necesare' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['Active', 'Pending', 'Inactive'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'invalid_status', message: 'Status invalid' },
        { status: 400 }
      );
    }

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'not_found', message: 'Utilizatorul nu a fost găsit' },
        { status: 404 }
      );
    }

    // Ensure target user is in the same firm
    if (targetUser.firmId !== currentUser.firmId) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Nu poți modifica utilizatori din altă firmă' },
        { status: 403 }
      );
    }

    // Prevent deactivating yourself
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: 'self_deactivation', message: 'Nu îți poți modifica propriul status' },
        { status: 400 }
      );
    }

    // Update status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    return NextResponse.json({
      message: 'Status actualizat cu succes',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Eroare la actualizarea statusului' },
      { status: 500 }
    );
  }
}
