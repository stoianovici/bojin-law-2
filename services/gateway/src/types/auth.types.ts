/**
 * Authentication Types
 * Story 2.4: Authentication with Azure AD
 * Story 2.11.1: Business Owner Role
 *
 * TypeScript interfaces for authentication flow
 */

// Re-export UserSessionData from session config to avoid duplication
export { UserSessionData } from '../config/session.config';

/**
 * PKCE parameters stored in temporary session during OAuth flow
 */
export interface PKCETempSession {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  createdAt: number; // Unix timestamp in milliseconds
}

/**
 * JWT access token payload
 */
export interface JWTAccessTokenPayload {
  iss: string; // Issuer
  sub: string; // Subject (user ID)
  aud: string; // Audience
  exp: number; // Expiry (Unix timestamp in seconds)
  iat: number; // Issued at (Unix timestamp in seconds)
  userId: string;
  email: string;
  role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
  status: 'Pending' | 'Active' | 'Inactive';
  firmId: string | null;
  azureAdId: string;
}

/**
 * JWT refresh token payload
 */
export interface JWTRefreshTokenPayload {
  iss: string; // Issuer
  sub: string; // Subject (user ID)
  aud: string; // Audience
  exp: number; // Expiry (Unix timestamp in seconds)
  iat: number; // Issued at (Unix timestamp in seconds)
  type: 'refresh';
}

/**
 * Login response sent to frontend
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Seconds until access token expires
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    status: 'Pending' | 'Active' | 'Inactive';
    firmId: string | null;
  };
}

/**
 * Token refresh response sent to frontend
 */
export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number; // Seconds until access token expires
}

/**
 * Error response for authentication failures
 */
export interface AuthErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * User profile from Microsoft Graph API
 */
export interface GraphUserProfile {
  id: string; // Azure AD user ID
  userPrincipalName: string;
  mail: string;
  displayName: string;
  givenName: string;
  surname: string;
  jobTitle?: string;
  officeLocation?: string;
}
