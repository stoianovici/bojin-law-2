/**
 * Session Configuration with Redis Store
 * Story 2.4: Authentication with Azure AD
 * Story 2.11.1: Business Owner Role
 *
 * Configures Express session middleware with Redis backend for authentication.
 *
 * Session Data Structure:
 * - userId: User UUID
 * - email: User email
 * - role: User role (Partner, Associate, Paralegal)
 * - status: User status (Active, Pending, Inactive)
 * - firmId: Firm UUID (nullable for pending users)
 * - azureAdId: Azure AD user ID (oid claim)
 * - accessToken: Azure AD access token (for Microsoft Graph API)
 * - refreshToken: Azure AD refresh token (for token refresh)
 * - accessTokenExpiry: Unix timestamp (seconds) when access token expires
 * - createdAt: Unix timestamp (seconds) when session was created
 * - lastActivity: Unix timestamp (seconds) of last request
 *
 * Security Features:
 * - httpOnly: Prevents JavaScript access to cookies (XSS protection)
 * - secure: HTTPS-only in production
 * - sameSite: strict (CSRF protection)
 * - 7-day TTL (matches refresh token lifetime)
 *
 * Usage:
 *   import { sessionConfig } from './config/session.config';
 *
 *   app.use(session(sessionConfig));
 */

import session from 'express-session';
import RedisStore from 'connect-redis';
import { redis } from '@legal-platform/database';

// Session TTL: 7 days (matches Azure AD refresh token lifetime)
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 604800000 milliseconds
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 604800 seconds

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

if (process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long');
}

// Check if Redis is available (development fallback to memory store)
const useMemoryStore =
  process.env.NODE_ENV !== 'production' && process.env.USE_MEMORY_SESSION === 'true';

// Redis session store configuration (only if not using memory store)
const redisStore = useMemoryStore
  ? undefined
  : new RedisStore({
      client: redis,
      prefix: 'sess:', // Session key prefix in Redis
      ttl: SESSION_TTL_SECONDS, // 7 days in seconds
      disableTouch: false, // Enable session refresh on activity
      disableTTL: false, // Enable TTL expiration
    });

if (useMemoryStore) {
  console.warn('⚠️  Using in-memory session store (sessions will not persist across restarts)');
}

// Express session configuration
export const sessionConfig: session.SessionOptions = {
  ...(redisStore && { store: redisStore }),
  secret: process.env.SESSION_SECRET,
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something stored
  rolling: true, // Reset expiry on every request (keep sessions alive)
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS-only in production
    httpOnly: true, // Prevent JavaScript access (XSS protection)
    maxAge: SESSION_MAX_AGE_MS, // 7 days in milliseconds
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // 'lax' in dev to allow localhost:3000 -> localhost:4000
    domain: process.env.COOKIE_DOMAIN, // Optional: restrict to domain
    path: '/', // Cookie available for entire site
  },
  name: 'sid', // Session cookie name (default is connect.sid)
  genid: () => {
    // Generate unique session ID using crypto.randomUUID
    return crypto.randomUUID();
  },
};

// User session data type definition
// Story 2.11.1: Added BusinessOwner role
export interface UserSessionData {
  userId: string;
  email: string;
  role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
  status: 'Active' | 'Pending' | 'Inactive';
  firmId: string | null;
  azureAdId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number; // Unix timestamp in seconds
  createdAt: number; // Unix timestamp in seconds
  lastActivity: number; // Unix timestamp in seconds
}

// Extend Express Session types
declare module 'express-session' {
  interface SessionData {
    user?: UserSessionData;
  }
}

// Export constants for testing
export const SESSION_CONSTANTS = {
  MAX_AGE_MS: SESSION_MAX_AGE_MS,
  TTL_SECONDS: SESSION_TTL_SECONDS,
  PREFIX: 'sess:',
  COOKIE_NAME: 'sid',
};
