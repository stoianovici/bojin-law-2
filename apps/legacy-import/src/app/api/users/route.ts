/**
 * Users API Route
 * Lists all users in the current user's firm
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/users
 * Returns all users in the firm (Partner/Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Trebuie să fii autentificat' },
        { status: 401 }
      );
    }

    // Only Partners and Admins can view user list
    if (currentUser.role !== 'Partner' && currentUser.role !== 'Admin') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Nu ai permisiunea să vezi lista de utilizatori' },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        firmId: currentUser.firmId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        lastActive: true,
        createdAt: true,
      },
      orderBy: [
        { role: 'asc' },
        { lastName: 'asc' },
      ],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Eroare la încărcarea utilizatorilor' },
      { status: 500 }
    );
  }
}
