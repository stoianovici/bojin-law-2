/**
 * Word AI Auth Middleware
 * Phase 1.1: Proper JWT Verification for Office SSO Tokens
 *
 * Replaces the insecure decodeJwtPayload() approach with proper
 * cryptographic verification using Azure AD's public keys.
 */

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import type { JwtHeader, SigningKeyCallback, Algorithm } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface SessionUser {
  userId: string;
  firmId: string;
  email: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  sessionUser?: SessionUser;
}

interface AzureAdTokenPayload {
  oid?: string; // Object ID (user ID in Azure AD)
  preferred_username?: string;
  upn?: string; // User Principal Name
  email?: string;
  iss?: string; // Issuer
  aud?: string; // Audience
  exp?: number; // Expiration
  iat?: number; // Issued at
  tid?: string; // Tenant ID
}

// ============================================================================
// JWKS Client (cached)
// ============================================================================

const TENANT_ID = process.env.AZURE_AD_TENANT_ID;
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;

// JWKS client for fetching Azure AD public keys
// Uses caching and rate limiting for performance
const jwksClientInstance = new JwksClient({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5, // Number of keys to cache
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10, // Prevent abuse
});

/**
 * Get signing key for JWT verification
 */
function getKey(header: JwtHeader, callback: SigningKeyCallback): void {
  if (!header.kid) {
    callback(new Error('No kid in JWT header'));
    return;
  }

  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err) {
      logger.error('Failed to get signing key', { error: err.message, kid: header.kid });
      callback(err);
      return;
    }

    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Verify Azure AD JWT token with proper cryptographic verification.
 *
 * @param token - The Bearer token from Authorization header
 * @returns Decoded and verified token payload, or null if invalid
 */
async function verifyAzureAdToken(token: string): Promise<AzureAdTokenPayload | null> {
  // Check if we have required config
  if (!TENANT_ID || !CLIENT_ID) {
    logger.error('Missing Azure AD configuration', {
      hasTenantId: !!TENANT_ID,
      hasClientId: !!CLIENT_ID,
    });
    return null;
  }

  return new Promise((resolve) => {
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['RS256'] as Algorithm[],
      issuer: [
        // v2.0 endpoint
        `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
        // v1.0 endpoint (some Office clients may use this)
        `https://sts.windows.net/${TENANT_ID}/`,
      ],
      audience: [
        // Standard audience claims
        CLIENT_ID,
        `api://${CLIENT_ID}`,
        // Production manifest uses domain-qualified resource URI
        `api://api.bojin-law.com/${CLIENT_ID}`,
        // Staging/dev manifest uses dev domain
        `api://dev.bojin-law.com/${CLIENT_ID}`,
        // Office may also include this
        `spn:${CLIENT_ID}`,
      ],
    };

    jwt.verify(token, getKey, verifyOptions, (err, decoded) => {
      if (err) {
        logger.warn('JWT verification failed', {
          error: err.message,
          name: err.name,
          // Don't log the full token, just first/last chars for debugging
          tokenPreview:
            token.length > 20 ? `${token.slice(0, 10)}...${token.slice(-10)}` : '[short]',
        });
        resolve(null);
        return;
      }

      resolve(decoded as AzureAdTokenPayload);
    });
  });
}

// ============================================================================
// Dev Bypass (Controlled)
// ============================================================================

// Startup check: Warn if ENABLE_DEV_BYPASS is set in production
// This is defense-in-depth - the code blocks it anyway, but this alerts on misconfiguration
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_BYPASS === 'true') {
  logger.error(
    'SECURITY MISCONFIGURATION: ENABLE_DEV_BYPASS=true is set in production! ' +
      'This is blocked at runtime but indicates a configuration error. ' +
      'Remove ENABLE_DEV_BYPASS from production environment variables immediately.'
  );
}

/**
 * Check if dev bypass should be allowed.
 * Requires explicit ENABLE_DEV_BYPASS=true env var.
 */
