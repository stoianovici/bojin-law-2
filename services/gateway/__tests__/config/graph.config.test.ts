/**
 * Unit Tests for Microsoft Graph API Configuration
 * Story 2.5: Microsoft Graph API Integration Foundation
 *
 * Tests configuration validation, defaults, and Graph client initialization
 */

import { Client } from '@microsoft/microsoft-graph-client';

describe('Graph API Configuration', () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to re-import with new env vars
    jest.resetModules();

    // Clone env to avoid mutations
    process.env = { ...originalEnv };

    // Skip validation during imports
    process.env.SKIP_GRAPH_VALIDATION = 'true';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('graphConfig defaults', () => {
    it('should use default base URL when GRAPH_API_BASE_URL is not set', () => {
      delete process.env.GRAPH_API_BASE_URL;

      const { graphConfig } = require('../../src/config/graph.config');

      expect(graphConfig.baseUrl).toBe('https://graph.microsoft.com/v1.0');
    });

    it('should use custom base URL when GRAPH_API_BASE_URL is set', () => {
      process.env.GRAPH_API_BASE_URL = 'https://custom.graph.microsoft.com/beta';

      const { graphConfig } = require('../../src/config/graph.config');

      expect(graphConfig.baseUrl).toBe('https://custom.graph.microsoft.com/beta');
    });

    it('should use default timeout of 30000ms when not specified', () => {
      delete process.env.GRAPH_API_TIMEOUT;

      const { graphConfig } = require('../../src/config/graph.config');

      expect(graphConfig.timeout).toBe(30000);
    });

    it('should use custom timeout when GRAPH_API_TIMEOUT is set', () => {
      process.env.GRAPH_API_TIMEOUT = '60000';

      const { graphConfig } = require('../../src/config/graph.config');

      expect(graphConfig.timeout).toBe(60000);
    });

    it('should use default retry max attempts of 5 when not specified', () => {
      delete process.env.GRAPH_RETRY_MAX_ATTEMPTS;

      const { graphConfig } = require('../../src/config/graph.config');

      expect(graphConfig.retryMaxAttempts).toBe(5);
    });

    it('should use custom retry max attempts when set', () => {
      process.env.GRAPH_RETRY_MAX_ATTEMPTS = '10';

      const { graphConfig } = require('../../src/config/graph.config');

      expect(graphConfig.retryMaxAttempts).toBe(10);
    });

    it('should use default retry initial delay of 1000ms when not specified', () => {
      delete process.env.GRAPH_RETRY_INITIAL_DELAY;

      const { graphConfig } = require('../../src/config/graph.config');

      expect(graphConfig.retryInitialDelay).toBe(1000);
    });

    it('should use default retry max delay of 32000ms when not specified', () => {
      delete process.env.GRAPH_RETRY_MAX_DELAY;

      const { graphConfig } = require('../../src/config/graph.config');

      expect(graphConfig.retryMaxDelay).toBe(32000);
    });
  });

  describe('graphScopes', () => {
    it('should define application-level permissions', () => {
      const { graphScopes } = require('../../src/config/graph.config');

      expect(graphScopes.application).toEqual([
        'Mail.Read',
        'Mail.Send',
        'Files.Read.All',
        'Files.ReadWrite.All',
        'Calendars.Read',
        'Calendars.ReadWrite',
      ]);
    });

    it('should define delegated user permissions', () => {
      const { graphScopes } = require('../../src/config/graph.config');

      expect(graphScopes.delegated.userRead).toEqual(['User.Read']);
      expect(graphScopes.delegated.mail).toContain('Mail.Read');
      expect(graphScopes.delegated.files).toContain('Files.ReadWrite');
      expect(graphScopes.delegated.calendar).toContain('Calendars.Read');
    });

    it('should define default scope for app-level access', () => {
      const { graphScopes } = require('../../src/config/graph.config');

      expect(graphScopes.default).toEqual(['https://graph.microsoft.com/.default']);
    });
  });

  describe('graphEndpoints', () => {
    it('should define user endpoints', () => {
      const { graphEndpoints } = require('../../src/config/graph.config');

      expect(graphEndpoints.me).toBe('/me');
      expect(graphEndpoints.users).toBe('/users');
      expect(graphEndpoints.userById('user123')).toBe('/users/user123');
    });

    it('should define mail endpoints', () => {
      const { graphEndpoints } = require('../../src/config/graph.config');

      expect(graphEndpoints.messages).toBe('/me/messages');
      expect(graphEndpoints.messageById('msg123')).toBe('/me/messages/msg123');
      expect(graphEndpoints.sendMail).toBe('/me/sendMail');
    });

    it('should define OneDrive endpoints', () => {
      const { graphEndpoints } = require('../../src/config/graph.config');

      expect(graphEndpoints.drive).toBe('/me/drive');
      expect(graphEndpoints.driveRoot).toBe('/me/drive/root');
      expect(graphEndpoints.driveItem('item123')).toBe('/me/drive/items/item123');
      expect(graphEndpoints.driveItemContent('item123')).toBe('/me/drive/items/item123/content');
    });

    it('should define calendar endpoints', () => {
      const { graphEndpoints } = require('../../src/config/graph.config');

      expect(graphEndpoints.calendar).toBe('/me/calendar');
      expect(graphEndpoints.events).toBe('/me/calendar/events');
      expect(graphEndpoints.eventById('event123')).toBe('/me/calendar/events/event123');
    });

    it('should define subscription (webhook) endpoints', () => {
      const { graphEndpoints } = require('../../src/config/graph.config');

      expect(graphEndpoints.subscriptions).toBe('/subscriptions');
      expect(graphEndpoints.subscriptionById('sub123')).toBe('/subscriptions/sub123');
    });
  });

  describe('createGraphClient', () => {
    it('should create a Graph client with provided access token', () => {
      const { createGraphClient } = require('../../src/config/graph.config');

      const accessToken = 'test-access-token-12345';
      const client = createGraphClient(accessToken);

      expect(client).toBeDefined();
      expect(typeof client.api).toBe('function');
    });

    it('should create different client instances for different tokens', () => {
      const { createGraphClient } = require('../../src/config/graph.config');

      const client1 = createGraphClient('token1');
      const client2 = createGraphClient('token2');

      expect(client1).not.toBe(client2);
    });
  });

  describe('validateGraphConfig', () => {
    it('should pass validation with valid configuration', () => {
      process.env.GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';
      process.env.GRAPH_API_TIMEOUT = '30000';
      process.env.GRAPH_RETRY_MAX_ATTEMPTS = '5';
      process.env.GRAPH_RETRY_INITIAL_DELAY = '1000';
      process.env.GRAPH_RETRY_MAX_DELAY = '32000';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when base URL is not HTTPS', () => {
      process.env.GRAPH_API_BASE_URL = 'http://graph.microsoft.com/v1.0';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GRAPH_API_BASE_URL must use HTTPS protocol');
    });

    it('should fail validation when base URL is invalid', () => {
      process.env.GRAPH_API_BASE_URL = 'not-a-valid-url';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GRAPH_API_BASE_URL must be a valid URL');
    });

    it('should warn when base URL does not point to graph.microsoft.com', () => {
      process.env.GRAPH_API_BASE_URL = 'https://example.com/api';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('does not point to graph.microsoft.com');
    });

    it('should fail validation when timeout is less than 1000ms', () => {
      process.env.GRAPH_API_TIMEOUT = '500';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GRAPH_API_TIMEOUT must be at least 1000ms (1 second)');
    });

    it('should warn when timeout exceeds 120 seconds', () => {
      process.env.GRAPH_API_TIMEOUT = '150000';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('exceeds 120 seconds');
    });

    it('should fail validation when retry max attempts is negative', () => {
      process.env.GRAPH_RETRY_MAX_ATTEMPTS = '-1';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GRAPH_RETRY_MAX_ATTEMPTS must be a non-negative integer');
    });

    it('should warn when retry max attempts exceeds 10', () => {
      process.env.GRAPH_RETRY_MAX_ATTEMPTS = '15';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('exceeds 10');
    });

    it('should fail validation when initial delay is less than 100ms', () => {
      process.env.GRAPH_RETRY_INITIAL_DELAY = '50';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GRAPH_RETRY_INITIAL_DELAY must be at least 100ms');
    });

    it('should fail validation when max delay is less than initial delay', () => {
      process.env.GRAPH_RETRY_INITIAL_DELAY = '5000';
      process.env.GRAPH_RETRY_MAX_DELAY = '2000';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'GRAPH_RETRY_MAX_DELAY must be greater than or equal to GRAPH_RETRY_INITIAL_DELAY'
      );
    });

    it('should handle multiple validation errors', () => {
      process.env.GRAPH_API_BASE_URL = 'http://invalid';
      process.env.GRAPH_API_TIMEOUT = '500';
      process.env.GRAPH_RETRY_MAX_ATTEMPTS = '-1';

      const { validateGraphConfig } = require('../../src/config/graph.config');

      const result = validateGraphConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('defaultClientOptions', () => {
    it('should use v1.0 as default version', () => {
      const { defaultClientOptions } = require('../../src/config/graph.config');

      expect(defaultClientOptions.defaultVersion).toBe('v1.0');
    });

    it('should enable debug logging in development environment', () => {
      process.env.NODE_ENV = 'development';

      const { defaultClientOptions } = require('../../src/config/graph.config');

      expect(defaultClientOptions.debugLogging).toBe(true);
    });

    it('should disable debug logging in production environment', () => {
      process.env.NODE_ENV = 'production';

      const { defaultClientOptions } = require('../../src/config/graph.config');

      expect(defaultClientOptions.debugLogging).toBe(false);
    });
  });
});
