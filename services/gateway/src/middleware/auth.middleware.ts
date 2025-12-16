/**
 * Authentication Middleware
 * Story 2.4: Authentication with Azure AD
 * Story 2.11.1: Business Owner Role
 *
 * Validates JWT tokens for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwt.service';
import { JWTAccessTokenPayload, UserSessionData } from '../types/auth.types';

// Extend Express Request to include user (can be from JWT or Session)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTAccessTokenPayload | UserSessionData;
    }
  }
}

const jwtService = new JWTService();

/**
 * Extract JWT token from Authorization header
 *
 * @param req - Express request
 * @returns JWT token or null
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Check for Bearer token format
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authentication middleware
 * Validates JWT access token and attaches user to request
 *
 * Usage:
 *   router.get('/protected', authenticateJWT, (req, res) => {
 *     const user = req.user; // User from token payload
 *   });
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract token from Authorization header
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      return;
    }

    // Validate token
    const decoded = jwtService.validateAccessToken(token);

    // Attach user to request
    req.user = decoded;

    next();
  } catch (error: any) {
    console.error('JWT authentication error:', error);

    // Handle token expiration
    if (error.message.includes('expired')) {
      res.status(401).json({
        error: 'token_expired',
        message: 'Access token has expired. Please refresh your token.',
      });
      return;
    }

    // Handle invalid token
    res.status(401).json({
      error: 'invalid_token',
      message: error.message || 'Invalid access token',
    });
  }
}

/**
 * Optional authentication middleware
 * Validates JWT if present but doesn't fail if missing
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function optionalAuthenticateJWT(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = jwtService.validateAccessToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Ignore errors for optional authentication
    next();
  }
}

/**
 * Role-based authorization middleware
 * Requires user to have one of the specified roles
 *
 * Usage:
 *   router.get('/admin', authenticateJWT, requireRole(['Partner']), (req, res) => {
 *     // Only accessible by Partners
 *   });
 *
 * @param roles - Array of allowed roles
 * @returns Express middleware function
 */
export function requireRole(roles: Array<'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'forbidden',
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Active user middleware
 * Requires user status to be 'Active'
 *
 * Usage:
 *   router.get('/dashboard', authenticateJWT, requireActiveUser, (req, res) => {
 *     // Only accessible by active users
 *   });
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function requireActiveUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  if (req.user.status !== 'Active') {
    let message: string;

    if (req.user.status === 'Pending') {
      message =
        "Your account is pending activation. Please contact your firm's partner for access.";
    } else if (req.user.status === 'Inactive') {
      message = "Your account has been deactivated. Please contact your firm's partner.";
    } else {
      message = 'Access denied';
    }

    res.status(403).json({
      error: 'account_not_active',
      message,
      status: req.user.status,
    });
    return;
  }

  next();
}
