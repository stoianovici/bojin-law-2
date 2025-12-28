/**
 * Development Login API Route
 * Creates a local session cookie for development without Microsoft OAuth
 * ONLY available in development mode
 */

import { NextResponse } from 'next/server';
import { createSessionCookie, SESSION_COOKIE_NAME } from '@/lib/auth';
import { prisma } from '@legal-platform/database';

export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    // Query database for a real Partner user to use for dev login
    const partner = await prisma.user.findFirst({
      where: {
        role: 'Partner',
        status: 'Active',
      },
      include: {
        firm: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'No Partner user found in database. Please run seed script.' },
        { status: 500 }
      );
    }

    // Create response with user data
    const nextResponse = NextResponse.json({
      user: {
        id: partner.id,
        email: partner.email,
        firstName: partner.firstName,
        lastName: partner.lastName,
        role: partner.role,
        firmId: partner.firmId,
      },
      message: 'Development session created',
    });

    // Set the session cookie that the web app actually uses
    const sessionCookie = createSessionCookie(partner.id);
    nextResponse.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: false, // Allow HTTP in development
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return nextResponse;
  } catch (error) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'Failed to create dev session' }, { status: 500 });
  }
}
