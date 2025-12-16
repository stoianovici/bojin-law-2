/**
 * Session Validation Middleware
 * Story 2.4: Authentication with Azure AD - Task 11
 * Story 2.11.1: Business Owner Role
 *
 * Middleware to validate user session from Redis for protected routes.
 */

import { Request, Response, NextFunction } from 'express';
import { UserSessionData } from '../config/session.config';

// Note: Express.Request.user is extended in auth.middleware.ts with union type
// to support both JWT and Session authentication

/**
 * Validate user session middleware
 * Checks if user has valid session in Redis (via express-session)
 *
 * Usage:
 *   app.get('/protected-route', validateSession, (req, res) => {
 *     // req.user contains session data
 *   });
 */
export const validateSession = (req: Request, res: Response, next: NextFunction) => {
  // Check if session exists and has user data
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required. Please login.',
    });
  }

  const sessionUser = req.session.user;
  const now = Math.floor(Date.now() / 1000);

  // Check if access token has expired
  if (sessionUser.accessTokenExpiry && now > sessionUser.accessTokenExpiry) {
    return res.status(401).json({
      error: 'token_expired',
      message: 'Access token expired. Please refresh your token or login again.',
    });
  }

  // Check if user status is still Active
  if (sessionUser.status !== 'Active') {
    return res.status(403).json({
      error: 'account_not_active',
      message: `Your account is ${sessionUser.status}. Please contact your administrator.`,
    });
  }

  // Update last activity timestamp
  sessionUser.lastActivity = now;

  // Attach user to request for use in route handlers
  req.user = sessionUser;

  next();
};

/**
 * Optional session validation middleware
 * Attaches user to request if session exists, but doesn't require it
 *
 * Usage:
 *   app.get('/public-route', optionalSession, (req, res) => {
 *     // req.user may or may not exist
 *   });
 */
export const optionalSession = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.user) {
    const sessionUser = req.session.user;
    const now = Math.floor(Date.now() / 1000);

    // Update last activity if session is valid
    if (sessionUser.accessTokenExpiry && now <= sessionUser.accessTokenExpiry) {
      sessionUser.lastActivity = now;
      req.user = sessionUser;
    }
  }

  next();
};

/**
 * Require specific role middleware
 * Must be used after validateSession
 *
 * Usage:
 *   app.get('/admin-route', validateSession, requireRole(['Partner']), (req, res) => {
 *     // Only Partners can access
 *   });
 */
export const requireRole = (
  allowedRoles: Array<'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner'>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'forbidden',
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    next();
  };
};
