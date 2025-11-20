/**
 * JWT Service Unit Tests
 * Story 2.4: Authentication with Azure AD
 *
 * Tests token generation and validation logic
 * Target: 80%+ code coverage
 */

// Setup test environment variables BEFORE any imports
const JWT_SECRET_TEST = 'test-jwt-secret-min-32-characters-long-for-security';
const JWT_ISSUER_TEST = 'https://test.bojin-law.onrender.com';
const JWT_AUDIENCE_TEST = 'bojin-law-api-test';

process.env.JWT_SECRET = JWT_SECRET_TEST;
process.env.JWT_ISSUER = JWT_ISSUER_TEST;
process.env.JWT_AUDIENCE = JWT_AUDIENCE_TEST;

import jwt from 'jsonwebtoken';
import { JWTService, TOKEN_EXPIRY } from '../../src/services/jwt.service';
import {
  JWTAccessTokenPayload,
  JWTRefreshTokenPayload,
} from '../../src/types/auth.types';

describe('JWTService', () => {
  let jwtService: JWTService;

  beforeEach(() => {
    jwtService = new JWTService();
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate valid access token with correct claims', () => {
      const userInfo = {
        userId: 'user-123',
        email: 'john.doe@lawfirm.ro',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-456',
        azureAdId: 'azure-ad-789',
      };

      const token = jwtService.generateAccessToken(userInfo);

      // Verify token is a string
      expect(typeof token).toBe('string');
      expect(token).toBeTruthy();

      // Decode and verify payload
      const decoded = jwt.decode(token) as JWTAccessTokenPayload;
      expect(decoded.iss).toBe(JWT_ISSUER_TEST);
      expect(decoded.sub).toBe(userInfo.userId);
      expect(decoded.aud).toBe(JWT_AUDIENCE_TEST);
      expect(decoded.userId).toBe(userInfo.userId);
      expect(decoded.email).toBe(userInfo.email);
      expect(decoded.role).toBe(userInfo.role);
      expect(decoded.status).toBe(userInfo.status);
      expect(decoded.firmId).toBe(userInfo.firmId);
      expect(decoded.azureAdId).toBe(userInfo.azureAdId);
    });

    it('should generate access token with 30-minute expiry', () => {
      const userInfo = {
        userId: 'user-123',
        email: 'john.doe@lawfirm.ro',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-456',
        azureAdId: 'azure-ad-789',
      };

      const beforeGeneration = Math.floor(Date.now() / 1000);
      const token = jwtService.generateAccessToken(userInfo);
      const afterGeneration = Math.floor(Date.now() / 1000);

      const decoded = jwt.decode(token) as JWTAccessTokenPayload;

      // Verify expiry is approximately 30 minutes from now
      expect(decoded.exp).toBeGreaterThanOrEqual(
        beforeGeneration + TOKEN_EXPIRY.ACCESS_TOKEN
      );
      expect(decoded.exp).toBeLessThanOrEqual(
        afterGeneration + TOKEN_EXPIRY.ACCESS_TOKEN
      );

      // Verify issued at timestamp
      expect(decoded.iat).toBeGreaterThanOrEqual(beforeGeneration);
      expect(decoded.iat).toBeLessThanOrEqual(afterGeneration);
    });

    it('should generate access token with null firmId for pending users', () => {
      const userInfo = {
        userId: 'user-123',
        email: 'pending@lawfirm.ro',
        role: 'Paralegal' as const,
        status: 'Pending' as const,
        firmId: null,
        azureAdId: 'azure-ad-789',
      };

      const token = jwtService.generateAccessToken(userInfo);
      const decoded = jwt.decode(token) as JWTAccessTokenPayload;

      expect(decoded.firmId).toBeNull();
      expect(decoded.status).toBe('Pending');
    });

    it('should generate different tokens for different users', () => {
      const user1 = {
        userId: 'user-1',
        email: 'user1@lawfirm.ro',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-1',
        azureAdId: 'azure-1',
      };

      const user2 = {
        userId: 'user-2',
        email: 'user2@lawfirm.ro',
        role: 'Associate' as const,
        status: 'Active' as const,
        firmId: 'firm-2',
        azureAdId: 'azure-2',
      };

      const token1 = jwtService.generateAccessToken(user1);
      const token2 = jwtService.generateAccessToken(user2);

      expect(token1).not.toBe(token2);

      const decoded1 = jwt.decode(token1) as JWTAccessTokenPayload;
      const decoded2 = jwt.decode(token2) as JWTAccessTokenPayload;

      expect(decoded1.userId).toBe(user1.userId);
      expect(decoded2.userId).toBe(user2.userId);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate valid refresh token with correct claims', () => {
      const userId = 'user-123';
      const token = jwtService.generateRefreshToken(userId);

      expect(typeof token).toBe('string');
      expect(token).toBeTruthy();

      const decoded = jwt.decode(token) as JWTRefreshTokenPayload;
      expect(decoded.iss).toBe(JWT_ISSUER_TEST);
      expect(decoded.sub).toBe(userId);
      expect(decoded.aud).toBe(JWT_AUDIENCE_TEST);
      expect(decoded.type).toBe('refresh');
    });

    it('should generate refresh token with 7-day expiry', () => {
      const userId = 'user-123';

      const beforeGeneration = Math.floor(Date.now() / 1000);
      const token = jwtService.generateRefreshToken(userId);
      const afterGeneration = Math.floor(Date.now() / 1000);

      const decoded = jwt.decode(token) as JWTRefreshTokenPayload;

      // Verify expiry is approximately 7 days from now
      expect(decoded.exp).toBeGreaterThanOrEqual(
        beforeGeneration + TOKEN_EXPIRY.REFRESH_TOKEN
      );
      expect(decoded.exp).toBeLessThanOrEqual(
        afterGeneration + TOKEN_EXPIRY.REFRESH_TOKEN
      );

      // Verify issued at timestamp
      expect(decoded.iat).toBeGreaterThanOrEqual(beforeGeneration);
      expect(decoded.iat).toBeLessThanOrEqual(afterGeneration);
    });

    it('should generate different refresh tokens for different users', () => {
      const token1 = jwtService.generateRefreshToken('user-1');
      const token2 = jwtService.generateRefreshToken('user-2');

      expect(token1).not.toBe(token2);

      const decoded1 = jwt.decode(token1) as JWTRefreshTokenPayload;
      const decoded2 = jwt.decode(token2) as JWTRefreshTokenPayload;

      expect(decoded1.sub).toBe('user-1');
      expect(decoded2.sub).toBe('user-2');
    });
  });

  describe('validateAccessToken', () => {
    it('should validate and decode valid access token', () => {
      const userInfo = {
        userId: 'user-123',
        email: 'john.doe@lawfirm.ro',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-456',
        azureAdId: 'azure-ad-789',
      };

      const token = jwtService.generateAccessToken(userInfo);
      const decoded = jwtService.validateAccessToken(token);

      expect(decoded.userId).toBe(userInfo.userId);
      expect(decoded.email).toBe(userInfo.email);
      expect(decoded.role).toBe(userInfo.role);
      expect(decoded.status).toBe(userInfo.status);
      expect(decoded.firmId).toBe(userInfo.firmId);
      expect(decoded.azureAdId).toBe(userInfo.azureAdId);
    });

    it('should throw error for expired access token', () => {
      // Generate token with past expiry
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload: JWTAccessTokenPayload = {
        iss: JWT_ISSUER_TEST,
        sub: 'user-123',
        aud: JWT_AUDIENCE_TEST,
        exp: now - 3600, // Expired 1 hour ago
        iat: now - 7200,
        userId: 'user-123',
        email: 'test@lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        azureAdId: 'azure-789',
      };

      const expiredToken = jwt.sign(expiredPayload, JWT_SECRET_TEST, {
        algorithm: 'HS256',
      });

      expect(() => {
        jwtService.validateAccessToken(expiredToken);
      }).toThrow('Access token has expired');
    });

    it('should throw error for invalid signature', () => {
      const userInfo = {
        userId: 'user-123',
        email: 'john.doe@lawfirm.ro',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-456',
        azureAdId: 'azure-ad-789',
      };

      // Generate token with different secret
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTAccessTokenPayload = {
        iss: JWT_ISSUER_TEST,
        sub: userInfo.userId,
        aud: JWT_AUDIENCE_TEST,
        exp: now + TOKEN_EXPIRY.ACCESS_TOKEN,
        iat: now,
        userId: userInfo.userId,
        email: userInfo.email,
        role: userInfo.role,
        status: userInfo.status,
        firmId: userInfo.firmId,
        azureAdId: userInfo.azureAdId,
      };

      const invalidToken = jwt.sign(payload, 'wrong-secret-key-that-is-at-least-32-chars', {
        algorithm: 'HS256',
      });

      expect(() => {
        jwtService.validateAccessToken(invalidToken);
      }).toThrow('Invalid access token');
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        jwtService.validateAccessToken('invalid.token.string');
      }).toThrow('Invalid access token');
    });

    it('should throw error for refresh token passed as access token', () => {
      const refreshToken = jwtService.generateRefreshToken('user-123');

      expect(() => {
        jwtService.validateAccessToken(refreshToken);
      }).toThrow('Invalid token type: expected access token');
    });

    it('should throw error for token with wrong issuer', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTAccessTokenPayload = {
        iss: 'https://wrong-issuer.com',
        sub: 'user-123',
        aud: JWT_AUDIENCE_TEST,
        exp: now + TOKEN_EXPIRY.ACCESS_TOKEN,
        iat: now,
        userId: 'user-123',
        email: 'test@lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        azureAdId: 'azure-789',
      };

      const invalidToken = jwt.sign(payload, JWT_SECRET_TEST, {
        algorithm: 'HS256',
      });

      expect(() => {
        jwtService.validateAccessToken(invalidToken);
      }).toThrow('Invalid access token');
    });

    it('should throw error for token with wrong audience', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTAccessTokenPayload = {
        iss: JWT_ISSUER_TEST,
        sub: 'user-123',
        aud: 'wrong-audience',
        exp: now + TOKEN_EXPIRY.ACCESS_TOKEN,
        iat: now,
        userId: 'user-123',
        email: 'test@lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        azureAdId: 'azure-789',
      };

      const invalidToken = jwt.sign(payload, JWT_SECRET_TEST, {
        algorithm: 'HS256',
      });

      expect(() => {
        jwtService.validateAccessToken(invalidToken);
      }).toThrow('Invalid access token');
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate and decode valid refresh token', () => {
      const userId = 'user-123';
      const token = jwtService.generateRefreshToken(userId);
      const decoded = jwtService.validateRefreshToken(token);

      expect(decoded.sub).toBe(userId);
      expect(decoded.type).toBe('refresh');
      expect(decoded.iss).toBe(JWT_ISSUER_TEST);
      expect(decoded.aud).toBe(JWT_AUDIENCE_TEST);
    });

    it('should throw error for expired refresh token', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload: JWTRefreshTokenPayload = {
        iss: JWT_ISSUER_TEST,
        sub: 'user-123',
        aud: JWT_AUDIENCE_TEST,
        exp: now - 86400, // Expired 1 day ago
        iat: now - 604800, // Issued 7 days ago
        type: 'refresh',
      };

      const expiredToken = jwt.sign(expiredPayload, JWT_SECRET_TEST, {
        algorithm: 'HS256',
      });

      expect(() => {
        jwtService.validateRefreshToken(expiredToken);
      }).toThrow('Refresh token has expired');
    });

    it('should throw error for invalid signature', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTRefreshTokenPayload = {
        iss: JWT_ISSUER_TEST,
        sub: 'user-123',
        aud: JWT_AUDIENCE_TEST,
        exp: now + TOKEN_EXPIRY.REFRESH_TOKEN,
        iat: now,
        type: 'refresh',
      };

      const invalidToken = jwt.sign(payload, 'wrong-secret-key-that-is-at-least-32-chars', {
        algorithm: 'HS256',
      });

      expect(() => {
        jwtService.validateRefreshToken(invalidToken);
      }).toThrow('Invalid refresh token');
    });

    it('should throw error for access token passed as refresh token', () => {
      const accessToken = jwtService.generateAccessToken({
        userId: 'user-123',
        email: 'test@lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        azureAdId: 'azure-789',
      });

      expect(() => {
        jwtService.validateRefreshToken(accessToken);
      }).toThrow('Invalid token type: expected refresh token');
    });

    it('should throw error for malformed refresh token', () => {
      expect(() => {
        jwtService.validateRefreshToken('invalid.token.string');
      }).toThrow('Invalid refresh token');
    });
  });

  describe('decodeToken', () => {
    it('should decode access token without verification', () => {
      const userInfo = {
        userId: 'user-123',
        email: 'john.doe@lawfirm.ro',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-456',
        azureAdId: 'azure-ad-789',
      };

      const token = jwtService.generateAccessToken(userInfo);
      const decoded = jwtService.decodeToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(userInfo.userId);
      expect(decoded.email).toBe(userInfo.email);
    });

    it('should decode refresh token without verification', () => {
      const userId = 'user-123';
      const token = jwtService.generateRefreshToken(userId);
      const decoded = jwtService.decodeToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.sub).toBe(userId);
      expect(decoded.type).toBe('refresh');
    });

    it('should return null for malformed token', () => {
      const decoded = jwtService.decodeToken('invalid.token');
      expect(decoded).toBeNull();
    });

    it('should decode expired token without throwing error', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload: JWTAccessTokenPayload = {
        iss: JWT_ISSUER_TEST,
        sub: 'user-123',
        aud: JWT_AUDIENCE_TEST,
        exp: now - 3600, // Expired 1 hour ago
        iat: now - 7200,
        userId: 'user-123',
        email: 'test@lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        azureAdId: 'azure-789',
      };

      const expiredToken = jwt.sign(expiredPayload, JWT_SECRET_TEST, {
        algorithm: 'HS256',
      });

      const decoded = jwtService.decodeToken(expiredToken);

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe('user-123');
    });
  });

  describe('getTokenExpiry', () => {
    it('should return expiry timestamp for access token', () => {
      const userInfo = {
        userId: 'user-123',
        email: 'john.doe@lawfirm.ro',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-456',
        azureAdId: 'azure-ad-789',
      };

      const token = jwtService.generateAccessToken(userInfo);
      const expiry = jwtService.getTokenExpiry(token);

      expect(expiry).toBeTruthy();
      expect(typeof expiry).toBe('number');

      // Verify expiry is approximately 30 minutes in future
      const now = Math.floor(Date.now() / 1000);
      expect(expiry).toBeGreaterThan(now);
      expect(expiry).toBeLessThanOrEqual(now + TOKEN_EXPIRY.ACCESS_TOKEN + 5);
    });

    it('should return expiry timestamp for refresh token', () => {
      const token = jwtService.generateRefreshToken('user-123');
      const expiry = jwtService.getTokenExpiry(token);

      expect(expiry).toBeTruthy();
      expect(typeof expiry).toBe('number');

      // Verify expiry is approximately 7 days in future
      const now = Math.floor(Date.now() / 1000);
      expect(expiry).toBeGreaterThan(now);
      expect(expiry).toBeLessThanOrEqual(now + TOKEN_EXPIRY.REFRESH_TOKEN + 5);
    });

    it('should return null for malformed token', () => {
      const expiry = jwtService.getTokenExpiry('invalid.token');
      expect(expiry).toBeNull();
    });

    it('should return expiry for token without verification', () => {
      // Token with wrong signature but valid structure
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        exp: now + 1800,
        userId: 'user-123',
      };

      const token = jwt.sign(payload, 'wrong-secret-that-is-at-least-32-chars-long', {
        algorithm: 'HS256',
      });

      const expiry = jwtService.getTokenExpiry(token);
      expect(expiry).toBe(now + 1800);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid non-expired token', () => {
      const userInfo = {
        userId: 'user-123',
        email: 'john.doe@lawfirm.ro',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-456',
        azureAdId: 'azure-ad-789',
      };

      const token = jwtService.generateAccessToken(userInfo);
      const isExpired = jwtService.isTokenExpired(token);

      expect(isExpired).toBe(false);
    });

    it('should return true for expired token', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload: JWTAccessTokenPayload = {
        iss: JWT_ISSUER_TEST,
        sub: 'user-123',
        aud: JWT_AUDIENCE_TEST,
        exp: now - 3600, // Expired 1 hour ago
        iat: now - 7200,
        userId: 'user-123',
        email: 'test@lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        azureAdId: 'azure-789',
      };

      const expiredToken = jwt.sign(expiredPayload, JWT_SECRET_TEST, {
        algorithm: 'HS256',
      });

      const isExpired = jwtService.isTokenExpired(expiredToken);
      expect(isExpired).toBe(true);
    });

    it('should return true for malformed token', () => {
      const isExpired = jwtService.isTokenExpired('invalid.token');
      expect(isExpired).toBe(true);
    });

    it('should return true for token without expiry', () => {
      const payload = {
        userId: 'user-123',
        // No exp field
      };

      const tokenWithoutExpiry = jwt.sign(payload, JWT_SECRET_TEST, {
        algorithm: 'HS256',
      });

      const isExpired = jwtService.isTokenExpired(tokenWithoutExpiry);
      expect(isExpired).toBe(true);
    });

    it('should return false for token about to expire but still valid', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTAccessTokenPayload = {
        iss: JWT_ISSUER_TEST,
        sub: 'user-123',
        aud: JWT_AUDIENCE_TEST,
        exp: now + 10, // Expires in 10 seconds
        iat: now - 1790,
        userId: 'user-123',
        email: 'test@lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        azureAdId: 'azure-789',
      };

      const tokenAboutToExpire = jwt.sign(payload, JWT_SECRET_TEST, {
        algorithm: 'HS256',
      });

      const isExpired = jwtService.isTokenExpired(tokenAboutToExpire);
      expect(isExpired).toBe(false);
    });
  });

  describe('TOKEN_EXPIRY constants', () => {
    it('should have correct expiry values', () => {
      expect(TOKEN_EXPIRY.ACCESS_TOKEN).toBe(30 * 60); // 30 minutes in seconds
      expect(TOKEN_EXPIRY.REFRESH_TOKEN).toBe(7 * 24 * 60 * 60); // 7 days in seconds
    });
  });
});
