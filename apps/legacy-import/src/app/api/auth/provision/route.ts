/**
 * User Provisioning API Route
 * Creates or updates user and firm in database after Azure AD authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionCookie } from '@/lib/auth';

interface IdTokenClaims {
  oid?: string;         // Azure AD Object ID
  sub?: string;         // Subject (unique identifier)
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  tid?: string;         // Tenant ID
}

interface ProvisionRequest {
  accessToken: string;
  idTokenClaims: IdTokenClaims;
}

/**
 * POST /api/auth/provision
 * Provisions user and firm from Azure AD token claims
 */
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

    // Extract user info from claims
    const azureAdId = idTokenClaims.oid || idTokenClaims.sub;
    const email = idTokenClaims.email || idTokenClaims.preferred_username;

    if (!azureAdId || !email) {
      return NextResponse.json(
        { error: 'invalid_claims', message: 'Missing required user information' },
        { status: 400 }
      );
    }

    // Parse name from claims
    let firstName = idTokenClaims.given_name || '';
    let lastName = idTokenClaims.family_name || '';

    if (!firstName && !lastName && idTokenClaims.name) {
      const nameParts = idTokenClaims.name.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // Find existing firm or use the first one (legacy import is firm-specific)
    let firm = await prisma.firm.findFirst();

    if (!firm) {
      // Create new firm for this domain
      const domain = email.split('@')[1] || 'unknown.com';
      firm = await prisma.firm.create({
        data: {
          name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1) + ' Law Firm',
        },
      });
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { azureAdId },
          { email },
        ],
      },
    });

    if (user) {
      // Update existing user
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
      // Create new user
      // First user in firm becomes Partner, others are Associates
      const existingUsersCount = await prisma.user.count({
        where: { firmId: firm.id },
      });

      const role = existingUsersCount === 0 ? 'Partner' : 'Associate';

      user = await prisma.user.create({
        data: {
          azureAdId,
          email,
          firstName: firstName || 'User',
          lastName: lastName || '',
          role,
          status: 'Active',
          firmId: firm.id,
          lastActive: new Date(),
        },
      });
    }

    // Check user status
    if (user.status === 'Pending') {
      return NextResponse.json(
        {
          error: 'account_pending',
          message: 'Your account is pending activation. Please contact your firm\'s partner.',
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

    // Create session cookie
    const sessionCookie = createSessionCookie(user.id);

    // Return user data with session cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        firmId: user.firmId,
        azureAdId: user.azureAdId,
      },
    });

    // Set session cookie (24 hour expiry)
    response.cookies.set('legacy-import-session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
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
