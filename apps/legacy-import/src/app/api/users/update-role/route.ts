/**
 * Update User Role API Route
 * Allows Partners/Admins to change user roles
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

import { UserRole } from '@/generated/prisma';

interface UpdateRoleRequest {
  userId: string;
  role: UserRole;
}

/**
 * POST /api/users/update-role
 * Updates a user's role (Partner/Admin only)
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

    // Only Partners and BusinessOwners can update roles
    if (currentUser.role !== 'Partner' && currentUser.role !== 'BusinessOwner') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Nu ai permisiunea să modifici roluri' },
        { status: 403 }
      );
    }

    const body: UpdateRoleRequest = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'ID utilizator și rol sunt necesare' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: UserRole[] = ['Partner', 'Associate', 'Paralegal', 'BusinessOwner'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'invalid_role', message: 'Rol invalid' },
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

    // Prevent removing your own Partner role (must have at least one Partner)
    if (userId === currentUser.id && currentUser.role === 'Partner' && role !== 'Partner') {
      // Check if there's another Partner in the firm
      const otherPartners = await prisma.user.count({
        where: {
          firmId: currentUser.firmId,
          role: 'Partner',
          id: { not: currentUser.id },
        },
      });

      if (otherPartners === 0) {
        return NextResponse.json(
          { error: 'last_partner', message: 'Nu îți poți schimba rolul - ești singurul Partener' },
          { status: 400 }
        );
      }
    }

    // Update role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
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
      message: 'Rol actualizat cu succes',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Eroare la actualizarea rolului' },
      { status: 500 }
    );
  }
}
