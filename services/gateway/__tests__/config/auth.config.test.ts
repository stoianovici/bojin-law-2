/**
 * Unit tests for Azure AD Authentication Configuration
 * Story 2.4: Authentication with Azure AD
 */

describe('Azure AD Authentication Configuration', () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Environment Variable Validation', () => {
    it('should throw error if AZURE_AD_CLIENT_ID is missing', () => {
      delete process.env.AZURE_AD_CLIENT_ID;
      process.env.AZURE_AD_TENANT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3000/auth/callback';

      expect(() => {
        require('../../src/config/auth.config');
      }).toThrow(/Missing required Azure AD environment variables.*AZURE_AD_CLIENT_ID/);
    });

    it('should throw error if AZURE_AD_TENANT_ID is missing', () => {
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      delete process.env.AZURE_AD_TENANT_ID;
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3000/auth/callback';

      expect(() => {
        require('../../src/config/auth.config');
      }).toThrow(/Missing required Azure AD environment variables.*AZURE_AD_TENANT_ID/);
    });

    it('should throw error if AZURE_AD_CLIENT_SECRET is missing', () => {
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '12345678-1234-1234-1234-123456789012';
      delete process.env.AZURE_AD_CLIENT_SECRET;
      process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3000/auth/callback';

      expect(() => {
        require('../../src/config/auth.config');
      }).toThrow(/Missing required Azure AD environment variables.*AZURE_AD_CLIENT_SECRET/);
    });

    it('should throw error if AZURE_AD_REDIRECT_URI is missing', () => {
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      delete process.env.AZURE_AD_REDIRECT_URI;

      expect(() => {
        require('../../src/config/auth.config');
      }).toThrow(/Missing required Azure AD environment variables.*AZURE_AD_REDIRECT_URI/);
    });

    it('should load configuration successfully with all required variables', () => {
      process.env.NODE_ENV = 'test';
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3000/auth/callback';

      expect(() => {
        require('../../src/config/auth.config');
      }).not.toThrow();
    });
  });

  describe('Configuration Values', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'https://example.com/auth/callback';
    });

    it('should export correct azureAdConfig', () => {
      const { azureAdConfig } = require('../../src/config/auth.config');

      expect(azureAdConfig.clientId).toBe('12345678-1234-1234-1234-123456789012');
      expect(azureAdConfig.tenantId).toBe('87654321-4321-4321-4321-210987654321');
      expect(azureAdConfig.clientSecret).toBe('test-secret-123456789');
      expect(azureAdConfig.redirectUri).toBe('https://example.com/auth/callback');
      expect(azureAdConfig.authority).toBe(
        'https://login.microsoftonline.com/87654321-4321-4321-4321-210987654321'
      );
    });

    it('should export correct MSAL configuration', () => {
      const { msalConfig } = require('../../src/config/auth.config');

      expect(msalConfig.auth.clientId).toBe('12345678-1234-1234-1234-123456789012');
      expect(msalConfig.auth.authority).toBe(
        'https://login.microsoftonline.com/87654321-4321-4321-4321-210987654321'
      );
      expect(msalConfig.auth.clientSecret).toBe('test-secret-123456789');
      expect(msalConfig.system?.loggerOptions?.piiLoggingEnabled).toBe(false);
    });

    it('should export correct auth scopes', () => {
      const { authScopes, defaultScopes } = require('../../src/config/auth.config');

      expect(authScopes.openid).toEqual(['openid', 'profile', 'email', 'offline_access']);
      expect(authScopes.graph.userRead).toEqual(['User.Read']);
      expect(authScopes.graph.userReadBasicAll).toEqual(['User.ReadBasic.All']);

      expect(defaultScopes).toContain('openid');
      expect(defaultScopes).toContain('profile');
      expect(defaultScopes).toContain('email');
      expect(defaultScopes).toContain('offline_access');
      expect(defaultScopes).toContain('User.Read');
    });

    it('should export correct token configuration', () => {
      const { tokenConfig } = require('../../src/config/auth.config');

      expect(tokenConfig.accessTokenExpiry).toBe(30 * 60 * 1000); // 30 minutes
      expect(tokenConfig.refreshTokenExpiry).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
    });
  });

  describe('Configuration Validation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should validate correct configuration', () => {
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'https://example.com/auth/callback';

      const { validateAuthConfig } = require('../../src/config/auth.config');
      const result = validateAuthConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid client ID format', () => {
      process.env.AZURE_AD_CLIENT_ID = 'invalid-guid';
      process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'https://example.com/auth/callback';

      const { validateAuthConfig } = require('../../src/config/auth.config');
      const result = validateAuthConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AZURE_AD_CLIENT_ID must be a valid GUID');
    });

    it('should reject invalid tenant ID format', () => {
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = 'invalid-guid';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'https://example.com/auth/callback';

      const { validateAuthConfig } = require('../../src/config/auth.config');
      const result = validateAuthConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AZURE_AD_TENANT_ID must be a valid GUID');
    });

    it('should reject client secret shorter than 16 characters', () => {
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
      process.env.AZURE_AD_CLIENT_SECRET = 'short-secret';
      process.env.AZURE_AD_REDIRECT_URI = 'https://example.com/auth/callback';

      const { validateAuthConfig } = require('../../src/config/auth.config');
      const result = validateAuthConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AZURE_AD_CLIENT_SECRET must be at least 16 characters');
    });

    it('should reject invalid redirect URI format', () => {
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'not-a-valid-url';

      const { validateAuthConfig } = require('../../src/config/auth.config');
      const result = validateAuthConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AZURE_AD_REDIRECT_URI must be a valid URL');
    });

    it('should reject redirect URI without /auth/callback path', () => {
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'https://example.com/wrong/path';

      const { validateAuthConfig } = require('../../src/config/auth.config');
      const result = validateAuthConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AZURE_AD_REDIRECT_URI must end with /auth/callback (e.g., https://example.com/auth/callback)'
      );
    });

    it('should reject HTTP redirect URI in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'http://example.com/auth/callback';

      const { validateAuthConfig } = require('../../src/config/auth.config');
      const result = validateAuthConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AZURE_AD_REDIRECT_URI must use HTTPS in production environment'
      );

      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should allow HTTP redirect URI in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
      process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
      process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3000/auth/callback';

      const { validateAuthConfig } = require('../../src/config/auth.config');
      const result = validateAuthConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
