/**
 * JWT Token Service
 * Story 2.4: Authentication with Azure AD
 * Story 2.11.1: Business Owner Role
 *
 * Handles JWT token generation and validation for API authentication.
 *
 * Token Types:
 * - Access Token: Short-lived (30 min), used for API requests
 * - Refresh Token: Long-lived (7 days), used to get new access tokens
 *
 * Ref: https://datatracker.ietf.org/doc/html/rfc7519
 */

import jwt from 'jsonwebtoken';
import { JWTAccessTokenPayload, JWTRefreshTokenPayload } from '../types/auth.types';

/**
 * JWT configuration from environment variables
 */
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://bojin-law.onrender.com';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'bojin-law-api';

// Validate JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for token generation');
}

if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters for security');
}

/**
 * Token expiry durations
 */
export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: 30 * 60, // 30 minutes in seconds
  REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7 days in seconds
};

/**
 * JWT Token Service
 * Handles token generation and validation
 */
export class JWTService {
  /**
   * Generate access token
   *
   * @param userInfo - User information for token payload
   * @returns Signed JWT access token
   */
  generateAccessToken(userInfo: {
    userId: string;
    email: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    status: 'Pending' | 'Active' | 'Inactive';
    firmId: string | null;
    azureAdId: string;
  }): string {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds

    const payload: JWTAccessTokenPayload = {
      iss: JWT_ISSUER,
      sub: userInfo.userId,
      aud: JWT_AUDIENCE,
      exp: now + TOKEN_EXPIRY.ACCESS_TOKEN,
      iat: now,
      userId: userInfo.userId,
      email: userInfo.email,
      role: userInfo.role,
      status: userInfo.status,
      firmId: userInfo.firmId,
      azureAdId: userInfo.azureAdId,
    };

    return jwt.sign(payload, JWT_SECRET!, { algorithm: 'HS256' });
  }

  /**
   * Generate refresh token
   *
   * @param userId - User ID for token payload
   * @returns Signed JWT refresh token
   */
  generateRefreshToken(userId: string): string {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds

    const payload: JWTRefreshTokenPayload = {
      iss: JWT_ISSUER,
      sub: userId,
      aud: JWT_AUDIENCE,
      exp: now + TOKEN_EXPIRY.REFRESH_TOKEN,
      iat: now,
      type: 'refresh',
    };

    return jwt.sign(payload, JWT_SECRET!, { algorithm: 'HS256' });
  }

  /**
   * Validate and decode access token
   *
   * @param token - JWT access token
   * @returns Decoded token payload
   * @throws Error if token is invalid or expired
   */
  validateAccessToken(token: string): JWTAccessTokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET!, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as JWTAccessTokenPayload;

      // Verify token is not a refresh token
      if ('type' in decoded && decoded.type === 'refresh') {
        throw new Error('Invalid token type: expected access token');
      }

      return decoded;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token has expired');
      }

      if (error.name === 'JsonWebTokenError') {
        throw new Error(`Invalid access token: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Validate and decode refresh token
   *
   * @param token - JWT refresh token
   * @returns Decoded token payload
   * @throws Error if token is invalid or expired
   */
  validateRefreshToken(token: string): JWTRefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET!, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as JWTRefreshTokenPayload;

      // Verify token is a refresh token
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type: expected refresh token');
      }

      return decoded;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      }

      if (error.name === 'JsonWebTokenError') {
        throw new Error(`Invalid refresh token: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging only)
   *
   * @param token - JWT token
   * @returns Decoded token payload or null if invalid
   */
  decodeToken(token: string): any | null {
    return jwt.decode(token);
  }

  /**
   * Get token expiry time
   *
   * @param token - JWT token
   * @returns Expiry time in Unix timestamp (seconds) or null if no expiry
   */
  getTokenExpiry(token: string): number | null {
    const decoded = this.decodeToken(token);
    return decoded?.exp || null;
  }

  /**
   * Check if token is expired
   *
   * @param token - JWT token
   * @returns True if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    return expiry < now;
  }
}
