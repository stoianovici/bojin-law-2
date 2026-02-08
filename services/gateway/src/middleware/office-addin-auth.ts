/**
 * Office Add-in Authentication
 *
 * Shared JWT verification for Word and Outlook add-ins.
 * Verifies Office SSO tokens using Azure AD's public keys (JWKS).
 */

import * as jwt from 'jsonwebtoken';
import type { JwtHeader, SigningKeyCallback, Algorithm } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface OfficeAddinUser {
  userId: string;
  firmId: string;
  email: string;
  role?: string;
}

interface AzureAdTokenPayload {
  oid?: string;
  preferred_username?: string;
  upn?: string;
  email?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  tid?: string;
}

// ============================================================================
// JWKS Client (cached)
// ============================================================================

const TENANT_ID = process.env.AZURE_AD_TENANT_ID;
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;

const jwksClientInstance = new JwksClient({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

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
 */
async function verifyAzureAdToken(token: string): Promise<AzureAdTokenPayload | null> {
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
        `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
        `https://sts.windows.net/${TENANT_ID}/`,
      ],
      audience: [
        CLIENT_ID,
        `api://${CLIENT_ID}`,
        // Production manifest uses domain-qualified resource URI
        `api://api.bojin-law.com/${CLIENT_ID}`,
        // Staging/dev manifest uses dev domain
        `api://dev.bojin-law.com/${CLIENT_ID}`,
        `spn:${CLIENT_ID}`,
      ],
    };

    jwt.verify(token, getKey, verifyOptions, (err, decoded) => {
      if (err) {
        logger.warn('JWT verification failed', {
          error: err.message,
          name: err.name,
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
// Public API
// ============================================================================

/**
 * Verify an Office add-in Bearer token and return the user info.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer xxx")
 * @returns User info if valid, null if invalid or not authenticated
 */
export async function verifyOfficeAddinToken(
  authHeader: string | undefined
): Promise<OfficeAddinUser | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = await verifyAzureAdToken(token);

  if (!payload) {
    return null;
  }

  const email = (payload.preferred_username || payload.upn || payload.email) as string;

  if (!email) {
    logger.warn('Office add-in JWT missing email claim', {
      hasPreferredUsername: !!payload.preferred_username,
      hasUpn: !!payload.upn,
      hasEmail: !!payload.email,
    });
    return null;
  }

  // Look up user in database by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firmId: true, email: true, role: true },
  });

  if (!user) {
    logger.warn('Office add-in auth: User not found in database', {
      email,
      oid: payload.oid,
    });
    return null;
  }

  logger.debug('Office add-in auth successful', {
    userId: user.id,
    email: user.email,
  });

  return {
    userId: user.id,
    firmId: user.firmId,
    email: user.email,
    role: user.role,
  };
}
