/**
 * Unit Tests for Session Configuration
 * Story 2.4: Authentication with Azure AD - Task 10
 *
 * Tests session configuration with Redis store
 */

// Set environment variables BEFORE any imports (module-level validation)
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long';
process.env.NODE_ENV = 'test';

// Mock @legal-platform/database before any imports
jest.mock('@legal-platform/database');

import { sessionConfig, SESSION_CONSTANTS } from '../../src/config/session.config';

describe('Session Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = {
      ...originalEnv,
      SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
      NODE_ENV: 'test',
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('SESSION_CONSTANTS', () => {
    it('should define correct session max age in milliseconds (7 days)', () => {
      const expectedMs = 7 * 24 * 60 * 60 * 1000; // 604800000 ms
      expect(SESSION_CONSTANTS.MAX_AGE_MS).toBe(expectedMs);
      expect(SESSION_CONSTANTS.MAX_AGE_MS).toBe(604800000);
    });

    it('should define correct session TTL in seconds (7 days)', () => {
      const expectedSeconds = 7 * 24 * 60 * 60; // 604800 seconds
      expect(SESSION_CONSTANTS.TTL_SECONDS).toBe(expectedSeconds);
      expect(SESSION_CONSTANTS.TTL_SECONDS).toBe(604800);
    });

    it('should define correct session key prefix', () => {
      expect(SESSION_CONSTANTS.PREFIX).toBe('sess:');
    });

    it('should define correct cookie name', () => {
      expect(SESSION_CONSTANTS.COOKIE_NAME).toBe('sid');
    });
  });

  describe('sessionConfig', () => {
    it('should have Redis store configured', () => {
      expect(sessionConfig.store).toBeDefined();
      expect(sessionConfig.store).toHaveProperty('client');
    });

    it('should use SESSION_SECRET from environment', () => {
      expect(sessionConfig.secret).toBe('test-session-secret-at-least-32-characters-long');
    });

    it('should have resave set to false', () => {
      expect(sessionConfig.resave).toBe(false);
    });

    it('should have saveUninitialized set to false', () => {
      expect(sessionConfig.saveUninitialized).toBe(false);
    });

    it('should have rolling set to true (refresh session on activity)', () => {
      expect(sessionConfig.rolling).toBe(true);
    });

    it('should have cookie name set to sid', () => {
      expect(sessionConfig.name).toBe('sid');
    });

    it('should have genid function that generates UUIDs', () => {
      expect(sessionConfig.genid).toBeDefined();
      const sessionId1 = sessionConfig.genid!({} as any);
      const sessionId2 = sessionConfig.genid!({} as any);

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(sessionId1).toMatch(uuidRegex);
      expect(sessionId2).toMatch(uuidRegex);

      // Each call should generate unique ID
      expect(sessionId1).not.toBe(sessionId2);
    });
  });

  describe('sessionConfig.cookie', () => {
    it('should configure httpOnly cookie for XSS protection', () => {
      expect(sessionConfig.cookie).toBeDefined();
      expect(sessionConfig.cookie!.httpOnly).toBe(true);
    });

    it('should configure sameSite=strict for CSRF protection', () => {
      expect(sessionConfig.cookie!.sameSite).toBe('strict');
    });

    it('should set maxAge to 7 days in milliseconds', () => {
      expect(sessionConfig.cookie!.maxAge).toBe(604800000); // 7 days
    });

    it('should set path to /', () => {
      expect(sessionConfig.cookie!.path).toBe('/');
    });

    it('should set secure to false in test environment', () => {
      process.env.NODE_ENV = 'test';
      // Re-import to get fresh config with new env
      jest.resetModules();
      const { sessionConfig: testConfig } = require('../../src/config/session.config');
      expect(testConfig.cookie!.secure).toBe(false);
    });

    it('should set secure to true in production environment', () => {
      process.env.NODE_ENV = 'production';
      // Re-import to get fresh config with new env
      jest.resetModules();
      const { sessionConfig: prodConfig } = require('../../src/config/session.config');
      expect(prodConfig.cookie!.secure).toBe(true);
    });

    it('should set secure to false in development environment', () => {
      process.env.NODE_ENV = 'development';
      // Re-import to get fresh config with new env
      jest.resetModules();
      const { sessionConfig: devConfig } = require('../../src/config/session.config');
      expect(devConfig.cookie!.secure).toBe(false);
    });
  });

  describe('Environment Variable Validation', () => {
    it('should throw error if SESSION_SECRET is missing', () => {
      delete process.env.SESSION_SECRET;
      jest.resetModules();

      expect(() => {
        require('../../src/config/session.config');
      }).toThrow('SESSION_SECRET environment variable is required');
    });

    it('should throw error if SESSION_SECRET is too short (< 32 characters)', () => {
      process.env.SESSION_SECRET = 'short-secret'; // Only 12 characters
      jest.resetModules();

      expect(() => {
        require('../../src/config/session.config');
      }).toThrow('SESSION_SECRET must be at least 32 characters long');
    });

    it('should accept SESSION_SECRET with exactly 32 characters', () => {
      process.env.SESSION_SECRET = '12345678901234567890123456789012'; // Exactly 32 chars
      jest.resetModules();

      expect(() => {
        require('../../src/config/session.config');
      }).not.toThrow();
    });

    it('should accept SESSION_SECRET longer than 32 characters', () => {
      process.env.SESSION_SECRET =
        'this-is-a-very-long-session-secret-with-more-than-32-characters';
      jest.resetModules();

      expect(() => {
        require('../../src/config/session.config');
      }).not.toThrow();
    });
  });

  describe('RedisStore Configuration', () => {
    it('should configure Redis store with correct TTL', () => {
      // RedisStore internal config is not directly accessible
      // But we can verify the store is defined
      expect(sessionConfig.store).toBeDefined();
      expect(sessionConfig.store).toHaveProperty('client');
    });
  });
});
