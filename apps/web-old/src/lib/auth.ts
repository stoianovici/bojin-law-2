/**
 * Auth helper for web app API routes
 * Provides user context extraction from session cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@legal-platform/database';
import type { UserRole } from '@legal-platform/database';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  firmId: string;
}

export interface AuthResult {
  user: AuthUser | null;
  error?: string;
}

// Session cookie name
const SESSION_COOKIE = 'legal-platform-session';

/**
 * Create session cookie with user ID
 */
export function createSessionCookie(userId: string): string {
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
 */
export async function getAuthUser(request: NextRequest): Promise<AuthResult> {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

    if (!sessionCookie) {
      return { user: null, error: 'No session found' };
    }

    const session = parseSessionCookie(sessionCookie);

    if (!session) {
      return { user: null, error: 'Invalid session' };
    }

    // Check session age (24 hour max)
    const sessionAge = Date.now() - session.createdAt;
    const maxAge = 24 * 60 * 60 * 1000;

    if (sessionAge > maxAge) {
      return { user: null, error: 'Session expired' };
    }

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
 * Require authenticated user - returns user or throws
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const { user, error } = await getAuthUser(request);
  if (!user) {
    throw new AuthError(error || 'Unauthorized', 401);
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
 * Get current authenticated user
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const { user } = await getAuthUser(request);
  return user;
}

/**
 * Session cookie name export for other modules
 */
export const SESSION_COOKIE_NAME = SESSION_COOKIE;
