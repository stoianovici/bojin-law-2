import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@legal-platform/database';

// Map database roles to frontend roles
const DB_TO_UI_ROLE: Record<string, 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY'> = {
  Partner: 'ADMIN',
  BusinessOwner: 'ADMIN',
  Associate: 'LAWYER',
  AssociateJr: 'LAWYER',
  Paralegal: 'PARALEGAL',
};

/**
 * GET /api/auth/me
 * Fetches the current user's profile from the database based on their email.
 * Returns user info with the proper frontend role mapping.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the email from the Authorization header (JWT token)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);

    // Decode JWT to get user email (tokens are Base64 encoded)
    let email: string;
    let azureAdId: string | undefined;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      email = decoded.email || decoded.preferred_username || decoded.upn;
      azureAdId = decoded.oid || decoded.sub;

      if (!email && !azureAdId) {
        return NextResponse.json({ error: 'No email or oid in token' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Query user from database by email or Azure AD ID
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
          ...(azureAdId ? [{ azureAdId }] : []),
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        firmId: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Map the database role to frontend role
    const uiRole = DB_TO_UI_ROLE[user.role] || 'LAWYER';

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: uiRole,
      firmId: user.firmId || '',
      status: user.status,
      _dbRole: user.role,
    });
  } catch (error) {
    console.error('[Auth/me] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