function isDevBypassAllowed(req: Request): boolean {
  // Only allow in non-production
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // Require explicit opt-in
  if (process.env.ENABLE_DEV_BYPASS !== 'true') {
    return false;
  }

  // Check for dev bypass header
  return req.headers['x-dev-bypass'] === 'word-addin';
}

/**
 * Get dev bypass user.
 * Uses env var for firm ID - required when dev bypass is enabled.
 *
 * @returns SessionUser if DEV_BYPASS_FIRM_ID is set, null otherwise
 */
function getDevBypassUser(): SessionUser | null {
  const firmId = process.env.DEV_BYPASS_FIRM_ID;

  if (!firmId) {
    logger.error(
      'DEV_BYPASS_FIRM_ID environment variable is required when ENABLE_DEV_BYPASS=true. ' +
        'Please set it in your .env.local file to your firm ID from the database.'
    );
    return null;
  }

  return {
    userId: 'dev-user',
    firmId,
    email: 'dev@test.local',
  };
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Authentication middleware for Word AI routes.
 *
 * Verifies Office SSO tokens using Azure AD's public keys (JWKS).
 * Falls back to session-based auth for web platform requests.
 *
 * Security improvements over previous implementation:
 * 1. Proper JWT signature verification using RS256
 * 2. Validates issuer matches Azure AD tenant
 * 3. Validates audience matches our client ID
 * 4. Checks token expiration
 * 5. Dev bypass requires explicit env var
 */
export async function requireWordAiAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  // Dev mode bypass (controlled)
  if (isDevBypassAllowed(req)) {
    const devUser = getDevBypassUser();
    if (devUser) {
      logger.warn('Using dev bypass for Word AI auth', {
        path: req.path,
        firmId: devUser.firmId,
      });
      req.sessionUser = devUser;
      return next();
    }
  }

  // Check for Bearer token (Office SSO)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // Verify the token cryptographically
    const payload = await verifyAzureAdToken(token);

    if (payload) {
      const email = (payload.preferred_username || payload.upn || payload.email) as string;

      if (!email) {
        logger.warn('JWT missing email claim', {
          hasPreferredUsername: !!payload.preferred_username,
          hasUpn: !!payload.upn,
          hasEmail: !!payload.email,
        });
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Token missing email claim',
        });
      }

      // Look up user in database by email to get firmId
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, firmId: true, email: true, role: true },
      });

      if (user) {
        req.sessionUser = {
          userId: user.id,
          firmId: user.firmId,
          email: user.email,
          role: user.role,
        };

        logger.debug('Word AI auth successful via JWT', {
          userId: user.id,
          email: user.email,
        });

        return next();
      }

      // User not found in DB
      logger.warn('Word add-in auth: User not found in database', {
        email,
        oid: payload.oid,
      });

      return res.status(401).json({
        error: 'unauthorized',
        message: 'User not registered in platform',
      });
    }

    // JWT verification failed - don't fall through to session auth
    // This prevents token bypass attacks
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid or expired token',
    });
  }

  // Fall back to session-based auth (for web platform)
  const session = req.session as { user?: SessionUser };
  if (session?.user) {
    // Monitor: Word add-in requests should NEVER use session fallback
    // They should always have Bearer tokens from Office SSO
    const userAgent = req.headers['user-agent'] || '';
    const isLikelyWordAddin =
      userAgent.includes('Microsoft Office') ||
      userAgent.includes('Word') ||
      req.headers['x-requested-with'] === 'XMLHttpRequest' ||
      req.headers.origin?.includes('officeapps.live.com');

    if (isLikelyWordAddin) {
      logger.warn('Word add-in using session fallback (expected Bearer token)', {
        path: req.path,
        userId: session.user.userId,
        userAgent: userAgent.substring(0, 100),
        origin: req.headers.origin,
        referer: req.headers.referer,
      });
    }

    req.sessionUser = {
      userId: session.user.userId,
      firmId: session.user.firmId,
      email: session.user.email,
    };
    return next();
  }

  return res.status(401).json({
    error: 'unauthorized',
    message: 'Authentication required',
  });
}

export default {
  requireWordAiAuth,
};
