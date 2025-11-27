/**
 * Auth helper for legacy-import API routes
 * Provides user context extraction from session cookies or direct provisioning lookup
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Partner' | 'Associate' | 'Paralegal' | 'Admin';
  firmId: string;
}

export interface AuthResult {
  user: AuthUser | null;
  error?: string;
}

// Session cookie name
const SESSION_COOKIE = 'legacy-import-session';

/**
 * Create session cookie with user ID
 * Called after successful MSAL authentication and user provisioning
 */
export function createSessionCookie(userId: string): string {
  // Simple session: just store user ID in a signed cookie
  // In production, you'd use proper JWT or encrypted session
  const sessionData = JSON.stringify({
    userId,
    createdAt: Date.now(),
  });
  return Buffer.from(sessionData).toString('base64');
}

/**
 * Parse session cookie to get user ID
 */
export function parseSessionCookie(cookie: string): { userId: string; createdAt: number } | null {
  try {
    const decoded = Buffer.from(cookie, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Get authenticated user from request
 * Checks session cookie and looks up user in database
 */
export async function getAuthUser(request: NextRequest): Promise<AuthResult> {
  try {
    // Get session cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

    if (!sessionCookie) {
      // No session cookie - check if in development mode
      if (process.env.NODE_ENV === 'development') {
        return getDevUser();
      }
      return { user: null, error: 'No session found' };
    }

    // Parse session cookie
    const session = parseSessionCookie(sessionCookie);

    if (!session) {
      return { user: null, error: 'Invalid session' };
    }

    // Check session age (24 hour max)
    const sessionAge = Date.now() - session.createdAt;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      return { user: null, error: 'Session expired' };
    }

    // Look up user in database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return { user: null, error: 'User not found' };
    }

    if (user.status !== 'Active') {
      return { user: null, error: `Account is ${user.status.toLowerCase()}` };
    }

    if (!user.firmId) {
      return { user: null, error: 'User not assigned to a firm' };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as AuthUser['role'],
        firmId: user.firmId,
      },
    };
  } catch (error) {
    console.error('Auth error:', error);
    return { user: null, error: 'Authentication failed' };
  }
}

/**
 * Get development fallback user
 * Returns first active Partner or creates mock session
 */
async function getDevUser(): Promise<AuthResult> {
  try {
    // Try to find an existing Partner user
    const partner = await prisma.user.findFirst({
      where: {
        role: 'Partner',
        status: 'Active',
      },
    });

    if (partner && partner.firmId) {
      return {
        user: {
          id: partner.id,
          email: partner.email,
          firstName: partner.firstName,
          lastName: partner.lastName,
          role: partner.role as AuthUser['role'],
          firmId: partner.firmId,
        },
      };
    }

    // No Partner found - return mock user for development
    return {
      user: {
        id: 'dev-user-id',
        email: 'dev@localhost',
        firstName: 'Dev',
        lastName: 'User',
        role: 'Partner' as const,
        firmId: 'dev-firm-id',
      },
    };
  } catch {
    // Database not available - return mock
    return {
      user: {
        id: 'dev-user-id',
        email: 'dev@localhost',
        firstName: 'Dev',
        lastName: 'User',
        role: 'Partner' as const,
        firmId: 'dev-firm-id',
      },
    };
  }
}

/**
 * Require authenticated user - returns user or throws
 * Use in API routes that require authentication
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const { user, error } = await getAuthUser(request);
  if (!user) {
    throw new AuthError(error || 'Unauthorized', 401);
  }
  return user;
}

/**
 * Require Partner role - returns user or throws
 * Use in API routes that are Partner-only (e.g., merge categories, export)
 */
export async function requirePartner(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== 'Partner' && user.role !== 'Admin') {
    throw new AuthError('Partner role required', 403);
  }
  return user;
}

/**
 * Custom error class for auth failures
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Create JSON response for auth errors
 */
export function authErrorResponse(error: AuthError | Error): NextResponse {
  const statusCode = error instanceof AuthError ? error.statusCode : 401;
  return NextResponse.json(
    { error: 'unauthorized', message: error.message },
    { status: statusCode }
  );
}

/**
 * Get current authenticated user (alias for getAuthUser)
 * Returns user or null
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const { user } = await getAuthUser(request);
  return user;
}
