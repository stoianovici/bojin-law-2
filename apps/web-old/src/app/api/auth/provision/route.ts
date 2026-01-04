/**
 * User Provisioning API Route
 * Creates or updates user and firm in database after Azure AD authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@legal-platform/database';
import { createSessionCookie, SESSION_COOKIE_NAME } from '@/lib/auth';

interface IdTokenClaims {
  oid?: string;
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  tid?: string;
}

interface ProvisionRequest {
  accessToken: string;
  idTokenClaims: IdTokenClaims;
}

export async function POST(request: NextRequest) {
  try {
    const body: ProvisionRequest = await request.json();
    const { idTokenClaims } = body;

    if (!idTokenClaims) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Missing token claims' },
        { status: 400 }
      );
    }

    const azureAdId = idTokenClaims.oid || idTokenClaims.sub;
    const email = idTokenClaims.email || idTokenClaims.preferred_username;

    if (!azureAdId || !email) {
      return NextResponse.json(
        { error: 'invalid_claims', message: 'Missing required user information' },
        { status: 400 }
      );
    }

    let firstName = idTokenClaims.given_name || '';
    let lastName = idTokenClaims.family_name || '';

    if (!firstName && !lastName && idTokenClaims.name) {
      const nameParts = idTokenClaims.name.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // Find existing firm or create one
    let firm = await prisma.firm.findFirst();

    if (!firm) {
      const domain = email.split('@')[1] || 'unknown.com';
      firm = await prisma.firm.create({
        data: {
          name:
            domain.split('.')[0].charAt(0).toUpperCase() +
            domain.split('.')[0].slice(1) +
            ' Law Firm',
        },
      });
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ azureAdId }, { email }],
      },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          azureAdId,
          email,
          firstName: firstName || user.firstName,
          lastName: lastName || user.lastName,
          lastActive: new Date(),
        },
      });
    } else {
      const existingUsersCount = await prisma.user.count({
        where: { firmId: firm.id },
      });

      // First user in a firm is auto-activated as Partner
      // Subsequent users are Pending and require Partner activation
      const isFirstUser = existingUsersCount === 0;
      const role = isFirstUser ? 'Partner' : 'Associate';
      const status = isFirstUser ? 'Active' : 'Pending';

      user = await prisma.user.create({
        data: {
          azureAdId,
          email,
          firstName: firstName || 'User',
          lastName: lastName || '',
          role,
          status,
          firmId: firm.id,
          lastActive: new Date(),
        },
      });
    }

    if (user.status === 'Pending') {
      return NextResponse.json(
        {
          error: 'account_pending',
          message: "Your account is pending activation. Please contact your firm's partner.",
        },
        { status: 403 }
      );
    }

    if (user.status === 'Inactive') {
      return NextResponse.json(
        {
          error: 'account_inactive',
          message: 'Your account has been deactivated. Please contact your administrator.',
        },
        { status: 403 }
      );
    }

    const sessionCookie = createSessionCookie(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        firmId: user.firmId,
        azureAdId: user.azureAdId,
        status: user.status,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        preferences: user.preferences,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('User provisioning error:', error);
    return NextResponse.json(
      { error: 'provisioning_failed', message: 'Failed to provision user' },
      { status: 500 }
    );
  }
}
